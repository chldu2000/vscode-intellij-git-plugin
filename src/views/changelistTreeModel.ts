import path from 'node:path';
import type { ChangelistGroup } from '../changelists/changelistService';
import type { GitFileStatus, GitFileStatusKind } from '../git/statusParser';

export interface RepositoryChangelistGroups {
  root: string;
  groups: ChangelistGroup[];
}

export type ChangelistTreeNode = RepositoryNode | GroupNode | FileNode;

export interface RepositoryNode {
  id: string;
  kind: 'repository';
  label: string;
  repositoryRoot: string;
  children: GroupNode[];
}

export interface GroupNode {
  id: string;
  kind: 'group';
  label: string;
  repositoryRoot: string;
  groupId: string;
  groupType: 'changelist' | 'derived';
  children: FileNode[];
}

export interface FileNode {
  id: string;
  kind: 'file';
  label: string;
  repositoryRoot: string;
  path: string;
  statusKind: GitFileStatusKind;
}

export function buildChangelistTree(repositories: RepositoryChangelistGroups[]): RepositoryNode[] {
  return repositories.map((repository) => ({
    id: `repo:${repository.root}`,
    kind: 'repository',
    label: path.basename(repository.root),
    repositoryRoot: repository.root,
    children: repository.groups.map((group) => buildGroupNode(repository.root, group))
  }));
}

function buildGroupNode(repositoryRoot: string, group: ChangelistGroup): GroupNode {
  return {
    id: `group:${repositoryRoot}:${group.id}`,
    kind: 'group',
    label: group.name,
    repositoryRoot,
    groupId: group.id,
    groupType: group.type,
    children: group.files.map((file) => buildFileNode(repositoryRoot, file))
  };
}

function buildFileNode(repositoryRoot: string, file: GitFileStatus): FileNode {
  return {
    id: `file:${repositoryRoot}:${file.path}`,
    kind: 'file',
    label: file.path,
    repositoryRoot,
    path: file.path,
    statusKind: file.kind
  };
}
