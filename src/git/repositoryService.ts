import { realpath } from 'node:fs/promises';
import type { GitService } from './gitService';
import { GitCommandError } from './gitService';
import { type GitFileStatus, parsePorcelainV2Status } from './statusParser';

export interface GitRepository {
  root: string;
}

export class RepositoryService {
  public constructor(private readonly git: GitService) {}

  public async discover(candidateFolders: string[]): Promise<GitRepository[]> {
    const roots = new Map<string, GitRepository>();

    for (const folder of candidateFolders) {
      const root = await this.findRoot(folder);

      if (root !== undefined) {
        roots.set(root, { root });
      }
    }

    return [...roots.values()].sort((left, right) => left.root.localeCompare(right.root));
  }

  public async status(repositoryRoot: string): Promise<GitFileStatus[]> {
    const result = await this.git.exec(repositoryRoot, [
      'status',
      '--porcelain=v2',
      '-z',
      '--untracked-files=all'
    ]);

    return parsePorcelainV2Status(result.stdout);
  }

  private async findRoot(folder: string): Promise<string | undefined> {
    try {
      const result = await this.git.exec(folder, ['rev-parse', '--show-toplevel']);
      return realpath(result.stdout.trim());
    } catch (error) {
      if (error instanceof GitCommandError) {
        return undefined;
      }

      throw error;
    }
  }
}
