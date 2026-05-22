import * as vscode from "vscode";
import { localizeIssue, t } from "../i18n";
import {
  buildMarkdownWorkspaceTree,
  MarkdownWorkspaceFile,
  MarkdownWorkspaceTreeNode
} from "./markdownWorkspace";
import { MarkdownWorkspaceIndex } from "./MarkdownWorkspaceIndex";

export const SUPER_MARKDOWN_MARKDOWN_LIBRARY_VIEW_ID = "superMarkdown.markdownLibrary";

export class MarkdownLibraryTreeProvider implements vscode.TreeDataProvider<MarkdownWorkspaceTreeNode>, vscode.Disposable {
  private readonly changeEmitter = new vscode.EventEmitter<MarkdownWorkspaceTreeNode | undefined | null | void>();
  private readonly disposables: vscode.Disposable[] = [];
  private showProblemDocumentsOnly = false;

  readonly onDidChangeTreeData = this.changeEmitter.event;

  constructor(private readonly index: MarkdownWorkspaceIndex) {
    this.disposables.push(this.index.onDidChange(() => this.changeEmitter.fire()));
  }

  refresh(): void {
    this.changeEmitter.fire();
  }

  toggleProblemFilter(): boolean {
    this.showProblemDocumentsOnly = !this.showProblemDocumentsOnly;
    this.changeEmitter.fire();
    return this.showProblemDocumentsOnly;
  }

  getTitle(): string {
    return this.showProblemDocumentsOnly
      ? `${t("sidebar.markdownLibrary.title")} · ${t("sidebar.markdownLibrary.problemFilter")}`
      : t("sidebar.markdownLibrary.title");
  }

  getTreeItem(element: MarkdownWorkspaceTreeNode): vscode.TreeItem {
    if (element.type === "file") {
      return this.getFileTreeItem(element.file);
    }

    const item = new vscode.TreeItem(
      element.name,
      element.type === "workspace" ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed
    );
    item.id = element.id;
    item.contextValue = element.type === "workspace" ? "superMarkdown.workspaceFolder" : "superMarkdown.directory";
    item.iconPath = new vscode.ThemeIcon(element.type === "workspace" ? "root-folder" : "folder");
    return item;
  }

  getChildren(element?: MarkdownWorkspaceTreeNode): MarkdownWorkspaceTreeNode[] {
    if (element) {
      return element.children;
    }

    const workspaceFolderCount = vscode.workspace.workspaceFolders?.length ?? 0;
    return buildMarkdownWorkspaceTree(this.getVisibleFiles(), { multiRoot: workspaceFolderCount > 1 });
  }

  getEmptyMessage(): string {
    if ((vscode.workspace.workspaceFolders?.length ?? 0) === 0) {
      return t("sidebar.markdownLibrary.noWorkspace");
    }
    if (this.index.getFiles().length === 0) {
      return t("sidebar.markdownLibrary.noFiles");
    }
    if (this.showProblemDocumentsOnly && this.getVisibleFiles().length === 0) {
      return t("sidebar.markdownLibrary.noProblemFiles");
    }
    return "";
  }

  dispose(): void {
    this.disposables.splice(0).forEach((disposable) => disposable.dispose());
    this.changeEmitter.dispose();
  }

  private getVisibleFiles(): MarkdownWorkspaceFile[] {
    const files = this.index.getFiles();
    return this.showProblemDocumentsOnly ? files.filter((file) => file.stats.issueCount > 0) : files;
  }

  private getFileTreeItem(file: MarkdownWorkspaceFile): vscode.TreeItem {
    const item = new vscode.TreeItem(file.filename, vscode.TreeItemCollapsibleState.None);
    item.id = file.uriString;
    item.resourceUri = vscode.Uri.parse(file.uriString);
    item.contextValue = "superMarkdown.markdownFile";
    item.description = this.formatFileDescription(file);
    item.tooltip = this.formatFileTooltip(file);
    item.iconPath = new vscode.ThemeIcon(this.getFileIcon());
    item.command = {
      command: "superMarkdown.openEditor",
      title: t("sidebar.markdownLibrary.open"),
      arguments: [vscode.Uri.parse(file.uriString)]
    };
    return item;
  }

  private getFileIcon(): string {
    return "markdown";
  }

  private formatFileDescription(file: MarkdownWorkspaceFile): string | undefined {
    return file.stats.issueCount > 0 ? String(file.stats.issueCount) : undefined;
  }

  private formatFileTooltip(file: MarkdownWorkspaceFile): vscode.MarkdownString {
    const lines = [
      `**${file.title || file.filename}**`,
      "",
      file.relativePath,
      "",
      `- ${t("sidebar.markdownLibrary.headings", file.stats.headingCount)}`,
      `- ${t("sidebar.markdownLibrary.issues", file.stats.issueCount)}`,
      `- ${t("sidebar.markdownLibrary.tasks", file.stats.uncheckedTaskCount)}`,
      `- ${t("sidebar.markdownLibrary.images", file.stats.imageCount)}`,
      `- ${t("sidebar.markdownLibrary.links", file.stats.linkCount)}`
    ];

    for (const issue of file.issues.slice(0, 5)) {
      const line = issue.line === undefined ? "" : ` ${t("health.issueLine", issue.line + 1)}`;
      lines.push(`- ${issue.severity.toUpperCase()}${line}: ${localizeIssue(issue)}`);
    }

    if (file.issues.length > 5) {
      lines.push(`- ${t("sidebar.markdownLibrary.moreIssues", file.issues.length - 5)}`);
    }

    return new vscode.MarkdownString(lines.join("\n"));
  }
}
