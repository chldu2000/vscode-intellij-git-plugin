import { describe, expect, it } from 'vitest';
import type { DiffFile } from '../git/diffParser';
import {
  createInitialSelection,
  createSelectionForFiles,
  getHunkSelectionState,
  getSelectedSummary,
  toggleFile,
  toggleHunk,
  toggleLine
} from '../shared/selection';

describe('diff review selection', () => {
  it('toggles files and updates selected summary', () => {
    const files = fixtureFiles();
    let selection = createInitialSelection(files);

    selection = toggleFile(selection, files[0], true);

    expect(getSelectedSummary(selection)).toEqual({
      files: 1,
      hunks: 2,
      lines: 3
    });

    selection = toggleFile(selection, files[0], false);

    expect(getSelectedSummary(selection)).toEqual({
      files: 0,
      hunks: 0,
      lines: 0
    });
  });

  it('tracks full and partial hunk selection state', () => {
    const files = fixtureFiles();
    let selection = createInitialSelection(files);

    selection = toggleLine(selection, files[0], 0, 2, true);

    expect(getHunkSelectionState(selection, files[0], 0)).toBe('partial');

    selection = toggleHunk(selection, files[0], 0, true);

    expect(getHunkSelectionState(selection, files[0], 0)).toBe('selected');

    selection = toggleHunk(selection, files[0], 0, false);

    expect(getHunkSelectionState(selection, files[0], 0)).toBe('unselected');
  });

  it('creates initial selection for checked files', () => {
    const files = fixtureFiles();
    const selection = createSelectionForFiles(files, ['src/a.ts']);

    expect(getSelectedSummary(selection)).toEqual({
      files: 1,
      hunks: 2,
      lines: 3
    });
  });
});

function fixtureFiles(): DiffFile[] {
  return [
    {
      oldPath: 'src/a.ts',
      newPath: 'src/a.ts',
      changeType: 'modified',
      binary: false,
      hunks: [
        {
          header: '@@ -1,2 +1,2 @@',
          oldStart: 1,
          oldLines: 2,
          newStart: 1,
          newLines: 2,
          lines: [
            { type: 'delete', content: '-old', oldLine: 1 },
            { type: 'add', content: '+new', newLine: 1 }
          ]
        },
        {
          header: '@@ -5,1 +5,2 @@',
          oldStart: 5,
          oldLines: 1,
          newStart: 5,
          newLines: 2,
          lines: [
            { type: 'context', content: ' keep', oldLine: 5, newLine: 5 },
            { type: 'add', content: '+more', newLine: 6 }
          ]
        }
      ]
    }
  ];
}
