import * as vscode from 'vscode';
import { ChangelistService } from './changelists/changelistService';
import { MementoChangelistStore } from './changelists/changelistStore';
import { BranchService } from './git/branchService';
import { CommitService } from './git/commitService';
import { parseUnifiedDiff } from './git/diffParser';
import { GitService } from './git/gitService';
import { LogService } from './git/logService';
import { RepositoryService } from './git/repositoryService';
import { ShelfService } from './git/shelfService';
import { StashService } from './git/stashService';
import { DiffReviewPanel } from './views/diffReviewPanel';
import { BranchTreeProvider } from './views/branchTreeProvider';
import type { BranchTreeNode } from './views/branchTreeModel';
import { ChangelistTreeProvider } from './views/changelistTreeProvider';
import type { ChangelistTreeNode } from './views/changelistTreeModel';
import { LogViewProvider } from './views/logViewProvider';
import type { LogTreeNode } from './views/logTreeModel';

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel('IntelliJ Git');
  const gitPath = vscode.workspace.getConfiguration('intellijGit').get<string>('gitPath', 'git');
  const git = new GitService(gitPath);
  const repositories = new RepositoryService(git);
  const branches = new BranchService(git);
  const commits = new CommitService(git);
  const logs = new LogService(git);
  const stashes = new StashService(git);
  const shelves = new ShelfService(git, context.globalStorageUri.fsPath);
  const changelists = new ChangelistService(new MementoChangelistStore(context.workspaceState));
  const treeProvider = new ChangelistTreeProvider(
    repositories,
    changelists,
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

  context.subscriptions.push(output);
  context.subscriptions.push(vscode.window.registerTreeDataProvider('intellijGit.changelists', treeProvider));
  context.subscriptions.push(vscode.window.registerTreeDataProvider('intellijGit.log', logProvider));
  context.subscriptions.push(vscode.window.registerTreeDataProvider('intellijGit.branches', branchProvider));

  context.subscriptions.push(
    vscode.commands.registerCommand('intellijGit.refresh', async () => {
      output.appendLine('Refresh requested.');
      await treeProvider.refresh();
    }),
    vscode.commands.registerCommand('intellijGit.openDiffReview', async (node?: ChangelistTreeNode) => {
      const target = await resolveDiffTarget(node, repositories);

      if (target === undefined) {
        await vscode.window.showInformationMessage('No Git repository found for diff review.');
        return;
      }

      const loadState = async () => loadDiffReviewState(git, target);
      const state = await loadState();

      diffReviewPanel.open(state, loadState);
    }),
    vscode.commands.registerCommand('intellijGit.commitSelected', async () => {
      await vscode.window.showInformationMessage('Commit selected changes is not implemented yet.');
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
  repositories: RepositoryService
): Promise<{ repositoryRoot: string; paths: string[] } | undefined> {
  if (node?.kind === 'file') {
    return {
      repositoryRoot: node.repositoryRoot,
      paths: [node.path]
    };
  }

  if (node?.kind === 'group') {
    return {
      repositoryRoot: node.repositoryRoot,
      paths: node.children.map((child) => child.path)
    };
  }

  const workspaceFolders = vscode.workspace.workspaceFolders ?? [];
  const discovered = await repositories.discover(workspaceFolders.map((folder) => folder.uri.fsPath));
  const repository = discovered[0];

  if (repository === undefined) {
    return undefined;
  }

  return {
    repositoryRoot: repository.root,
    paths: []
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
