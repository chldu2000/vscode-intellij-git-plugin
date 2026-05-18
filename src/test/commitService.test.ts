import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CommitService } from '../git/commitService';
import { parseUnifiedDiff } from '../git/diffParser';
import { GitService } from '../git/gitService';
import {
  createInitialSelection,
  toggleFile,
  toggleHunk,
  toggleLine
} from '../shared/selection';

describe('CommitService', () => {
  let repo: string;
  let git: GitService;
  let commits: CommitService;

  beforeEach(async () => {
    repo = await mkdtemp(path.join(tmpdir(), 'intellij-git-client-commit-'));
    git = new GitService('git');
    commits = new CommitService(git);
    await git.exec(repo, ['init']);
    await writeFile(path.join(repo, 'file.txt'), 'one\ntwo\nthree\nfour\n', 'utf8');
    await writeFile(path.join(repo, 'other.txt'), 'alpha\n', 'utf8');
    await git.exec(repo, ['add', 'file.txt', 'other.txt']);
    await git.exec(repo, ['commit', '-m', 'initial'], authorEnv());
  });

  afterEach(async () => {
    await rm(repo, { recursive: true, force: true });
  });

  it('commits a selected whole file and leaves other working tree changes pending', async () => {
    await writeFile(path.join(repo, 'file.txt'), 'ONE\ntwo\nthree\nfour\n', 'utf8');
    await writeFile(path.join(repo, 'other.txt'), 'beta\n', 'utf8');
    const files = parseUnifiedDiff((await git.exec(repo, ['diff', '--', 'file.txt'])).stdout);
    const selection = toggleFile(createInitialSelection(files), files[0], true);

    const commit = await commits.commitSelected(repo, files, selection, {
      message: 'commit selected file',
      env: authorEnv().env
    });

    expect(commit).toMatch(/[0-9a-f]{40}/);
    expect((await git.exec(repo, ['show', 'HEAD:file.txt'])).stdout).toBe('ONE\ntwo\nthree\nfour\n');
    expect((await readFile(path.join(repo, 'other.txt'), 'utf8'))).toBe('beta\n');
    expect((await git.exec(repo, ['diff', '--name-only'])).stdout.trim()).toBe('other.txt');
  });

  it('commits a selected hunk and leaves other hunks pending', async () => {
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
    await git.exec(repo, ['commit', '-m', 'expand fixture'], authorEnv());
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

    await commits.commitSelected(repo, files, selection, {
      message: 'commit selected hunk',
      env: authorEnv().env
    });

    expect((await git.exec(repo, ['show', 'HEAD:file.txt'])).stdout).toContain('ONE\n');
    expect((await git.exec(repo, ['show', 'HEAD:file.txt'])).stdout).toContain('ten\n');
    const remainingDiff = (await git.exec(repo, ['diff', '--', 'file.txt'])).stdout;
    expect(remainingDiff).not.toContain('-one');
    expect(remainingDiff).toContain('-ten');
    expect(remainingDiff).toContain('+TEN');
  });

  it('commits selected changed lines and leaves adjacent unselected lines pending', async () => {
    await writeFile(path.join(repo, 'file.txt'), 'one\nTWO\nTHREE\nfour\n', 'utf8');
    const files = parseUnifiedDiff((await git.exec(repo, ['diff', '--', 'file.txt'])).stdout);
    const hunk = files[0].hunks[0];
    let selection = createInitialSelection(files);
    selection = toggleLine(selection, files[0], 0, hunk.lines.findIndex((line) => line.content === '-two'), true);
    selection = toggleLine(selection, files[0], 0, hunk.lines.findIndex((line) => line.content === '+TWO'), true);

    await commits.commitSelected(repo, files, selection, {
      message: 'commit selected line',
      env: authorEnv().env
    });

    expect((await git.exec(repo, ['show', 'HEAD:file.txt'])).stdout).toBe('one\nTWO\nthree\nfour\n');
    const remainingDiff = (await git.exec(repo, ['diff', '--', 'file.txt'])).stdout;
    expect(remainingDiff).toContain('-three');
    expect(remainingDiff).toContain('+THREE');
  });

  it('supports sign-off and author override', async () => {
    await writeFile(path.join(repo, 'file.txt'), 'ONE\ntwo\nthree\nfour\n', 'utf8');
    const files = parseUnifiedDiff((await git.exec(repo, ['diff', '--', 'file.txt'])).stdout);
    const selection = toggleFile(createInitialSelection(files), files[0], true);

    await commits.commitSelected(repo, files, selection, {
      message: 'commit with metadata',
      signOff: true,
      author: {
        name: 'Override Author',
        email: 'override@example.com'
      },
      env: authorEnv().env
    });

    expect((await git.exec(repo, ['log', '-1', '--format=%an <%ae>%n%B'])).stdout).toContain(
      'Override Author <override@example.com>'
    );
    expect((await git.exec(repo, ['log', '-1', '--format=%B'])).stdout).toContain(
      'Signed-off-by: Override Author <override@example.com>'
    );
  });

  it('amends the last commit when requested', async () => {
    const originalParent = (await git.exec(repo, ['rev-parse', 'HEAD^@'])).stdout.trim();
    const originalCommit = (await git.exec(repo, ['rev-parse', 'HEAD'])).stdout.trim();
    await writeFile(path.join(repo, 'file.txt'), 'ONE\ntwo\nthree\nfour\n', 'utf8');
    const files = parseUnifiedDiff((await git.exec(repo, ['diff', '--', 'file.txt'])).stdout);
    const selection = toggleFile(createInitialSelection(files), files[0], true);

    const amendedCommit = await commits.commitSelected(repo, files, selection, {
      message: 'amended initial',
      amend: true,
      env: authorEnv().env
    });

    expect(amendedCommit).not.toBe(originalCommit);
    expect((await git.exec(repo, ['log', '-1', '--format=%s'])).stdout.trim()).toBe('amended initial');
    expect((await git.exec(repo, ['rev-parse', 'HEAD^@'])).stdout.trim()).toBe(originalParent);
  });

  it('pushes after a successful commit when requested', async () => {
    const remote = await mkdtemp(path.join(tmpdir(), 'intellij-git-client-remote-'));

    try {
      await git.exec(remote, ['init', '--bare']);
      await git.exec(repo, ['remote', 'add', 'origin', remote]);
      await git.exec(repo, ['push', '-u', 'origin', 'HEAD']);
      await writeFile(path.join(repo, 'file.txt'), 'ONE\ntwo\nthree\nfour\n', 'utf8');
      const files = parseUnifiedDiff((await git.exec(repo, ['diff', '--', 'file.txt'])).stdout);
      const selection = toggleFile(createInitialSelection(files), files[0], true);

      const commit = await commits.commitSelected(repo, files, selection, {
        message: 'commit and push',
        push: true,
        env: authorEnv().env
      });

      const branch = (await git.exec(repo, ['branch', '--show-current'])).stdout.trim();
      expect((await git.exec(remote, ['rev-parse', `refs/heads/${branch}`])).stdout.trim()).toBe(commit);
    } finally {
      await rm(remote, { recursive: true, force: true });
    }
  });
});

function authorEnv() {
  return {
    env: {
      GIT_AUTHOR_NAME: 'Tester',
      GIT_AUTHOR_EMAIL: 'tester@example.com',
      GIT_COMMITTER_NAME: 'Tester',
      GIT_COMMITTER_EMAIL: 'tester@example.com'
    }
  };
}
