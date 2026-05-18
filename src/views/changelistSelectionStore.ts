import type { FileNode, GroupNode, RepositoryNode } from './changelistTreeModel';

export type TreeCheckboxSummary = 'checked' | 'partial' | 'unchecked';

export class ChangelistSelectionStore {
  private readonly selectedPathsByRepository = new Map<string, Set<string>>();

  public selectedPaths(repositoryRoot: string): string[] {
    return [...(this.selectedPathsByRepository.get(repositoryRoot) ?? [])].sort();
  }

  public isSelected(repositoryRoot: string, path: string): boolean {
    return this.selectedPathsByRepository.get(repositoryRoot)?.has(path) ?? false;
  }

  public setFile(repositoryRoot: string, path: string, selected: boolean): void {
    const paths = this.pathsFor(repositoryRoot);

    if (selected) {
      paths.add(path);
    } else {
      paths.delete(path);
    }
  }

  public setGroup(repositoryRoot: string, paths: string[], selected: boolean): void {
    const current = this.pathsFor(repositoryRoot);

    for (const path of paths) {
      if (selected) {
        current.add(path);
      } else {
        current.delete(path);
      }
    }
  }

  public summaryForGroup(group: GroupNode): TreeCheckboxSummary {
    if (group.children.length === 0) {
      return 'unchecked';
    }

    const selectedCount = group.children.filter((file) => this.isSelected(file.repositoryRoot, file.path)).length;

    if (selectedCount === 0) {
      return 'unchecked';
    }

    if (selectedCount === group.children.length) {
      return 'checked';
    }

    return 'partial';
  }

  public applyTreeCheckboxChange(node: FileNode | GroupNode, selected: boolean): void {
    if (node.kind === 'file') {
      this.setFile(node.repositoryRoot, node.path, selected);
      return;
    }

    this.setGroup(node.repositoryRoot, node.children.map((file) => file.path), selected);
  }

  public prune(tree: RepositoryNode[]): void {
    for (const repository of tree) {
      const availablePaths = new Set(
        repository.children.flatMap((group) => group.children.map((file) => file.path))
      );
      const selected = this.selectedPathsByRepository.get(repository.repositoryRoot);

      if (selected === undefined) {
        continue;
      }

      for (const path of selected) {
        if (!availablePaths.has(path)) {
          selected.delete(path);
        }
      }
    }
  }

  private pathsFor(repositoryRoot: string): Set<string> {
    let paths = this.selectedPathsByRepository.get(repositoryRoot);

    if (paths === undefined) {
      paths = new Set<string>();
      this.selectedPathsByRepository.set(repositoryRoot, paths);
    }

    return paths;
  }
}
