import { mkdtemp, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GitCommandError, GitService } from '../git/gitService';

describe('GitService', () => {
  let tempDir: string;
  let service: GitService;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'intellij-git-client-'));
    service = new GitService('git');
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('runs git commands in the provided working directory', async () => {
    await service.exec(tempDir, ['init']);

    const result = await service.exec(tempDir, ['rev-parse', '--show-toplevel']);

    expect(await realpath(result.stdout.trim())).toBe(await realpath(tempDir));
    expect(result.exitCode).toBe(0);
  });

  it('passes environment overrides to git', async () => {
    await service.exec(tempDir, ['init']);

    const result = await service.exec(tempDir, ['var', 'GIT_AUTHOR_IDENT'], {
      env: {
        GIT_AUTHOR_NAME: 'Plugin Tester',
        GIT_AUTHOR_EMAIL: 'tester@example.com'
      }
    });

    expect(result.stdout).toContain('Plugin Tester');
    expect(result.stdout).toContain('<tester@example.com>');
  });

  it('throws a typed error when git exits with a non-zero status', async () => {
    await expect(service.exec(tempDir, ['not-a-real-git-command'])).rejects.toMatchObject({
      name: 'GitCommandError',
      args: ['not-a-real-git-command'],
      cwd: tempDir
    });

    try {
      await service.exec(tempDir, ['not-a-real-git-command']);
    } catch (error) {
      expect(error).toBeInstanceOf(GitCommandError);
      expect((error as GitCommandError).exitCode).not.toBe(0);
      expect((error as GitCommandError).stderr).toContain('not-a-real-git-command');
    }
  });
});
