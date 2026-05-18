import type { GitFileStatus } from '../git/statusParser';
import {
  type Changelist,
  type ChangelistAssignment,
  type ChangelistState,
  type ChangelistStore,
  cloneState
} from './changelistStore';

export interface ChangelistGroup {
  id: string;
  name: string;
  type: 'changelist' | 'derived';
  active: boolean;
  files: GitFileStatus[];
}

export class ChangelistService {
  public constructor(private readonly store: ChangelistStore) {}

  public async getState(repositoryRoot: string): Promise<ChangelistState> {
    const state = await this.loadOrCreate(repositoryRoot);
    return cloneState(state);
  }

  public async create(repositoryRoot: string, name: string): Promise<Changelist> {
    const state = await this.loadOrCreate(repositoryRoot);
    validateChangelistName(state, name);
    const now = Date.now();
    const changelist: Changelist = {
      id: createId(name, now),
      name,
      active: false,
      createdAt: now,
      updatedAt: now
    };

    state.changelists.push(changelist);
    await this.store.save(repositoryRoot, state);
    return { ...changelist };
  }

  public async rename(repositoryRoot: string, changelistId: string, name: string): Promise<void> {
    const state = await this.loadOrCreate(repositoryRoot);
    const changelist = requireChangelist(state, changelistId);
    validateChangelistName(state, name, changelistId);
    changelist.name = name;
    changelist.updatedAt = Date.now();
    await this.store.save(repositoryRoot, state);
  }

  public async delete(repositoryRoot: string, changelistId: string): Promise<void> {
    if (changelistId === 'default') {
      throw new Error('The default changelist cannot be deleted.');
    }

    const state = await this.loadOrCreate(repositoryRoot);
    state.changelists = state.changelists.filter((changelist) => changelist.id !== changelistId);
    state.assignments = state.assignments
      .filter((assignment) => assignment.changelistId !== changelistId)
      .map((assignment) => ({ ...assignment, changelistId: 'default' }));

    if (!state.changelists.some((changelist) => changelist.active)) {
      requireChangelist(state, 'default').active = true;
    }

    await this.store.save(repositoryRoot, state);
  }

  public async setActive(repositoryRoot: string, changelistId: string): Promise<void> {
    const state = await this.loadOrCreate(repositoryRoot);
    requireChangelist(state, changelistId);
    state.changelists = state.changelists.map((changelist) => ({
      ...changelist,
      active: changelist.id === changelistId,
      updatedAt: changelist.id === changelistId ? Date.now() : changelist.updatedAt
    }));
    await this.store.save(repositoryRoot, state);
  }

  public async moveFiles(repositoryRoot: string, changelistId: string, paths: string[]): Promise<void> {
    const state = await this.loadOrCreate(repositoryRoot);
    requireChangelist(state, changelistId);
    const moving = new Set(paths);
    const retained = state.assignments.filter((assignment) => !moving.has(assignment.path));

    state.assignments = [
      ...retained,
      ...paths.map<ChangelistAssignment>((filePath) => ({
        repositoryRoot,
        path: filePath,
        changelistId
      }))
    ];

    await this.store.save(repositoryRoot, state);
  }

  public async groupStatus(repositoryRoot: string, statuses: GitFileStatus[]): Promise<ChangelistGroup[]> {
    const state = await this.loadOrCreate(repositoryRoot);
    const assignmentByPath = new Map(state.assignments.map((assignment) => [assignment.path, assignment]));
    const changelistGroups = new Map<string, ChangelistGroup>();
    const unversioned: GitFileStatus[] = [];
    const conflicts: GitFileStatus[] = [];

    for (const changelist of state.changelists) {
      changelistGroups.set(changelist.id, {
        id: changelist.id,
        name: changelist.name,
        type: 'changelist',
        active: changelist.active,
        files: []
      });
    }

    for (const status of statuses) {
      if (status.kind === 'untracked') {
        unversioned.push(status);
        continue;
      }

      if (status.kind === 'conflicted') {
        conflicts.push(status);
        continue;
      }

      const assignment = assignmentByPath.get(status.path);
      const changelistId = assignment?.changelistId ?? 'default';
      const group = changelistGroups.get(changelistId) ?? changelistGroups.get('default');
      group?.files.push(status);
    }

    const populatedChangelists = [...changelistGroups.values()].filter((group) => group.files.length > 0);
    const groups = [
      ...populatedChangelists.filter((group) => group.id !== 'default'),
      ...populatedChangelists.filter((group) => group.id === 'default')
    ];

    if (unversioned.length > 0) {
      groups.push({
        id: 'unversioned',
        name: 'Unversioned Files',
        type: 'derived',
        active: false,
        files: unversioned
      });
    }

    if (conflicts.length > 0) {
      groups.push({
        id: 'merge-conflicts',
        name: 'Merge Conflicts',
        type: 'derived',
        active: false,
        files: conflicts
      });
    }

    return groups;
  }

  private async loadOrCreate(repositoryRoot: string): Promise<ChangelistState> {
    const existing = await this.store.load(repositoryRoot);

    if (existing !== undefined) {
      return existing;
    }

    const now = Date.now();
    const initial: ChangelistState = {
      changelists: [
        {
          id: 'default',
          name: 'Changes',
          active: true,
          createdAt: now,
          updatedAt: now
        }
      ],
      assignments: []
    };

    await this.store.save(repositoryRoot, initial);
    return initial;
  }
}

function validateChangelistName(state: ChangelistState, name: string, currentId?: string): void {
  const normalized = normalizeName(name);

  if (normalized.length === 0) {
    throw new Error('Changelist name is required.');
  }

  const duplicate = state.changelists.some((changelist) => (
    changelist.id !== currentId && normalizeName(changelist.name) === normalized
  ));

  if (duplicate) {
    throw new Error(`Changelist already exists: ${name}`);
  }
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

function requireChangelist(state: ChangelistState, changelistId: string): Changelist {
  const changelist = state.changelists.find((candidate) => candidate.id === changelistId);

  if (changelist === undefined) {
    throw new Error(`Changelist not found: ${changelistId}`);
  }

  return changelist;
}

function createId(name: string, timestamp: number): string {
  const normalized = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  return `${normalized || 'changelist'}-${timestamp}`;
}
