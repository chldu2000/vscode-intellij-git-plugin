import type { GitService } from './gitService';
import { GitCommandError } from './gitService';

export interface GitBranch {
  name: string;
  current: boolean;
  remote: boolean;
  upstream?: string;
  ahead: number;
  behind: number;
  hash: string;
}

export interface CheckoutOptions {
  strategy: 'safe' | 'force';
}

export class BranchService {
  public constructor(private readonly git: GitService) {}

  public async list(repositoryRoot: string): Promise<GitBranch[]> {
    const result = await this.git.exec(repositoryRoot, [
      'branch',
      '--all',
      '--verbose',
      '--verbose',
      '--no-abbrev'
    ]);

    return parseBranchList(result.stdout);
  }

  public async checkout(repositoryRoot: string, branchName: string, options: CheckoutOptions): Promise<void> {
    try {
      await this.git.exec(repositoryRoot, [
        'checkout',
        ...(options.strategy === 'force' ? ['--force'] : []),
        branchName
      ]);
    } catch (error) {
      if (error instanceof GitCommandError && error.stderr.trim().length > 0) {
        throw new Error(error.stderr.trim());
      }

      throw error;
    }
  }
}

export function parseBranchList(output: string): GitBranch[] {
  return output
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0)
    .map(parseBranchLine);
}

function parseBranchLine(line: string): GitBranch {
  const current = line.startsWith('*');
  const normalized = line.replace(/^[* ]\s*/, '');
  const [rawName = '', hash = '', ...restParts] = normalized.split(/\s+/);
  const rest = restParts.join(' ');
  const remote = rawName.startsWith('remotes/');
  const name = remote ? rawName.slice('remotes/'.length) : rawName;
  const trackingMatch = /^\[(.+?)\]\s*/.exec(rest);
  const tracking = trackingMatch?.[1];
  const upstream = tracking?.split(':')[0];

  return {
    name,
    current,
    remote,
    upstream,
    ahead: parseCount(tracking, 'ahead'),
    behind: parseCount(tracking, 'behind'),
    hash
  };
}

function parseCount(tracking: string | undefined, label: 'ahead' | 'behind'): number {
  if (tracking === undefined) {
    return 0;
  }

  const match = new RegExp(`${label} (\\d+)`).exec(tracking);
  return match === null ? 0 : Number(match[1]);
}
