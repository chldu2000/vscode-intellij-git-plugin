export interface Changelist {
  id: string;
  name: string;
  description?: string;
  active: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface ChangelistAssignment {
  repositoryRoot: string;
  path: string;
  changelistId: string;
}

export interface ChangelistState {
  changelists: Changelist[];
  assignments: ChangelistAssignment[];
}

export interface ChangelistStore {
  load(repositoryRoot: string): Promise<ChangelistState | undefined>;
  save(repositoryRoot: string, state: ChangelistState): Promise<void>;
}

export class InMemoryChangelistStore implements ChangelistStore {
  private readonly states = new Map<string, ChangelistState>();

  public async load(repositoryRoot: string): Promise<ChangelistState | undefined> {
    const state = this.states.get(repositoryRoot);
    return state === undefined ? undefined : cloneState(state);
  }

  public async save(repositoryRoot: string, state: ChangelistState): Promise<void> {
    this.states.set(repositoryRoot, cloneState(state));
  }
}

export function cloneState(state: ChangelistState): ChangelistState {
  return {
    changelists: state.changelists.map((changelist) => ({ ...changelist })),
    assignments: state.assignments.map((assignment) => ({ ...assignment }))
  };
}
