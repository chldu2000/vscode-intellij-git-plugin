import { describe, expect, it } from 'vitest';
import type { DiffFile } from '../git/diffParser';
import {
  createDiffIdentity,
  invalidateStaleSelections
} from '../git/diffIdentity';
import {
  createInitialSelection,
  toggleHunk
} from '../webview/selection';

describe('diff identity', () => {
  it('hashes path, index line, and hunk header', () => {
    const file = fixtureFile('index 1111111..2222222 100644', '@@ -1 +1 @@');

    expect(createDiffIdentity(file, 0)).toBe(createDiffIdentity(file, 0));
    expect(createDiffIdentity(file, 0)).not.toBe(
      createDiffIdentity(fixtureFile('index 1111111..3333333 100644', '@@ -1 +1 @@'), 0)
    );
    expect(createDiffIdentity(file, 0)).not.toBe(
      createDiffIdentity(fixtureFile('index 1111111..2222222 100644', '@@ -2 +2 @@'), 0)
    );
  });

  it('clears selected hunks whose identity changed', () => {
    const previous = fixtureFile('index 1111111..2222222 100644', '@@ -1 +1 @@');
    const current = fixtureFile('index 1111111..3333333 100644', '@@ -1 +1 @@');
    const selection = toggleHunk(createInitialSelection([previous]), previous, 0, true);

    const result = invalidateStaleSelections([previous], [current], selection);

    expect(result.selection.selectedLinesByFile).toEqual({});
    expect(result.stale).toEqual([
      {
        fileKey: 'file.txt',
        hunkIndex: 0
      }
    ]);
  });

  it('keeps selected hunks whose identity is unchanged', () => {
    const previous = fixtureFile('index 1111111..2222222 100644', '@@ -1 +1 @@');
    const current = fixtureFile('index 1111111..2222222 100644', '@@ -1 +1 @@');
    const selection = toggleHunk(createInitialSelection([previous]), previous, 0, true);

    const result = invalidateStaleSelections([previous], [current], selection);

    expect(result.selection).toEqual(selection);
    expect(result.stale).toEqual([]);
  });
});

function fixtureFile(indexLine: string, hunkHeader: string): DiffFile {
  return {
    oldPath: 'file.txt',
    newPath: 'file.txt',
    indexLine,
    changeType: 'modified',
    binary: false,
    hunks: [
      {
        header: hunkHeader,
        oldStart: 1,
        oldLines: 1,
        newStart: 1,
        newLines: 1,
        lines: [
          { type: 'delete', content: '-old', oldLine: 1 },
          { type: 'add', content: '+new', newLine: 1 }
        ]
      }
    ]
  };
}
