import { describe, expect, it } from 'vitest';
import { InMemoryChangelistStore } from '../changelists/changelistStore';
import { ChangelistService } from '../changelists/changelistService';

describe('ChangelistService', () => {
  it('creates the default Changes changelist for a repository', async () => {
    const service = new ChangelistService(new InMemoryChangelistStore());

    const state = await service.getState('/repo');

    expect(state.changelists).toEqual([
      expect.objectContaining({
        id: 'default',
        name: 'Changes',
        active: true
      })
    ]);
    expect(state.assignments).toEqual([]);
  });

  it('creates, renames, deletes, and sets active changelists', async () => {
    const service = new ChangelistService(new InMemoryChangelistStore());

    const feature = await service.create('/repo', 'Feature work');
    await service.rename('/repo', feature.id, 'Feature polish');
    await service.setActive('/repo', feature.id);
    let state = await service.getState('/repo');

    expect(state.changelists).toEqual([
      expect.objectContaining({ id: 'default', name: 'Changes', active: false }),
      expect.objectContaining({ id: feature.id, name: 'Feature polish', active: true })
    ]);

    await service.delete('/repo', feature.id);
    state = await service.getState('/repo');

    expect(state.changelists).toEqual([
      expect.objectContaining({ id: 'default', name: 'Changes', active: true })
    ]);
  });

  it('moves file assignments and returns derived groups for status entries', async () => {
    const service = new ChangelistService(new InMemoryChangelistStore());
    const feature = await service.create('/repo', 'Feature work');

    await service.moveFiles('/repo', feature.id, ['src/a.ts', 'src/b.ts']);

    const groups = await service.groupStatus('/repo', [
      {
        path: 'src/a.ts',
        kind: 'modified',
        indexStatus: '.',
        workingTreeStatus: 'M',
        staged: false,
        unstaged: true
      },
      {
        path: 'notes.txt',
        kind: 'untracked',
        indexStatus: '?',
        workingTreeStatus: '?',
        staged: false,
        unstaged: true
      },
      {
        path: 'conflicted.ts',
        kind: 'conflicted',
        indexStatus: 'U',
        workingTreeStatus: 'U',
        staged: false,
        unstaged: true
      },
      {
        path: 'src/other.ts',
        kind: 'modified',
        indexStatus: '.',
        workingTreeStatus: 'M',
        staged: false,
        unstaged: true
      }
    ]);

    expect(groups).toEqual([
      {
        id: feature.id,
        name: 'Feature work',
        type: 'changelist',
        files: [expect.objectContaining({ path: 'src/a.ts' })]
      },
      {
        id: 'default',
        name: 'Changes',
        type: 'changelist',
        files: [expect.objectContaining({ path: 'src/other.ts' })]
      },
      {
        id: 'unversioned',
        name: 'Unversioned Files',
        type: 'derived',
        files: [expect.objectContaining({ path: 'notes.txt' })]
      },
      {
        id: 'merge-conflicts',
        name: 'Merge Conflicts',
        type: 'derived',
        files: [expect.objectContaining({ path: 'conflicted.ts' })]
      }
    ]);
  });

  it('persists assignments across service instances', async () => {
    const store = new InMemoryChangelistStore();
    const first = new ChangelistService(store);
    const feature = await first.create('/repo', 'Feature work');
    await first.moveFiles('/repo', feature.id, ['src/a.ts']);

    const second = new ChangelistService(store);
    const state = await second.getState('/repo');

    expect(state.assignments).toEqual([
      {
        repositoryRoot: '/repo',
        path: 'src/a.ts',
        changelistId: feature.id
      }
    ]);
  });
});
