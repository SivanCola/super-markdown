import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as vscode from "vscode";
import { getPreviewSettings, getWysiwygSettings } from "../config";
import { t } from "../i18n";
import { parseMarkdown, type MarkdownBlock } from "../markdown/core";
import { extractMarkdownInlineLinks } from "../markdown/links";
import { extractHeadings } from "../markdown/outline";
import { renderMarkdown, resolveImageSrc } from "../markdown/render";
import { upsertToc } from "../markdown/toc";
import { Heading, SuperMarkdownEditorLayout, WysiwygMode, WysiwygSettings } from "../types";
import { escapeAttribute, escapeHtml, escapeJsonForScript, safeInlineUrl } from "../utils/html";
import { prepareUploadedImage, resolveImageDirectory, UploadedImageData } from "./assets";
import { normalizeEditorLayout, normalizeEditorMode } from "./mode";
import type { ImageResource } from "./protocol";
import { renderToolbarIcon, SUPER_MARKDOWN_ISSUES_URL, TOOLBAR_GROUPS } from "./toolbar";

export const SUPER_MARKDOWN_EDITOR_VIEW_TYPE = "superMarkdown.editor";
export const SUPER_MARKDOWN_TOOLBAR_COMMAND = "superMarkdown.webviewToolbar";

interface SuperMarkdownEditorOpenOptions {
  layout?: SuperMarkdownEditorLayout;
  mode?: WysiwygMode;
}

type WebviewMessage =
  | { type: "ready" }
  | { type: "edit"; text?: unknown }
  | { type: "copyCode"; text?: unknown }
  | { type: "setMode"; mode?: unknown }
  | { type: "export"; format?: unknown }
  | { type: "runHostCommand"; command?: unknown }
  | { type: "toolbarCommand"; action?: unknown }
  | { type: "uploadImages"; requestId?: unknown; images?: unknown }
  | { type: "openLink"; href?: unknown }
  | { type: "error"; message?: unknown };

const HOST_COMMANDS: Record<string, string> = {
  organizeMarkdown: "superMarkdown.organizeMarkdown",
  syntaxGuide: "superMarkdown.openSyntaxGuide"
};

const EXPORT_COMMANDS: Record<string, string> = {
  html: "superMarkdown.export.html",
  pdf: "superMarkdown.export.pdf",
  png: "superMarkdown.export.png",
  jpeg: "superMarkdown.export.jpeg",
  all: "superMarkdown.export.all"
};

const TOOLBAR_EXPORT_ACTIONS: Record<string, keyof typeof EXPORT_COMMANDS> = {
  "export-html": "html",
  "export-pdf": "pdf",
  "export-all": "all"
};

interface ToolbarCommandPayload {
  action: string;
  uri: string;
}

interface PreviewState {
  html: string;
  markdown: string;
  headings: Array<Pick<Heading, "level" | "text" | "slug" | "line">>;
  blocks: VisualMarkdownBlock[];
}

type VisualMarkdownBlock =
  | { type: "heading"; level: number; text: string; raw: string; line: number }
  | { type: "paragraph"; text: string; raw: string; line: number }
  | { type: "list"; text: string; raw: string; line: number }
  | { type: "quote"; text: string; raw: string; line: number }
  | { type: "code"; language: string; text: string; raw: string; line: number }
  | { type: "mermaid"; language: string; text: string; raw: string; line: number }
  | { type: "math"; text: string; raw: string; line: number }
  | { type: "table"; text: string; raw: string; line: number; headers: string[]; rows: string[][] }
  | { type: "hr"; text: string; raw: string; line: number }
  | { type: "footnote"; id: string; text: string; raw: string; line: number };

export class SuperMarkdownWysiwygEditorProvider implements vscode.CustomTextEditorProvider {
  private readonly panels = new Map<string, vscode.WebviewPanel>();
  private readonly pendingOpenOptions = new Map<string, SuperMarkdownEditorOpenOptions>();
  private readonly activeOpenOptions = new Map<string, SuperMarkdownEditorOpenOptions>();
  private readonly lastWebviewErrors = new Map<string, string>();

  constructor(private readonly context: vscode.ExtensionContext) {}

  async openDocument(
    document: vscode.TextDocument,
    viewType = SUPER_MARKDOWN_EDITOR_VIEW_TYPE,
    options: SuperMarkdownEditorOpenOptions = {}
  ): Promise<void> {
    const normalized = normalizeOpenOptions(options);
    const key = document.uri.toString();
    this.pendingOpenOptions.set(key, normalized);
    this.activeOpenOptions.set(key, normalized);
    const existing = this.panels.get(key);
    if (existing) {
      existing.webview.html = await this.render(document, existing.webview, getWysiwygSettings(), normalized);
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
      enableCommandUris: [SUPER_MARKDOWN_TOOLBAR_COMMAND],
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
        preview: await this.renderPreviewState(document, webviewPanel.webview),
        imageResources: this.collectImageResources(document, webviewPanel.webview)
      });
    };

    const key = document.uri.toString();
    const openOptions = normalizeOpenOptions(this.pendingOpenOptions.get(key) ?? {});
    this.pendingOpenOptions.delete(key);
    this.activeOpenOptions.set(key, openOptions);
    this.panels.set(key, webviewPanel);
    webviewPanel.webview.html = await this.render(document, webviewPanel.webview, getWysiwygSettings(), openOptions);
    webviewPanel.title = `Super Markdown: ${path.basename(document.fileName)}`;

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
          void this.render(document, webviewPanel.webview, getWysiwygSettings(), this.activeOpenOptions.get(key)).then((html) => {
            webviewPanel.webview.html = html;
          });
        }
      }),
      webviewPanel.webview.onDidReceiveMessage(async (message: WebviewMessage) => {
        switch (message.type) {
          case "ready":
            this.postOpenOptions(webviewPanel, this.activeOpenOptions.get(key) ?? {});
            void postState();
            break;
          case "edit":
            if (typeof message.text === "string") {
              if (message.text !== document.getText()) {
                applyingWebviewEdit = true;
                try {
                  await replaceDocument(document, message.text);
                } finally {
                  applyingWebviewEdit = false;
                }
              }
              void postState();
            }
            break;
          case "copyCode":
            if (typeof message.text === "string") {
              await vscode.env.clipboard.writeText(message.text);
            }
            break;
          case "setMode":
            if (typeof message.mode === "string") {
              const next = normalizeEditorMode(message.mode);
              this.activeOpenOptions.set(key, { ...this.activeOpenOptions.get(key), mode: next });
            }
            break;
          case "export":
            if (typeof message.format === "string" && EXPORT_COMMANDS[message.format]) {
              await vscode.commands.executeCommand(EXPORT_COMMANDS[message.format]);
            }
            break;
          case "runHostCommand":
            if (typeof message.command === "string" && HOST_COMMANDS[message.command]) {
              await vscode.commands.executeCommand(HOST_COMMANDS[message.command]);
            }
            break;
          case "toolbarCommand":
            if (typeof message.action === "string") {
              await this.handleToolbarCommand({ action: message.action, uri: document.uri.toString() });
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
            {
              const formattedError = formatWebviewError(message.message);
              if (this.lastWebviewErrors.get(key) !== formattedError) {
                this.lastWebviewErrors.set(key, formattedError);
                void vscode.window.showWarningMessage(t("message.wysiwygError", formattedError));
              }
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
      this.lastWebviewErrors.delete(key);
      disposables.forEach((disposable) => disposable.dispose());
    });
  }

  private postOpenOptions(webviewPanel: vscode.WebviewPanel, options: SuperMarkdownEditorOpenOptions): void {
    void webviewPanel.webview.postMessage({
      type: "setEditorState",
      layout: options.layout,
      mode: normalizeEditorMode(options.mode)
    });
  }

  private async render(
    document: vscode.TextDocument,
    webview: vscode.Webview,
    settings: WysiwygSettings,
    openOptions: SuperMarkdownEditorOpenOptions = {}
  ): Promise<string> {
    const normalizedOptions = normalizeOpenOptions(openOptions);
    const nonce = createNonce();
    const media = (relativePath: string) =>
      webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, ...relativePath.split("/")));
    const versionedMedia = (relativePath: string) => media(relativePath).with({ query: `v=${nonce}` });
    const previewSettings = getPreviewSettings();
    const preview = await this.renderPreviewState(document, webview, previewSettings);
    const initialMode = normalizeEditorMode(normalizedOptions.mode ?? settings.defaultMode);
    const initialLayout = normalizeEditorLayout(normalizedOptions.layout ?? settings.layout);
    const isZhCn = previewSettings.activeLanguage === "zh-CN";
    const payload = escapeJsonForScript(JSON.stringify({
      text: document.getText(),
      mode: initialMode,
      layout: initialLayout,
      customCss: settings.customCss,
      useVsCodeThemeColors: settings.useVsCodeThemeColors,
      fileName: path.basename(document.fileName),
      mermaidScript: String(media("media/vendor/mermaid/mermaid.min.js")),
      preview,
      imageResources: this.collectImageResources(document, webview),
      katexEnabled: previewSettings.katexEnabled,
      translations: {
        copyCode: isZhCn ? "复制" : "Copy",
        copiedCode: isZhCn ? "已复制" : "Copied",
                codeTheme: t("webview.codeTheme"),
                codeThemeAuto: t("webview.codeThemeAuto"),
                codeThemeLight: t("webview.codeThemeLight"),
                codeThemeDark: t("webview.codeThemeDark"),
                editLanguage: isZhCn ? "编辑语言" : "Edit language",
                mathEdit: isZhCn ? "编辑" : "Edit",
                mathDone: isZhCn ? "完成" : "Done",
                rawHtmlEscaped: isZhCn ? "原始 HTML 已转义" : "Raw HTML escaped",
                outline: t("webview.headings"),
        preview: t("webview.markdownPreview"),
        noHeadings: t("webview.noHeadings"),
        toolbar: {
          heading: isZhCn ? "标题" : "Heading",
          bold: isZhCn ? "加粗" : "Bold",
          italic: isZhCn ? "斜体" : "Italic",
          underline: isZhCn ? "下划线" : "Underline",
          highlight: isZhCn ? "高亮" : "Highlight",
          strike: isZhCn ? "删除线" : "Strike",
          quote: isZhCn ? "引用" : "Quote",
          list: isZhCn ? "列表" : "List",
          orderedList: isZhCn ? "有序列表" : "Ordered list",
          task: isZhCn ? "任务" : "Task",
          taskChecked: isZhCn ? "已完成任务" : "Checked task",
          link: isZhCn ? "链接" : "Link",
          image: isZhCn ? "图片" : "Image",
          code: isZhCn ? "代码块" : "Code block",
          inlineCode: isZhCn ? "行内代码" : "Inline code",
          table: isZhCn ? "表格" : "Table",
          math: isZhCn ? "数学公式" : "Math",
          mermaid: isZhCn ? "流程图" : "Mermaid",
          toc: isZhCn ? "目录" : "Table of contents",
          hr: isZhCn ? "分割线" : "Rule",
          export: isZhCn ? "导出" : "Export",
          all: isZhCn ? "全部" : "All",
          more: isZhCn ? "更多" : "More",
          help: isZhCn ? "反馈问题" : "Report issue",
          organizeMarkdown: isZhCn ? "整理 Markdown" : "Organize Markdown"
        }
      }
    }));

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
  <link rel="stylesheet" href="${media("media/vendor/katex/katex.min.css")}">
  <link rel="stylesheet" href="${media("media/vendor/codicons/codicon.css")}">
  <link rel="stylesheet" href="${versionedMedia("media/preview.css")}">
  <link rel="stylesheet" href="${versionedMedia("media/wysiwyg/editor.css")}">
  <title>${escapeHtml(document.fileName)}</title>
</head>
<body class="${settings.useVsCodeThemeColors ? "use-vscode-theme " : ""}layout-${initialLayout} mode-${initialMode} sm-theme-${previewSettings.theme}" data-script-state="html-rendered" data-script-diag="html-rendered" style="--sm-font-size: ${previewSettings.fontSize}px; --sm-max-width: ${previewSettings.maxWidth}px;">
  <div class="workbench-shell">
    <button id="side-panel-toggle" class="side-panel-toggle" type="button" aria-controls="side-panel" aria-expanded="false" title="${escapeHtml(t("webview.navigation"))}">
      <span aria-hidden="true">☰</span>
    </button>
    <aside id="side-panel" class="side-panel">
      <div class="panel-heading">
        <span class="panel-title">${escapeHtml(t("webview.headings"))}</span>
        <button id="outline-current" class="outline-tool" type="button" title="${isZhCn ? "定位当前标题" : "Reveal current heading"}" aria-label="${isZhCn ? "定位当前标题" : "Reveal current heading"}">⌾</button>
        <button id="side-panel-collapse" class="outline-tool" type="button" title="${isZhCn ? "收起目录" : "Collapse outline"}" aria-label="${isZhCn ? "收起目录" : "Collapse outline"}">←</button>
      </div>
      <section class="panel-content">
        <input id="outline-search" class="outline-search" type="search" placeholder="${escapeHtml(t("webview.searchHeadings"))}">
        <nav id="outline" class="outline"></nav>
      </section>
    </aside>
    <div id="editor-toolbar-slot" class="editor-toolbar-slot" aria-label="Markdown toolbar" data-script-diag="html-rendered">${renderInitialToolbar(isZhCn, document.uri)}</div>
    <section class="editor-panel">
      <main id="editor" class="editor-surface">
        <textarea id="source-editor" class="source-editor" spellcheck="false" aria-label="Markdown source">${escapeHtml(document.getText())}</textarea>
        <div id="visual-editor" class="visual-editor" aria-label="Visual Markdown editor"></div>
      </main>
    </section>
    <aside class="preview-panel">
      <div class="preview-title">${escapeHtml(t("webview.markdownPreview"))}</div>
      <main id="preview" class="markdown-preview">
        <article class="markdown-body">${preview.html}</article>
      </main>
    </aside>
  </div>
  <script id="payload" type="application/json">${payload}</script>
  <script nonce="${nonce}">
${renderBootstrapScript()}
  </script>
  <script nonce="${nonce}" src="${versionedMedia("media/wysiwyg/editor.js")}"></script>
</body>
</html>`;
  }

  private async renderPreviewState(
    document: vscode.TextDocument,
    webview: vscode.Webview,
    settings = getPreviewSettings()
  ): Promise<PreviewState> {
    const headings = extractHeadings(document.getText(), { levels: settings.tocLevels });
    const html = await renderMarkdown({
      document,
      webview,
      headings,
      settings
    });

    return {
      html,
      markdown: document.getText(),
      headings: headings.map(({ level, text, slug, line }) => ({ level, text, slug, line })),
      blocks: parseMarkdown(document.getText()).nodes.map(toVisualMarkdownBlock)
    };
  }

  private collectImageResources(document: vscode.TextDocument, webview: vscode.Webview): ImageResource[] {
    const resources = new Map<string, string>();
    for (const link of extractMarkdownInlineLinks(document.getText())) {
      if (!link.image) {
        continue;
      }
      const source = safeInlineUrl(link.destination);
      if (!source || source === "#") {
        continue;
      }
      resources.set(link.destination, resolveImageSrc(source, document, webview));
    }
    return Array.from(resources, ([source, resolved]) => ({ source, resolved }));
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
    const directory = resolveImageDirectory(document.uri.fsPath, settings);
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

  async handleToolbarCommand(payload: unknown): Promise<void> {
    if (!isToolbarCommandPayload(payload)) {
      return;
    }

    const uri = vscode.Uri.parse(payload.uri);
    const document = await vscode.workspace.openTextDocument(uri);
    if (document.languageId !== "markdown" && !isMarkdownFileUri(document.uri)) {
      return;
    }

    if (payload.action === "heading") {
      const selected = await vscode.window.showQuickPick(
        [1, 2, 3, 4, 5, 6].map((level) => ({
          label: `H${level}`,
          description: `${"#".repeat(level)} Heading`,
          action: `heading-${level}`
        })),
        { title: "Heading" }
      );
      if (selected) {
        await this.insertToolbarSnippet(document, getToolbarSnippet(selected.action));
      }
      return;
    }

    if (payload.action === "more") {
      const selected = await vscode.window.showQuickPick(
        [
          { label: "HTML", description: "Export HTML", command: EXPORT_COMMANDS.html },
          { label: "PDF", description: "Export PDF", command: EXPORT_COMMANDS.pdf },
          { label: "All", description: "Export all configured formats", command: EXPORT_COMMANDS.all }
        ],
        { title: "Export" }
      );
      if (selected) {
        await vscode.commands.executeCommand(selected.command);
      }
      return;
    }

    const exportType = TOOLBAR_EXPORT_ACTIONS[payload.action];
    if (exportType) {
      await vscode.commands.executeCommand(EXPORT_COMMANDS[exportType]);
      return;
    }

    if (payload.action === "organizeMarkdown") {
      await vscode.commands.executeCommand(HOST_COMMANDS.organizeMarkdown);
      return;
    }

    if (payload.action === "help") {
      await vscode.env.openExternal(vscode.Uri.parse(SUPER_MARKDOWN_ISSUES_URL));
      return;
    }

    if (payload.action === "toc") {
      const result = upsertToc(document.getText(), getPreviewSettings().tocLevels);
      if (result.text !== document.getText()) {
        await replaceDocument(document, result.text);
        await this.refreshDocument(document.uri);
      }
      return;
    }

    await this.insertToolbarSnippet(document, getToolbarSnippet(payload.action));
  }

  private async insertToolbarSnippet(document: vscode.TextDocument, snippet: ToolbarSnippet): Promise<void> {
    if (!snippet.insert) {
      return;
    }

    const activeEditor = vscode.window.activeTextEditor;
    const edit = new vscode.WorkspaceEdit();
    if (activeEditor && activeEditor.document.uri.toString() === document.uri.toString()) {
      const selectionText = activeEditor.document.getText(activeEditor.selection);
      edit.replace(document.uri, activeEditor.selection, snippet.wrap(selectionText));
    } else {
      const end = fullDocumentRange(document).end;
      const prefix = document.getText().trim().length === 0 || document.getText().endsWith("\n") ? "" : "\n\n";
      edit.insert(document.uri, end, `${prefix}${snippet.insert}`);
    }

    const applied = await vscode.workspace.applyEdit(edit);
    if (applied) {
      await this.refreshDocument(document.uri);
    }
  }

  private async refreshDocument(uri: vscode.Uri): Promise<void> {
    const panel = this.panels.get(uri.toString());
    if (!panel) {
      return;
    }
    const document = await vscode.workspace.openTextDocument(uri);
    panel.webview.html = await this.render(document, panel.webview, getWysiwygSettings(), this.activeOpenOptions.get(uri.toString()));
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

function formatWebviewError(error: unknown): string {
  if (error instanceof Error) {
    return error.message || error.name;
  }
  if (typeof error === "string") {
    return error;
  }
  if (error && typeof error === "object") {
    const candidate = error as { message?: unknown; name?: unknown; error?: unknown };
    const parts = [
      typeof candidate.name === "string" ? candidate.name : "",
      typeof candidate.message === "string" ? candidate.message : "",
      typeof candidate.error === "string" ? candidate.error : ""
    ].filter(Boolean);
    if (parts.length > 0) {
      return Array.from(new Set(parts)).join(": ");
    }
    try {
      return JSON.stringify(error);
    } catch {
      return Object.prototype.toString.call(error);
    }
  }
  return String(error || "Unknown error");
}

function normalizeOpenOptions(options: SuperMarkdownEditorOpenOptions): SuperMarkdownEditorOpenOptions {
  return {
    ...options,
    layout: options.layout === undefined ? undefined : normalizeEditorLayout(options.layout),
    mode: options.mode === undefined ? undefined : normalizeEditorMode(options.mode)
  };
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

function isMarkdownFileUri(uri: vscode.Uri): boolean {
  return [".md", ".markdown", ".mdown", ".mkdn"].includes(path.extname(uri.fsPath).toLowerCase());
}

function isToolbarCommandPayload(value: unknown): value is ToolbarCommandPayload {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Partial<ToolbarCommandPayload>;
  return typeof candidate.action === "string" && typeof candidate.uri === "string";
}

interface ToolbarSnippet {
  insert: string;
  wrap: (selected: string) => string;
}

function getToolbarSnippet(action: string): ToolbarSnippet {
  const inline = (prefix: string, suffix = prefix, fallback = "text"): ToolbarSnippet => ({
    insert: `${prefix}${fallback}${suffix}`,
    wrap: (selected) => `${prefix}${selected || fallback}${suffix}`
  });
  const block = (insert: string): ToolbarSnippet => ({
    insert,
    wrap: (selected) => selected ? `${insert}\n${selected}` : insert
  });
  const heading = action.match(/^heading-([1-6])$/);
  if (heading) {
    const marker = "#".repeat(Number(heading[1]));
    return {
      insert: `${marker} Heading`,
      wrap: (selected) => `${marker} ${selected || "Heading"}`
    };
  }
  const snippets: Record<string, ToolbarSnippet> = {
    bold: inline("**"),
    italic: inline("*"),
    underline: inline("<u>", "</u>"),
    strike: inline("~~"),
    highlight: inline("=="),
    "inline-code": inline("`", "`", "code"),
    hr: block("---"),
    quote: block("> Quote"),
    list: block("- List item"),
    "ordered-list": block("1. List item"),
    task: block("- [ ] Task"),
    "task-checked": block("- [x] Task"),
    link: {
      insert: "[link text](https://example.com)",
      wrap: (selected) => `[${selected || "link text"}](https://example.com)`
    },
    image: block("![alt](image.png)"),
    code: block("```text\ncode\n```"),
    table: block("| Column | Value |\n| --- | --- |\n| Item | Value |"),
    math: block("$$\nx = y\n$$"),
    mermaid: block("```mermaid\ngraph TD\n  A --> B\n```")
  };
  return snippets[action] ?? { insert: "", wrap: () => "" };
}

function renderBootstrapScript(): string {
  return `(function () {
  document.body.dataset.scriptState = "bootstrap-ran";
  document.body.dataset.scriptDiag = "bootstrap-ran";
  var toolbar = document.getElementById("editor-toolbar-slot");
  if (toolbar) {
    toolbar.dataset.scriptDiag = "bootstrap-ran";
  }
  function showScriptError(error) {
    var message = error && error.message ? error.message : String(error || "Unknown script error");
    var stack = error && error.stack ? String(error.stack) : "";
    document.body.dataset.scriptState = "error";
    document.body.dataset.scriptError = message + (stack ? " | " + stack.split("\\n").slice(0, 3).join(" / ") : "");
    if (toolbar) {
      toolbar.dataset.scriptError = document.body.dataset.scriptError;
    }
  }
  window.addEventListener("error", function (event) {
    showScriptError(event.error || event.message);
  });
  window.addEventListener("unhandledrejection", function (event) {
    showScriptError(event.reason);
  });
  window.setTimeout(function () {
    var state = document.body.dataset.scriptState;
    if (state !== "runtime-ready" && state !== "error") {
      document.body.dataset.scriptState = "csp-timeout";
      document.body.dataset.scriptDiag = state || "unknown";
      if (toolbar) {
        toolbar.dataset.scriptDiag = document.body.dataset.scriptDiag;
      }
    }
  }, 1000);
})();`;
}

function renderInitialToolbar(isZhCn: boolean, documentUri: vscode.Uri): string {
  const label = (zh: string, en: string) => isZhCn ? zh : en;
  const titles: Record<string, string> = {
    bold: label("加粗", "Bold"),
    italic: label("斜体", "Italic"),
    underline: label("下划线", "Underline"),
    highlight: label("高亮", "Highlight"),
    strike: label("删除线", "Strike"),
    heading: label("标题", "Heading"),
    hr: label("分割线", "Rule"),
    quote: label("引用", "Quote"),
    list: label("列表", "List"),
    "ordered-list": label("有序列表", "Ordered list"),
    task: label("任务", "Task"),
    "task-checked": label("已完成任务", "Checked task"),
    link: label("链接", "Link"),
    image: label("图片", "Image"),
    "inline-code": label("行内代码", "Inline code"),
    code: label("代码块", "Code block"),
    table: label("表格", "Table"),
    math: label("数学公式", "Math"),
    mermaid: label("流程图", "Mermaid"),
    toc: label("目录", "Table of contents"),
    organizeMarkdown: label("整理 Markdown", "Organize Markdown"),
    help: label("反馈问题", "Report issue"),
    more: label("更多", "More")
  };
  const commandUri = (action: string) => {
    const args = encodeURIComponent(JSON.stringify([{ action, uri: documentUri.toString() }]));
    return `command:${SUPER_MARKDOWN_TOOLBAR_COMMAND}?${args}`;
  };
  const button = (action: string) => {
    const title = escapeHtml(titles[action] || action);
    if (action === "heading" || action === "more") {
      return `<a class="toolbar-button toolbar-menu-toggle" href="${escapeAttribute(commandUri(action))}" data-menu-toggle="${action}" title="${title}" aria-label="${title}" aria-expanded="false"><span class="toolbar-icon" aria-hidden="true">${renderToolbarIcon(action)}</span><span class="toolbar-caret codicon codicon-arrow-small-down" aria-hidden="true"></span></a>`;
    }
    return `<a class="toolbar-button" href="${escapeAttribute(commandUri(action))}" data-action="${action}" title="${title}" aria-label="${title}"><span class="toolbar-icon" aria-hidden="true">${renderToolbarIcon(action)}</span></a>`;
  };
  return TOOLBAR_GROUPS.map((group) => `<div class="toolbar-group toolbar-group-${group.name}">${group.actions.map(button).join("")}</div>`).join("");
}

function toVisualMarkdownBlock(block: MarkdownBlock): VisualMarkdownBlock {
  switch (block.type) {
    case "heading":
      return { type: "heading", level: block.level, text: block.text, raw: block.raw, line: block.line };
    case "paragraph":
      return { type: "paragraph", text: block.text, raw: block.raw, line: block.line };
    case "list":
      return { type: "list", text: block.raw, raw: block.raw, line: block.line };
    case "blockquote":
      return { type: "quote", text: block.text, raw: block.raw, line: block.line };
    case "code":
      return { type: "code", language: block.language, text: block.code, raw: block.raw, line: block.line };
    case "mermaid":
      return { type: "mermaid", language: "mermaid", text: block.code, raw: block.raw, line: block.line };
    case "math":
      return { type: "math", text: block.expression, raw: block.raw, line: block.line };
    case "table":
      return { type: "table", text: block.raw, raw: block.raw, line: block.line, headers: block.headers, rows: block.rows };
    case "hr":
      return { type: "hr", text: "", raw: block.raw, line: block.line };
    case "footnote":
      return { type: "footnote", id: block.id, text: block.text, raw: block.raw, line: block.line };
  }
}

function createNonce(): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let nonce = "";
  for (let index = 0; index < 32; index += 1) {
    nonce += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return nonce;
}
