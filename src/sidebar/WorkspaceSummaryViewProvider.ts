import * as vscode from "vscode";
import { getWysiwygSettings } from "../config";
import { t } from "../i18n";
import { escapeAttribute, escapeHtml, escapeJsonForScript } from "../utils/html";
import { MarkdownWorkspaceIndex } from "./MarkdownWorkspaceIndex";

export const SUPER_MARKDOWN_WORKSPACE_SUMMARY_VIEW_ID = "superMarkdown.workspaceSummary";

type WorkspaceSummaryMessage =
  | { type: "ready" }
  | { type: "refresh" }
  | { type: "openSyntaxGuide" }
  | { type: "switchBackgroundTheme" }
  | { type: "saveImageDirectory"; value?: unknown };

export class WorkspaceSummaryViewProvider implements vscode.WebviewViewProvider, vscode.Disposable {
  private view?: vscode.WebviewView;
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
          case "saveImageDirectory":
            void this.saveImageDirectory(message.value);
            break;
        }
      })
    );
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
      imageDirectory: this.getImageDirectory(),
      hasWorkspace: (vscode.workspace.workspaceFolders?.length ?? 0) > 0,
      status,
      error
    });
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

  private render(webview: vscode.Webview): string {
    const nonce = createNonce();
    const payload = escapeJsonForScript(JSON.stringify({
      labels: {
        title: t("sidebar.workspaceSummary.title"),
        files: t("sidebar.workspaceSummary.files"),
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
        placeholder: "assets",
        save: t("webview.save"),
        saving: t("sidebar.workspaceSummary.saving"),
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
      gap: 6px;
    }

    .workspace-summary-sidebar-button {
      box-sizing: border-box;
      min-width: 0;
      width: 100%;
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

    .workspace-summary-sidebar-button:hover,
    .workspace-summary-sidebar-button:focus {
      background: var(--vscode-button-hoverBackground);
      outline: none;
    }

    .workspace-summary-sidebar-row {
      display: grid;
      min-width: 0;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 6px;
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
      min-height: 16px;
    }

    .workspace-summary-sidebar-status.is-error {
      color: var(--vscode-errorForeground);
    }
  </style>
</head>
<body>
  <main class="workspace-summary-sidebar-view">
    <h2 class="workspace-summary-sidebar-title" id="workspace-summary-title"></h2>
    <section class="workspace-summary-sidebar-grid" id="workspace-summary-metrics"></section>
    <section class="workspace-summary-sidebar-actions" aria-labelledby="workspace-summary-actions-title">
      <h3 class="workspace-summary-sidebar-section-title" id="workspace-summary-actions-title"></h3>
      <button id="workspace-summary-refresh" class="workspace-summary-sidebar-button" type="button"></button>
      <button id="workspace-summary-syntax" class="workspace-summary-sidebar-button" type="button"></button>
      <button id="workspace-summary-theme" class="workspace-summary-sidebar-button" type="button"></button>
    </section>
    <section class="workspace-summary-sidebar-actions" aria-labelledby="workspace-summary-assets-title">
      <h3 class="workspace-summary-sidebar-section-title" id="workspace-summary-assets-title"></h3>
      <label class="workspace-summary-sidebar-input-label" id="workspace-summary-directory-label" for="workspace-summary-directory"></label>
      <div class="workspace-summary-sidebar-row">
        <input id="workspace-summary-directory" class="workspace-summary-sidebar-input" type="text" spellcheck="false">
        <button id="workspace-summary-save" class="workspace-summary-sidebar-button" type="button"></button>
      </div>
    </section>
    <div id="workspace-summary-status" class="workspace-summary-sidebar-status" aria-live="polite"></div>
  </main>
  <script id="workspace-summary-payload" type="application/json">${payload}</script>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const payloadElement = document.getElementById("workspace-summary-payload");
    const payload = JSON.parse(payloadElement.textContent || "{}");
    const labels = payload.labels || {};
    const metricsElement = document.getElementById("workspace-summary-metrics");
    const directoryInput = document.getElementById("workspace-summary-directory");
    const saveButton = document.getElementById("workspace-summary-save");
    const statusElement = document.getElementById("workspace-summary-status");

    document.getElementById("workspace-summary-title").textContent = labels.title || "Workspace Summary";
    document.getElementById("workspace-summary-actions-title").textContent = labels.actions || "Actions";
    document.getElementById("workspace-summary-assets-title").textContent = labels.assets || "Assets";
    document.getElementById("workspace-summary-directory-label").textContent = labels.directory || "Directory";
    document.getElementById("workspace-summary-refresh").textContent = labels.refresh || "Refresh";
    document.getElementById("workspace-summary-syntax").textContent = labels.syntaxGuide || "Syntax guide";
    document.getElementById("workspace-summary-theme").textContent = labels.theme || "Theme";
    saveButton.textContent = labels.save || "Save";
    directoryInput.placeholder = labels.placeholder || "assets";

    function setStatus(message, isError) {
      statusElement.textContent = message || "";
      statusElement.classList.toggle("is-error", Boolean(isError));
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

    function renderSummary(summary, hasWorkspace) {
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

    document.getElementById("workspace-summary-refresh").addEventListener("click", () => {
      setStatus(labels.refreshing || "");
      vscode.postMessage({ type: "refresh" });
    });
    document.getElementById("workspace-summary-syntax").addEventListener("click", () => {
      vscode.postMessage({ type: "openSyntaxGuide" });
    });
    document.getElementById("workspace-summary-theme").addEventListener("click", () => {
      vscode.postMessage({ type: "switchBackgroundTheme" });
    });

    function saveDirectory() {
      const value = directoryInput.value.trim() || "assets";
      directoryInput.value = value;
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

    window.addEventListener("message", (event) => {
      const message = event.data || {};
      if (message.type !== "workspaceSummaryState") {
        return;
      }
      renderSummary(message.summary || {}, Boolean(message.hasWorkspace));
      if (typeof message.imageDirectory === "string") {
        directoryInput.value = message.imageDirectory;
      }
      saveButton.disabled = false;
      setStatus(message.error || message.status || "", Boolean(message.error));
    });

    vscode.postMessage({ type: "ready" });
  </script>
</body>
</html>`;
  }
}

function normalizeImageDirectory(value: string): string {
  const trimmed = value.trim().replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+$/, "");
  return trimmed || "assets";
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function createNonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: 32 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}
