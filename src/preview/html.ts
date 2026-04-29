import * as vscode from "vscode";
import { getLanguageButtonLabel, getWebviewTranslations, t } from "../i18n";
import { buildHeadingTree } from "../markdown/outline";
import { escapeHtml } from "../markdown/render";
import { DocumentIssue, Heading, PreviewSettings } from "../types";

export interface PreviewHtmlOptions {
  webview: vscode.Webview;
  extensionUri: vscode.Uri;
  document: vscode.TextDocument;
  contentHtml: string;
  headings: Heading[];
  issues: DocumentIssue[];
  mode: "preview" | "splitEdit";
  settings: PreviewSettings;
}

export function buildPreviewHtml(options: PreviewHtmlOptions): string {
  const nonce = createNonce();
  const isSplitEdit = options.mode === "splitEdit";
  const media = (relativePath: string) =>
    options.webview.asWebviewUri(vscode.Uri.joinPath(options.extensionUri, ...relativePath.split("/")));
  const katexCss = options.webview.asWebviewUri(
    vscode.Uri.joinPath(options.extensionUri, "media", "vendor", "katex", "katex.min.css")
  );
  const mermaidScript = options.webview.asWebviewUri(
    vscode.Uri.joinPath(options.extensionUri, "media", "vendor", "mermaid", "mermaid.min.js")
  );

  const payload = JSON.stringify({
    headings: options.headings.map(({ level, text, slug, line }) => ({ level, text, slug, line })),
    issues: options.issues,
    documentUri: options.document.uri.toString(),
    mode: options.mode,
    activeLanguage: options.settings.activeLanguage,
    translations: getWebviewTranslations(),
    mermaidEnabled: options.settings.mermaidEnabled
  }).replace(/<\/template/gi, "<\\/template");

  const csp = [
    "default-src 'none'",
    `img-src ${options.webview.cspSource} https: data:`,
    `style-src ${options.webview.cspSource} 'unsafe-inline'`,
    `script-src 'nonce-${nonce}' ${options.webview.cspSource}`,
    `font-src ${options.webview.cspSource}`,
    "connect-src https:"
  ].join("; ");

  const mermaidTag = options.settings.mermaidEnabled
    ? `<script nonce="${nonce}" src="${mermaidScript}"></script>`
    : "";

  return `<!DOCTYPE html>
<html lang="${options.settings.activeLanguage === "zh-CN" ? "zh-CN" : "en"}">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="${media("media/preview.css")}">
  ${options.settings.katexEnabled ? `<link rel="stylesheet" href="${katexCss}">` : ""}
  <title>${escapeHtml(options.document.fileName)}</title>
</head>
<body class="sm-theme-${options.settings.theme}" style="--sm-font-size: ${options.settings.fontSize}px; --sm-max-width: ${options.settings.maxWidth}px;">
  <div class="app-shell ${isSplitEdit ? "sidebar-collapsed" : ""}">
    <button type="button" class="sidebar-toggle" data-toggle-sidebar aria-controls="sidebar" aria-expanded="${isSplitEdit ? "false" : "true"}">${escapeHtml(isSplitEdit ? t("webview.showOutline") : t("webview.hideOutline"))}</button>
    <aside id="sidebar" class="sidebar" aria-label="${escapeHtml(t("webview.navigation"))}">
      <div class="sidebar-header">
        <div class="mode-row">
          <div class="mode-label">${escapeHtml(isSplitEdit ? t("mode.splitEdit") : t("mode.preview"))}</div>
          <button type="button" class="language-button" title="${escapeHtml(t("language.button.title"))}" aria-label="${escapeHtml(t("language.button.title"))}" data-switch-language>${escapeHtml(getLanguageButtonLabel())}</button>
        </div>
        <input id="toc-search" type="search" aria-label="${escapeHtml(t("webview.searchHeadings"))}" placeholder="${escapeHtml(t("webview.searchHeadings"))}">
      </div>
      <nav class="toc" aria-label="${escapeHtml(t("webview.headings"))}">
        ${renderToc(options.headings)}
      </nav>
      <div class="sidebar-resize-handle" data-resize-sidebar role="separator" aria-orientation="horizontal" tabindex="0" aria-label="${escapeHtml(t("webview.resizeOutline"))}" title="${escapeHtml(t("webview.resizeOutline"))}"></div>
    </aside>
    <main class="preview" aria-label="${escapeHtml(t("webview.markdownPreview"))}">
      <article class="markdown-body">
        ${options.contentHtml}
      </article>
    </main>
  </div>
  <template id="payload">${payload}</template>
  ${mermaidTag}
  <script nonce="${nonce}" src="${media("media/preview.js")}"></script>
</body>
</html>`;
}

function renderToc(headings: Heading[]): string {
  const tree = buildHeadingTree(headings);
  if (tree.length === 0) {
    return `<div class="empty-state">${escapeHtml(t("webview.noHeadings"))}</div>`;
  }

  return `<ol>${tree.map(renderTocItem).join("")}</ol>`;
}

function renderTocItem(heading: Heading): string {
  const children = heading.children.length > 0 ? `<ol>${heading.children.map(renderTocItem).join("")}</ol>` : "";
  return `<li class="toc-item" data-heading-level="${heading.level}">
    <a href="#${escapeHtml(heading.slug)}" data-toc-link data-slug="${escapeHtml(heading.slug)}" data-line="${heading.line}">
      <span class="toc-level">H${heading.level}</span>
      <span class="toc-text">${escapeHtml(heading.text)}</span>
    </a>
    ${children}
  </li>`;
}

function createNonce(): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let nonce = "";
  for (let index = 0; index < 32; index += 1) {
    nonce += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return nonce;
}
