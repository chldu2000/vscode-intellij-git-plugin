import { describe, expect, it } from 'vitest';
import { parsePorcelainV2Status } from '../git/statusParser';

describe('parsePorcelainV2Status', () => {
  it('parses ordinary tracked changes from porcelain v2 z output', () => {
    const output = [
      '1 .M N... 100644 100644 100644 abcdef1 abcdef1 src/modified.ts',
      '1 A. N... 000000 100644 100644 0000000 abcdef2 src/added.ts',
      '1 D. N... 100644 000000 000000 abcdef3 0000000 src/deleted.ts',
      ''
    ].join('\0');

    expect(parsePorcelainV2Status(output)).toEqual([
      {
        path: 'src/modified.ts',
        kind: 'modified',
        indexStatus: '.',
        workingTreeStatus: 'M',
        staged: false,
        unstaged: true
      },
      {
        path: 'src/added.ts',
        kind: 'added',
        indexStatus: 'A',
        workingTreeStatus: '.',
        staged: true,
        unstaged: false
      },
      {
        path: 'src/deleted.ts',
        kind: 'deleted',
        indexStatus: 'D',
        workingTreeStatus: '.',
        staged: true,
        unstaged: false
      }
    ]);
  });

  it('parses renamed, untracked, ignored, and conflicted records', () => {
    const output = [
      '2 R. N... 100644 100644 100644 abcdef1 abcdef2 R100 src/new-name.ts',
      'src/old-name.ts',
      '? scratch.txt',
      '! ignored.log',
      'u UU N... 100644 100644 100644 100644 abc1 abc2 abc3 conflicted.ts',
      ''
    ].join('\0');

    expect(parsePorcelainV2Status(output)).toEqual([
      {
        path: 'src/new-name.ts',
        originalPath: 'src/old-name.ts',
        kind: 'renamed',
        indexStatus: 'R',
        workingTreeStatus: '.',
        staged: true,
        unstaged: false
      },
      {
        path: 'scratch.txt',
        kind: 'untracked',
        indexStatus: '?',
        workingTreeStatus: '?',
        staged: false,
        unstaged: true
      },
      {
        path: 'ignored.log',
        kind: 'ignored',
        indexStatus: '!',
        workingTreeStatus: '!',
        staged: false,
        unstaged: false
      },
      {
        path: 'conflicted.ts',
        kind: 'conflicted',
        indexStatus: 'U',
        workingTreeStatus: 'U',
        staged: false,
        unstaged: true
      }
    ]);
  });
});
