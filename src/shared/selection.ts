import type { DiffFile } from '../git/diffParser';

export type SelectionStateName = 'selected' | 'partial' | 'unselected';

export interface DiffSelection {
  selectedLinesByFile: Record<string, Record<number, number[]>>;
}

export interface SelectedSummary {
  files: number;
  hunks: number;
  lines: number;
}

export function createInitialSelection(files: DiffFile[]): DiffSelection {
  void files;

  return {
    selectedLinesByFile: {}
  };
}

export function createSelectionForFiles(files: DiffFile[], paths: readonly string[]): DiffSelection {
  const selectedPaths = new Set(paths);

  return files.reduce<DiffSelection>((selection, file) => {
    if (!selectedPaths.has(fileKey(file))) {
      return selection;
    }

    return toggleFile(selection, file, true);
  }, createInitialSelection(files));
}

export function toggleFile(selection: DiffSelection, file: DiffFile, selected: boolean): DiffSelection {
  const next = cloneSelection(selection);
  const key = fileKey(file);

  if (!selected) {
    delete next.selectedLinesByFile[key];
    return next;
  }

  next.selectedLinesByFile[key] = {};
  file.hunks.forEach((hunk, hunkIndex) => {
    void hunk;
    next.selectedLinesByFile[key][hunkIndex] = selectableLineIndexes(file, hunkIndex);
  });

  return next;
}

export function toggleHunk(
  selection: DiffSelection,
  file: DiffFile,
  hunkIndex: number,
  selected: boolean
): DiffSelection {
  const next = cloneSelection(selection);
  const key = fileKey(file);
  next.selectedLinesByFile[key] ??= {};

  if (selected) {
    next.selectedLinesByFile[key][hunkIndex] = selectableLineIndexes(file, hunkIndex);
    return next;
  }

  delete next.selectedLinesByFile[key][hunkIndex];

  if (Object.keys(next.selectedLinesByFile[key]).length === 0) {
    delete next.selectedLinesByFile[key];
  }

  return next;
}

export function toggleLine(
  selection: DiffSelection,
  file: DiffFile,
  hunkIndex: number,
  lineIndex: number,
  selected: boolean
): DiffSelection {
  const next = cloneSelection(selection);
  const key = fileKey(file);
  next.selectedLinesByFile[key] ??= {};
  next.selectedLinesByFile[key][hunkIndex] ??= [];

  const current = new Set(next.selectedLinesByFile[key][hunkIndex]);

  if (selected) {
    current.add(lineIndex);
  } else {
    current.delete(lineIndex);
  }

  const sorted = [...current].sort((left, right) => left - right);

  if (sorted.length === 0) {
    delete next.selectedLinesByFile[key][hunkIndex];
  } else {
    next.selectedLinesByFile[key][hunkIndex] = sorted;
  }

  if (Object.keys(next.selectedLinesByFile[key]).length === 0) {
    delete next.selectedLinesByFile[key];
  }

  return next;
}

export function getHunkSelectionState(
  selection: DiffSelection,
  file: DiffFile,
  hunkIndex: number
): SelectionStateName {
  const selectedLines = selection.selectedLinesByFile[fileKey(file)]?.[hunkIndex] ?? [];
  const selectableCount = selectableLineIndexes(file, hunkIndex).length;

  if (selectedLines.length === 0) {
    return 'unselected';
  }

  if (selectedLines.length === selectableCount) {
    return 'selected';
  }

  return 'partial';
}

export function isLineSelected(
  selection: DiffSelection,
  file: DiffFile,
  hunkIndex: number,
  lineIndex: number
): boolean {
  return selection.selectedLinesByFile[fileKey(file)]?.[hunkIndex]?.includes(lineIndex) ?? false;
}

export function getSelectedSummary(selection: DiffSelection): SelectedSummary {
  let files = 0;
  let hunks = 0;
  let lines = 0;

  for (const hunksByIndex of Object.values(selection.selectedLinesByFile)) {
    const selectedHunks = Object.values(hunksByIndex).filter((selectedLines) => selectedLines.length > 0);

    if (selectedHunks.length > 0) {
      files += 1;
      hunks += selectedHunks.length;
      lines += selectedHunks.reduce((total, selectedLines) => total + selectedLines.length, 0);
    }
  }

  return { files, hunks, lines };
}

export function getSelectedFileKeys(selection: DiffSelection): string[] {
  return Object.keys(selection.selectedLinesByFile).filter((key) => (
    Object.values(selection.selectedLinesByFile[key]).some((selectedLines) => selectedLines.length > 0)
  ));
}

export function hasSelectedFileEntry(selection: DiffSelection, key: string): boolean {
  return Object.hasOwn(selection.selectedLinesByFile, key);
}

export function fileKey(file: DiffFile): string {
  return file.newPath ?? file.oldPath ?? 'unknown';
}

function selectableLineIndexes(file: DiffFile, hunkIndex: number): number[] {
  return file.hunks[hunkIndex].lines
    .map((line, lineIndex) => (line.type === 'context' ? undefined : lineIndex))
    .filter((lineIndex): lineIndex is number => lineIndex !== undefined);
}

function cloneSelection(selection: DiffSelection): DiffSelection {
  return {
    selectedLinesByFile: Object.fromEntries(
      Object.entries(selection.selectedLinesByFile).map(([key, hunks]) => [
        key,
        Object.fromEntries(
          Object.entries(hunks).map(([hunkIndex, lines]) => [hunkIndex, [...lines]])
        )
      ])
    )
  };
}
