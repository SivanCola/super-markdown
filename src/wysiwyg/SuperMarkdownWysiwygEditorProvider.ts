import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as vscode from "vscode";
import { getPreviewSettings, getWysiwygSettings } from "../config";
import { t } from "../i18n";
import { extractHeadings } from "../markdown/outline";
import { renderMarkdown } from "../markdown/render";
import { Heading, SuperMarkdownEditorLayout, WysiwygMode, WysiwygSettings } from "../types";
import { prepareUploadedImage, UploadedImageData } from "./assets";

export const SUPER_MARKDOWN_EDITOR_VIEW_TYPE = "superMarkdown.editor";

interface SuperMarkdownEditorOpenOptions {
  layout?: SuperMarkdownEditorLayout;
  mode?: WysiwygMode;
}

type WysiwygMessage =
  | { type: "ready" }
  | { type: "edit"; text?: unknown }
  | { type: "save" }
  | { type: "copyMarkdown" }
  | { type: "copyHtml"; html?: unknown }
  | { type: "runHostCommand"; command?: unknown }
  | { type: "uploadImages"; requestId?: unknown; images?: unknown }
  | { type: "openLink"; href?: unknown }
  | { type: "error"; message?: unknown };

const HOST_COMMANDS: Record<string, string> = {
  organizeMarkdown: "superMarkdown.organizeMarkdown"
};

interface PreviewState {
  html: string;
  markdown: string;
  headings: Array<Pick<Heading, "level" | "text" | "slug" | "line">>;
}

export class SuperMarkdownWysiwygEditorProvider implements vscode.CustomTextEditorProvider {
  private readonly panels = new Map<string, vscode.WebviewPanel>();
  private readonly pendingOpenOptions = new Map<string, SuperMarkdownEditorOpenOptions>();
  private readonly activeOpenOptions = new Map<string, SuperMarkdownEditorOpenOptions>();

  constructor(private readonly context: vscode.ExtensionContext) {}

  async openDocument(
    document: vscode.TextDocument,
    viewType = SUPER_MARKDOWN_EDITOR_VIEW_TYPE,
    options: SuperMarkdownEditorOpenOptions = {}
  ): Promise<void> {
    const key = document.uri.toString();
    this.pendingOpenOptions.set(key, options);
    this.activeOpenOptions.set(key, options);
    const existing = this.panels.get(key);
    if (existing) {
      existing.webview.html = await this.render(document, existing.webview, getWysiwygSettings(), options);
      existing.reveal(vscode.ViewColumn.Active);
      return;
    }
    await vscode.commands.executeCommand("vscode.openWith", document.uri, viewType);
  }

  async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        this.context.extensionUri,
        ...(vscode.workspace.workspaceFolders?.map((folder) => folder.uri) ?? []),
        document.uri.scheme === "file"
          ? vscode.Uri.file(path.dirname(document.uri.fsPath))
          : this.context.extensionUri
      ]
    };

    let applyingWebviewEdit = false;
    const postState = async () => {
      await webviewPanel.webview.postMessage({
        type: "setMarkdown",
        text: document.getText(),
        dirty: document.isDirty,
        preview: await this.renderPreviewState(document, webviewPanel.webview)
      });
    };

    const updateTitle = () => {
      webviewPanel.title = `Super Markdown: ${path.basename(document.fileName)}`;
    };

    const key = document.uri.toString();
    const openOptions = this.pendingOpenOptions.get(key);
    this.pendingOpenOptions.delete(key);
    this.activeOpenOptions.set(key, openOptions ?? {});
    this.panels.set(key, webviewPanel);
    webviewPanel.webview.html = await this.render(document, webviewPanel.webview, getWysiwygSettings(), openOptions);
    updateTitle();

    const disposables: vscode.Disposable[] = [
      vscode.workspace.onDidChangeTextDocument((event) => {
        if (event.document.uri.toString() === document.uri.toString() && !applyingWebviewEdit) {
          void postState();
        }
      }),
      vscode.workspace.onDidSaveTextDocument((saved) => {
        if (saved.uri.toString() === document.uri.toString()) {
          void postState();
        }
      }),
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration("superMarkdown")) {
          void this.render(document, webviewPanel.webview, getWysiwygSettings()).then((html) => {
            webviewPanel.webview.html = html;
          });
        }
      }),
      webviewPanel.webview.onDidReceiveMessage(async (message: WysiwygMessage) => {
        switch (message.type) {
          case "ready":
            this.postOpenOptions(webviewPanel, this.activeOpenOptions.get(key) ?? {});
            void postState();
            break;
          case "edit":
            if (typeof message.text === "string" && message.text !== document.getText()) {
              applyingWebviewEdit = true;
              try {
                await replaceDocument(document, message.text);
              } finally {
                applyingWebviewEdit = false;
              }
            }
            break;
          case "save":
            await document.save();
            break;
          case "copyMarkdown":
            await vscode.env.clipboard.writeText(document.getText());
            void vscode.window.showInformationMessage(t("message.copiedMarkdown"));
            break;
          case "copyHtml":
            if (typeof message.html === "string") {
              await vscode.env.clipboard.writeText(message.html);
              void vscode.window.showInformationMessage(t("message.copiedHtml"));
            }
            break;
          case "runHostCommand":
            if (typeof message.command === "string" && HOST_COMMANDS[message.command]) {
              await vscode.commands.executeCommand(HOST_COMMANDS[message.command]);
            }
            break;
          case "openLink":
            if (typeof message.href === "string") {
              await vscode.env.openExternal(vscode.Uri.parse(message.href));
            }
            break;
          case "uploadImages":
            await this.handleUploadImages(document, webviewPanel.webview, message);
            break;
          case "error":
            if (typeof message.message === "string") {
              void vscode.window.showWarningMessage(t("message.wysiwygError", message.message));
            }
            break;
          default:
            break;
        }
      })
    ];

    webviewPanel.onDidDispose(() => {
      this.panels.delete(key);
      this.activeOpenOptions.delete(key);
      disposables.forEach((disposable) => disposable.dispose());
    });
  }

  private postOpenOptions(webviewPanel: vscode.WebviewPanel, options: SuperMarkdownEditorOpenOptions): void {
    void webviewPanel.webview.postMessage({
      type: "setEditorState",
      layout: options.layout,
      mode: options.mode
    });
  }

  private async render(
    document: vscode.TextDocument,
    webview: vscode.Webview,
    settings: WysiwygSettings,
    openOptions: SuperMarkdownEditorOpenOptions = {}
  ): Promise<string> {
    const nonce = createNonce();
    const media = (relativePath: string) =>
      webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, ...relativePath.split("/")));
    const vditorBase = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, "media", "vendor", "vditor"));
    const previewSettings = getPreviewSettings();
    const preview = await this.renderPreviewState(document, webview, previewSettings);
    const initialMarkdown = escapeHtml(document.getText());
    const initialMode = openOptions.mode ?? settings.defaultMode;
    const initialLayout = openOptions.layout ?? settings.layout;
    const isZhCn = previewSettings.activeLanguage === "zh-CN";
    const payload = JSON.stringify({
      text: document.getText(),
      mode: initialMode,
      layout: initialLayout,
      theme: settings.theme,
      cdn: vditorBase.toString(),
      customCss: settings.customCss,
      useVsCodeThemeColors: settings.useVsCodeThemeColors,
      fileName: path.basename(document.fileName),
      preview,
      translations: {
        save: t("webview.save"),
        copyMarkdown: t("webview.copyMarkdown"),
        copyHtml: t("webview.copyHtml"),
        outline: t("webview.headings"),
        preview: t("webview.markdownPreview"),
        noHeadings: t("webview.noHeadings"),
        toolbar: {
          underline: isZhCn ? "下划线" : "Underline",
          mark: isZhCn ? "标记" : "Highlight",
          completedTask: isZhCn ? "已完成任务" : "Completed task",
          math: isZhCn ? "数学公式" : "Math",
          mermaid: isZhCn ? "流程图" : "Mermaid",
          more: isZhCn ? "更多" : "More",
          tocBlock: isZhCn ? "目录块" : "Table of contents block",
          footnote: isZhCn ? "脚注" : "Footnote",
          htmlComment: isZhCn ? "HTML 注释" : "HTML comment",
          organizeMarkdown: isZhCn ? "整理 Markdown" : "Organize Markdown"
        }
      }
    }).replace(/<\/template/gi, "<\\/template");

    const csp = [
      "default-src 'none'",
      `img-src ${webview.cspSource} data: https:`,
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `script-src 'nonce-${nonce}' ${webview.cspSource}`,
      `font-src ${webview.cspSource} data:`,
      "connect-src https:"
    ].join("; ");

    return `<!DOCTYPE html>
<html lang="${previewSettings.activeLanguage === "zh-CN" ? "zh-CN" : "en"}">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="${media("media/vendor/vditor/dist/index.css")}">
  <link rel="stylesheet" href="${media("media/preview.css")}">
  <link rel="stylesheet" href="${media("media/wysiwyg/editor.css")}">
  <title>${escapeHtml(document.fileName)}</title>
</head>
<body class="${settings.useVsCodeThemeColors ? "use-vscode-theme " : ""}layout-${initialLayout} sm-theme-${previewSettings.theme}" style="--sm-font-size: ${previewSettings.fontSize}px; --sm-max-width: ${previewSettings.maxWidth}px;">
  <div class="workbench-shell">
    <button id="side-panel-toggle" class="side-panel-toggle" type="button" aria-controls="side-panel" aria-expanded="false" title="${escapeHtml(t("webview.navigation"))}">
      <span aria-hidden="true">☰</span>
    </button>
    <aside id="side-panel" class="side-panel">
      <div class="panel-heading">${escapeHtml(t("webview.headings"))}</div>
      <section class="panel-content">
        <input id="outline-search" class="outline-search" type="search" placeholder="${escapeHtml(t("webview.searchHeadings"))}">
        <nav id="outline" class="outline"></nav>
      </section>
    </aside>
    <div id="editor-toolbar-slot" class="editor-toolbar-slot" aria-label="Markdown toolbar"></div>
    <section class="editor-panel">
      <main id="editor">
        <div class="fallback-editor static-fallback">
          <div class="fallback-notice">Loading Super Markdown editor...</div>
          <textarea readonly aria-label="Markdown source">${initialMarkdown}</textarea>
        </div>
      </main>
    </section>
    <aside class="preview-panel">
      <div class="preview-title">${escapeHtml(t("webview.markdownPreview"))}</div>
      <main id="preview" class="markdown-preview">
        <article class="markdown-body">${preview.html}</article>
      </main>
    </aside>
  </div>
  <template id="payload">${payload}</template>
  <script nonce="${nonce}" src="${media("media/vendor/vditor/dist/index.min.js")}"></script>
  <script nonce="${nonce}" src="${media("media/wysiwyg/editor.js")}"></script>
</body>
</html>`;
  }

  private async renderPreviewState(
    document: vscode.TextDocument,
    webview: vscode.Webview,
    settings = getPreviewSettings()
  ): Promise<PreviewState> {
    const headings = extractHeadings(document.getText(), { levels: settings.tocLevels });
    const html = renderMarkdown({
      document,
      webview,
      headings,
      settings
    });

    return {
      html,
      markdown: document.getText(),
      headings: headings.map(({ level, text, slug, line }) => ({ level, text, slug, line }))
    };
  }

  private async handleUploadImages(
    document: vscode.TextDocument,
    webview: vscode.Webview,
    message: { type: "uploadImages"; requestId?: unknown; images?: unknown }
  ): Promise<void> {
    if (document.uri.scheme !== "file") {
      await webview.postMessage({
        type: "uploadImagesResult",
        requestId: message.requestId,
        error: t("message.fileBackedOnly")
      });
      return;
    }
    if (!Array.isArray(message.images)) {
      return;
    }

    const images = message.images.filter(isUploadedImageData);
    const settings = getWysiwygSettings();
    const directory = path.resolve(path.dirname(document.uri.fsPath), settings.imageDirectory || "assets");
    const existingNames = new Set<string>(await fs.readdir(directory).catch(() => []));
    const stored = images.map((image) => {
      const prepared = prepareUploadedImage(document.uri.fsPath, settings, image, existingNames);
      existingNames.add(prepared.name);
      return prepared;
    });

    await fs.mkdir(directory, { recursive: true });
    await Promise.all(stored.map((image) => fs.writeFile(image.absolutePath, image.buffer)));

    await webview.postMessage({
      type: "uploadImagesResult",
      requestId: message.requestId,
      images: stored.map((image) => ({
        id: image.id,
        name: image.name,
        markdown: `![${escapeMarkdownAlt(image.name)}](${encodeURI(image.markdownPath)})`
      }))
    });
  }
}

async function replaceDocument(document: vscode.TextDocument, text: string): Promise<void> {
  const edit = new vscode.WorkspaceEdit();
  edit.replace(document.uri, fullDocumentRange(document), text);
  await vscode.workspace.applyEdit(edit);
}

function fullDocumentRange(document: vscode.TextDocument): vscode.Range {
  const lastLine = Math.max(0, document.lineCount - 1);
  const lastCharacter = document.lineAt(lastLine).text.length;
  return new vscode.Range(0, 0, lastLine, lastCharacter);
}

function isUploadedImageData(value: unknown): value is UploadedImageData {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as UploadedImageData;
  return typeof candidate.id === "string" && typeof candidate.name === "string" && typeof candidate.dataUrl === "string";
}

function escapeMarkdownAlt(value: string): string {
  return value.replace(/[[\]\\]/g, "\\$&");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function createNonce(): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let nonce = "";
  for (let index = 0; index < 32; index += 1) {
    nonce += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return nonce;
}
