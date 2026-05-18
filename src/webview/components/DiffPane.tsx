import type { DiffFile } from '../../git/diffParser';
import {
  fileKey,
  getHunkSelectionState,
  isLineSelected,
  type DiffSelection
} from '../../shared/selection';

interface DiffPaneProps {
  file: DiffFile | undefined;
  fileIndex: number;
  selection: DiffSelection;
  onToggleHunk(fileIndex: number, hunkIndex: number, selected: boolean): void;
  onToggleLine(fileIndex: number, hunkIndex: number, lineIndex: number, selected: boolean): void;
}

export function DiffPane({
  file,
  fileIndex,
  selection,
  onToggleHunk,
  onToggleLine
}: DiffPaneProps) {
  if (file === undefined) {
    return <main className="diffPane empty">No changes</main>;
  }

  if (file.binary) {
    return (
      <main className="diffPane">
        <h2>{fileKey(file)}</h2>
        <p className="binaryNotice">Binary file changed.</p>
      </main>
    );
  }

  return (
    <main className="diffPane" aria-label={`Diff for ${fileKey(file)}`}>
      <div className="diffTitle">
        <h2>{fileKey(file)}</h2>
        <span>{file.changeType}</span>
      </div>

      {file.hunks.map((hunk, hunkIndex) => {
        const hunkState = getHunkSelectionState(selection, file, hunkIndex);

        return (
          <section className="hunk" key={`${hunk.header}:${hunkIndex}`}>
            <header className="hunkHeader">
              <input
                aria-label={`Select hunk ${hunkIndex + 1}`}
                checked={hunkState === 'selected'}
                data-indeterminate={hunkState === 'partial' ? 'true' : 'false'}
                type="checkbox"
                onChange={(event) => onToggleHunk(fileIndex, hunkIndex, event.currentTarget.checked)}
              />
              <code>{hunk.header}</code>
            </header>

            <div className="hunkLines" role="table">
              {hunk.lines.map((line, lineIndex) => {
                const selectable = line.type !== 'context';

                return (
                  <label className={`diffLine ${line.type}`} key={`${line.type}:${lineIndex}`}>
                    <span className="lineSelect">
                      {selectable ? (
                        <input
                          aria-label={`Select line ${lineIndex + 1}`}
                          checked={isLineSelected(selection, file, hunkIndex, lineIndex)}
                          type="checkbox"
                          onChange={(event) => onToggleLine(
                            fileIndex,
                            hunkIndex,
                            lineIndex,
                            event.currentTarget.checked
                          )}
                        />
                      ) : null}
                    </span>
                    <span className="lineNo">{line.oldLine ?? ''}</span>
                    <span className="lineNo">{line.newLine ?? ''}</span>
                    <code>{line.content}</code>
                  </label>
                );
              })}
            </div>
          </section>
        );
      })}
    </main>
  );
}
