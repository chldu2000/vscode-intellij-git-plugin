import { describe, expect, it } from 'vitest';
import { buildChangelistTree } from '../views/changelistTreeModel';

describe('buildChangelistTree', () => {
  it('builds repository, group, and file nodes', () => {
    const tree = buildChangelistTree([
      {
        root: '/repo',
        groups: [
          {
            id: 'feature',
            name: 'Feature',
            type: 'changelist',
            files: [
              {
                path: 'src/a.ts',
                kind: 'modified',
                indexStatus: '.',
                workingTreeStatus: 'M',
                staged: false,
                unstaged: true
              }
            ]
          },
          {
            id: 'unversioned',
            name: 'Unversioned Files',
            type: 'derived',
            files: [
              {
                path: 'notes.txt',
                kind: 'untracked',
                indexStatus: '?',
                workingTreeStatus: '?',
                staged: false,
                unstaged: true
              }
            ]
          }
        ]
      }
    ]);

    expect(tree).toEqual([
      {
        id: 'repo:/repo',
        kind: 'repository',
        label: 'repo',
        repositoryRoot: '/repo',
        children: [
          {
            id: 'group:/repo:feature',
            kind: 'group',
            label: 'Feature',
            repositoryRoot: '/repo',
            groupId: 'feature',
            groupType: 'changelist',
            children: [
              {
                id: 'file:/repo:src/a.ts',
                kind: 'file',
                label: 'src/a.ts',
                repositoryRoot: '/repo',
                path: 'src/a.ts',
                statusKind: 'modified'
              }
            ]
          },
          {
            id: 'group:/repo:unversioned',
            kind: 'group',
            label: 'Unversioned Files',
            repositoryRoot: '/repo',
            groupId: 'unversioned',
            groupType: 'derived',
            children: [
              {
                id: 'file:/repo:notes.txt',
                kind: 'file',
                label: 'notes.txt',
                repositoryRoot: '/repo',
                path: 'notes.txt',
                statusKind: 'untracked'
              }
            ]
          }
        ]
      }
    ]);
  });
});
