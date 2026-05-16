import * as vscode from 'vscode';
import type { ChangelistService } from '../changelists/changelistService';
import type { RepositoryService } from '../git/repositoryService';
import { buildChangelistTree, type ChangelistTreeNode, type RepositoryNode } from './changelistTreeModel';

export class ChangelistTreeProvider implements vscode.TreeDataProvider<ChangelistTreeNode> {
  private readonly changeEmitter = new vscode.EventEmitter<ChangelistTreeNode | undefined | null | void>();
  private tree: RepositoryNode[] = [];

  public readonly onDidChangeTreeData = this.changeEmitter.event;

  public constructor(
    private readonly repositories: RepositoryService,
    private readonly changelists: ChangelistService,
    private readonly getWorkspaceFolders: () => readonly vscode.WorkspaceFolder[] | undefined
  ) {}

  public async refresh(): Promise<void> {
    const workspaceFolders = this.getWorkspaceFolders() ?? [];
    const discovered = await this.repositories.discover(workspaceFolders.map((folder) => folder.uri.fsPath));
    const groupedRepositories = await Promise.all(
      discovered.map(async (repository) => {
        const status = await this.repositories.status(repository.root);
        const groups = await this.changelists.groupStatus(repository.root, status);

        return {
          root: repository.root,
          groups
        };
      })
    );

    this.tree = buildChangelistTree(groupedRepositories);
    this.changeEmitter.fire();
  }

  public getTreeItem(element: ChangelistTreeNode): vscode.TreeItem {
    const item = new vscode.TreeItem(element.label, collapsibleStateFor(element));
    item.id = element.id;
    item.contextValue = element.kind;

    if (element.kind === 'file') {
      item.description = element.statusKind;
      item.resourceUri = vscode.Uri.file(`${element.repositoryRoot}/${element.path}`);
      item.checkboxState = vscode.TreeItemCheckboxState.Unchecked;
      item.command = {
        command: 'intellijGit.openDiffReview',
        title: 'Open Diff Review',
        arguments: [element]
      };
    }

    if (element.kind === 'group') {
      item.description = `${element.children.length}`;
      item.checkboxState = vscode.TreeItemCheckboxState.Unchecked;
    }

    return item;
  }

  public getChildren(element?: ChangelistTreeNode): ChangelistTreeNode[] {
    if (element === undefined) {
      return this.tree;
    }

    if (element.kind === 'repository' || element.kind === 'group') {
      return element.children;
    }

    return [];
  }
}

function collapsibleStateFor(element: ChangelistTreeNode): vscode.TreeItemCollapsibleState {
  if (element.kind === 'file') {
    return vscode.TreeItemCollapsibleState.None;
  }

  return vscode.TreeItemCollapsibleState.Expanded;
}
