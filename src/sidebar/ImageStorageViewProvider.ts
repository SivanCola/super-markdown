import * as vscode from "vscode";
import { getWysiwygSettings } from "../config";
import { t } from "../i18n";
import { escapeAttribute, escapeHtml, escapeJsonForScript } from "../utils/html";

export const SUPER_MARKDOWN_IMAGE_STORAGE_VIEW_ID = "superMarkdown.imageStorage";

type ImageStorageMessage =
  | { type: "ready" }
  | { type: "saveImageDirectory"; value?: unknown };

export class ImageStorageViewProvider implements vscode.WebviewViewProvider, vscode.Disposable {
  private view?: vscode.WebviewView;
  private readonly disposables: vscode.Disposable[] = [];
  private readonly viewDisposables: vscode.Disposable[] = [];

  constructor() {
    this.disposables.push(
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
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = this.render(webviewView.webview);
    this.viewDisposables.push(
      webviewView.webview.onDidReceiveMessage((message: ImageStorageMessage) => {
        if (message.type === "ready") {
          this.postState();
          return;
        }
        if (message.type === "saveImageDirectory") {
          void this.saveImageDirectory(message.value);
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
      this.view.webview.html = this.render(this.view.webview);
    }
  }

  private postState(status?: string, error?: string): void {
    void this.view?.webview.postMessage({
      type: "imageDirectoryState",
      value: this.getImageDirectory(),
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
      this.postState(t("sidebar.imageStorage.saved"));
    } catch (error) {
      this.postState(undefined, `${t("sidebar.imageStorage.failed")}: ${formatError(error)}`);
    }
  }

  private getImageDirectory(): string {
    return normalizeImageDirectory(getWysiwygSettings().imageDirectory);
  }

  private render(webview: vscode.Webview): string {
    const nonce = createNonce();
    const payload = escapeJsonForScript(JSON.stringify({
      value: this.getImageDirectory(),
      labels: {
        title: t("sidebar.imageStorage.title"),
        directory: t("sidebar.imageStorage.directory"),
        placeholder: "assets",
        save: t("webview.save"),
        saving: t("sidebar.imageStorage.saving")
      }
    }));

    return `<!doctype html>
<html lang="${escapeAttribute(vscode.env.language || "en")}">
<head>
  <meta charset="utf-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} data:; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(t("sidebar.imageStorage.title"))}</title>
  <style nonce="${nonce}">
    body {
      margin: 0;
      padding: 14px 12px;
      color: var(--vscode-sideBar-foreground, var(--vscode-foreground));
      background: var(--vscode-sideBar-background, var(--vscode-editor-background));
      font: var(--vscode-font-size) var(--vscode-font-family);
    }

    .image-storage-sidebar-view {
      display: flex;
      min-width: 0;
      flex-direction: column;
      gap: 8px;
    }

    .image-storage-sidebar-title {
      overflow: hidden;
      margin: 0 0 2px;
      color: var(--vscode-sideBarTitle-foreground, var(--vscode-foreground));
      font-size: 13px;
      font-weight: 700;
      line-height: 20px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .image-storage-sidebar-label {
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
      line-height: 18px;
    }

    .image-storage-sidebar-row {
      display: grid;
      min-width: 0;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 6px;
    }

    .image-storage-sidebar-input {
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

    .image-storage-sidebar-input:focus {
      border-color: var(--vscode-focusBorder);
      outline: none;
    }

    .image-storage-sidebar-button {
      height: 28px;
      padding: 0 10px;
      border: 1px solid var(--vscode-button-border, transparent);
      border-radius: 2px;
      color: var(--vscode-button-foreground);
      background: var(--vscode-button-background);
      font: inherit;
      font-size: 12px;
      cursor: pointer;
    }

    .image-storage-sidebar-button:hover,
    .image-storage-sidebar-button:focus {
      background: var(--vscode-button-hoverBackground);
      outline: none;
    }

    .image-storage-sidebar-button:disabled {
      opacity: 0.65;
      cursor: default;
    }

    .image-storage-sidebar-status {
      min-height: 16px;
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
      line-height: 16px;
    }

    .image-storage-sidebar-status.is-error {
      color: var(--vscode-errorForeground);
    }
  </style>
</head>
<body>
  <main class="image-storage-sidebar-view">
    <h2 class="image-storage-sidebar-title" id="image-storage-title"></h2>
    <label class="image-storage-sidebar-label" id="image-storage-label" for="image-storage-directory"></label>
    <div class="image-storage-sidebar-row">
      <input id="image-storage-directory" class="image-storage-sidebar-input" type="text" spellcheck="false">
      <button id="image-storage-save" class="image-storage-sidebar-button" type="button"></button>
    </div>
    <div id="image-storage-status" class="image-storage-sidebar-status" aria-live="polite"></div>
  </main>
  <script id="image-storage-payload" type="application/json">${payload}</script>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const payloadElement = document.getElementById("image-storage-payload");
    const payload = JSON.parse(payloadElement.textContent || "{}");
    const labels = payload.labels || {};
    const input = document.getElementById("image-storage-directory");
    const saveButton = document.getElementById("image-storage-save");
    const statusElement = document.getElementById("image-storage-status");
    document.getElementById("image-storage-title").textContent = labels.title || "Image storage";
    document.getElementById("image-storage-label").textContent = labels.directory || "Directory";
    input.placeholder = labels.placeholder || "assets";
    input.value = typeof payload.value === "string" ? payload.value : "assets";
    saveButton.textContent = labels.save || "Save";

    function setStatus(message, isError) {
      statusElement.textContent = message || "";
      statusElement.classList.toggle("is-error", Boolean(isError));
    }

    function save() {
      const value = input.value.trim() || "assets";
      input.value = value;
      saveButton.disabled = true;
      setStatus(labels.saving || "Saving...");
      vscode.postMessage({ type: "saveImageDirectory", value });
    }

    saveButton.addEventListener("click", save);
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        save();
      }
    });
    window.addEventListener("message", (event) => {
      const message = event.data || {};
      if (message.type !== "imageDirectoryState") {
        return;
      }
      if (typeof message.value === "string") {
        input.value = message.value;
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
  return value.trim() || "assets";
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error || "Unknown error");
}

function createNonce(): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let nonce = "";
  for (let index = 0; index < 32; index += 1) {
    nonce += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  }
  return nonce;
}
