import type { DiffFile } from '../../git/diffParser';
import { fileKey, getHunkSelectionState, type DiffSelection } from '../../shared/selection';

interface FileNavigatorProps {
  files: DiffFile[];
  activeFileIndex: number;
  selection: DiffSelection;
  onSelectFile(fileIndex: number): void;
  onToggleFile(fileIndex: number, selected: boolean): void;
}

export function FileNavigator({
  files,
  activeFileIndex,
  selection,
  onSelectFile,
  onToggleFile
}: FileNavigatorProps) {
  return (
    <aside className="fileNavigator" aria-label="Changed files">
      {files.map((file, fileIndex) => {
        const allHunksSelected = file.hunks.length > 0
          && file.hunks.every((_, hunkIndex) => getHunkSelectionState(selection, file, hunkIndex) === 'selected');
        const partiallySelected = file.hunks.some(
          (_, hunkIndex) => getHunkSelectionState(selection, file, hunkIndex) === 'partial'
        );

        return (
          <button
            key={fileKey(file)}
            className={fileIndex === activeFileIndex ? 'fileRow active' : 'fileRow'}
            type="button"
            onClick={() => onSelectFile(fileIndex)}
          >
            <input
              aria-label={`Select ${fileKey(file)}`}
              checked={allHunksSelected}
              data-indeterminate={partiallySelected ? 'true' : 'false'}
              disabled={file.binary || file.hunks.length === 0}
              type="checkbox"
              onClick={(event: MouseEvent) => event.stopPropagation()}
              onChange={(event) => onToggleFile(fileIndex, event.currentTarget.checked)}
            />
            <span className={`statusDot ${file.changeType}`} />
            <span className="fileName">{fileKey(file)}</span>
          </button>
        );
      })}
    </aside>
  );
}
