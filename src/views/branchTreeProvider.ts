import * as vscode from 'vscode';
import type { BranchService } from '../git/branchService';
import type { RepositoryService } from '../git/repositoryService';
import { buildBranchTree, type BranchRepositoryNode, type BranchTreeNode } from './branchTreeModel';

export class BranchTreeProvider implements vscode.TreeDataProvider<BranchTreeNode> {
  private readonly changeEmitter = new vscode.EventEmitter<BranchTreeNode | undefined | null | void>();
  private tree: BranchRepositoryNode[] = [];

  public readonly onDidChangeTreeData = this.changeEmitter.event;

  public constructor(
    private readonly repositories: RepositoryService,
    private readonly branches: BranchService,
    private readonly getWorkspaceFolders: () => readonly vscode.WorkspaceFolder[] | undefined
  ) {}

  public async refresh(): Promise<void> {
    const workspaceFolders = this.getWorkspaceFolders() ?? [];
    const discovered = await this.repositories.discover(workspaceFolders.map((folder) => folder.uri.fsPath));
    const repositoryBranches = await Promise.all(
      discovered.map(async (repository) => ({
        root: repository.root,
        branches: await this.branches.list(repository.root)
      }))
    );

    this.tree = buildBranchTree(repositoryBranches);
    this.changeEmitter.fire();
  }

  public getTreeItem(element: BranchTreeNode): vscode.TreeItem {
    const item = new vscode.TreeItem(element.label, collapsibleStateFor(element));
    item.id = element.id;

    if (element.kind === 'repository') {
      item.contextValue = 'gitBranch.repository';
      item.description = `${element.children.length}`;
      item.iconPath = new vscode.ThemeIcon('repo');
    } else {
      item.contextValue = `gitBranch.branch${element.current ? '.current' : ''}${element.remote ? '.remote' : ''}`;
      item.description = element.description;
      item.iconPath = new vscode.ThemeIcon(element.current ? 'check' : 'git-branch');
      item.command = element.current
        ? undefined
        : {
            command: 'intellijGit.checkoutBranch',
            title: 'Checkout Branch',
            arguments: [element]
          };
    }

    return item;
  }

  public getChildren(element?: BranchTreeNode): BranchTreeNode[] {
    if (element === undefined) {
      return this.tree;
    }

    if (element.kind === 'repository') {
      return element.children;
    }

    return [];
  }
}

function collapsibleStateFor(element: BranchTreeNode): vscode.TreeItemCollapsibleState {
  return element.kind === 'repository'
    ? vscode.TreeItemCollapsibleState.Expanded
    : vscode.TreeItemCollapsibleState.None;
}
