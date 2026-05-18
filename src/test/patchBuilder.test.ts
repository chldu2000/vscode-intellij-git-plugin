import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseUnifiedDiff } from '../git/diffParser';
import { GitService } from '../git/gitService';
import { buildSelectedPatch } from '../git/patchBuilder';
import {
  createInitialSelection,
  toggleFile,
  toggleHunk,
  toggleLine
} from '../shared/selection';

describe('buildSelectedPatch', () => {
  let repo: string;
  let git: GitService;

  beforeEach(async () => {
    repo = await mkdtemp(path.join(tmpdir(), 'intellij-git-client-patch-'));
    git = new GitService('git');
    await git.exec(repo, ['init']);
    await writeFile(path.join(repo, 'file.txt'), 'one\ntwo\nthree\nfour\n', 'utf8');
    await git.exec(repo, ['add', 'file.txt']);
    await git.exec(repo, ['commit', '-m', 'initial'], commitEnv());
  });

  afterEach(async () => {
    await rm(repo, { recursive: true, force: true });
  });

  it('builds a patch for a selected whole file', async () => {
    await writeFile(path.join(repo, 'file.txt'), 'one\nTWO\nthree\nfour\nfive\n', 'utf8');
    const files = parseUnifiedDiff((await git.exec(repo, ['diff', '--', 'file.txt'])).stdout);
    const selection = toggleFile(createInitialSelection(files), files[0], true);

    const patch = buildSelectedPatch(files, selection);

    expect(patch).toContain('diff --git a/file.txt b/file.txt');
    await expect(git.exec(repo, ['apply', '--cached', '--check'], { input: patch })).resolves.toBeDefined();
  });

  it('builds a patch for selected hunks only', async () => {
    await writeFile(path.join(repo, 'file.txt'), [
      'one',
      'two',
      'three',
      'four',
      'five',
      'six',
      'seven',
      'eight',
      'nine',
      'ten',
      ''
    ].join('\n'), 'utf8');
    await git.exec(repo, ['add', 'file.txt']);
    await git.exec(repo, ['commit', '-m', 'expand fixture'], commitEnv());
    await writeFile(path.join(repo, 'file.txt'), [
      'ONE',
      'two',
      'three',
      'four',
      'five',
      'six',
      'seven',
      'eight',
      'nine',
      'TEN',
      ''
    ].join('\n'), 'utf8');
    const files = parseUnifiedDiff((await git.exec(repo, ['diff', '--', 'file.txt'])).stdout);
    let selection = createInitialSelection(files);
    selection = toggleHunk(selection, files[0], 0, true);

    const patch = buildSelectedPatch(files, selection);

    expect(patch).toContain('-one');
    expect(patch).toContain('+ONE');
    expect(patch).not.toContain('-four');
    expect(patch).not.toContain('+FOUR');
    await expect(git.exec(repo, ['apply', '--cached', '--check'], { input: patch })).resolves.toBeDefined();
  });

  it('builds a valid simple line-level patch', async () => {
    await writeFile(path.join(repo, 'file.txt'), 'one\nTWO\nTHREE\nfour\n', 'utf8');
    const files = parseUnifiedDiff((await git.exec(repo, ['diff', '--', 'file.txt'])).stdout);
    let selection = createInitialSelection(files);
    const hunk = files[0].hunks[0];
    const selectedLineIndex = hunk.lines.findIndex((line) => line.content === '+TWO');
    selection = toggleLine(selection, files[0], 0, selectedLineIndex, true);

    const patch = buildSelectedPatch(files, selection);

    expect(patch).toContain('+TWO');
    expect(patch).not.toContain('+THREE');
    await expect(git.exec(repo, ['apply', '--cached', '--check'], { input: patch })).resolves.toBeDefined();
  });
});

function commitEnv() {
  return {
    env: {
      GIT_AUTHOR_NAME: 'Tester',
      GIT_AUTHOR_EMAIL: 'tester@example.com',
      GIT_COMMITTER_NAME: 'Tester',
      GIT_COMMITTER_EMAIL: 'tester@example.com'
    }
  };
}
