import * as path from "node:path";
import * as vscode from "vscode";
import { getPreviewSettings } from "../config";
import { analyzeMarkdownHealth } from "../markdown/health";
import { parseMarkdownResourceTarget } from "../markdown/resource";
import {
  aggregateMarkdownWorkspaceSummary,
  analyzeMarkdownWorkspaceText,
  isExcludedMarkdownWorkspacePath,
  isMarkdownWorkspacePath,
  MARKDOWN_WORKSPACE_EXTENSIONS,
  MarkdownWorkspaceFile,
  MarkdownWorkspaceSummary
} from "./markdownWorkspace";

const MARKDOWN_FIND_EXCLUDE = "{**/.git/**,**/node_modules/**,**/out/**,**/dist/**}";

export class MarkdownWorkspaceIndex implements vscode.Disposable {
  private readonly changeEmitter = new vscode.EventEmitter<void>();
  private readonly entries = new Map<string, MarkdownWorkspaceFile>();
  private refreshVersion = 0;

  readonly onDidChange = this.changeEmitter.event;

  async refresh(): Promise<void> {
    const version = ++this.refreshVersion;
    const uris = await this.findMarkdownUris();
    const analyzed = await Promise.all(uris.map((uri) => this.analyzeUri(uri)));

    if (version !== this.refreshVersion) {
      return;
    }

    this.entries.clear();
    for (const entry of analyzed) {
      if (entry) {
        this.entries.set(entry.uriString, entry);
      }
    }
    this.changeEmitter.fire();
  }

  async refreshFile(uri: vscode.Uri): Promise<void> {
    if (!this.shouldIncludeUri(uri)) {
      this.removeFile(uri);
      return;
    }

    const entry = await this.analyzeUri(uri);
    if (entry) {
      this.entries.set(entry.uriString, entry);
    } else {
      this.entries.delete(uri.toString());
    }
    this.changeEmitter.fire();
  }

  removeFile(uri: vscode.Uri): void {
    if (this.entries.delete(uri.toString())) {
      this.changeEmitter.fire();
    }
  }

  getFiles(): MarkdownWorkspaceFile[] {
    return Array.from(this.entries.values()).sort((a, b) =>
      `${a.workspaceFolderName}/${a.relativePath}`.localeCompare(`${b.workspaceFolderName}/${b.relativePath}`, undefined, {
        sensitivity: "base"
      })
    );
  }

  getFile(uri: vscode.Uri | string): MarkdownWorkspaceFile | undefined {
    const key = typeof uri === "string" ? uri : uri.toString();
    return this.entries.get(key);
  }

  getSummary(): MarkdownWorkspaceSummary {
    return aggregateMarkdownWorkspaceSummary(this.getFiles());
  }

  dispose(): void {
    this.changeEmitter.dispose();
  }

  private async findMarkdownUris(): Promise<vscode.Uri[]> {
    const found = await Promise.all(
      MARKDOWN_WORKSPACE_EXTENSIONS.map((extension) =>
        vscode.workspace.findFiles(`**/*${extension}`, MARKDOWN_FIND_EXCLUDE)
      )
    );
    const seen = new Set<string>();
    return found
      .flat()
      .filter((uri) => {
        const key = uri.toString();
        if (seen.has(key) || !this.shouldIncludeUri(uri)) {
          return false;
        }
        seen.add(key);
        return true;
      });
  }

  private shouldIncludeUri(uri: vscode.Uri): boolean {
    if (!isMarkdownWorkspacePath(uri.fsPath)) {
      return false;
    }
    const folder = vscode.workspace.getWorkspaceFolder(uri);
    if (!folder) {
      return false;
    }
    const relativePath = path.relative(folder.uri.fsPath, uri.fsPath);
    return !isExcludedMarkdownWorkspacePath(relativePath);
  }

  private async analyzeUri(uri: vscode.Uri): Promise<MarkdownWorkspaceFile | undefined> {
    const folder = vscode.workspace.getWorkspaceFolder(uri);
    if (!folder || !this.shouldIncludeUri(uri)) {
      return undefined;
    }

    try {
      const bytes = await vscode.workspace.fs.readFile(uri);
      const text = new TextDecoder("utf-8").decode(bytes);
      const relativePath = path.relative(folder.uri.fsPath, uri.fsPath).replace(/\\/g, "/");
      const filename = path.basename(uri.fsPath);
      const issues = await analyzeMarkdownHealth(text, {
        levels: getPreviewSettings().tocLevels,
        fileExists: async (target) => this.fileExistsNear(uri, target)
      });
      const analyzed = analyzeMarkdownWorkspaceText(text, filename, issues);

      return {
        uriString: uri.toString(),
        workspaceFolderName: folder.name,
        relativePath,
        filename,
        title: analyzed.title,
        stats: analyzed.stats,
        issues,
        updatedAt: Date.now()
      };
    } catch {
      return undefined;
    }
  }

  private async fileExistsNear(documentUri: vscode.Uri, target: string): Promise<boolean> {
    if (documentUri.scheme !== "file") {
      return false;
    }

    const resource = parseMarkdownResourceTarget(target, documentUri.fsPath);
    const absolutePath = resource.absolutePath ?? (path.isAbsolute(resource.decodedPath)
      ? resource.decodedPath
      : path.resolve(path.dirname(documentUri.fsPath), resource.decodedPath));

    try {
      await vscode.workspace.fs.stat(vscode.Uri.file(absolutePath));
      return true;
    } catch {
      return false;
    }
  }
}
