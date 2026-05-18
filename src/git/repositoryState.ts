import { access } from 'node:fs/promises';
import path from 'node:path';
import { GitCommandError, type GitService } from './gitService';

export type RepositoryOperationKind =
  | 'normal'
  | 'merge'
  | 'rebase'
  | 'cherry-pick'
  | 'revert'
  | 'bisect'
  | 'detached-head';

export interface RepositoryOperationState {
  kind: RepositoryOperationKind;
  supported: boolean;
  reason?: string;
}

const operationMarkers: Array<{ kind: RepositoryOperationKind; gitPath: string; reason: string }> = [
  {
    kind: 'merge',
    gitPath: 'MERGE_HEAD',
    reason: 'Cannot commit selected changes while a merge is in progress.'
  },
  {
    kind: 'rebase',
    gitPath: 'rebase-merge',
    reason: 'Cannot commit selected changes while a rebase is in progress.'
  },
  {
    kind: 'rebase',
    gitPath: 'rebase-apply',
    reason: 'Cannot commit selected changes while a rebase is in progress.'
  },
  {
    kind: 'cherry-pick',
    gitPath: 'CHERRY_PICK_HEAD',
    reason: 'Cannot commit selected changes while a cherry-pick is in progress.'
  },
  {
    kind: 'revert',
    gitPath: 'REVERT_HEAD',
    reason: 'Cannot commit selected changes while a revert is in progress.'
  },
  {
    kind: 'bisect',
    gitPath: 'BISECT_LOG',
    reason: 'Cannot commit selected changes while a bisect is in progress.'
  }
];

export async function detectRepositoryOperationState(
  git: GitService,
  repositoryRoot: string
): Promise<RepositoryOperationState> {
  for (const marker of operationMarkers) {
    if (await gitPathExists(git, repositoryRoot, marker.gitPath)) {
      return {
        kind: marker.kind,
        supported: false,
        reason: marker.reason
      };
    }
  }

  try {
    await git.exec(repositoryRoot, ['symbolic-ref', '--quiet', '--short', 'HEAD']);
  } catch (error) {
    if (error instanceof GitCommandError) {
      return {
        kind: 'detached-head',
        supported: false,
        reason: 'Cannot commit selected changes while HEAD is detached.'
      };
    }

    throw error;
  }

  return {
    kind: 'normal',
    supported: true
  };
}

async function gitPathExists(git: GitService, repositoryRoot: string, gitPath: string): Promise<boolean> {
  const resolved = (await git.exec(repositoryRoot, ['rev-parse', '--git-path', gitPath])).stdout.trim();
  const markerPath = path.isAbsolute(resolved) ? resolved : path.join(repositoryRoot, resolved);

  try {
    await access(markerPath);
    return true;
  } catch {
    return false;
  }
}
