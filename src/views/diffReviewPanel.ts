import * as vscode from 'vscode';
import type { DiffFile } from '../git/diffParser';
import type { DiffReviewState, WebviewToExtensionMessage } from '../webview/messages';
import {
  createInitialSelection,
  toggleFile,
  toggleHunk,
  toggleLine
} from '../webview/selection';

export class DiffReviewPanel {
  private panel: vscode.WebviewPanel | undefined;
  private state: DiffReviewState | undefined;

  public constructor(private readonly extensionUri: vscode.Uri) {}

  public open(state: Omit<DiffReviewState, 'selection' | 'commitMessage'>): void {
    this.state = {
      ...state,
      selection: createInitialSelection(state.files),
      commitMessage: ''
    };

    if (this.panel === undefined) {
      this.panel = vscode.window.createWebviewPanel(
        'intellijGit.diffReview',
        'Diff Review',
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          localResourceRoots: [
            vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview')
          ]
        }
      );
      this.panel.onDidDispose(() => {
        this.panel = undefined;
        this.state = undefined;
      });
      this.panel.webview.onDidReceiveMessage((message: WebviewToExtensionMessage) => {
        void this.handleMessage(message);
      });
    } else {
      this.panel.reveal(vscode.ViewColumn.One);
    }

    this.panel.title = state.title;
    this.panel.webview.html = this.renderHtml(this.panel.webview, this.state);
  }

  private async handleMessage(message: WebviewToExtensionMessage): Promise<void> {
    if (this.state === undefined) {
      return;
    }

    switch (message.type) {
      case 'toggleFile':
        this.state.selection = toggleFile(this.state.selection, this.state.files[message.fileIndex], message.selected);
        break;
      case 'toggleHunk':
        this.state.selection = toggleHunk(
          this.state.selection,
          this.state.files[message.fileIndex],
          message.hunkIndex,
          message.selected
        );
        break;
      case 'toggleLine':
        this.state.selection = toggleLine(
          this.state.selection,
          this.state.files[message.fileIndex],
          message.hunkIndex,
          message.lineIndex,
          message.selected
        );
        break;
      case 'updateCommitMessage':
        this.state.commitMessage = message.value;
        break;
      case 'openSource':
        await this.openSource(this.state.files[message.fileIndex]);
        break;
      case 'commitSelected':
        await vscode.window.showInformationMessage('Partial commit is not implemented yet.');
        break;
      case 'refresh':
        await vscode.window.showInformationMessage('Diff refresh is not implemented yet.');
        break;
      case 'close':
        this.panel?.dispose();
        break;
    }
  }

  private async openSource(file: DiffFile | undefined): Promise<void> {
    if (file === undefined || this.state?.repositoryRoot === undefined) {
      return;
    }

    const relativePath = file.newPath ?? file.oldPath;

    if (relativePath === undefined) {
      return;
    }

    const uri = vscode.Uri.joinPath(vscode.Uri.file(this.state.repositoryRoot), relativePath);
    await vscode.window.showTextDocument(uri);
  }

  private renderHtml(webview: vscode.Webview, state: DiffReviewState): string {
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', 'main.js'));
    const stylesUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', 'styles.css'));
    const nonce = createNonce();
    const serializedState = JSON.stringify(state).replace(/</g, '\\u003c');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
  <link href="${stylesUri}" rel="stylesheet">
  <title>${escapeHtml(state.title)}</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}">window.initialDiffReviewState = ${serializedState};</script>
  <script nonce="${nonce}" type="module" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function createNonce(): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let nonce = '';

  for (let index = 0; index < 32; index += 1) {
    nonce += alphabet[Math.floor(Math.random() * alphabet.length)];
  }

  return nonce;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
