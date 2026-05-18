import path from 'node:path';
import type { GitBranch } from '../git/branchService';

export interface RepositoryBranches {
  root: string;
  branches: GitBranch[];
}

export type BranchTreeNode = BranchRepositoryNode | BranchNode;

export interface BranchRepositoryNode {
  id: string;
  kind: 'repository';
  label: string;
  repositoryRoot: string;
  children: BranchNode[];
}

export interface BranchNode {
  id: string;
  kind: 'branch';
  label: string;
  description: string;
  repositoryRoot: string;
  branchName: string;
  remote: boolean;
  current: boolean;
}

export function buildBranchTree(repositories: RepositoryBranches[]): BranchRepositoryNode[] {
  return repositories.map((repository) => ({
    id: `branch-repo:${repository.root}`,
    kind: 'repository',
    label: path.basename(repository.root),
    repositoryRoot: repository.root,
    children: repository.branches.map((branch) => ({
      id: `branch:${repository.root}:${branch.name}`,
      kind: 'branch',
      label: branch.name,
      description: branchDescription(branch),
      repositoryRoot: repository.root,
      branchName: branch.name,
      remote: branch.remote,
      current: branch.current
    }))
  }));
}

function branchDescription(branch: GitBranch): string {
  const parts: string[] = [];

  if (branch.current) {
    parts.push('current');
  }

  if (branch.remote) {
    parts.push('remote');
  }

  if (branch.ahead > 0) {
    parts.push(`+${branch.ahead}`);
  }

  if (branch.behind > 0) {
    parts.push(`-${branch.behind}`);
  }

  return parts.join(' ');
}
