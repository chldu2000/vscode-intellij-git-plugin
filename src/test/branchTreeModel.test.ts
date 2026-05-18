import { describe, expect, it } from 'vitest';
import { buildBranchTree } from '../views/branchTreeModel';

describe('buildBranchTree', () => {
  it('groups local and remote branches under repository nodes', () => {
    const tree = buildBranchTree([
      {
        root: '/repo',
        branches: [
          {
            name: 'main',
            current: true,
            remote: false,
            upstream: 'origin/main',
            ahead: 1,
            behind: 2,
            hash: 'abc'
          },
          {
            name: 'origin/main',
            current: false,
            remote: true,
            ahead: 0,
            behind: 0,
            hash: 'abc'
          }
        ]
      }
    ]);

    expect(tree).toEqual([
      {
        id: 'branch-repo:/repo',
        kind: 'repository',
        label: 'repo',
        repositoryRoot: '/repo',
        children: [
          {
            id: 'branch:/repo:main',
            kind: 'branch',
            label: 'main',
            description: 'current +1 -2',
            repositoryRoot: '/repo',
            branchName: 'main',
            remote: false,
            current: true
          },
          {
            id: 'branch:/repo:origin/main',
            kind: 'branch',
            label: 'origin/main',
            description: 'remote',
            repositoryRoot: '/repo',
            branchName: 'origin/main',
            remote: true,
            current: false
          }
        ]
      }
    ]);
  });
});
