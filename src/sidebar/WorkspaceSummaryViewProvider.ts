import * as path from "node:path";
import * as vscode from "vscode";
import { getWysiwygSettings } from "../config";
import { localizeIssue, t } from "../i18n";
import { revealDocumentLine } from "../preview/document";
import { escapeAttribute, escapeHtml, escapeJsonForScript } from "../utils/html";
import { createNonce } from "../utils/webview";
import {
  aggregateMarkdownWorkspaceSummary,
  MarkdownWorkspaceFile,
  MarkdownWorkspaceSummary,
  MarkdownWorkspaceTreeNode
} from "./markdownWorkspace";
import { MarkdownWorkspaceIndex } from "./MarkdownWorkspaceIndex";

export const SUPER_MARKDOWN_WORKSPACE_SUMMARY_VIEW_ID = "superMarkdown.workspaceSummary";

type WorkspaceSummaryMessage =
  | { type: "ready" }
  | { type: "refresh" }
  | { type: "openSyntaxGuide" }
  | { type: "switchBackgroundTheme" }
  | { type: "openSelectedFile"; mode?: unknown }
  | { type: "organizeSelectedFile" }
  | { type: "exportSelectedFile" }
  | { type: "revealSelectedIssue"; uri?: unknown; line?: unknown }
  | { type: "chooseImageDirectory" }
  | { type: "saveImageDirectory"; value?: unknown };

interface SelectedDocumentIssueState {
  uriString: string;
  severity: string;
  line?: number;
  message: string;
  source?: string;
}

interface SelectedDocumentState {
  kind: "file";
  uriString: string;
  title: string;
  filename: string;
  relativePath: string;
  workspaceFolderName: string;
  updatedAt: number;
  stats: MarkdownWorkspaceFile["stats"];
  issues: SelectedDocumentIssueState[];
}

interface SelectedFolderState {
  kind: "folder";
  title: string;
  subtitle: string;
  summary: MarkdownWorkspaceSummary;
  issues: SelectedDocumentIssueState[];
}

type SelectedScopeState = SelectedDocumentState | SelectedFolderState;

type SelectedScope =
  | { kind: "file"; uriString: string }
  | { kind: "folder"; id: string; name: string; fileUriStrings: string[] };

export class WorkspaceSummaryViewProvider implements vscode.WebviewViewProvider, vscode.Disposable {
  private view?: vscode.WebviewView;
  private selectedScope?: SelectedScope;
  private readonly disposables: vscode.Disposable[] = [];
  private readonly viewDisposables: vscode.Disposable[] = [];

  constructor(private readonly index: MarkdownWorkspaceIndex) {
    this.disposables.push(
      this.index.onDidChange(() => this.postState()),
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration("superMarkdown.displayLanguage")) {
          this.refresh();
          return;
        }
        if (event.affectsConfiguration("superMarkdown.wysiwyg.imageDirectory")) {
          this.postState();
        }
      })
    );
  }

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    this.viewDisposables.splice(0).forEach((disposable) => disposable.dispose());
    this.updateTitle();
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = this.render(webviewView.webview);
    this.viewDisposables.push(
      webviewView.webview.onDidReceiveMessage((message: WorkspaceSummaryMessage) => {
        switch (message.type) {
          case "ready":
            this.postState();
            break;
          case "refresh":
            void this.refreshIndex();
            break;
          case "openSyntaxGuide":
            void vscode.commands.executeCommand("superMarkdown.openSyntaxGuide");
            break;
          case "switchBackgroundTheme":
            void vscode.commands.executeCommand("superMarkdown.switchBackgroundTheme");
            break;
          case "openSelectedFile":
            void this.openSelectedFile(message.mode);
            break;
          case "organizeSelectedFile":
            void this.executeSelectedFileCommand("superMarkdown.organizeMarkdown");
            break;
          case "exportSelectedFile":
            void this.executeSelectedFileCommand("superMarkdown.export.choose");
            break;
          case "revealSelectedIssue":
            void this.revealSelectedIssue(message.uri, message.line);
            break;
          case "chooseImageDirectory":
            void this.chooseImageDirectory();
            break;
          case "saveImageDirectory":
            void this.saveImageDirectory(message.value);
            break;
        }
      })
    );
  }

  setSelectedMarkdownTreeNode(node?: MarkdownWorkspaceTreeNode): void {
    if (!node) {
      this.selectedScope = undefined;
      this.postState();
      return;
    }

    if (node.type === "file") {
      this.selectedScope = { kind: "file", uriString: node.file.uriString };
      this.postState();
      return;
    }

    const files = collectMarkdownWorkspaceFiles(node.children);
    this.selectedScope = {
      kind: "folder",
      id: node.id,
      name: node.name,
      fileUriStrings: files.map((file) => file.uriString)
    };
    this.postState();
  }

  dispose(): void {
    this.disposables.splice(0).forEach((disposable) => disposable.dispose());
    this.viewDisposables.splice(0).forEach((disposable) => disposable.dispose());
  }

  private refresh(): void {
    if (this.view) {
      this.updateTitle();
      this.view.webview.html = this.render(this.view.webview);
      this.postState();
    }
  }

  private updateTitle(): void {
    if (this.view) {
      this.view.title = t("sidebar.workspaceSummary.title");
    }
  }

  private async refreshIndex(): Promise<void> {
    this.postState(t("sidebar.workspaceSummary.refreshing"));
    await this.index.refresh();
    this.postState(t("sidebar.workspaceSummary.refreshed"));
  }

  private postState(status?: string, error?: string): void {
    void this.view?.webview.postMessage({
      type: "workspaceSummaryState",
      summary: this.index.getSummary(),
      selection: this.getSelectedScopeState(),
      imageDirectory: this.getImageDirectory(),
      hasWorkspace: (vscode.workspace.workspaceFolders?.length ?? 0) > 0,
      status,
      error
    });
  }

  private getSelectedFile(): MarkdownWorkspaceFile | undefined {
    return this.selectedScope?.kind === "file" ? this.index.getFile(this.selectedScope.uriString) : undefined;
  }

  private getSelectedScopeState(): SelectedScopeState | undefined {
    if (!this.selectedScope) {
      return undefined;
    }
    if (this.selectedScope.kind === "file") {
      const file = this.getSelectedFile();
      return file ? this.getSelectedFileState(file) : undefined;
    }
    const files = this.selectedScope.fileUriStrings
      .map((uriString) => this.index.getFile(uriString))
      .filter((file): file is MarkdownWorkspaceFile => Boolean(file));
    return {
      kind: "folder",
      title: this.selectedScope.name,
      subtitle: t("sidebar.workspaceSummary.fileCount", files.length),
      summary: aggregateMarkdownWorkspaceSummary(files),
      issues: files.flatMap((file) => this.getIssueStates(file, file.relativePath)).sort(compareSelectedIssues)
    };
  }

  private getSelectedFileState(file: MarkdownWorkspaceFile): SelectedDocumentState {
    return {
      kind: "file",
      uriString: file.uriString,
      title: file.title,
      filename: file.filename,
      relativePath: file.relativePath,
      workspaceFolderName: file.workspaceFolderName,
      updatedAt: file.updatedAt,
      stats: file.stats,
      issues: this.getIssueStates(file)
    };
  }

  private getIssueStates(file: MarkdownWorkspaceFile, source?: string): SelectedDocumentIssueState[] {
    return file.issues.map((issue) => ({
      uriString: file.uriString,
      severity: issue.severity,
      line: issue.line,
      message: localizeIssue(issue),
      source
    }));
  }

  private getSelectedFileUri(): vscode.Uri | undefined {
    const file = this.getSelectedFile();
    if (!file) {
      return undefined;
    }
    return vscode.Uri.parse(file.uriString);
  }

  private async openSelectedFile(mode: unknown): Promise<void> {
    const command = mode === "preview"
      ? "superMarkdown.openPreview"
      : mode === "split"
        ? "superMarkdown.openSplitEditMode"
        : mode === "wysiwyg"
          ? "superMarkdown.openWysiwygEditor"
          : "superMarkdown.openEditor";
    await this.executeSelectedFileCommand(command);
  }

  private async executeSelectedFileCommand(command: string): Promise<void> {
    const uri = this.getSelectedFileUri();
    if (uri) {
      await vscode.commands.executeCommand(command, uri);
    }
  }

  private async revealSelectedIssue(uriString: unknown, line: unknown): Promise<void> {
    if (typeof uriString !== "string" || typeof line !== "number" || !Number.isInteger(line) || line < 0) {
      return;
    }
    const uri = vscode.Uri.parse(uriString);
    await revealDocumentLine(uri, line);
  }

  private async saveImageDirectory(rawValue: unknown): Promise<void> {
    const value = typeof rawValue === "string" ? normalizeImageDirectory(rawValue) : "assets";
    try {
      const target = vscode.workspace.workspaceFolders?.length
        ? vscode.ConfigurationTarget.Workspace
        : vscode.ConfigurationTarget.Global;
      await vscode.workspace.getConfiguration("superMarkdown").update("wysiwyg.imageDirectory", value, target);
      this.postState(t("sidebar.workspaceSummary.saved"));
    } catch (error) {
      this.postState(undefined, `${t("sidebar.workspaceSummary.failed")}: ${formatError(error)}`);
    }
  }

  private getImageDirectory(): string {
    return normalizeImageDirectory(getWysiwygSettings().imageDirectory);
  }

  private async chooseImageDirectory(): Promise<void> {
    const selected = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      defaultUri: this.getImageDirectoryPickerUri(),
      openLabel: t("sidebar.workspaceSummary.chooseDirectory"),
      title: t("sidebar.workspaceSummary.directory")
    });
    const directory = selected?.[0];
    if (!directory) {
      this.postState();
      return;
    }
    await this.saveImageDirectory(this.toConfiguredImageDirectory(directory));
  }

  private getImageDirectoryPickerUri(): vscode.Uri | undefined {
    const configured = this.getImageDirectory();
    if (path.isAbsolute(configured)) {
      return vscode.Uri.file(configured);
    }
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    return workspaceFolder ? vscode.Uri.file(path.join(workspaceFolder.uri.fsPath, configured)) : undefined;
  }

  private toConfiguredImageDirectory(directory: vscode.Uri): string {
    if (directory.scheme !== "file") {
      return "assets";
    }
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(directory);
    if (!workspaceFolder) {
      return normalizeImageDirectory(directory.fsPath);
    }
    const relativePath = path.relative(workspaceFolder.uri.fsPath, directory.fsPath).replace(/\\/g, "/");
    return normalizeImageDirectory(relativePath || ".");
  }

  private render(webview: vscode.Webview): string {
    const nonce = createNonce();
    const payload = escapeJsonForScript(JSON.stringify({
      labels: {
        title: t("sidebar.workspaceSummary.title"),
        files: t("sidebar.workspaceSummary.files"),
        document: t("sidebar.workspaceSummary.document"),
        folder: t("sidebar.workspaceSummary.folder"),
        selectedDocument: t("sidebar.workspaceSummary.selectedDocument"),
        selectedFolder: t("sidebar.workspaceSummary.selectedFolder"),
        headings: t("sidebar.workspaceSummary.headings"),
        errors: t("sidebar.workspaceSummary.errors"),
        warnings: t("sidebar.workspaceSummary.warnings"),
        info: t("sidebar.workspaceSummary.info"),
        problemList: t("sidebar.workspaceSummary.problemList"),
        noIssues: t("sidebar.workspaceSummary.noIssues"),
        openSource: t("sidebar.workspaceSummary.openSource"),
        openPreview: t("sidebar.workspaceSummary.openPreview"),
        openSplit: t("sidebar.workspaceSummary.openSplit"),
        openWysiwyg: t("sidebar.workspaceSummary.openWysiwyg"),
        organize: t("sidebar.workspaceSummary.organize"),
        export: t("sidebar.workspaceSummary.export"),
        issues: t("sidebar.workspaceSummary.issues"),
        missingImages: t("sidebar.workspaceSummary.missingImages"),
        missingLinks: t("sidebar.workspaceSummary.missingLinks"),
        tasks: t("sidebar.workspaceSummary.tasks"),
        staleToc: t("sidebar.workspaceSummary.staleToc"),
        images: t("sidebar.workspaceSummary.images"),
        links: t("sidebar.workspaceSummary.links"),
        actions: t("sidebar.workspaceSummary.actions"),
        refresh: t("sidebar.workspaceSummary.refresh"),
        refreshing: t("sidebar.workspaceSummary.refreshing"),
        syntaxGuide: t("sidebar.workspaceSummary.syntaxGuide"),
        theme: t("sidebar.workspaceSummary.theme"),
        assets: t("sidebar.workspaceSummary.assets"),
        directory: t("sidebar.workspaceSummary.directory"),
        directoryHelp: t("sidebar.workspaceSummary.directoryHelp"),
        chooseDirectory: t("sidebar.workspaceSummary.chooseDirectory"),
        placeholder: "assets",
        save: t("webview.save"),
        saving: t("sidebar.workspaceSummary.saving"),
        updated: t("sidebar.workspaceSummary.updated"),
        noWorkspace: t("sidebar.workspaceSummary.noWorkspace")
      }
    }));

    return `<!doctype html>
<html lang="${escapeAttribute(vscode.env.language || "en")}">
<head>
  <meta charset="utf-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} data:; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(t("sidebar.workspaceSummary.title"))}</title>
  <style nonce="${nonce}">
    body {
      margin: 0;
      padding: 14px 12px;
      color: var(--vscode-sideBar-foreground, var(--vscode-foreground));
      background: var(--vscode-sideBar-background, var(--vscode-editor-background));
      font: var(--vscode-font-size) var(--vscode-font-family);
    }

    .workspace-summary-sidebar-view {
      display: flex;
      min-width: 0;
      flex-direction: column;
      gap: 14px;
    }

    .workspace-summary-sidebar-title,
    .workspace-summary-sidebar-section-title {
      overflow: hidden;
      margin: 0;
      color: var(--vscode-sideBarTitle-foreground, var(--vscode-foreground));
      font-size: 13px;
      font-weight: 700;
      line-height: 20px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .workspace-summary-sidebar-detail {
      overflow: hidden;
      margin-top: -10px;
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
      line-height: 17px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .workspace-summary-sidebar-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 7px;
    }

    .workspace-summary-sidebar-metric {
      box-sizing: border-box;
      min-width: 0;
      padding: 8px;
      border: 1px solid var(--vscode-sideBarSectionHeader-border, var(--vscode-panel-border));
      border-radius: 4px;
      background: var(--vscode-sideBarSectionHeader-background, transparent);
    }

    .workspace-summary-sidebar-value {
      overflow: hidden;
      color: var(--vscode-foreground);
      font-size: 16px;
      font-weight: 700;
      line-height: 22px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .workspace-summary-sidebar-label,
    .workspace-summary-sidebar-input-label,
    .workspace-summary-sidebar-status {
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
      line-height: 16px;
    }

    .workspace-summary-sidebar-actions {
      display: flex;
      min-width: 0;
      flex-direction: column;
      gap: 7px;
    }

    .workspace-summary-sidebar-action-row {
      display: flex;
      min-width: 0;
      flex-wrap: wrap;
      gap: 4px;
    }

    .workspace-summary-sidebar-file-actions[hidden],
    .workspace-summary-sidebar-issues[hidden],
    .workspace-summary-sidebar-detail[hidden] {
      display: none;
    }

    .workspace-summary-sidebar-button {
      box-sizing: border-box;
      min-width: 0;
      min-height: 28px;
      padding: 4px 8px;
      border: 1px solid var(--vscode-button-border, transparent);
      border-radius: 2px;
      color: var(--vscode-button-foreground);
      background: var(--vscode-button-background);
      font: inherit;
      font-size: 12px;
      line-height: 18px;
      text-align: center;
      cursor: pointer;
    }

    .workspace-summary-sidebar-link-button {
      width: auto;
      min-height: 24px;
      padding: 2px 6px;
      border-color: transparent;
      color: var(--vscode-textLink-foreground);
      background: transparent;
      font-size: 12px;
      line-height: 18px;
    }

    .workspace-summary-sidebar-save-button {
      width: auto;
      padding: 4px 10px;
    }

    .workspace-summary-sidebar-info-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 18px;
      min-width: 18px;
      min-height: 18px;
      padding: 0;
      border-color: transparent;
      border-radius: 50%;
      color: var(--vscode-descriptionForeground);
      background: transparent;
      font-size: 11px;
      line-height: 18px;
    }

    .workspace-summary-sidebar-button:hover,
    .workspace-summary-sidebar-button:focus {
      background: var(--vscode-button-hoverBackground);
      outline: none;
    }

    .workspace-summary-sidebar-link-button:hover,
    .workspace-summary-sidebar-link-button:focus,
    .workspace-summary-sidebar-info-button:hover,
    .workspace-summary-sidebar-info-button:focus {
      background: var(--vscode-toolbar-hoverBackground, var(--vscode-list-hoverBackground));
    }

    .workspace-summary-sidebar-button:focus-visible {
      outline: 1px solid var(--vscode-focusBorder);
      outline-offset: 1px;
    }

    .workspace-summary-sidebar-button:disabled,
    .workspace-summary-sidebar-button:disabled:hover {
      border-color: var(--vscode-input-border, transparent);
      color: var(--vscode-disabledForeground);
      background: var(--vscode-button-secondaryBackground, transparent);
      cursor: default;
    }

    .workspace-summary-sidebar-row {
      display: grid;
      min-width: 0;
      grid-template-columns: minmax(0, 1fr) auto auto;
      gap: 6px;
    }

    .workspace-summary-sidebar-label-row {
      display: flex;
      min-width: 0;
      align-items: center;
      gap: 4px;
    }

    .workspace-summary-sidebar-input {
      box-sizing: border-box;
      min-width: 0;
      width: 100%;
      height: 28px;
      padding: 0 7px;
      border: 1px solid var(--vscode-input-border, transparent);
      border-radius: 2px;
      color: var(--vscode-input-foreground);
      background: var(--vscode-input-background);
      font: inherit;
      font-size: 12px;
      line-height: 26px;
    }

    .workspace-summary-sidebar-input:focus {
      border-color: var(--vscode-focusBorder);
      outline: none;
    }

    .workspace-summary-sidebar-status {
      min-height: 0;
    }

    .workspace-summary-sidebar-issues {
      display: flex;
      min-width: 0;
      flex-direction: column;
      gap: 6px;
    }

    .workspace-summary-sidebar-issue-list {
      display: flex;
      min-width: 0;
      flex-direction: column;
      gap: 4px;
    }

    .workspace-summary-sidebar-issue {
      display: grid;
      min-width: 0;
      grid-template-columns: auto minmax(0, 1fr);
      gap: 6px;
      padding: 6px 7px;
      border: 1px solid var(--vscode-sideBarSectionHeader-border, var(--vscode-panel-border));
      border-radius: 4px;
      color: var(--vscode-sideBar-foreground, var(--vscode-foreground));
      background: transparent;
      font: inherit;
      font-size: 12px;
      line-height: 16px;
      text-align: left;
      cursor: pointer;
    }

    .workspace-summary-sidebar-issue:hover,
    .workspace-summary-sidebar-issue:focus {
      background: var(--vscode-list-hoverBackground);
      outline: none;
    }

    .workspace-summary-sidebar-issue:disabled,
    .workspace-summary-sidebar-issue:disabled:hover {
      color: var(--vscode-disabledForeground);
      background: transparent;
      cursor: default;
    }

    .workspace-summary-sidebar-issue:focus-visible {
      outline: 1px solid var(--vscode-focusBorder);
      outline-offset: 1px;
    }

    .workspace-summary-sidebar-issue-severity {
      color: var(--vscode-descriptionForeground);
      font-weight: 700;
      text-transform: uppercase;
    }

    .workspace-summary-sidebar-issue-message {
      overflow: hidden;
      min-width: 0;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .workspace-summary-sidebar-status[hidden],
    .workspace-summary-sidebar-save-button[hidden] {
      display: none;
    }

    .workspace-summary-sidebar-status.is-error {
      color: var(--vscode-errorForeground);
    }

    .hover-tooltip {
      position: fixed;
      z-index: 20;
      max-width: min(260px, calc(100vw - 16px));
      padding: 4px 8px;
      border: 1px solid var(--vscode-editorHoverWidget-border, var(--vscode-editorWidget-border, var(--vscode-panel-border)));
      border-radius: 4px;
      color: var(--vscode-editorHoverWidget-foreground, var(--vscode-editorWidget-foreground, var(--vscode-foreground)));
      background: var(--vscode-editorHoverWidget-background, var(--vscode-editorWidget-background, var(--vscode-editor-background)));
      box-shadow: 0 3px 10px rgba(15, 23, 42, 0.18);
      font-family: var(--vscode-font-family, inherit);
      font-size: 12px;
      font-weight: 400;
      line-height: 18px;
      overflow-wrap: anywhere;
      opacity: 0;
      pointer-events: none;
      visibility: hidden;
    }

    .hover-tooltip.is-visible {
      opacity: 1;
      visibility: visible;
    }
  </style>
</head>
<body>
  <main class="workspace-summary-sidebar-view">
    <h2 class="workspace-summary-sidebar-title" id="workspace-summary-title"></h2>
    <div class="workspace-summary-sidebar-detail" id="workspace-summary-detail" hidden></div>
    <section class="workspace-summary-sidebar-grid" id="workspace-summary-metrics"></section>
    <section class="workspace-summary-sidebar-action-row workspace-summary-sidebar-file-actions" id="workspace-summary-file-actions" hidden>
      <button class="workspace-summary-sidebar-button workspace-summary-sidebar-link-button" type="button" data-file-command="source"></button>
      <button class="workspace-summary-sidebar-button workspace-summary-sidebar-link-button" type="button" data-file-command="preview"></button>
      <button class="workspace-summary-sidebar-button workspace-summary-sidebar-link-button" type="button" data-file-command="split"></button>
      <button class="workspace-summary-sidebar-button workspace-summary-sidebar-link-button" type="button" data-file-command="wysiwyg"></button>
      <button class="workspace-summary-sidebar-button workspace-summary-sidebar-link-button" type="button" data-file-command="organize"></button>
      <button class="workspace-summary-sidebar-button workspace-summary-sidebar-link-button" type="button" data-file-command="export"></button>
    </section>
    <section class="workspace-summary-sidebar-issues" id="workspace-summary-issues" hidden>
      <h3 class="workspace-summary-sidebar-section-title" id="workspace-summary-issues-title"></h3>
      <div class="workspace-summary-sidebar-issue-list" id="workspace-summary-issue-list"></div>
    </section>
    <section class="workspace-summary-sidebar-action-row" id="workspace-summary-actions" aria-label="">
      <button id="workspace-summary-refresh" class="workspace-summary-sidebar-button workspace-summary-sidebar-link-button" type="button"></button>
      <button id="workspace-summary-syntax" class="workspace-summary-sidebar-button workspace-summary-sidebar-link-button" type="button"></button>
      <button id="workspace-summary-theme" class="workspace-summary-sidebar-button workspace-summary-sidebar-link-button" type="button"></button>
    </section>
    <section class="workspace-summary-sidebar-actions" aria-labelledby="workspace-summary-directory-label">
      <div class="workspace-summary-sidebar-label-row">
        <h3 class="workspace-summary-sidebar-section-title" id="workspace-summary-directory-label"></h3>
        <button id="workspace-summary-directory-info" class="workspace-summary-sidebar-button workspace-summary-sidebar-info-button" type="button">?</button>
      </div>
      <div class="workspace-summary-sidebar-row">
        <input id="workspace-summary-directory" class="workspace-summary-sidebar-input" type="text" spellcheck="false" aria-labelledby="workspace-summary-directory-label">
        <button id="workspace-summary-choose" class="workspace-summary-sidebar-button workspace-summary-sidebar-save-button" type="button"></button>
        <button id="workspace-summary-save" class="workspace-summary-sidebar-button workspace-summary-sidebar-save-button" type="button" disabled hidden></button>
      </div>
    </section>
    <div id="workspace-summary-status" class="workspace-summary-sidebar-status" aria-live="polite" hidden></div>
  </main>
  <script id="workspace-summary-payload" type="application/json">${payload}</script>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const payloadElement = document.getElementById("workspace-summary-payload");
    const payload = JSON.parse(payloadElement.textContent || "{}");
    const labels = payload.labels || {};
    const titleElement = document.getElementById("workspace-summary-title");
    const detailElement = document.getElementById("workspace-summary-detail");
    const metricsElement = document.getElementById("workspace-summary-metrics");
    const fileActionsElement = document.getElementById("workspace-summary-file-actions");
    const issuesElement = document.getElementById("workspace-summary-issues");
    const issuesTitleElement = document.getElementById("workspace-summary-issues-title");
    const issueListElement = document.getElementById("workspace-summary-issue-list");
    const directoryInput = document.getElementById("workspace-summary-directory");
    const directoryInfoButton = document.getElementById("workspace-summary-directory-info");
    const refreshButton = document.getElementById("workspace-summary-refresh");
    const syntaxButton = document.getElementById("workspace-summary-syntax");
    const themeButton = document.getElementById("workspace-summary-theme");
    const chooseButton = document.getElementById("workspace-summary-choose");
    const saveButton = document.getElementById("workspace-summary-save");
    const statusElement = document.getElementById("workspace-summary-status");
    const hoverTooltipSelector = "[data-hover-tooltip]";
    let savedImageDirectory = "assets";
    let pendingImageDirectory = "";
    let statusTimer = 0;
    let hoverTooltipTimer = 0;
    let hoverTooltipElement = null;
    let hoverTooltipTarget = null;

    const fileActionLabels = {
      source: labels.openSource || "Source",
      preview: labels.openPreview || "Preview",
      split: labels.openSplit || "Split",
      wysiwyg: labels.openWysiwyg || "WYSIWYG",
      organize: labels.organize || "Organize",
      export: labels.export || "Export"
    };

    titleElement.textContent = labels.title || "Workspace Summary";
    document.getElementById("workspace-summary-actions").setAttribute("aria-label", labels.actions || "Actions");
    document.getElementById("workspace-summary-directory-label").textContent = labels.directory || "Directory";
    directoryInfoButton.setAttribute("aria-label", labels.directoryHelp || labels.directory || "Directory");
    directoryInfoButton.dataset.hoverTooltip = labels.directoryHelp || "";
    refreshButton.textContent = "↻ " + (labels.refresh || "Refresh");
    refreshButton.title = labels.refresh || "Refresh";
    syntaxButton.textContent = "? " + (labels.syntaxGuide || "Syntax guide");
    syntaxButton.title = labels.syntaxGuide || "Syntax guide";
    themeButton.textContent = "◐ " + (labels.theme || "Theme");
    themeButton.title = labels.theme || "Theme";
    chooseButton.textContent = labels.chooseDirectory || "Choose";
    chooseButton.title = labels.chooseDirectory || "Choose";
    saveButton.textContent = labels.save || "Save";
    directoryInput.placeholder = labels.placeholder || "assets";
    directoryInput.title = labels.directory || "Directory";
    for (const button of fileActionsElement.querySelectorAll("[data-file-command]")) {
      const label = fileActionLabels[button.dataset.fileCommand] || button.dataset.fileCommand || "";
      button.textContent = label;
      button.title = label;
    }

    function setStatus(message, isError) {
      window.clearTimeout(statusTimer);
      statusElement.textContent = message || "";
      statusElement.hidden = !message;
      statusElement.classList.toggle("is-error", Boolean(isError));
      if (message && !isError && message !== labels.noWorkspace) {
        statusTimer = window.setTimeout(() => setStatus("", false), 2200);
      }
    }

    function normalizeDirectory(value) {
      const normalized = String(value || "").trim().replace(/\\\\/g, "/").replace(/\\/+$/, "");
      return (normalized.startsWith("/") ? normalized : normalized.replace(/^\\/+/, "")) || "assets";
    }

    function updateSaveState() {
      const value = normalizeDirectory(directoryInput.value);
      const hasChanged = value !== savedImageDirectory;
      saveButton.disabled = !hasChanged || pendingImageDirectory === value;
      saveButton.hidden = !hasChanged;
    }

    function getHoverTooltipTarget(target) {
      const element = target instanceof Element ? target : target && target.parentElement;
      return element ? element.closest(hoverTooltipSelector) : null;
    }

    function scheduleHoverTooltip(target) {
      const text = target.dataset.hoverTooltip || target.getAttribute("aria-label") || "";
      if (!text.trim()) {
        return;
      }
      hideHoverTooltip();
      hoverTooltipTarget = target;
      hoverTooltipTimer = window.setTimeout(() => showHoverTooltip(target, text), 500);
    }

    function showHoverTooltip(target, text) {
      const tooltip = ensureHoverTooltip();
      tooltip.textContent = text;
      tooltip.style.visibility = "hidden";
      tooltip.classList.add("is-visible");
      target.setAttribute("aria-describedby", tooltip.id);

      const targetRect = target.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();
      const gap = 8;
      const viewportPadding = 8;
      const maxLeft = Math.max(viewportPadding, window.innerWidth - tooltipRect.width - viewportPadding);
      const left = Math.min(
        Math.max(viewportPadding, targetRect.left + targetRect.width / 2 - tooltipRect.width / 2),
        maxLeft
      );
      const bottomTop = targetRect.bottom + gap;
      const top = bottomTop + tooltipRect.height <= window.innerHeight - viewportPadding
        ? bottomTop
        : Math.max(viewportPadding, targetRect.top - tooltipRect.height - gap);

      tooltip.style.left = Math.round(left) + "px";
      tooltip.style.top = Math.round(top) + "px";
      tooltip.style.visibility = "";
    }

    function ensureHoverTooltip() {
      if (hoverTooltipElement) {
        return hoverTooltipElement;
      }
      hoverTooltipElement = document.createElement("div");
      hoverTooltipElement.id = "hover-tooltip";
      hoverTooltipElement.className = "hover-tooltip";
      hoverTooltipElement.setAttribute("role", "tooltip");
      document.body.appendChild(hoverTooltipElement);
      return hoverTooltipElement;
    }

    function hideHoverTooltip() {
      window.clearTimeout(hoverTooltipTimer);
      hoverTooltipTarget && hoverTooltipTarget.removeAttribute("aria-describedby");
      hoverTooltipTarget = null;
      if (hoverTooltipElement) {
        hoverTooltipElement.classList.remove("is-visible");
        hoverTooltipElement.removeAttribute("style");
      }
    }

    function renderMetric(label, value) {
      const item = document.createElement("div");
      item.className = "workspace-summary-sidebar-metric";
      const valueElement = document.createElement("div");
      valueElement.className = "workspace-summary-sidebar-value";
      valueElement.textContent = String(value || 0);
      const labelElement = document.createElement("div");
      labelElement.className = "workspace-summary-sidebar-label";
      labelElement.textContent = label;
      item.append(valueElement, labelElement);
      return item;
    }

    function formatLabel(template, value) {
      return String(template || "").replace("{0}", value);
    }

    function formatUpdated(timestamp) {
      if (!timestamp) {
        return "";
      }
      return formatLabel(labels.updated || "Updated {0}", new Date(timestamp).toLocaleString());
    }

    function setDetail(text) {
      detailElement.textContent = text || "";
      detailElement.hidden = !text;
      detailElement.title = text || "";
    }

    function renderWorkspaceSummary(summary, hasWorkspace) {
      titleElement.textContent = labels.title || "Workspace Summary";
      setDetail("");
      fileActionsElement.hidden = true;
      renderIssues([]);
      issuesElement.hidden = true;
      metricsElement.replaceChildren(
        renderMetric(labels.files || "Files", summary.fileCount),
        renderMetric(labels.issues || "Issues", summary.issueCount),
        renderMetric(labels.missingImages || "Missing images", summary.brokenImageCount),
        renderMetric(labels.missingLinks || "Missing links", summary.brokenLinkCount),
        renderMetric(labels.tasks || "Tasks", summary.uncheckedTaskCount),
        renderMetric(labels.staleToc || "Stale TOC", summary.staleTocFileCount),
        renderMetric(labels.images || "Images", summary.imageCount),
        renderMetric(labels.links || "Links", summary.linkCount)
      );
      if (!hasWorkspace) {
        setStatus(labels.noWorkspace || "Open a workspace folder first.");
      }
    }

    function renderFileSummary(file) {
      const stats = file.stats || {};
      titleElement.textContent = labels.selectedDocument || "Document Details";
      setDetail([file.title || file.filename, file.relativePath, formatUpdated(file.updatedAt)].filter(Boolean).join(" · "));
      fileActionsElement.hidden = false;
      metricsElement.replaceChildren(
        renderMetric(labels.headings || "Headings", stats.headingCount),
        renderMetric(labels.issues || "Issues", stats.issueCount),
        renderMetric(labels.errors || "Errors", stats.errorCount),
        renderMetric(labels.warnings || "Warnings", stats.warningCount),
        renderMetric(labels.info || "Info", stats.infoCount),
        renderMetric(labels.missingImages || "Missing images", stats.brokenImageCount),
        renderMetric(labels.missingLinks || "Missing links", stats.brokenLinkCount),
        renderMetric(labels.tasks || "Tasks", stats.uncheckedTaskCount),
        renderMetric(labels.images || "Images", stats.imageCount),
        renderMetric(labels.links || "Links", stats.linkCount)
      );
      renderIssues(file.issues || []);
    }

    function renderFolderSummary(folder) {
      const summary = folder.summary || {};
      titleElement.textContent = labels.selectedFolder || "Folder Summary";
      setDetail([folder.title || labels.folder || "Folder", folder.subtitle].filter(Boolean).join(" · "));
      fileActionsElement.hidden = true;
      metricsElement.replaceChildren(
        renderMetric(labels.files || "Files", summary.fileCount),
        renderMetric(labels.issues || "Issues", summary.issueCount),
        renderMetric(labels.errors || "Errors", summary.errorCount),
        renderMetric(labels.warnings || "Warnings", summary.warningCount),
        renderMetric(labels.missingImages || "Missing images", summary.brokenImageCount),
        renderMetric(labels.missingLinks || "Missing links", summary.brokenLinkCount),
        renderMetric(labels.tasks || "Tasks", summary.uncheckedTaskCount),
        renderMetric(labels.staleToc || "Stale TOC", summary.staleTocFileCount),
        renderMetric(labels.images || "Images", summary.imageCount),
        renderMetric(labels.links || "Links", summary.linkCount)
      );
      renderIssues(folder.issues || []);
    }

    function renderIssues(issues) {
      issueListElement.replaceChildren();
      if (!issues.length) {
        issuesElement.hidden = true;
        return;
      }
      issuesTitleElement.textContent = labels.problemList || "Problems";
      for (const issue of issues.slice(0, 20)) {
        const item = document.createElement("button");
        item.className = "workspace-summary-sidebar-issue";
        item.type = "button";
        item.dataset.issueUri = issue.uriString || "";
        if (Number.isInteger(issue.line)) {
          item.dataset.issueLine = String(issue.line);
          item.title = issue.source ? issue.source : "";
        } else {
          item.disabled = true;
        }
        const severityElement = document.createElement("span");
        severityElement.className = "workspace-summary-sidebar-issue-severity";
        severityElement.textContent = issue.severity || "";
        const messageElement = document.createElement("span");
        messageElement.className = "workspace-summary-sidebar-issue-message";
        messageElement.textContent = [issue.source, issue.message].filter(Boolean).join(": ");
        item.append(severityElement, messageElement);
        issueListElement.appendChild(item);
      }
      issuesElement.hidden = false;
    }

    refreshButton.addEventListener("click", () => {
      setStatus(labels.refreshing || "");
      vscode.postMessage({ type: "refresh" });
    });
    syntaxButton.addEventListener("click", () => {
      vscode.postMessage({ type: "openSyntaxGuide" });
    });
    themeButton.addEventListener("click", () => {
      vscode.postMessage({ type: "switchBackgroundTheme" });
    });
    directoryInfoButton.addEventListener("click", () => {
      setStatus(labels.directoryHelp || "", false);
    });
    chooseButton.addEventListener("click", () => {
      vscode.postMessage({ type: "chooseImageDirectory" });
    });
    fileActionsElement.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target.closest("[data-file-command]") : null;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      const command = target.dataset.fileCommand;
      if (command === "organize") {
        vscode.postMessage({ type: "organizeSelectedFile" });
      } else if (command === "export") {
        vscode.postMessage({ type: "exportSelectedFile" });
      } else {
        vscode.postMessage({ type: "openSelectedFile", mode: command });
      }
    });
    issueListElement.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target.closest("[data-issue-uri]") : null;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      const line = Number(target.dataset.issueLine);
      if (!Number.isInteger(line)) {
        return;
      }
      vscode.postMessage({ type: "revealSelectedIssue", uri: target.dataset.issueUri, line });
    });

    function saveDirectory() {
      const value = normalizeDirectory(directoryInput.value);
      if (saveButton.disabled) {
        directoryInput.value = value;
        return;
      }
      directoryInput.value = value;
      pendingImageDirectory = value;
      saveButton.disabled = true;
      setStatus(labels.saving || "Saving...");
      vscode.postMessage({ type: "saveImageDirectory", value });
    }

    saveButton.addEventListener("click", saveDirectory);
    directoryInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        saveDirectory();
      }
    });
    directoryInput.addEventListener("input", updateSaveState);
    document.addEventListener("mouseover", (event) => {
      const target = getHoverTooltipTarget(event.target);
      const relatedTarget = event.relatedTarget instanceof Node ? event.relatedTarget : null;
      if (!target || target.contains(relatedTarget)) {
        return;
      }
      scheduleHoverTooltip(target);
    });
    document.addEventListener("mouseout", (event) => {
      const target = getHoverTooltipTarget(event.target);
      const relatedTarget = event.relatedTarget instanceof Node ? event.relatedTarget : null;
      if (!target || target.contains(relatedTarget)) {
        return;
      }
      hideHoverTooltip();
    });
    document.addEventListener("focusin", (event) => {
      const target = getHoverTooltipTarget(event.target);
      if (target) {
        scheduleHoverTooltip(target);
      }
    });
    document.addEventListener("focusout", hideHoverTooltip);
    document.addEventListener("click", (event) => {
      if (getHoverTooltipTarget(event.target)) {
        hideHoverTooltip();
      }
    });
    window.addEventListener("scroll", hideHoverTooltip, true);
    window.addEventListener("resize", hideHoverTooltip);

    window.addEventListener("message", (event) => {
      const message = event.data || {};
      if (message.type !== "workspaceSummaryState") {
        return;
      }
      if (message.selection && message.selection.kind === "file") {
        renderFileSummary(message.selection);
      } else if (message.selection && message.selection.kind === "folder") {
        renderFolderSummary(message.selection);
      } else {
        renderWorkspaceSummary(message.summary || {}, Boolean(message.hasWorkspace));
      }
      if (typeof message.imageDirectory === "string") {
        savedImageDirectory = normalizeDirectory(message.imageDirectory);
        directoryInput.value = savedImageDirectory;
      }
      pendingImageDirectory = "";
      updateSaveState();
      setStatus(message.error || message.status || "", Boolean(message.error));
    });

    vscode.postMessage({ type: "ready" });
  </script>
</body>
</html>`;
  }
}

function normalizeImageDirectory(value: string): string {
  const trimmed = value.trim().replace(/\\/g, "/").replace(/\/+$/, "");
  if (path.isAbsolute(trimmed)) {
    return trimmed;
  }
  return trimmed.replace(/^\/+/, "") || "assets";
}

function collectMarkdownWorkspaceFiles(nodes: readonly MarkdownWorkspaceTreeNode[]): MarkdownWorkspaceFile[] {
  return nodes.flatMap((node) => node.type === "file" ? [node.file] : collectMarkdownWorkspaceFiles(node.children));
}

function compareSelectedIssues(a: SelectedDocumentIssueState, b: SelectedDocumentIssueState): number {
  const severity = getIssueSeverityRank(a.severity) - getIssueSeverityRank(b.severity);
  if (severity !== 0) {
    return severity;
  }
  const source = (a.source || "").localeCompare(b.source || "", undefined, { sensitivity: "base" });
  if (source !== 0) {
    return source;
  }
  return (a.line ?? Number.MAX_SAFE_INTEGER) - (b.line ?? Number.MAX_SAFE_INTEGER);
}

function getIssueSeverityRank(severity: string): number {
  return severity === "error" ? 0 : severity === "warning" ? 1 : severity === "info" ? 2 : 3;
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
