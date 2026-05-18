import { describe, expect, it } from 'vitest';
import type { DiffHunk } from '../git/diffParser';
import { buildSplitDiffRows } from '../webview/diffRows';

describe('buildSplitDiffRows', () => {
  it('pairs adjacent deleted and added lines as modifications', () => {
    const rows = buildSplitDiffRows(hunk([
      { type: 'context', content: ' keep', oldLine: 1, newLine: 1 },
      { type: 'delete', content: '-old', oldLine: 2 },
      { type: 'add', content: '+new', newLine: 2 },
      { type: 'context', content: ' tail', oldLine: 3, newLine: 3 }
    ]));

    expect(rows).toEqual([
      expect.objectContaining({ kind: 'context' }),
      {
        kind: 'modify',
        old: { lineIndex: 1, lineNumber: 2, content: '-old', type: 'delete' },
        new: { lineIndex: 2, lineNumber: 2, content: '+new', type: 'add' }
      },
      expect.objectContaining({ kind: 'context' })
    ]);
  });

  it('keeps surplus deleted or added lines as one-sided rows', () => {
    const rows = buildSplitDiffRows(hunk([
      { type: 'delete', content: '-old one', oldLine: 1 },
      { type: 'delete', content: '-old two', oldLine: 2 },
      { type: 'add', content: '+new one', newLine: 1 }
    ]));

    expect(rows).toEqual([
      {
        kind: 'modify',
        old: { lineIndex: 0, lineNumber: 1, content: '-old one', type: 'delete' },
        new: { lineIndex: 2, lineNumber: 1, content: '+new one', type: 'add' }
      },
      {
        kind: 'delete',
        old: { lineIndex: 1, lineNumber: 2, content: '-old two', type: 'delete' },
        new: undefined
      }
    ]);
  });

  it('models add-only and delete-only hunks', () => {
    expect(buildSplitDiffRows(hunk([
      { type: 'add', content: '+created', newLine: 1 }
    ]))).toEqual([
      {
        kind: 'add',
        old: undefined,
        new: { lineIndex: 0, lineNumber: 1, content: '+created', type: 'add' }
      }
    ]);

    expect(buildSplitDiffRows(hunk([
      { type: 'delete', content: '-removed', oldLine: 1 }
    ]))).toEqual([
      {
        kind: 'delete',
        old: { lineIndex: 0, lineNumber: 1, content: '-removed', type: 'delete' },
        new: undefined
      }
    ]);
  });
});

function hunk(lines: DiffHunk['lines']): DiffHunk {
  return {
    header: '@@ -1 +1 @@',
    oldStart: 1,
    oldLines: 1,
    newStart: 1,
    newLines: 1,
    lines
  };
}
