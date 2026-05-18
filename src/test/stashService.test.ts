import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GitService } from '../git/gitService';
import { parseStashList, StashService } from '../git/stashService';

describe('parseStashList', () => {
  it('parses stash refs and messages', () => {
    const output = [
      'stash@{0}\u001fabc123\u001fOn main: work in progress',
      'stash@{1}\u001fdef456\u001fWIP on feature: subject',
      ''
    ].join('\n');

    expect(parseStashList(output)).toEqual([
      { ref: 'stash@{0}', hash: 'abc123', message: 'On main: work in progress' },
      { ref: 'stash@{1}', hash: 'def456', message: 'WIP on feature: subject' }
    ]);
  });
});

describe('StashService', () => {
  let repo: string;
  let git: GitService;
  let stashes: StashService;

  beforeEach(async () => {
    repo = await mkdtemp(path.join(tmpdir(), 'intellij-git-stash-'));
    git = new GitService('git');
    stashes = new StashService(git);
    await git.exec(repo, ['init']);
    await writeFile(path.join(repo, 'file.txt'), 'one\n', 'utf8');
    await git.exec(repo, ['add', 'file.txt']);
    await git.exec(repo, ['commit', '-m', 'initial'], authorEnv());
  });

  afterEach(async () => {
    await rm(repo, { recursive: true, force: true });
  });

  it('creates and lists a stash', async () => {
    await writeFile(path.join(repo, 'file.txt'), 'two\n', 'utf8');

    await stashes.create(repo, 'selected work');

    const listed = await stashes.list(repo);
    expect(listed[0]).toMatchObject({
      ref: 'stash@{0}',
      message: expect.stringContaining('selected work')
    });
    expect((await git.exec(repo, ['diff', '--name-only'])).stdout.trim()).toBe('');
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
