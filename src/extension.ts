import * as vscode from 'vscode';
import { ChangelistService } from './changelists/changelistService';
import { MementoChangelistStore } from './changelists/changelistStore';
import { GitService } from './git/gitService';
import { RepositoryService } from './git/repositoryService';
import { ChangelistTreeProvider } from './views/changelistTreeProvider';

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel('IntelliJ Git');
  const gitPath = vscode.workspace.getConfiguration('intellijGit').get<string>('gitPath', 'git');
  const git = new GitService(gitPath);
  const repositories = new RepositoryService(git);
  const changelists = new ChangelistService(new MementoChangelistStore(context.workspaceState));
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
    vscode.commands.registerCommand('intellijGit.openDiffReview', async () => {
      await vscode.window.showInformationMessage('Diff review is not implemented yet.');
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
