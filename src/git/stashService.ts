import type { GitService } from './gitService';

const FIELD_SEPARATOR = '\u001f';

export interface GitStash {
  ref: string;
  hash: string;
  message: string;
}

export class StashService {
  public constructor(private readonly git: GitService) {}

  public async list(repositoryRoot: string): Promise<GitStash[]> {
    const result = await this.git.exec(repositoryRoot, [
      'stash',
      'list',
      `--format=%gd${FIELD_SEPARATOR}%H${FIELD_SEPARATOR}%gs`
    ]);

    return parseStashList(result.stdout);
  }

  public async create(repositoryRoot: string, message: string): Promise<void> {
    await this.git.exec(repositoryRoot, ['stash', 'push', '--include-untracked', '-m', message]);
  }

  public async apply(repositoryRoot: string, ref: string): Promise<void> {
    await this.git.exec(repositoryRoot, ['stash', 'apply', ref]);
  }
}

export function parseStashList(output: string): GitStash[] {
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const [ref = '', hash = '', message = ''] = line.split(FIELD_SEPARATOR);
      return { ref, hash, message };
    });
}
