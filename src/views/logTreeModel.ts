import path from 'node:path';
import type { GitLogCommit } from '../git/logService';

export interface RepositoryLog {
  root: string;
  commits: GitLogCommit[];
}

export type LogTreeNode = LogRepositoryNode | LogCommitNode | LogFileNode;

export interface LogRepositoryNode {
  id: string;
  kind: 'repository';
  label: string;
  repositoryRoot: string;
  children: LogCommitNode[];
}

export interface LogCommitNode {
  id: string;
  kind: 'commit';
  label: string;
  description: string;
  repositoryRoot: string;
  hash: string;
  children: LogFileNode[];
}

export interface LogFileNode {
  id: string;
  kind: 'file';
  label: string;
  description: string;
  repositoryRoot: string;
  hash: string;
  path: string;
}

export function buildLogTree(repositories: RepositoryLog[]): LogRepositoryNode[] {
  return repositories.map((repository) => ({
    id: `log-repo:${repository.root}`,
    kind: 'repository',
    label: path.basename(repository.root),
    repositoryRoot: repository.root,
    children: repository.commits.map((commit) => buildCommitNode(repository.root, commit))
  }));
}

function buildCommitNode(repositoryRoot: string, commit: GitLogCommit): LogCommitNode {
  return {
    id: `commit:${repositoryRoot}:${commit.hash}`,
    kind: 'commit',
    label: commit.subject,
    description: `${commit.hash.slice(0, 7)} ${commit.authorName}`,
    repositoryRoot,
    hash: commit.hash,
    children: commit.files.map((file) => ({
      id: `commit-file:${repositoryRoot}:${commit.hash}:${file.path}`,
      kind: 'file',
      label: file.path,
      description: file.binary ? 'binary' : `+${file.additions} -${file.deletions}`,
      repositoryRoot,
      hash: commit.hash,
      path: file.path
    }))
  };
}
