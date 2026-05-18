import * as vscode from 'vscode';
import type { CommitService } from '../git/commitService';
import { invalidateStaleSelections } from '../git/diffIdentity';
import type { DiffFile } from '../git/diffParser';
import type { DiffReviewState, WebviewToExtensionMessage } from '../webview/messages';
import { canCommitSelectedChanges } from '../shared/commitValidation';
import {
  createInitialSelection,
  createSelectionForFiles,
  getSelectedSummary,
  toggleFile,
  toggleHunk,
  toggleLine
} from '../shared/selection';

type DiffReviewPanelInput = Omit<DiffReviewState, 'selection' | 'commitMessage' | 'commitOptions'>;
type DiffReviewReload = () => Promise<DiffReviewPanelInput>;

export class DiffReviewPanel {
  private panel: vscode.WebviewPanel | undefined;
  private state: DiffReviewState | undefined;
  private reload: DiffReviewReload | undefined;

  public constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly commits: CommitService,
    private readonly onDidCommit: () => Promise<void>,
    private readonly output: vscode.OutputChannel
  ) {}

  public open(state: DiffReviewPanelInput, reload?: DiffReviewReload, selectedPaths: readonly string[] = []): void {
    this.state = {
      ...state,
      selection: selectedPaths.length > 0
        ? createSelectionForFiles(state.files, selectedPaths)
        : createInitialSelection(state.files),
      commitMessage: '',
      commitOptions: {
        amend: false,
        signOff: false,
        push: false,
        authorName: '',
        authorEmail: ''
      }
    };
    this.reload = reload;

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
      case 'updateCommitOptions':
        this.state.commitOptions = message.value;
        break;
      case 'openSource':
        await this.openSource(this.state.files[message.fileIndex]);
        break;
      case 'commitSelected':
        await this.commitSelected();
        break;
      case 'refresh':
        await this.reloadDiff();
        break;
      case 'close':
        this.panel?.dispose();
        break;
    }
  }

  private async commitSelected(): Promise<void> {
    if (this.state?.repositoryRoot === undefined) {
      await vscode.window.showErrorMessage('No repository is available for this diff review.');
      return;
    }

    if (!canCommitSelectedChanges(getSelectedSummary(this.state.selection), this.state.commitMessage)) {
      await vscode.window.showErrorMessage('Select changes and enter a commit message before committing.');
      return;
    }

    try {
      if (await this.invalidateStaleSelectionsBeforeCommit()) {
        return;
      }

      const commit = await this.commits.commitSelected(
        this.state.repositoryRoot,
        this.state.files,
        this.state.selection,
        {
          message: this.state.commitMessage
          ,
          amend: this.state.commitOptions.amend,
          signOff: this.state.commitOptions.signOff,
          push: this.state.commitOptions.push,
          author: this.authorOverride()
        }
      );
      this.output.appendLine(`Committed selected changes: ${commit}`);
      await this.onDidCommit();
      await vscode.window.showInformationMessage(`Committed selected changes: ${commit.slice(0, 12)}`);
      await this.reloadDiff();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.output.appendLine(message);
      await vscode.window.showErrorMessage(message);
    }
  }

  private async reloadDiff(): Promise<void> {
    if (this.reload === undefined || this.panel === undefined) {
      return;
    }

    const next = await this.reload();
    this.state = {
      ...next,
      selection: createInitialSelection(next.files),
      commitMessage: '',
      commitOptions: {
        amend: false,
        signOff: false,
        push: false,
        authorName: '',
        authorEmail: ''
      }
    };
    this.panel.title = next.title;
    this.panel.webview.html = this.renderHtml(this.panel.webview, this.state);
  }

  private async invalidateStaleSelectionsBeforeCommit(): Promise<boolean> {
    if (this.reload === undefined || this.state === undefined || this.panel === undefined) {
      return false;
    }

    const current = await this.reload();
    const result = invalidateStaleSelections(this.state.files, current.files, this.state.selection);

    if (result.stale.length === 0) {
      this.state = {
        ...this.state,
        files: current.files,
        selection: result.selection
      };
      return false;
    }

    this.state = {
      ...current,
      selection: result.selection,
      commitMessage: this.state.commitMessage,
      commitOptions: this.state.commitOptions
    };
    this.panel.webview.html = this.renderHtml(this.panel.webview, this.state);
    await vscode.window.showWarningMessage('Some selected changes changed on disk. Review the refreshed diff and select them again.');
    return true;
  }

  private authorOverride(): { name: string; email: string } | undefined {
    const name = this.state?.commitOptions.authorName.trim() ?? '';
    const email = this.state?.commitOptions.authorEmail.trim() ?? '';

    if (name.length === 0 && email.length === 0) {
      return undefined;
    }

    if (name.length === 0 || email.length === 0) {
      throw new Error('Author override requires both name and email.');
    }

    return { name, email };
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
