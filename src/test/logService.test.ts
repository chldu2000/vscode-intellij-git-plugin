import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GitService } from '../git/gitService';
import { LogService, parseGitLog } from '../git/logService';

describe('parseGitLog', () => {
  it('parses commit metadata and changed files', () => {
    const output = [
      '\u001eabc123\u001fAlice\u001falice@example.com\u001f1700000000\u001fmain, HEAD\u001fSubject line',
      '1\t0\tfile.txt',
      '-\t-\timage.png',
      '\u001edef456\u001fBob\u001fbob@example.com\u001f1700000100\u001f\u001fAnother subject',
      '2\t1\tsrc/app.ts',
      ''
    ].join('\n');

    expect(parseGitLog(output)).toEqual([
      {
        hash: 'abc123',
        authorName: 'Alice',
        authorEmail: 'alice@example.com',
        authoredAt: new Date(1700000000 * 1000),
        refs: ['main', 'HEAD'],
        subject: 'Subject line',
        files: [
          { path: 'file.txt', additions: 1, deletions: 0, binary: false },
          { path: 'image.png', additions: 0, deletions: 0, binary: true }
        ]
      },
      {
        hash: 'def456',
        authorName: 'Bob',
        authorEmail: 'bob@example.com',
        authoredAt: new Date(1700000100 * 1000),
        refs: [],
        subject: 'Another subject',
        files: [
          { path: 'src/app.ts', additions: 2, deletions: 1, binary: false }
        ]
      }
    ]);
  });
});

describe('LogService', () => {
  let repo: string;
  let git: GitService;
  let logs: LogService;

  beforeEach(async () => {
    repo = await mkdtemp(path.join(tmpdir(), 'intellij-git-log-'));
    git = new GitService('git');
    logs = new LogService(git);
    await git.exec(repo, ['init']);
  });

  afterEach(async () => {
    await rm(repo, { recursive: true, force: true });
  });

  it('lists recent commits from a repository', async () => {
    await writeFile(path.join(repo, 'file.txt'), 'one\n', 'utf8');
    await git.exec(repo, ['add', 'file.txt']);
    await git.exec(repo, ['commit', '-m', 'initial'], authorEnv('Alice', 'alice@example.com'));
    await writeFile(path.join(repo, 'file.txt'), 'two\n', 'utf8');
    await git.exec(repo, ['add', 'file.txt']);
    await git.exec(repo, ['commit', '-m', 'second'], authorEnv('Bob', 'bob@example.com'));

    const commits = await logs.list(repo, { limit: 2 });

    expect(commits).toHaveLength(2);
    expect(commits[0]).toMatchObject({
      authorName: 'Bob',
      authorEmail: 'bob@example.com',
      subject: 'second',
      files: [expect.objectContaining({ path: 'file.txt' })]
    });
    expect(commits[1]).toMatchObject({
      authorName: 'Alice',
      subject: 'initial'
    });
  });
});

function authorEnv(name: string, email: string) {
  return {
    env: {
      GIT_AUTHOR_NAME: name,
      GIT_AUTHOR_EMAIL: email,
      GIT_COMMITTER_NAME: name,
      GIT_COMMITTER_EMAIL: email
    }
  };
}
