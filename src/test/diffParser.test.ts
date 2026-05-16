import { describe, expect, it } from 'vitest';
import { parseUnifiedDiff } from '../git/diffParser';

describe('parseUnifiedDiff', () => {
  it('parses modified files with hunks and line numbers', () => {
    const diff = [
      'diff --git a/src/a.ts b/src/a.ts',
      'index 1111111..2222222 100644',
      '--- a/src/a.ts',
      '+++ b/src/a.ts',
      '@@ -1,3 +1,4 @@',
      ' const keep = true;',
      '-const oldName = "old";',
      '+const newName = "new";',
      '+const added = true;',
      ' export { keep };',
      ''
    ].join('\n');

    expect(parseUnifiedDiff(diff)).toEqual([
      {
        oldPath: 'src/a.ts',
        newPath: 'src/a.ts',
        changeType: 'modified',
        binary: false,
        hunks: [
          {
            header: '@@ -1,3 +1,4 @@',
            oldStart: 1,
            oldLines: 3,
            newStart: 1,
            newLines: 4,
            lines: [
              { type: 'context', content: ' const keep = true;', oldLine: 1, newLine: 1 },
              { type: 'delete', content: '-const oldName = "old";', oldLine: 2 },
              { type: 'add', content: '+const newName = "new";', newLine: 2 },
              { type: 'add', content: '+const added = true;', newLine: 3 },
              { type: 'context', content: ' export { keep };', oldLine: 3, newLine: 4 }
            ]
          }
        ]
      }
    ]);
  });

  it('parses added, deleted, renamed, and binary files', () => {
    const diff = [
      'diff --git a/dev/null b/new.txt',
      'new file mode 100644',
      'index 0000000..1111111',
      '--- /dev/null',
      '+++ b/new.txt',
      '@@ -0,0 +1 @@',
      '+new',
      'diff --git a/old.txt b/dev/null',
      'deleted file mode 100644',
      'index 2222222..0000000',
      '--- a/old.txt',
      '+++ /dev/null',
      '@@ -1 +0,0 @@',
      '-old',
      'diff --git a/old-name.ts b/new-name.ts',
      'similarity index 100%',
      'rename from old-name.ts',
      'rename to new-name.ts',
      'diff --git a/image.png b/image.png',
      'index 3333333..4444444 100644',
      'Binary files a/image.png and b/image.png differ',
      ''
    ].join('\n');

    const files = parseUnifiedDiff(diff);

    expect(files.map((file) => ({
      oldPath: file.oldPath,
      newPath: file.newPath,
      changeType: file.changeType,
      binary: file.binary,
      hunkCount: file.hunks.length
    }))).toEqual([
      { oldPath: undefined, newPath: 'new.txt', changeType: 'added', binary: false, hunkCount: 1 },
      { oldPath: 'old.txt', newPath: undefined, changeType: 'deleted', binary: false, hunkCount: 1 },
      { oldPath: 'old-name.ts', newPath: 'new-name.ts', changeType: 'renamed', binary: false, hunkCount: 0 },
      { oldPath: 'image.png', newPath: 'image.png', changeType: 'modified', binary: true, hunkCount: 0 }
    ]);
  });
});
