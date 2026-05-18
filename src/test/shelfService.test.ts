import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GitService } from '../git/gitService';
import { ShelfService } from '../git/shelfService';

describe('ShelfService', () => {
  let repo: string;
  let shelfRoot: string;
  let git: GitService;
  let shelves: ShelfService;

  beforeEach(async () => {
    repo = await mkdtemp(path.join(tmpdir(), 'intellij-git-shelf-repo-'));
    shelfRoot = await mkdtemp(path.join(tmpdir(), 'intellij-git-shelves-'));
    git = new GitService('git');
    shelves = new ShelfService(git, shelfRoot);
    await git.exec(repo, ['init']);
    await writeFile(path.join(repo, 'file.txt'), 'one\n', 'utf8');
    await git.exec(repo, ['add', 'file.txt']);
    await git.exec(repo, ['commit', '-m', 'initial'], authorEnv());
  });

  afterEach(async () => {
    await rm(repo, { recursive: true, force: true });
    await rm(shelfRoot, { recursive: true, force: true });
  });

  it('creates an extension-owned shelf patch and lists it', async () => {
    await writeFile(path.join(repo, 'file.txt'), 'two\n', 'utf8');

    const shelf = await shelves.create(repo, 'local shelf');

    expect(await readFile(shelf.patchPath, 'utf8')).toContain('diff --git a/file.txt b/file.txt');
    expect(await shelves.list(repo)).toEqual([
      expect.objectContaining({
        id: shelf.id,
        name: 'local shelf'
      })
    ]);
  });

  it('applies a shelf patch', async () => {
    await writeFile(path.join(repo, 'file.txt'), 'two\n', 'utf8');
    const shelf = await shelves.create(repo, 'local shelf');
    await git.exec(repo, ['checkout', '--', 'file.txt']);
    await mkdir(path.dirname(shelf.patchPath), { recursive: true });

    await shelves.apply(repo, shelf.id);

    expect(await readFile(path.join(repo, 'file.txt'), 'utf8')).toBe('two\n');
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
