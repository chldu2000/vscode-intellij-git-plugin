import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BranchService, parseBranchList } from '../git/branchService';
import { GitService } from '../git/gitService';

describe('parseBranchList', () => {
  it('parses current, local, remote, upstream, and ahead behind values', () => {
    const output = [
      '* main abc123 [origin/main: ahead 2, behind 1] work',
      '  feature def456 feature work',
      '  remotes/origin/main abc123 remote main',
      ''
    ].join('\n');

    expect(parseBranchList(output)).toEqual([
      {
        name: 'main',
        current: true,
        remote: false,
        upstream: 'origin/main',
        ahead: 2,
        behind: 1,
        hash: 'abc123'
      },
      {
        name: 'feature',
        current: false,
        remote: false,
        ahead: 0,
        behind: 0,
        hash: 'def456'
      },
      {
        name: 'origin/main',
        current: false,
        remote: true,
        ahead: 0,
        behind: 0,
        hash: 'abc123'
      }
    ]);
  });
});

describe('BranchService', () => {
  let repo: string;
  let git: GitService;
  let branches: BranchService;

  beforeEach(async () => {
    repo = await mkdtemp(path.join(tmpdir(), 'intellij-git-branch-'));
    git = new GitService('git');
    branches = new BranchService(git);
    await git.exec(repo, ['init']);
    await writeFile(path.join(repo, 'file.txt'), 'one\n', 'utf8');
    await git.exec(repo, ['add', 'file.txt']);
    await git.exec(repo, ['commit', '-m', 'initial'], authorEnv());
  });

  afterEach(async () => {
    await rm(repo, { recursive: true, force: true });
  });

  it('lists branches and marks current branch', async () => {
    await git.exec(repo, ['checkout', '-b', 'feature']);

    const listed = await branches.list(repo);

    expect(listed).toEqual([
      expect.objectContaining({ name: 'feature', current: true, remote: false }),
      expect.objectContaining({ name: 'main', current: false, remote: false })
    ]);
  });

  it('blocks checkout when local changes would be overwritten', async () => {
    await git.exec(repo, ['checkout', '-b', 'target']);
    await writeFile(path.join(repo, 'file.txt'), 'target\n', 'utf8');
    await git.exec(repo, ['add', 'file.txt']);
    await git.exec(repo, ['commit', '-m', 'target change'], authorEnv());
    await git.exec(repo, ['checkout', 'main']);
    await writeFile(path.join(repo, 'file.txt'), 'dirty\n', 'utf8');

    await expect(branches.checkout(repo, 'target', { strategy: 'safe' })).rejects.toThrow(
      'would be overwritten'
    );
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
