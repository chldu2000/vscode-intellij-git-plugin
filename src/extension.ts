import * as vscode from 'vscode';
import { ChangelistService } from './changelists/changelistService';
import { MementoChangelistStore } from './changelists/changelistStore';
import { parseUnifiedDiff } from './git/diffParser';
import { GitService } from './git/gitService';
import { RepositoryService } from './git/repositoryService';
import { DiffReviewPanel } from './views/diffReviewPanel';
import { ChangelistTreeProvider } from './views/changelistTreeProvider';
import type { ChangelistTreeNode } from './views/changelistTreeModel';

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel('IntelliJ Git');
  const gitPath = vscode.workspace.getConfiguration('intellijGit').get<string>('gitPath', 'git');
  const git = new GitService(gitPath);
  const repositories = new RepositoryService(git);
  const changelists = new ChangelistService(new MementoChangelistStore(context.workspaceState));
  const diffReviewPanel = new DiffReviewPanel(context.extensionUri);
  const treeProvider = new ChangelistTreeProvider(
    repositories,
    changelists,
    () => vscode.workspace.workspaceFolders
  );

  context.subscriptions.push(output);
  context.subscriptions.push(vscode.window.registerTreeDataProvider('intellijGit.changelists', treeProvider));

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

      const args = target.paths.length > 0 ? ['diff', '--', ...target.paths] : ['diff'];
      const diff = await git.exec(target.repositoryRoot, args);
      const files = parseUnifiedDiff(diff.stdout);

      diffReviewPanel.open({
        title: target.paths.length === 1 ? `Diff: ${target.paths[0]}` : 'Diff Review',
        repositoryRoot: target.repositoryRoot,
        files
      });
    }),
    vscode.commands.registerCommand('intellijGit.commitSelected', async () => {
      await vscode.window.showInformationMessage('Commit selected changes is not implemented yet.');
    })
  );

  void treeProvider.refresh().catch((error: unknown) => {
    output.appendLine(error instanceof Error ? error.message : String(error));
  });
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
