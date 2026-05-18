import * as vscode from 'vscode';
import type { LogService } from '../git/logService';
import type { RepositoryService } from '../git/repositoryService';
import { buildLogTree, type LogRepositoryNode, type LogTreeNode } from './logTreeModel';

export class LogViewProvider implements vscode.TreeDataProvider<LogTreeNode> {
  private readonly changeEmitter = new vscode.EventEmitter<LogTreeNode | undefined | null | void>();
  private tree: LogRepositoryNode[] = [];

  public readonly onDidChangeTreeData = this.changeEmitter.event;

  public constructor(
    private readonly repositories: RepositoryService,
    private readonly logs: LogService,
    private readonly getWorkspaceFolders: () => readonly vscode.WorkspaceFolder[] | undefined
  ) {}

  public async refresh(): Promise<void> {
    const workspaceFolders = this.getWorkspaceFolders() ?? [];
    const discovered = await this.repositories.discover(workspaceFolders.map((folder) => folder.uri.fsPath));
    const repositoryLogs = await Promise.all(
      discovered.map(async (repository) => ({
        root: repository.root,
        commits: await this.logs.list(repository.root, { limit: 100 })
      }))
    );

    this.tree = buildLogTree(repositoryLogs);
    this.changeEmitter.fire();
  }

  public getTreeItem(element: LogTreeNode): vscode.TreeItem {
    const item = new vscode.TreeItem(element.label, collapsibleStateFor(element));
    item.id = element.id;
    item.contextValue = `gitLog.${element.kind}`;

    if (element.kind === 'repository') {
      item.description = `${element.children.length}`;
      item.iconPath = new vscode.ThemeIcon('repo');
    }

    if (element.kind === 'commit') {
      item.description = element.description;
      item.tooltip = element.hash;
      item.iconPath = new vscode.ThemeIcon('git-commit');
      item.command = {
        command: 'intellijGit.openCommitDiff',
        title: 'Open Commit Diff',
        arguments: [element]
      };
    }

    if (element.kind === 'file') {
      item.description = element.description;
      item.resourceUri = vscode.Uri.file(`${element.repositoryRoot}/${element.path}`);
      item.command = {
        command: 'intellijGit.openCommitDiff',
        title: 'Open Commit File Diff',
        arguments: [element]
      };
    }

    return item;
  }

  public getChildren(element?: LogTreeNode): LogTreeNode[] {
    if (element === undefined) {
      return this.tree;
    }

    if (element.kind === 'repository' || element.kind === 'commit') {
      return element.children;
    }

    return [];
  }
}

function collapsibleStateFor(element: LogTreeNode): vscode.TreeItemCollapsibleState {
  if (element.kind === 'file') {
    return vscode.TreeItemCollapsibleState.None;
  }

  return vscode.TreeItemCollapsibleState.Collapsed;
}
