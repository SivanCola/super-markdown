import * as fs from "node:fs";
import * as path from "node:path";

export type HarnessMode = "split" | "wysiwyg" | "preview";

export const editorRuntimePath = path.join(process.cwd(), "media", "wysiwyg", "editor.js");
const codiconStylePath = path.join(process.cwd(), "node_modules", "@vscode", "codicons", "dist", "codicon.css");
const codiconFontPath = path.join(process.cwd(), "node_modules", "@vscode", "codicons", "dist", "codicon.ttf");
const previewStylePath = path.join(process.cwd(), "media", "preview.css");
const editorStylePath = path.join(process.cwd(), "media", "wysiwyg", "editor.css");

interface HarnessOptions {
  mode: HarnessMode;
  text?: string;
  previewHtml?: string;
  headings?: Array<{ level: number; text: string; slug?: string; line: number }>;
  imageResources?: Array<{ source: string; resolved: string }>;
  bodyClass?: string;
  bodyStyle?: string;
}

export function createWebviewHarnessHtml(options: HarnessOptions): string {
  const text = options.text ?? "alpha";
  const layout = options.mode === "split" ? "splitEdit" : options.mode === "preview" ? "previewOnly" : "workbench";
  const payload = scriptSafeJson({
    text,
    mode: options.mode,
    layout,
    preview: {
      markdown: text,
      html: options.previewHtml ?? `<p data-source-line="0">${escapeHtml(text)}</p>`,
      headings: options.headings ?? []
    },
    imageResources: options.imageResources ?? [],
    translations: {
      copyCode: "Copy",
      copiedCode: "Copied",
      editLanguage: "Edit language",
      mathEdit: "Edit",
      mathDone: "Done",
      rawHtmlEscaped: "Raw HTML escaped",
      footnote: "Footnote",
      noHeadings: "No headings",
      outlineRevealCurrent: "Reveal current heading",
      outlineCollapse: "Collapse outline",
      toolbar: {}
    }
  });

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Super Markdown toolbar harness</title>
  <style>${readCodiconStyle()}</style>
  <style>${fs.readFileSync(previewStylePath, "utf8")}</style>
  <style>${fs.readFileSync(editorStylePath, "utf8")}</style>
  <style>
    body { margin: 0; font-family: sans-serif; }
    .workbench-shell { display: grid; grid-template-columns: 44px minmax(0, 1fr) minmax(0, 1fr); gap: 0; padding: 16px; }
    .editor-toolbar-slot { grid-column: 1 / -1; display: flex; min-width: 0; gap: 4px; flex-wrap: wrap; overflow: hidden; }
    .toolbar-group { display: inline-flex; gap: 2px; }
    .toolbar-menu[hidden] { display: none; }
    body.harness-compact-side-panel #side-panel { display: none; }
    body.harness-compact-side-panel.side-panel-open #side-panel { display: block; }
    .source-editor, .visual-editor, .markdown-preview { height: 220px; min-height: 220px; border: 1px solid #ccc; overflow: auto; }
    .source-editor { width: 100%; }
    .visual-editor { display: block; position: relative; inset: auto; padding: 12px; }
    .visual-editor .milkdown { max-width: none; }
  </style>
</head>
<body class="${escapeAttribute(options.bodyClass ?? "")}" style="${escapeAttribute(options.bodyStyle ?? "")}">
  <div class="workbench-shell">
    <button id="side-panel-toggle" class="side-panel-toggle" type="button" aria-expanded="false" data-hover-tooltip="Document navigation" aria-label="Document navigation">Navigation</button>
    <aside id="side-panel" aria-hidden="true">
      <div class="panel-heading">
        <span class="panel-title">Headings</span>
        <button id="outline-current" class="outline-tool" type="button" data-hover-tooltip="Reveal current heading" aria-label="Reveal current heading">Current</button>
        <button id="side-panel-collapse" class="outline-tool" type="button" data-hover-tooltip="Collapse outline" aria-label="Collapse outline">Collapse</button>
      </div>
      <section class="panel-content">
        <input id="outline-search" type="search">
        <nav id="outline"></nav>
      </section>
    </aside>
    <div id="editor-toolbar-slot" class="editor-toolbar-slot" aria-label="Markdown toolbar"></div>
    <section class="editor-panel">
      <main id="editor" class="editor-surface">
        <textarea id="source-editor" class="source-editor" spellcheck="false" aria-label="Markdown source"></textarea>
        <div id="visual-editor" class="visual-editor" aria-label="Visual Markdown editor"></div>
      </main>
    </section>
    <div id="split-resizer" class="split-resizer" role="separator" aria-orientation="vertical" aria-valuemin="20" aria-valuemax="80" aria-valuenow="50" tabindex="0" data-hover-tooltip="Resize editor and preview panes" aria-label="Resize editor and preview panes"></div>
    <aside class="preview-panel">
      <main id="preview" class="markdown-preview"></main>
    </aside>
  </div>
  <script>
    window.__messages = [];
    window.__state = undefined;
    window.acquireVsCodeApi = function () {
      return {
        postMessage: function (message) { window.__messages.push(message); },
        getState: function () { return window.__state; },
        setState: function (state) { window.__state = state; }
      };
    };
  </script>
  <script id="payload" type="application/json">${payload}</script>
</body>
</html>`;
}

function readCodiconStyle(): string {
  const fontData = fs.readFileSync(codiconFontPath).toString("base64");
  return fs
    .readFileSync(codiconStylePath, "utf8")
    .replace(/url\("\.\/codicon\.ttf\?[^"]*"\)/, `url("data:font/ttf;base64,${fontData}")`);
}

function scriptSafeJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttribute(value: string): string {
  return escapeHtml(value);
}
