import * as path from "node:path";
import * as vscode from "vscode";
import { getPreviewSettings } from "../config";
import { t } from "../i18n";
import { analyzeMarkdownHealth } from "../markdown/health";
import { extractHeadings } from "../markdown/outline";
import { renderMarkdown } from "../markdown/render";
import { buildPreviewHtml } from "./html";

type PreviewMode = "preview" | "splitEdit";

export class PreviewManager implements vscode.Disposable {
  private readonly panels = new Map<string, MarkdownPreviewPanel>();
  private readonly disposables: vscode.Disposable[] = [];

  constructor(private readonly context: vscode.ExtensionContext, onDidChangeDisplayLanguage?: vscode.Event<void>) {
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument((event) => {
        const panel = this.panels.get(event.document.uri.toString());
        if (panel) {
          void panel.update(event.document);
        }
      }),
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration("superMarkdown")) {
          void this.refreshAll();
        }
      }),
      vscode.window.onDidChangeTextEditorSelection((event) => {
        const panel = this.panels.get(event.textEditor.document.uri.toString());
        const line = event.selections[0]?.active.line;
        if (panel?.syncsFromSource() && typeof line === "number") {
          panel.revealPreviewLine(line);
        }
      })
    );
    if (onDidChangeDisplayLanguage) {
      this.disposables.push(onDidChangeDisplayLanguage(() => void this.refreshAll()));
    }
  }

  async openPreview(document: vscode.TextDocument, viewColumn: vscode.ViewColumn, mode: PreviewMode = "preview"): Promise<void> {
    const key = document.uri.toString();
    const existing = this.panels.get(key);
    if (existing) {
      existing.setMode(mode);
      existing.reveal(viewColumn);
      await existing.update(document);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "superMarkdown.preview",
      `${mode === "splitEdit" ? t("mode.splitEdit") : t("mode.preview")}: ${path.basename(document.fileName)}`,
      viewColumn,
      {
        enableScripts: true,
        retainContextWhenHidden: false,
        localResourceRoots: [
          this.context.extensionUri,
          document.uri.scheme === "file"
            ? vscode.Uri.file(path.dirname(document.uri.fsPath))
            : this.context.extensionUri
        ]
      }
    );

    const preview = new MarkdownPreviewPanel(this.context.extensionUri, panel, document, mode, () => {
      this.panels.delete(key);
    });
    this.panels.set(key, preview);
    await preview.update(document);
  }

  async openSplitEditMode(document: vscode.TextDocument): Promise<void> {
    await vscode.window.showTextDocument(document, {
      viewColumn: vscode.ViewColumn.One,
      preview: false,
      preserveFocus: false
    });
    await this.openPreview(document, vscode.ViewColumn.Beside, "splitEdit");
  }

  async refreshActive(resource?: vscode.Uri): Promise<void> {
    const document = await resolveMarkdownDocument(resource);
    if (!document) {
      void vscode.window.showWarningMessage(t("message.noMarkdownRefresh"));
      return;
    }

    const panel = this.panels.get(document.uri.toString());
    if (panel) {
      await panel.update(document);
      return;
    }

    await this.openPreview(document, vscode.ViewColumn.Beside);
  }

  dispose(): void {
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    for (const panel of this.panels.values()) {
      panel.dispose();
    }
    this.panels.clear();
  }

  private async refreshAll(): Promise<void> {
    await Promise.all([...this.panels.values()].map((panel) => panel.reloadDocument()));
  }
}

class MarkdownPreviewPanel implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly panel: vscode.WebviewPanel,
    private document: vscode.TextDocument,
    private mode: PreviewMode,
    onDispose: () => void
  ) {
    this.disposables.push(
      panel.onDidDispose(onDispose),
      panel.webview.onDidReceiveMessage((message) => {
        void this.handleMessage(message);
      })
    );
  }

  reveal(viewColumn: vscode.ViewColumn): void {
    this.panel.reveal(viewColumn);
  }

  setMode(mode: PreviewMode): void {
    this.mode = mode;
  }

  syncsFromSource(): boolean {
    return this.mode === "splitEdit";
  }

  revealPreviewLine(line: number): void {
    void this.panel.webview.postMessage({ type: "revealPreviewLine", line });
  }

  async reloadDocument(): Promise<void> {
    const document = await vscode.workspace.openTextDocument(this.document.uri);
    await this.update(document);
  }

  async update(document: vscode.TextDocument): Promise<void> {
    this.document = document;
    const settings = getPreviewSettings();
    const headings = extractHeadings(document.getText(), { levels: settings.tocLevels });
    const issues = await analyzeMarkdownHealth(document.getText(), {
      levels: settings.tocLevels,
      fileExists: async (target) => fileExistsNearDocument(document, target)
    });
    const contentHtml = renderMarkdown({
      document,
      webview: this.panel.webview,
      headings,
      settings
    });

    this.panel.title = `${this.mode === "splitEdit" ? t("mode.splitEdit") : t("mode.preview")}: ${path.basename(document.fileName)}`;
    this.panel.webview.html = buildPreviewHtml({
      webview: this.panel.webview,
      extensionUri: this.extensionUri,
      document,
      contentHtml,
      headings,
      issues,
      mode: this.mode,
      settings
    });
  }

  dispose(): void {
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.panel.dispose();
  }

  private async handleMessage(message: { type?: string; line?: number; text?: string; href?: string; message?: string }) {
    switch (message.type) {
      case "revealLine":
        if (typeof message.line === "number") {
          await revealDocumentLine(this.document.uri, message.line);
        }
        break;
      case "copyText":
        if (typeof message.text === "string") {
          await vscode.env.clipboard.writeText(message.text);
        }
        break;
      case "openLink":
        if (typeof message.href === "string") {
          await openMarkdownLink(this.document, message.href);
        }
        break;
      case "switchDisplayLanguage":
        await vscode.commands.executeCommand("superMarkdown.switchDisplayLanguage");
        break;
      case "previewError":
        if (message.message) {
          void vscode.window.showWarningMessage(t("message.previewError", message.message));
        }
        break;
      default:
        break;
    }
  }
}

export function getActiveMarkdownDocument(): vscode.TextDocument | undefined {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== "markdown") {
    return undefined;
  }
  return editor.document;
}

export async function resolveMarkdownDocument(resource?: vscode.Uri): Promise<vscode.TextDocument | undefined> {
  if (resource) {
    const document = await tryOpenMarkdownDocument(resource);
    if (document) {
      return document;
    }
  }

  const active = getActiveMarkdownDocument();
  if (active) {
    return active;
  }

  const tabDocument = await getMarkdownDocumentFromActiveTab();
  if (tabDocument) {
    return tabDocument;
  }

  const visibleMarkdownEditors = vscode.window.visibleTextEditors.filter((editor) => isMarkdownDocument(editor.document));
  if (visibleMarkdownEditors.length === 1) {
    return visibleMarkdownEditors[0].document;
  }

  const openMarkdownDocuments = vscode.workspace.textDocuments.filter(isMarkdownDocument);
  if (openMarkdownDocuments.length === 1) {
    return openMarkdownDocuments[0];
  }

  return pickMarkdownDocument();
}

async function getMarkdownDocumentFromActiveTab(): Promise<vscode.TextDocument | undefined> {
  const tab = vscode.window.tabGroups.activeTabGroup.activeTab;
  const input = tab?.input;
  const candidateUris: vscode.Uri[] = [];

  if (input instanceof vscode.TabInputText || input instanceof vscode.TabInputCustom) {
    candidateUris.push(input.uri);
  } else if (input instanceof vscode.TabInputTextDiff) {
    candidateUris.push(input.modified, input.original);
  }

  for (const uri of candidateUris) {
    const document = await tryOpenMarkdownDocument(uri);
    if (document) {
      return document;
    }
  }

  return undefined;
}

async function pickMarkdownDocument(): Promise<vscode.TextDocument | undefined> {
  const files = await vscode.workspace.findFiles("**/*.{md,markdown,mdown,mkdn}", "**/{node_modules,out,media/vendor}/**", 100);
  if (files.length === 0) {
    void vscode.window.showWarningMessage(t("message.noMarkdownFiles"));
    return undefined;
  }

  const workspaceFolders = vscode.workspace.workspaceFolders ?? [];
  const selected = await vscode.window.showQuickPick(
    files.map((uri) => ({
      label: path.basename(uri.fsPath),
      description: workspaceFolders.length > 0 ? vscode.workspace.asRelativePath(uri, false) : uri.fsPath,
      uri
    })),
    { title: t("message.selectMarkdownFile") }
  );

  if (!selected) {
    return undefined;
  }

  return vscode.workspace.openTextDocument(selected.uri);
}

export async function tryOpenMarkdownDocument(uri: vscode.Uri): Promise<vscode.TextDocument | undefined> {
  if (!isMarkdownUri(uri)) {
    return undefined;
  }

  try {
    const document = await vscode.workspace.openTextDocument(uri);
    return isMarkdownDocument(document) ? document : undefined;
  } catch {
    return undefined;
  }
}

function isMarkdownDocument(document: vscode.TextDocument): boolean {
  return document.languageId === "markdown" || isMarkdownUri(document.uri);
}

function isMarkdownUri(uri: vscode.Uri): boolean {
  if (uri.scheme !== "file" && uri.scheme !== "untitled") {
    return false;
  }
  return [".md", ".markdown", ".mdown", ".mkdn"].includes(path.extname(uri.fsPath).toLowerCase());
}

export async function revealDocumentLine(uri: vscode.Uri, line: number): Promise<void> {
  const existingEditor = vscode.window.visibleTextEditors.find((editor) => editor.document.uri.toString() === uri.toString());
  const document = existingEditor?.document ?? (await vscode.workspace.openTextDocument(uri));
  const editor = await vscode.window.showTextDocument(document, {
    viewColumn: existingEditor?.viewColumn ?? vscode.ViewColumn.One,
    preview: false,
    preserveFocus: false
  });

  const safeLine = Math.max(0, Math.min(line, document.lineCount - 1));
  const range = new vscode.Range(safeLine, 0, safeLine, document.lineAt(safeLine).text.length);
  editor.selection = new vscode.Selection(range.start, range.end);
  editor.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
}

export async function openMarkdownLink(document: vscode.TextDocument, href: string): Promise<void> {
  if (/^https?:/i.test(href)) {
    await vscode.env.openExternal(vscode.Uri.parse(href));
    return;
  }

  if (href.startsWith("mailto:")) {
    await vscode.env.openExternal(vscode.Uri.parse(href));
    return;
  }

  if (document.uri.scheme !== "file") {
    return;
  }

  const targetPath = href.split("#")[0].split("?")[0];
  if (!targetPath) {
    return;
  }

  const targetUri = path.isAbsolute(targetPath)
    ? vscode.Uri.file(targetPath)
    : vscode.Uri.file(path.resolve(path.dirname(document.uri.fsPath), decodeURIComponent(targetPath)));
  await vscode.window.showTextDocument(targetUri, { preview: false });
}

export async function fileExistsNearDocument(document: vscode.TextDocument, target: string): Promise<boolean> {
  if (document.uri.scheme !== "file") {
    return true;
  }

  try {
    const decoded = decodeURIComponent(target);
    const uri = path.isAbsolute(decoded)
      ? vscode.Uri.file(decoded)
      : vscode.Uri.file(path.resolve(path.dirname(document.uri.fsPath), decoded));
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
}
