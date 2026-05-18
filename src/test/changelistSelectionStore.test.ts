import { describe, expect, it } from 'vitest';
import { ChangelistSelectionStore } from '../views/changelistSelectionStore';
import type { GroupNode, RepositoryNode } from '../views/changelistTreeModel';

describe('ChangelistSelectionStore', () => {
  it('tracks file selection by repository and path', () => {
    const store = new ChangelistSelectionStore();

    store.setFile('/repo', 'src/a.ts', true);

    expect(store.isSelected('/repo', 'src/a.ts')).toBe(true);
    expect(store.selectedPaths('/repo')).toEqual(['src/a.ts']);

    store.setFile('/repo', 'src/a.ts', false);

    expect(store.isSelected('/repo', 'src/a.ts')).toBe(false);
    expect(store.selectedPaths('/repo')).toEqual([]);
  });

  it('selects and clears a whole changelist group', () => {
    const store = new ChangelistSelectionStore();
    const group = fixtureGroup();

    store.applyTreeCheckboxChange(group, true);

    expect(store.selectedPaths('/repo')).toEqual(['src/a.ts', 'src/b.ts']);
    expect(store.summaryForGroup(group)).toBe('checked');

    store.applyTreeCheckboxChange(group.children[0], false);

    expect(store.selectedPaths('/repo')).toEqual(['src/b.ts']);
    expect(store.summaryForGroup(group)).toBe('partial');

    store.applyTreeCheckboxChange(group, false);

    expect(store.selectedPaths('/repo')).toEqual([]);
    expect(store.summaryForGroup(group)).toBe('unchecked');
  });

  it('prunes selections that are no longer present in the tree', () => {
    const store = new ChangelistSelectionStore();

    store.setGroup('/repo', ['src/a.ts', 'src/removed.ts'], true);
    store.prune([fixtureRepository()]);

    expect(store.selectedPaths('/repo')).toEqual(['src/a.ts']);
  });
});

function fixtureRepository(): RepositoryNode {
  return {
    id: 'repo:/repo',
    kind: 'repository',
    label: 'repo',
    repositoryRoot: '/repo',
    children: [fixtureGroup()]
  };
}

function fixtureGroup(): GroupNode {
  return {
    id: 'group:/repo:default',
    kind: 'group',
    label: 'Changes',
    repositoryRoot: '/repo',
    groupId: 'default',
    groupType: 'changelist',
    active: true,
    children: [
      {
        id: 'file:/repo:src/a.ts',
        kind: 'file',
        label: 'src/a.ts',
        repositoryRoot: '/repo',
        groupId: 'default',
        groupType: 'changelist',
        path: 'src/a.ts',
        statusKind: 'modified'
      },
      {
        id: 'file:/repo:src/b.ts',
        kind: 'file',
        label: 'src/b.ts',
        repositoryRoot: '/repo',
        groupId: 'default',
        groupType: 'changelist',
        path: 'src/b.ts',
        statusKind: 'added'
      }
    ]
  };
}
