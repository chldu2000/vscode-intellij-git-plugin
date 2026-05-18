import * as vscode from 'vscode';
import { ChangelistService } from './changelists/changelistService';
import { MementoChangelistStore } from './changelists/changelistStore';
import { BranchService } from './git/branchService';
import { CommitService } from './git/commitService';
import { HookService } from './git/hookService';
import { parseUnifiedDiff } from './git/diffParser';
import { GitService } from './git/gitService';
import { LogService } from './git/logService';
import { RepositoryService } from './git/repositoryService';
import { ShelfService } from './git/shelfService';
import { StashService } from './git/stashService';
import { DiffReviewPanel } from './views/diffReviewPanel';
import { BranchTreeProvider } from './views/branchTreeProvider';
import type { BranchTreeNode } from './views/branchTreeModel';
import { ChangelistSelectionStore } from './views/changelistSelectionStore';
import { ChangelistTreeProvider } from './views/changelistTreeProvider';
import type { ChangelistTreeNode, FileNode } from './views/changelistTreeModel';
import { LogViewProvider } from './views/logViewProvider';
import type { LogTreeNode } from './views/logTreeModel';

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel('IntelliJ Git');
  const gitPath = vscode.workspace.getConfiguration('intellijGit').get<string>('gitPath', 'git');
  const git = new GitService(gitPath);
  const repositories = new RepositoryService(git);
  const branches = new BranchService(git);
  const hooks = new HookService(git, (line) => output.appendLine(line));
  const commits = new CommitService(git, hooks);
  const logs = new LogService(git);
  const stashes = new StashService(git);
  const shelves = new ShelfService(git, context.globalStorageUri.fsPath);
  const changelists = new ChangelistService(new MementoChangelistStore(context.workspaceState));
  const changelistSelection = new ChangelistSelectionStore();
  const treeProvider = new ChangelistTreeProvider(
    repositories,
    changelists,
    changelistSelection,
    () => vscode.workspace.workspaceFolders
  );
  const logProvider = new LogViewProvider(
    repositories,
    logs,
    () => vscode.workspace.workspaceFolders
  );
  const branchProvider = new BranchTreeProvider(
    repositories,
    branches,
    () => vscode.workspace.workspaceFolders
  );
  const diffReviewPanel = new DiffReviewPanel(
    context.extensionUri,
    commits,
    async () => treeProvider.refresh(),
    output
  );
  const changelistTreeView = vscode.window.createTreeView('intellijGit.changelists', {
    treeDataProvider: treeProvider,
    canSelectMany: true
  });

  context.subscriptions.push(output);
  context.subscriptions.push(changelistTreeView);
  context.subscriptions.push(changelistTreeView.onDidChangeCheckboxState((event) => {
    treeProvider.handleCheckboxChange(event);
  }));
  context.subscriptions.push(vscode.window.registerTreeDataProvider('intellijGit.log', logProvider));
  context.subscriptions.push(vscode.window.registerTreeDataProvider('intellijGit.branches', branchProvider));

  context.subscriptions.push(
    vscode.commands.registerCommand('intellijGit.refresh', async () => {
      output.appendLine('Refresh requested.');
      await treeProvider.refresh();
    }),
    vscode.commands.registerCommand('intellijGit.openDiffReview', async (node?: ChangelistTreeNode) => {
      const target = await resolveDiffTarget(node, repositories, changelistSelection);

      if (target === undefined) {
        await vscode.window.showInformationMessage('No Git repository found for diff review.');
        return;
      }

      const loadState = async () => loadDiffReviewState(git, target);
      const state = await loadState();

      diffReviewPanel.open(state, loadState, target.selectedPaths);
    }),
    vscode.commands.registerCommand('intellijGit.commitSelected', async () => {
      const target = await resolveDiffTarget(undefined, repositories, changelistSelection);

      if (target === undefined || target.selectedPaths.length === 0) {
        await vscode.window.showInformationMessage('Select one or more files in Changelists before committing.');
        return;
      }

      const loadState = async () => loadDiffReviewState(git, target);
      const state = await loadState();
      diffReviewPanel.open(state, loadState, target.selectedPaths);
    }),
    vscode.commands.registerCommand('intellijGit.createChangelist', async (node?: ChangelistTreeNode) => {
      const repositoryRoot = await resolveRepositoryRoot(node, repositories);

      if (repositoryRoot === undefined) {
        await vscode.window.showInformationMessage('No Git repository found.');
        return;
      }

      const name = await promptForChangelistName(changelists, repositoryRoot, 'New changelist name');

      if (name === undefined) {
        return;
      }

      await changelists.create(repositoryRoot, name);
      await treeProvider.refresh();
      await vscode.window.showInformationMessage(`Created changelist ${name}.`);
    }),
    vscode.commands.registerCommand('intellijGit.renameChangelist', async (node?: ChangelistTreeNode) => {
      if (node?.kind !== 'group' || node.groupType !== 'changelist') {
        return;
      }

      const name = await promptForChangelistName(
        changelists,
        node.repositoryRoot,
        'Rename changelist',
        node.label,
        node.groupId
      );

      if (name === undefined) {
        return;
      }

      await changelists.rename(node.repositoryRoot, node.groupId, name);
      await treeProvider.refresh();
      await vscode.window.showInformationMessage(`Renamed changelist to ${name}.`);
    }),
    vscode.commands.registerCommand('intellijGit.deleteChangelist', async (node?: ChangelistTreeNode) => {
      if (node?.kind !== 'group' || node.groupType !== 'changelist') {
        return;
      }

      if (node.groupId === 'default') {
        await vscode.window.showInformationMessage('The default changelist cannot be deleted.');
        return;
      }

      const confirmed = await vscode.window.showWarningMessage(
        `Delete changelist "${node.label}"? Its files will move back to Changes.`,
        { modal: true },
        'Delete'
      );

      if (confirmed !== 'Delete') {
        return;
      }

      await changelists.delete(node.repositoryRoot, node.groupId);
      await treeProvider.refresh();
      await vscode.window.showInformationMessage(`Deleted changelist ${node.label}.`);
    }),
    vscode.commands.registerCommand('intellijGit.setActiveChangelist', async (node?: ChangelistTreeNode) => {
      if (node?.kind !== 'group' || node.groupType !== 'changelist') {
        return;
      }

      await changelists.setActive(node.repositoryRoot, node.groupId);
      await treeProvider.refresh();
      await vscode.window.showInformationMessage(`Set ${node.label} as active changelist.`);
    }),
    vscode.commands.registerCommand('intellijGit.moveFilesToChangelist', async (node?: ChangelistTreeNode) => {
      const paths = selectedMovePaths(node, changelistTreeView.selection);
      const repositoryRoot = moveRepositoryRoot(node, changelistTreeView.selection);

      if (repositoryRoot === undefined || paths.length === 0) {
        await vscode.window.showInformationMessage('Select one or more changed files to move.');
        return;
      }

      const destination = await pickChangelist(changelists, repositoryRoot, 'Move files to changelist');

      if (destination === undefined) {
        return;
      }

      await changelists.moveFiles(repositoryRoot, destination.id, paths);
      await treeProvider.refresh();
      await vscode.window.showInformationMessage(
        `Moved ${paths.length} file${paths.length === 1 ? '' : 's'} to ${destination.name}.`
      );
    }),
    vscode.commands.registerCommand('intellijGit.refreshLog', async () => {
      output.appendLine('Log refresh requested.');
      await logProvider.refresh();
    }),
    vscode.commands.registerCommand('intellijGit.openCommitDiff', async (node?: LogTreeNode) => {
      if (node === undefined || node.kind === 'repository') {
        return;
      }

      const paths = node.kind === 'file' ? [node.path] : [];
      const diff = await git.exec(node.repositoryRoot, [
        'show',
        '--format=',
        '--find-renames',
        node.hash,
        '--',
        ...paths
      ]);
      diffReviewPanel.open({
        title: node.kind === 'file' ? `Commit Diff: ${node.path}` : `Commit Diff: ${node.hash.slice(0, 12)}`,
        repositoryRoot: node.repositoryRoot,
        files: parseUnifiedDiff(diff.stdout)
      });
    }),
    vscode.commands.registerCommand('intellijGit.copyCommitHash', async (node?: LogTreeNode) => {
      if (node === undefined || node.kind === 'repository') {
        return;
      }

      await vscode.env.clipboard.writeText(node.hash);
      await vscode.window.showInformationMessage(`Copied ${node.hash.slice(0, 12)}`);
    }),
    vscode.commands.registerCommand('intellijGit.refreshBranches', async () => {
      output.appendLine('Branch refresh requested.');
      await branchProvider.refresh();
    }),
    vscode.commands.registerCommand('intellijGit.checkoutBranch', async (node?: BranchTreeNode) => {
      await checkoutBranch(node, branches, branchProvider, treeProvider, output, false);
    }),
    vscode.commands.registerCommand('intellijGit.forceCheckoutBranch', async (node?: BranchTreeNode) => {
      await checkoutBranch(node, branches, branchProvider, treeProvider, output, true);
    }),
    vscode.commands.registerCommand('intellijGit.stashChanges', async () => {
      const repositoryRoot = await firstRepositoryRoot(repositories);
      if (repositoryRoot === undefined) {
        await vscode.window.showInformationMessage('No Git repository found.');
        return;
      }

      const message = await vscode.window.showInputBox({
        prompt: 'Stash message',
        value: 'IntelliJ Git local changes'
      });

      if (message === undefined) {
        return;
      }

      await stashes.create(repositoryRoot, message);
      await treeProvider.refresh();
      await vscode.window.showInformationMessage('Stashed local changes.');
    }),
    vscode.commands.registerCommand('intellijGit.listStashes', async () => {
      const repositoryRoot = await firstRepositoryRoot(repositories);
      if (repositoryRoot === undefined) {
        await vscode.window.showInformationMessage('No Git repository found.');
        return;
      }

      const items = await stashes.list(repositoryRoot);
      await vscode.window.showQuickPick(
        items.map((stash) => ({
          label: stash.ref,
          description: stash.hash.slice(0, 12),
          detail: stash.message
        })),
        { placeHolder: 'Git stashes' }
      );
    }),
    vscode.commands.registerCommand('intellijGit.createShelf', async () => {
      const repositoryRoot = await firstRepositoryRoot(repositories);
      if (repositoryRoot === undefined) {
        await vscode.window.showInformationMessage('No Git repository found.');
        return;
      }

      const name = await vscode.window.showInputBox({
        prompt: 'Shelf name',
        value: 'Local shelf'
      });

      if (name === undefined) {
        return;
      }

      const shelf = await shelves.create(repositoryRoot, name);
      await vscode.window.showInformationMessage(`Created shelf ${shelf.name}`);
    }),
    vscode.commands.registerCommand('intellijGit.listShelves', async () => {
      const repositoryRoot = await firstRepositoryRoot(repositories);
      if (repositoryRoot === undefined) {
        await vscode.window.showInformationMessage('No Git repository found.');
        return;
      }

      const items = await shelves.list(repositoryRoot);
      await vscode.window.showQuickPick(
        items.map((shelf) => ({
          label: shelf.name,
          description: new Date(shelf.createdAt).toLocaleString(),
          detail: shelf.patchPath
        })),
        { placeHolder: 'Shelves' }
      );
    })
  );

  void treeProvider.refresh().catch((error: unknown) => {
    output.appendLine(error instanceof Error ? error.message : String(error));
  });
  void logProvider.refresh().catch((error: unknown) => {
    output.appendLine(error instanceof Error ? error.message : String(error));
  });
  void branchProvider.refresh().catch((error: unknown) => {
    output.appendLine(error instanceof Error ? error.message : String(error));
  });
}

async function firstRepositoryRoot(repositories: RepositoryService): Promise<string | undefined> {
  const workspaceFolders = vscode.workspace.workspaceFolders ?? [];
  const discovered = await repositories.discover(workspaceFolders.map((folder) => folder.uri.fsPath));
  return discovered[0]?.root;
}

async function resolveRepositoryRoot(
  node: ChangelistTreeNode | undefined,
  repositories: RepositoryService
): Promise<string | undefined> {
  if (node !== undefined) {
    return node.repositoryRoot;
  }

  return firstRepositoryRoot(repositories);
}

async function promptForChangelistName(
  changelists: ChangelistService,
  repositoryRoot: string,
  prompt: string,
  value = '',
  currentId?: string
): Promise<string | undefined> {
  const state = await changelists.getState(repositoryRoot);

  return vscode.window.showInputBox({
    prompt,
    value,
    validateInput: (input) => {
      const normalized = input.trim().toLowerCase();

      if (normalized.length === 0) {
        return 'Changelist name is required.';
      }

      const duplicate = state.changelists.some((changelist) => (
        changelist.id !== currentId && changelist.name.trim().toLowerCase() === normalized
      ));

      return duplicate ? `Changelist already exists: ${input}` : undefined;
    }
  });
}

async function pickChangelist(
  changelists: ChangelistService,
  repositoryRoot: string,
  placeHolder: string
): Promise<{ id: string; name: string } | undefined> {
  const state = await changelists.getState(repositoryRoot);
  const picked = await vscode.window.showQuickPick(
    state.changelists.map((changelist) => ({
      label: changelist.name,
      description: changelist.active ? 'active' : undefined,
      id: changelist.id,
      name: changelist.name
    })),
    { placeHolder }
  );

  if (picked === undefined) {
    return undefined;
  }

  return {
    id: picked.id,
    name: picked.name
  };
}

function selectedMovePaths(
  node: ChangelistTreeNode | undefined,
  selection: readonly ChangelistTreeNode[]
): string[] {
  const selectedFiles = selection.filter((candidate) => candidate.kind === 'file' && isMovableFile(candidate));

  if (node?.kind === 'file' && isMovableFile(node)) {
    const sameRepositorySelection = selectedFiles.filter((candidate) => candidate.repositoryRoot === node.repositoryRoot);

    if (sameRepositorySelection.some((candidate) => candidate.path === node.path)) {
      return uniquePaths(sameRepositorySelection.map((candidate) => candidate.path));
    }

    return [node.path];
  }

  if (node?.kind === 'group' && node.groupType === 'changelist') {
    return uniquePaths(node.children.filter(isMovableFile).map((child) => child.path));
  }

  if (node === undefined && selectedFiles.length > 0) {
    const repositoryRoot = selectedFiles[0]?.repositoryRoot;
    return uniquePaths(
      selectedFiles
        .filter((candidate) => candidate.repositoryRoot === repositoryRoot)
        .map((candidate) => candidate.path)
    );
  }

  return [];
}

function moveRepositoryRoot(
  node: ChangelistTreeNode | undefined,
  selection: readonly ChangelistTreeNode[]
): string | undefined {
  if (node !== undefined) {
    return node.repositoryRoot;
  }

  return selection.find((candidate) => candidate.kind === 'file' && isMovableFile(candidate))?.repositoryRoot;
}

function isMovableFile(node: ChangelistTreeNode): node is FileNode {
  return node.kind === 'file' && node.groupType === 'changelist';
}

function uniquePaths(paths: string[]): string[] {
  return [...new Set(paths)];
}

async function loadDiffReviewState(
  git: GitService,
  target: { repositoryRoot: string; paths: string[] }
) {
  const args = target.paths.length > 0 ? ['diff', '--', ...target.paths] : ['diff'];
  const diff = await git.exec(target.repositoryRoot, args);

  return {
    title: target.paths.length === 1 ? `Diff: ${target.paths[0]}` : 'Diff Review',
    repositoryRoot: target.repositoryRoot,
    files: parseUnifiedDiff(diff.stdout)
  };
}

export function deactivate(): void {
  // VS Code disposes registered subscriptions.
}

async function resolveDiffTarget(
  node: ChangelistTreeNode | undefined,
  repositories: RepositoryService,
  changelistSelection: ChangelistSelectionStore
): Promise<{ repositoryRoot: string; paths: string[]; selectedPaths: string[] } | undefined> {
  if (node?.kind === 'file') {
    return {
      repositoryRoot: node.repositoryRoot,
      paths: [node.path],
      selectedPaths: changelistSelection.isSelected(node.repositoryRoot, node.path) ? [node.path] : []
    };
  }

  if (node?.kind === 'group') {
    const paths = node.children.map((child) => child.path);

    return {
      repositoryRoot: node.repositoryRoot,
      paths,
      selectedPaths: changelistSelection.selectedPaths(node.repositoryRoot).filter((path) => paths.includes(path))
    };
  }

  const workspaceFolders = vscode.workspace.workspaceFolders ?? [];
  const discovered = await repositories.discover(workspaceFolders.map((folder) => folder.uri.fsPath));
  const repository = discovered.find((candidate) => changelistSelection.selectedPaths(candidate.root).length > 0)
    ?? discovered[0];

  if (repository === undefined) {
    return undefined;
  }

  const selectedPaths = changelistSelection.selectedPaths(repository.root);

  return {
    repositoryRoot: repository.root,
    paths: selectedPaths.length > 0 ? selectedPaths : [],
    selectedPaths
  };
}

async function checkoutBranch(
  node: BranchTreeNode | undefined,
  branches: BranchService,
  branchProvider: BranchTreeProvider,
  changelistProvider: ChangelistTreeProvider,
  output: vscode.OutputChannel,
  force: boolean
): Promise<void> {
  if (node === undefined || node.kind !== 'branch' || node.current) {
    return;
  }

  try {
    await branches.checkout(node.repositoryRoot, node.branchName, { strategy: force ? 'force' : 'safe' });
    await branchProvider.refresh();
    await changelistProvider.refresh();
    await vscode.window.showInformationMessage(`Checked out ${node.branchName}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    output.appendLine(message);

    if (!force) {
      const forceLabel = 'Force Checkout';
      const chosen = await vscode.window.showErrorMessage(message, forceLabel);

      if (chosen === forceLabel) {
        await checkoutBranch(node, branches, branchProvider, changelistProvider, output, true);
      }
      return;
    }

    await vscode.window.showErrorMessage(message);
  }
}
