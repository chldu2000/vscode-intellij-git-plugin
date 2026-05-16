import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { DiffFile } from './diffParser';
import type { GitService } from './gitService';
import { buildSelectedPatch } from './patchBuilder';
import type { DiffSelection } from '../webview/selection';

export interface CommitSelectedOptions {
  message: string;
  amend?: boolean;
  signOff?: boolean;
  author?: {
    name: string;
    email: string;
  };
  push?: boolean;
  env?: Record<string, string | undefined>;
}

export class CommitService {
  public constructor(private readonly git: GitService) {}

  public async commitSelected(
    repositoryRoot: string,
    files: DiffFile[],
    selection: DiffSelection,
    options: CommitSelectedOptions
  ): Promise<string> {
    if (options.message.trim().length === 0) {
      throw new Error('Commit message is required.');
    }

    await this.ensureSupportedRepositoryState(repositoryRoot);

    const patch = buildSelectedPatch(files, selection);

    if (patch.length === 0) {
      throw new Error('No selected changes to commit.');
    }

    const branch = (await this.git.exec(repositoryRoot, ['symbolic-ref', '--quiet', '--short', 'HEAD'])).stdout.trim();
    const expectedOldHead = (await this.git.exec(repositoryRoot, ['rev-parse', 'HEAD'])).stdout.trim();
    const tempDir = await mkdtemp(path.join(tmpdir(), 'intellij-git-index-'));
    const tempIndex = path.join(tempDir, 'index');
    const tempEnv = {
      ...options.env,
      GIT_INDEX_FILE: tempIndex
    };

    try {
      await this.git.exec(repositoryRoot, ['read-tree', 'HEAD'], { env: tempEnv });
      await this.git.exec(repositoryRoot, ['apply', '--cached', '--check'], {
        env: tempEnv,
        input: patch
      });
      await this.git.exec(repositoryRoot, ['apply', '--cached'], {
        env: tempEnv,
        input: patch
      });

      const tree = (await this.git.exec(repositoryRoot, ['write-tree'], { env: tempEnv })).stdout.trim();
      const commit = (await this.git.exec(repositoryRoot, [
        'commit-tree',
        tree,
        ...await this.parentArgs(repositoryRoot, options.amend === true)
      ], {
        env: this.commitEnv(options),
        input: `${this.commitMessage(options)}\n`
      })).stdout.trim();

      await this.git.exec(repositoryRoot, ['update-ref', `refs/heads/${branch}`, commit, expectedOldHead]);
      await this.git.exec(repositoryRoot, ['reset', '--mixed', 'HEAD']);

      if (options.push === true) {
        await this.git.exec(repositoryRoot, ['push']);
      }

      return commit;
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }

  private async parentArgs(repositoryRoot: string, amend: boolean): Promise<string[]> {
    if (!amend) {
      return ['-p', 'HEAD'];
    }

    const parentsLine = (await this.git.exec(repositoryRoot, ['rev-list', '--parents', '-n', '1', 'HEAD'])).stdout.trim();
    const [, ...parents] = parentsLine.split(' ').filter((part) => part.length > 0);

    return parents.flatMap((parent) => ['-p', parent]);
  }

  private commitEnv(options: CommitSelectedOptions): Record<string, string | undefined> | undefined {
    if (options.author === undefined) {
      return options.env;
    }

    return {
      ...options.env,
      GIT_AUTHOR_NAME: options.author.name,
      GIT_AUTHOR_EMAIL: options.author.email
    };
  }

  private commitMessage(options: CommitSelectedOptions): string {
    const message = options.message.trim();

    if (options.signOff !== true) {
      return message;
    }

    const signer = options.author ?? {
      name: options.env?.GIT_AUTHOR_NAME ?? options.env?.GIT_COMMITTER_NAME ?? 'Unknown',
      email: options.env?.GIT_AUTHOR_EMAIL ?? options.env?.GIT_COMMITTER_EMAIL ?? 'unknown@example.com'
    };

    return `${message}\n\nSigned-off-by: ${signer.name} <${signer.email}>`;
  }

  private async ensureSupportedRepositoryState(repositoryRoot: string): Promise<void> {
    const unresolved = await this.git.exec(repositoryRoot, ['diff', '--name-only', '--diff-filter=U']);

    if (unresolved.stdout.trim().length > 0) {
      throw new Error('Cannot commit selected changes while conflicts are unresolved.');
    }
  }
}
