import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GitService } from '../git/gitService';
import { detectRepositoryOperationState } from '../git/repositoryState';

describe('detectRepositoryOperationState', () => {
  let repo: string;
  let git: GitService;

  beforeEach(async () => {
    repo = await mkdtemp(path.join(tmpdir(), 'intellij-git-client-state-'));
    git = new GitService('git');
    await git.exec(repo, ['init']);
    await writeFile(path.join(repo, 'file.txt'), 'one\n', 'utf8');
    await git.exec(repo, ['add', 'file.txt']);
    await git.exec(repo, ['commit', '-m', 'initial'], authorEnv());
  });

  afterEach(async () => {
    await rm(repo, { recursive: true, force: true });
  });

  it('reports a normal repository state', async () => {
    await expect(detectRepositoryOperationState(git, repo)).resolves.toEqual({
      kind: 'normal',
      supported: true
    });
  });

  it.each([
    ['MERGE_HEAD', 'merge'],
    ['CHERRY_PICK_HEAD', 'cherry-pick'],
    ['REVERT_HEAD', 'revert'],
    ['BISECT_LOG', 'bisect']
  ])('blocks %s state', async (gitPath, kind) => {
    await writeGitPath(gitPath);

    await expect(detectRepositoryOperationState(git, repo)).resolves.toEqual(
      expect.objectContaining({
        kind,
        supported: false
      })
    );
  });

  it.each(['rebase-merge', 'rebase-apply'])('blocks %s state', async (gitPath) => {
    await mkdir(await resolveGitPath(gitPath));

    await expect(detectRepositoryOperationState(git, repo)).resolves.toEqual(
      expect.objectContaining({
        kind: 'rebase',
        supported: false
      })
    );
  });

  it('blocks detached HEAD state', async () => {
    const head = (await git.exec(repo, ['rev-parse', 'HEAD'])).stdout.trim();
    await git.exec(repo, ['checkout', '--detach', head]);

    await expect(detectRepositoryOperationState(git, repo)).resolves.toEqual(
      expect.objectContaining({
        kind: 'detached-head',
        supported: false
      })
    );
  });

  async function writeGitPath(gitPath: string): Promise<void> {
    await writeFile(await resolveGitPath(gitPath), 'marker\n', 'utf8');
  }

  async function resolveGitPath(gitPath: string): Promise<string> {
    const resolved = (await git.exec(repo, ['rev-parse', '--git-path', gitPath])).stdout.trim();
    return path.isAbsolute(resolved) ? resolved : path.join(repo, resolved);
  }
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
