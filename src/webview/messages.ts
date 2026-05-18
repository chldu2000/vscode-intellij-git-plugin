import type { DiffFile } from '../git/diffParser';
import type { DiffSelection } from '../shared/selection';

export interface DiffReviewState {
  title: string;
  repositoryRoot?: string;
  files: DiffFile[];
  selection: DiffSelection;
  commitMessage: string;
  commitOptions: DiffReviewCommitOptions;
}

export interface DiffReviewCommitOptions {
  amend: boolean;
  signOff: boolean;
  push: boolean;
  authorName: string;
  authorEmail: string;
}

export type ExtensionToWebviewMessage =
  | {
      type: 'initialState';
      state: DiffReviewState;
    };

export type WebviewToExtensionMessage =
  | {
      type: 'toggleFile';
      fileIndex: number;
      selected: boolean;
    }
  | {
      type: 'toggleHunk';
      fileIndex: number;
      hunkIndex: number;
      selected: boolean;
    }
  | {
      type: 'toggleLine';
      fileIndex: number;
      hunkIndex: number;
      lineIndex: number;
      selected: boolean;
    }
  | {
      type: 'updateCommitMessage';
      value: string;
    }
  | {
      type: 'updateCommitOptions';
      value: DiffReviewCommitOptions;
    }
  | {
      type: 'refresh';
    }
  | {
      type: 'commitSelected';
    }
  | {
      type: 'openSource';
      fileIndex: number;
    }
  | {
      type: 'close';
    };
