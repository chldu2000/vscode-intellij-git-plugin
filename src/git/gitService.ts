import { spawn } from 'node:child_process';

export interface GitExecOptions {
  env?: Record<string, string | undefined>;
  input?: string;
}

export interface GitExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export class GitCommandError extends Error {
  public readonly args: string[];
  public readonly cwd: string;
  public readonly exitCode: number | null;
  public readonly stdout: string;
  public readonly stderr: string;

  public constructor(args: string[], cwd: string, result: GitExecResult) {
    super(`git ${args.join(' ')} failed with exit code ${result.exitCode}`);
    this.name = 'GitCommandError';
    this.args = args;
    this.cwd = cwd;
    this.exitCode = result.exitCode;
    this.stdout = result.stdout;
    this.stderr = result.stderr;
  }
}

export class GitService {
  public constructor(private readonly gitPath: string) {}

  public async exec(cwd: string, args: string[], options: GitExecOptions = {}): Promise<GitExecResult> {
    return new Promise((resolve, reject) => {
      const child = spawn(this.gitPath, args, {
        cwd,
        env: {
          ...process.env,
          ...options.env
        },
        stdio: [options.input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe']
      });

      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];

      child.stdout?.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
      child.stderr?.on('data', (chunk: Buffer) => stderrChunks.push(chunk));

      if (options.input !== undefined && child.stdin !== null) {
        child.stdin.end(options.input);
      }

      child.on('error', (error) => {
        reject(error);
      });

      child.on('close', (exitCode) => {
        const result: GitExecResult = {
          stdout: Buffer.concat(stdoutChunks).toString('utf8'),
          stderr: Buffer.concat(stderrChunks).toString('utf8'),
          exitCode: exitCode ?? 1
        };

        if (result.exitCode !== 0) {
          reject(new GitCommandError(args, cwd, result));
          return;
        }

        resolve(result);
      });
    });
  }
}
