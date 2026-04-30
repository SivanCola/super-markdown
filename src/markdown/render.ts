import * as path from "node:path";
import * as vscode from "vscode";
import hljs from "highlight.js";
import MarkdownIt from "markdown-it";
import footnote from "markdown-it-footnote";
import katexPlugin from "@vscode/markdown-it-katex";
import taskLists from "markdown-it-task-lists";
import sanitizeHtml from "sanitize-html";
import { t } from "../i18n";
import { Heading, PreviewSettings } from "../types";

export interface RenderMarkdownOptions {
  document: vscode.TextDocument;
  webview: vscode.Webview;
  headings: Heading[];
  settings: PreviewSettings;
}

export function renderMarkdown(options: RenderMarkdownOptions): string {
  const headingByLine = new Map(options.headings.map((heading) => [heading.line, heading]));
  const md = new MarkdownIt({
    html: false,
    linkify: true,
    typographer: true,
    breaks: false
  });

  md.use(taskLists, { enabled: false, label: true, labelAfter: true });
  md.use(footnote);
  if (options.settings.katexEnabled) {
    md.use(katexPlugin, { throwOnError: false, errorColor: "#cc0000" });
  }

  addSourceLineAttributes(md, [
    "paragraph_open",
    "blockquote_open",
    "bullet_list_open",
    "ordered_list_open",
    "list_item_open",
    "table_open",
    "thead_open",
    "tbody_open",
    "tr_open"
  ]);

  const defaultHeadingOpen =
    md.renderer.rules.heading_open ??
    ((tokens, index, rendererOptions, _env, self) => self.renderToken(tokens, index, rendererOptions));

  md.renderer.rules.heading_open = (tokens, index, rendererOptions, env, self) => {
    const token = tokens[index];
    const line = token.map?.[0];
    const heading = line === undefined ? undefined : headingByLine.get(line);
    if (heading) {
      token.attrSet("id", heading.slug);
      token.attrSet("data-source-line", String(heading.line));
      token.attrSet("tabindex", "-1");
    }
    return defaultHeadingOpen(tokens, index, rendererOptions, env, self);
  };

  md.renderer.rules.fence = (tokens, index) => {
    const token = tokens[index];
    const line = token.map?.[0] ?? 0;
    const language = token.info.trim().split(/\s+/)[0].toLowerCase();
    const label = language || "text";

    if (language === "mermaid" && options.settings.mermaidEnabled) {
      return [
        `<figure class="diagram-block" data-source-line="${line}">`,
        `<figcaption>Mermaid</figcaption>`,
        `<pre class="mermaid">${escapeHtml(token.content)}</pre>`,
        `</figure>`
      ].join("");
    }

    const highlighted = highlightCode(token.content, language);
    const copyCode = t("webview.copyCode");
    const codeTheme = t("webview.codeTheme");
    const copy = t("webview.copy");
    return [
      `<figure class="code-block" data-source-line="${line}">`,
      `<figcaption><span>${escapeHtml(label)}</span><div class="code-actions"><button type="button" class="code-color-toggle" data-toggle-code-colors aria-label="${escapeHtml(codeTheme)}" title="${escapeHtml(codeTheme)}"></button><button type="button" class="copy-code" aria-label="${escapeHtml(copyCode)}">${escapeHtml(copy)}</button></div></figcaption>`,
      `<pre><code class="hljs language-${escapeAttribute(language)}">${highlighted}</code></pre>`,
      `</figure>`
    ].join("");
  };

  const defaultImage =
    md.renderer.rules.image ??
    ((tokens, index, rendererOptions, _env, self) => self.renderToken(tokens, index, rendererOptions));

  md.renderer.rules.image = (tokens, index, rendererOptions, env, self) => {
    const token = tokens[index];
    const src = token.attrGet("src");
    if (src) {
      token.attrSet("src", resolveImageSrc(src, options.document, options.webview));
      token.attrSet("loading", "lazy");
    }
    return defaultImage(tokens, index, rendererOptions, env, self);
  };

  const defaultLinkOpen =
    md.renderer.rules.link_open ??
    ((tokens, index, rendererOptions, _env, self) => self.renderToken(tokens, index, rendererOptions));

  md.renderer.rules.link_open = (tokens, index, rendererOptions, env, self) => {
    const token = tokens[index];
    token.attrSet("rel", "noopener noreferrer");
    return defaultLinkOpen(tokens, index, rendererOptions, env, self);
  };

  return sanitizeRenderedHtml(md.render(options.document.getText()));
}

function addSourceLineAttributes(md: MarkdownIt, ruleNames: string[]): void {
  for (const ruleName of ruleNames) {
    const defaultRenderer =
      md.renderer.rules[ruleName] ??
      ((tokens, index, rendererOptions, _env, self) => self.renderToken(tokens, index, rendererOptions));

    md.renderer.rules[ruleName] = (tokens, index, rendererOptions, env, self) => {
      const token = tokens[index];
      const line = token.map?.[0];
      if (line !== undefined && !token.attrGet("data-source-line")) {
        token.attrSet("data-source-line", String(line));
      }
      return defaultRenderer(tokens, index, rendererOptions, env, self);
    };
  }
}

function highlightCode(code: string, language: string): string {
  if (language && hljs.getLanguage(language)) {
    try {
      return hljs.highlight(code, { language, ignoreIllegals: true }).value;
    } catch {
      return escapeHtml(code);
    }
  }
  return escapeHtml(code);
}

function resolveImageSrc(src: string, document: vscode.TextDocument, webview: vscode.Webview): string {
  if (/^(https?:|data:|vscode-resource:|vscode-webview-resource:)/i.test(src)) {
    return src;
  }
  if (document.uri.scheme !== "file") {
    return src;
  }

  const withoutFragment = src.split("#")[0].split("?")[0];
  const decoded = decodeURIComponent(withoutFragment);
  const absolute = path.isAbsolute(decoded)
    ? vscode.Uri.file(decoded)
    : vscode.Uri.file(path.resolve(path.dirname(document.uri.fsPath), decoded));
  return webview.asWebviewUri(absolute).toString();
}

export function sanitizeRenderedHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      ...sanitizeHtml.defaults.allowedTags,
      "article",
      "section",
      "figure",
      "figcaption",
      "input",
      "label",
      "math",
      "semantics",
      "annotation",
      "mrow",
      "mi",
      "mn",
      "mo",
      "msup",
      "msub",
      "msubsup",
      "mfrac",
      "msqrt",
      "mroot",
      "mtext",
      "mtable",
      "mtr",
      "mtd"
    ],
    allowedAttributes: {
      "*": ["class", "id", "title", "aria-hidden", "aria-label", "data-*", "tabindex"],
      a: ["href", "name", "target", "rel", "class", "id", "title", "data-*"],
      img: ["src", "alt", "title", "width", "height", "class", "loading"],
      input: ["type", "checked", "disabled", "class", "id"],
      label: ["for", "class"],
      button: ["type", "class", "aria-label", "data-*"],
      code: ["class", "data-*"],
      pre: ["class", "data-*"],
      math: ["xmlns", "class", "display"],
      annotation: ["encoding"]
    },
    allowedSchemes: ["http", "https", "mailto", "data", "vscode-resource", "vscode-webview-resource"],
    allowProtocolRelative: false
  });
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/'/g, "&#39;");
}
