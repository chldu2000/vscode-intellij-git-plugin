import { describe, expect, it } from 'vitest';
import { buildLogTree } from '../views/logTreeModel';

describe('buildLogTree', () => {
  it('builds repository, commit, and file nodes', () => {
    const tree = buildLogTree([
      {
        root: '/repo',
        commits: [
          {
            hash: 'abcdef123456',
            authorName: 'Alice',
            authorEmail: 'alice@example.com',
            authoredAt: new Date('2026-05-18T10:00:00.000Z'),
            refs: ['main'],
            subject: 'Subject',
            files: [
              { path: 'file.txt', additions: 2, deletions: 1, binary: false }
            ]
          }
        ]
      }
    ]);

    expect(tree).toEqual([
      {
        id: 'log-repo:/repo',
        kind: 'repository',
        label: 'repo',
        repositoryRoot: '/repo',
        children: [
          {
            id: 'commit:/repo:abcdef123456',
            kind: 'commit',
            label: 'Subject',
            description: 'abcdef1 Alice',
            repositoryRoot: '/repo',
            hash: 'abcdef123456',
            children: [
              {
                id: 'commit-file:/repo:abcdef123456:file.txt',
                kind: 'file',
                label: 'file.txt',
                description: '+2 -1',
                repositoryRoot: '/repo',
                hash: 'abcdef123456',
                path: 'file.txt'
              }
            ]
          }
        ]
      }
    ]);
  });
});
