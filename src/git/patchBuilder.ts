import type { DiffFile, DiffHunk, DiffLine } from './diffParser';
import type { DiffSelection } from '../webview/selection';
import { fileKey } from '../webview/selection';

export function buildSelectedPatch(files: DiffFile[], selection: DiffSelection): string {
  const patches = files
    .map((file) => buildFilePatch(file, selection))
    .filter((patch): patch is string => patch !== undefined && patch.length > 0);

  return patches.length === 0 ? '' : `${patches.join('\n')}\n`;
}

function buildFilePatch(file: DiffFile, selection: DiffSelection): string | undefined {
  if (file.binary) {
    return undefined;
  }

  const key = fileKey(file);
  const selectedHunks = selection.selectedLinesByFile[key];

  if (selectedHunks === undefined) {
    return undefined;
  }

  const hunkPatches = file.hunks
    .map((hunk, hunkIndex) => buildHunkPatch(hunk, selectedHunks[hunkIndex]))
    .filter((patch): patch is string => patch !== undefined);

  if (hunkPatches.length === 0) {
    return undefined;
  }

  return [
    `diff --git ${diffPath('a', file.oldPath)} ${diffPath('b', file.newPath)}`,
    file.indexLine,
    file.changeType === 'added' ? 'new file mode 100644' : undefined,
    file.changeType === 'deleted' ? 'deleted file mode 100644' : undefined,
    `--- ${file.oldPath === undefined ? '/dev/null' : diffPath('a', file.oldPath)}`,
    `+++ ${file.newPath === undefined ? '/dev/null' : diffPath('b', file.newPath)}`,
    ...hunkPatches
  ].filter((line): line is string => line !== undefined).join('\n');
}

function buildHunkPatch(hunk: DiffHunk, selectedLineIndexes: number[] | undefined): string | undefined {
  if (selectedLineIndexes === undefined || selectedLineIndexes.length === 0) {
    return undefined;
  }

  const selected = new Set(selectedLineIndexes);
  const lines = hunk.lines.flatMap((line, lineIndex) => selectedPatchLines(line, selected.has(lineIndex)));

  if (!lines.some((line) => line.type === 'add' || line.type === 'delete')) {
    return undefined;
  }

  const oldLines = lines.filter((line) => line.type !== 'add').length;
  const newLines = lines.filter((line) => line.type !== 'delete').length;
  const header = `@@ -${formatRange(hunk.oldStart, oldLines)} +${formatRange(hunk.newStart, newLines)} @@`;

  return [header, ...lines.map((line) => line.content)].join('\n');
}

function selectedPatchLines(line: DiffLine, selected: boolean): DiffLine[] {
  if (line.type === 'context') {
    return [line];
  }

  if (selected) {
    return [line];
  }

  if (line.type === 'delete') {
    return [
      {
        type: 'context',
        content: ` ${line.content.slice(1)}`,
        oldLine: line.oldLine,
        newLine: line.oldLine
      }
    ];
  }

  return [];
}

function diffPath(prefix: 'a' | 'b', filePath: string | undefined): string {
  return filePath === undefined ? `${prefix}/dev/null` : `${prefix}/${filePath}`;
}

function formatRange(start: number, lineCount: number): string {
  return lineCount === 1 ? String(start) : `${start},${lineCount}`;
}
