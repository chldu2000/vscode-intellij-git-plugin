import { createHash } from 'node:crypto';
import type { DiffFile } from './diffParser';
import type { DiffSelection } from '../webview/selection';
import { fileKey } from '../webview/selection';

export interface StaleSelection {
  fileKey: string;
  hunkIndex: number;
}

export interface StaleSelectionResult {
  selection: DiffSelection;
  stale: StaleSelection[];
}

export function createDiffIdentity(file: DiffFile, hunkIndex: number): string {
  const hunk = file.hunks[hunkIndex];
  const source = [
    file.oldPath ?? '',
    file.newPath ?? '',
    file.indexLine ?? '',
    hunk?.header ?? ''
  ].join('\0');

  return createHash('sha256').update(source).digest('hex');
}

export function invalidateStaleSelections(
  previousFiles: DiffFile[],
  currentFiles: DiffFile[],
  selection: DiffSelection
): StaleSelectionResult {
  const currentByKey = new Map(currentFiles.map((file) => [fileKey(file), file]));
  const next: DiffSelection = {
    selectedLinesByFile: {}
  };
  const stale: StaleSelection[] = [];

  for (const previousFile of previousFiles) {
    const key = fileKey(previousFile);
    const selectedHunks = selection.selectedLinesByFile[key];

    if (selectedHunks === undefined) {
      continue;
    }

    const currentFile = currentByKey.get(key);

    for (const [hunkIndexText, selectedLines] of Object.entries(selectedHunks)) {
      const hunkIndex = Number(hunkIndexText);
      const unchanged = currentFile !== undefined
        && createDiffIdentity(previousFile, hunkIndex) === createDiffIdentity(currentFile, hunkIndex);

      if (!unchanged) {
        stale.push({ fileKey: key, hunkIndex });
        continue;
      }

      next.selectedLinesByFile[key] ??= {};
      next.selectedLinesByFile[key][hunkIndex] = [...selectedLines];
    }
  }

  return { selection: next, stale };
}
