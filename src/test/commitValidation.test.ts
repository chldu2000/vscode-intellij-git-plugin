import { describe, expect, it } from 'vitest';
import { canCommitSelectedChanges } from '../shared/commitValidation';

describe('canCommitSelectedChanges', () => {
  it('requires selected lines and a non-empty commit message', () => {
    expect(canCommitSelectedChanges({ files: 0, hunks: 0, lines: 0 }, 'message')).toBe(false);
    expect(canCommitSelectedChanges({ files: 1, hunks: 1, lines: 2 }, '   ')).toBe(false);
    expect(canCommitSelectedChanges({ files: 1, hunks: 1, lines: 2 }, 'message')).toBe(true);
  });
});
