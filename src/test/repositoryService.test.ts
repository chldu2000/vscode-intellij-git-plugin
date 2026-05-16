import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GitService } from '../git/gitService';
import { RepositoryService } from '../git/repositoryService';

describe('RepositoryService', () => {
  let tempDir: string;
  let git: GitService;
  let repositories: RepositoryService;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'intellij-git-client-repo-'));
    git = new GitService('git');
    repositories = new RepositoryService(git);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('discovers Git repository roots and de-duplicates nested folders', async () => {
    const nested = path.join(tempDir, 'src', 'feature');
    await mkdir(nested, { recursive: true });
    await git.exec(tempDir, ['init']);

    const discovered = await repositories.discover([nested, tempDir]);

    expect(discovered).toEqual([{ root: await realRepoPath(tempDir) }]);
  });

  it('returns parsed local status for a repository', async () => {
    await git.exec(tempDir, ['init']);
    await writeFile(path.join(tempDir, 'tracked.txt'), 'one\n', 'utf8');
    await git.exec(tempDir, ['add', 'tracked.txt']);
    await git.exec(tempDir, ['commit', '-m', 'initial'], {
      env: {
        GIT_AUTHOR_NAME: 'Tester',
        GIT_AUTHOR_EMAIL: 'tester@example.com',
        GIT_COMMITTER_NAME: 'Tester',
        GIT_COMMITTER_EMAIL: 'tester@example.com'
      }
    });
    await writeFile(path.join(tempDir, 'tracked.txt'), 'two\n', 'utf8');
    await writeFile(path.join(tempDir, 'untracked.txt'), 'new\n', 'utf8');

    const status = await repositories.status(tempDir);

    expect(status).toEqual([
      {
        path: 'tracked.txt',
        kind: 'modified',
        indexStatus: '.',
        workingTreeStatus: 'M',
        staged: false,
        unstaged: true
      },
      {
        path: 'untracked.txt',
        kind: 'untracked',
        indexStatus: '?',
        workingTreeStatus: '?',
        staged: false,
        unstaged: true
      }
    ]);
  });
});

async function realRepoPath(repoPath: string): Promise<string> {
  const { realpath } = await import('node:fs/promises');
  return realpath(repoPath);
}
