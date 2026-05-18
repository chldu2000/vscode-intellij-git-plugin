import { spawn } from 'node:child_process';
import { access, constants } from 'node:fs/promises';
import path from 'node:path';
import type { GitService } from './gitService';

export type GitHookName = 'pre-commit' | 'commit-msg';

export interface RunHookOptions {
  env?: Record<string, string | undefined>;
  args?: string[];
}

export class GitHookError extends Error {
  public constructor(
    public readonly hookName: GitHookName,
    public readonly exitCode: number,
    public readonly stdout: string,
    public readonly stderr: string
  ) {
    super(`Git hook ${hookName} failed with exit code ${exitCode}`);
    this.name = 'GitHookError';
  }
}

export class HookService {
  public constructor(
    private readonly git: GitService,
    private readonly appendOutput: (line: string) => void = () => {}
  ) {}

  public async runHook(
    repositoryRoot: string,
    hookName: GitHookName,
    options: RunHookOptions = {}
  ): Promise<void> {
    const hookPath = await this.executableHookPath(repositoryRoot, hookName);

    if (hookPath === undefined) {
      return;
    }

    const result = await runExecutable(repositoryRoot, hookPath, {
      args: options.args,
      env: options.env
    });

    this.appendHookOutput(hookName, result.stdout, result.stderr);

    if (result.exitCode !== 0) {
      throw new GitHookError(hookName, result.exitCode, result.stdout, result.stderr);
    }
  }

  private async executableHookPath(repositoryRoot: string, hookName: GitHookName): Promise<string | undefined> {
    const resolved = (await this.git.exec(repositoryRoot, ['rev-parse', '--git-path', `hooks/${hookName}`])).stdout
      .trim();
    const hookPath = path.isAbsolute(resolved) ? resolved : path.join(repositoryRoot, resolved);

    try {
      await access(hookPath, constants.X_OK);
      return hookPath;
    } catch {
      return undefined;
    }
  }

  private appendHookOutput(hookName: GitHookName, stdout: string, stderr: string): void {
    if (stdout.length === 0 && stderr.length === 0) {
      return;
    }

    this.appendOutput(`Git hook ${hookName} output:`);

    for (const line of [...stdoutLines(stdout), ...stdoutLines(stderr)]) {
      this.appendOutput(line);
    }
  }
}

interface RunExecutableOptions {
  args?: string[];
  env?: Record<string, string | undefined>;
}

interface RunExecutableResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

function runExecutable(cwd: string, command: string, options: RunExecutableOptions): Promise<RunExecutableResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, options.args ?? [], {
      cwd,
      env: {
        ...process.env,
        ...options.env
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    child.stdout?.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
    child.stderr?.on('data', (chunk: Buffer) => stderrChunks.push(chunk));

    child.on('error', (error) => reject(error));
    child.on('close', (exitCode) => {
      resolve({
        stdout: Buffer.concat(stdoutChunks).toString('utf8'),
        stderr: Buffer.concat(stderrChunks).toString('utf8'),
        exitCode: exitCode ?? 1
      });
    });
  });
}

function stdoutLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .filter((line) => line.length > 0);
}
