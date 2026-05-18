import type { DiffFile } from '../../git/diffParser';
import { buildSplitDiffRows, type SplitDiffCell } from '../diffRows';
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
  viewMode: 'split' | 'unified';
  onToggleHunk(fileIndex: number, hunkIndex: number, selected: boolean): void;
  onToggleLine(fileIndex: number, hunkIndex: number, lineIndex: number, selected: boolean): void;
}

export function DiffPane({
  file,
  fileIndex,
  selection,
  viewMode,
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

            {viewMode === 'split' ? (
              <div className="splitLines" role="table">
                {buildSplitDiffRows(hunk).map((row, rowIndex) => (
                  <div className={`splitRow ${row.kind}`} key={`${hunk.header}:${rowIndex}`}>
                    <SplitCell
                      cell={row.old}
                      file={file}
                      fileIndex={fileIndex}
                      hunkIndex={hunkIndex}
                      side="old"
                      selection={selection}
                      onToggleLine={onToggleLine}
                    />
                    <SplitCell
                      cell={row.new}
                      file={file}
                      fileIndex={fileIndex}
                      hunkIndex={hunkIndex}
                      side="new"
                      selection={selection}
                      onToggleLine={onToggleLine}
                    />
                  </div>
                ))}
              </div>
            ) : (
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
            )}
          </section>
        );
      })}
    </main>
  );
}

interface SplitCellProps {
  cell: SplitDiffCell | undefined;
  file: DiffFile;
  fileIndex: number;
  hunkIndex: number;
  side: 'old' | 'new';
  selection: DiffSelection;
  onToggleLine(fileIndex: number, hunkIndex: number, lineIndex: number, selected: boolean): void;
}

function SplitCell({
  cell,
  file,
  fileIndex,
  hunkIndex,
  side,
  selection,
  onToggleLine
}: SplitCellProps) {
  if (cell === undefined) {
    return <div className={`splitCell empty ${side}`} />;
  }

  const selectable = cell.type !== 'context';

  return (
    <label className={`splitCell ${side} ${cell.type}`}>
      <span className="lineSelect">
        {selectable ? (
          <input
            aria-label={`Select ${side} line ${cell.lineIndex + 1}`}
            checked={isLineSelected(selection, file, hunkIndex, cell.lineIndex)}
            type="checkbox"
            onChange={(event) => onToggleLine(
              fileIndex,
              hunkIndex,
              cell.lineIndex,
              event.currentTarget.checked
            )}
          />
        ) : null}
      </span>
      <span className="lineNo">{cell.lineNumber ?? ''}</span>
      <code>{cell.content}</code>
    </label>
  );
}
