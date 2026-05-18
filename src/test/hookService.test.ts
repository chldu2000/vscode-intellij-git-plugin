import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GitService } from '../git/gitService';
import { HookService, type GitHookError } from '../git/hookService';

describe('HookService', () => {
  let repo: string;
  let git: GitService;
  let output: string[];
  let hooks: HookService;

  beforeEach(async () => {
    repo = await mkdtemp(path.join(tmpdir(), 'intellij-git-client-hooks-'));
    git = new GitService('git');
    output = [];
    hooks = new HookService(git, (line) => output.push(line));
    await git.exec(repo, ['init']);
  });

  afterEach(async () => {
    await rm(repo, { recursive: true, force: true });
  });

  it('ignores missing hooks', async () => {
    await expect(hooks.runHook(repo, 'pre-commit')).resolves.toBeUndefined();
    expect(output).toEqual([]);
  });

  it('runs executable hooks and captures output', async () => {
    await writeHook('pre-commit', [
      '#!/bin/sh',
      'echo pre-commit-out',
      'echo pre-commit-err >&2'
    ]);

    await hooks.runHook(repo, 'pre-commit');

    expect(output).toEqual([
      'Git hook pre-commit output:',
      'pre-commit-out',
      'pre-commit-err'
    ]);
  });

  it('fails when an executable hook exits non-zero', async () => {
    await writeHook('commit-msg', [
      '#!/bin/sh',
      'echo bad-message >&2',
      'exit 7'
    ]);

    await expect(hooks.runHook(repo, 'commit-msg', { args: ['message.txt'] })).rejects.toMatchObject({
      hookName: 'commit-msg',
      exitCode: 7
    } satisfies Partial<GitHookError>);
    expect(output).toContain('bad-message');
  });

  async function writeHook(name: string, lines: string[]): Promise<void> {
    const hooksDir = path.join(repo, '.git', 'hooks');
    await mkdir(hooksDir, { recursive: true });
    const hookPath = path.join(hooksDir, name);
    await writeFile(hookPath, `${lines.join('\n')}\n`, 'utf8');
    await chmod(hookPath, 0o755);
  }
});
