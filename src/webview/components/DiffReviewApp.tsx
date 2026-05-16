import { useMemo, useState } from 'preact/hooks';
import type { DiffReviewState } from '../messages';
import { getVsCodeApi } from '../vscodeApi';
import { DiffPane } from './DiffPane';
import { FileNavigator } from './FileNavigator';
import {
  getSelectedSummary,
  toggleFile,
  toggleHunk,
  toggleLine
} from '../selection';

interface DiffReviewAppProps {
  initialState: DiffReviewState;
}

export function DiffReviewApp({ initialState }: DiffReviewAppProps) {
  const vscode = getVsCodeApi();
  const [state, setState] = useState(initialState);
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const selectedSummary = useMemo(() => getSelectedSummary(state.selection), [state.selection]);

  const updateState = (nextState: DiffReviewState): void => {
    setState(nextState);
    vscode.setState(nextState);
  };

  return (
    <div className="appShell">
      <header className="toolbar">
        <div>
          <h1>{state.title}</h1>
          <span className="summary">
            {selectedSummary.files} files, {selectedSummary.hunks} hunks, {selectedSummary.lines} lines selected
          </span>
        </div>
        <div className="toolbarActions">
          <button type="button" onClick={() => vscode.postMessage({ type: 'refresh' })}>Refresh</button>
          <button
            disabled={selectedSummary.lines === 0 || state.commitMessage.trim().length === 0}
            type="button"
            onClick={() => vscode.postMessage({ type: 'commitSelected' })}
          >
            Commit
          </button>
        </div>
      </header>

      <div className="commitBar">
        <textarea
          aria-label="Commit message"
          placeholder="Commit message"
          value={state.commitMessage}
          onInput={(event) => {
            const value = event.currentTarget.value;
            updateState({ ...state, commitMessage: value });
            vscode.postMessage({ type: 'updateCommitMessage', value });
          }}
        />
      </div>

      <div className="reviewLayout">
        <FileNavigator
          activeFileIndex={activeFileIndex}
          files={state.files}
          selection={state.selection}
          onSelectFile={setActiveFileIndex}
          onToggleFile={(fileIndex, selected) => {
            const file = state.files[fileIndex];
            const selection = toggleFile(state.selection, file, selected);
            updateState({ ...state, selection });
            vscode.postMessage({ type: 'toggleFile', fileIndex, selected });
          }}
        />
        <DiffPane
          file={state.files[activeFileIndex]}
          fileIndex={activeFileIndex}
          selection={state.selection}
          onToggleHunk={(fileIndex, hunkIndex, selected) => {
            const file = state.files[fileIndex];
            const selection = toggleHunk(state.selection, file, hunkIndex, selected);
            updateState({ ...state, selection });
            vscode.postMessage({ type: 'toggleHunk', fileIndex, hunkIndex, selected });
          }}
          onToggleLine={(fileIndex, hunkIndex, lineIndex, selected) => {
            const file = state.files[fileIndex];
            const selection = toggleLine(state.selection, file, hunkIndex, lineIndex, selected);
            updateState({ ...state, selection });
            vscode.postMessage({ type: 'toggleLine', fileIndex, hunkIndex, lineIndex, selected });
          }}
        />
      </div>
    </div>
  );
}
