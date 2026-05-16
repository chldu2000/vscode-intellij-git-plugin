import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel('IntelliJ Git');
  context.subscriptions.push(output);

  context.subscriptions.push(
    vscode.commands.registerCommand('intellijGit.refresh', async () => {
      output.appendLine('Refresh requested.');
    }),
    vscode.commands.registerCommand('intellijGit.openDiffReview', async () => {
      await vscode.window.showInformationMessage('Diff review is not implemented yet.');
    }),
    vscode.commands.registerCommand('intellijGit.commitSelected', async () => {
      await vscode.window.showInformationMessage('Commit selected changes is not implemented yet.');
    })
  );
}

export function deactivate(): void {
  // VS Code disposes registered subscriptions.
}
