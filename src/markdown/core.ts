import { escapeAttribute, escapeHtml, safeInlineUrl } from "../utils/html";
import { parseMarkdownBlocks, type ListBlock, type MarkdownBlock, type MarkdownDocument } from "./block";
import { renderCodeActions, type BlockToneLabels, type CodeCopyLabels } from "./codeCopy";
import {
  detectBlockquoteAdmonition,
  isSafeInlineHtmlTag,
  renderFootnoteDefinitionHtml,
  renderFootnoteReferenceHtml,
  renderInertInlineHtml,
  renderKatexHtml,
  renderSafeInlineHtmlToken,
  resolveFootnoteReference
} from "./features";
import { highlightCodeBlockHtml, normalizeCodeLanguage, renderPlainCodeLinesHtml } from "./highlight";
import { parseInlineMarkdown, type InlineToken } from "./inline";

export type { MarkdownBlock, MarkdownDocument } from "./block";

export interface RenderMarkdownCoreOptions {
  mermaidEnabled?: boolean;
  katexEnabled?: boolean;
  highlight?: boolean;
  breaks?: boolean;
  resolveImageSource?: (src: string) => string;
  codeCopyButton?: CodeCopyLabels;
  blockToneButton?: BlockToneLabels;
}

export function parseMarkdown(text: string): MarkdownDocument {
  return parseMarkdownBlocks(text);
}

export function serializeMarkdown(document: MarkdownDocument): string {
  return document.nodes.map((node) => node.raw).join("\n\n");
}

export async function renderMarkdownCore(text: string, options: RenderMarkdownCoreOptions = {}): Promise<string> {
  const document = parseMarkdown(text);
  const html = (await Promise.all(document.nodes
    .filter((node) => node.type !== "footnote")
    .map((node) => renderNode(node, document.footnotes, options))))
    .join("\n");
  const footnotes = renderFootnotes(document.footnotes, options);
  return footnotes ? `${html}\n${footnotes}` : html;
}

export function renderInlineMarkdown(
  text: string,
  footnotes: ReadonlyMap<string, string> = new Map(),
  options: RenderMarkdownCoreOptions = {}
): string {
  const html = renderInlineTokens(parseInlineMarkdown(text), footnotes, options);
  return options.breaks ? html.replace(/\n/g, "<br>") : html;
}

function renderInlineTokens(
  tokens: readonly InlineToken[],
  footnotes: ReadonlyMap<string, string>,
  options: RenderMarkdownCoreOptions
): string {
  return tokens.map((token) => {
    switch (token.type) {
      case "text":
        return escapeHtml(token.value);
      case "code":
        return `<code>${escapeHtml(token.value)}</code>`;
      case "strong":
        return `<strong>${renderInlineTokens(token.children, footnotes, options)}</strong>`;
      case "emphasis":
        return `<em>${renderInlineTokens(token.children, footnotes, options)}</em>`;
      case "delete":
        return `<del>${renderInlineTokens(token.children, footnotes, options)}</del>`;
      case "underline":
        return renderSafeInlineHtmlToken("u", renderInlineTokens(token.children, footnotes, options));
      case "mark":
        return renderSafeInlineHtmlToken("mark", renderInlineTokens(token.children, footnotes, options));
      case "kbd":
        return renderSafeInlineHtmlToken("kbd", renderInlineTokens(token.children, footnotes, options));
      case "math":
        return renderKatexHtml(token.value, false, options);
      case "footnote":
        return renderFootnoteReferenceHtml(resolveFootnoteReference(token.id, footnotes));
      case "image": {
        const safeDestination = safeInlineUrl(token.destination);
        const resolved = options.resolveImageSource ? options.resolveImageSource(safeDestination) : safeDestination;
        const titleAttribute = token.title ? ` title="${escapeAttribute(token.title)}"` : "";
        return `<img src="${escapeAttribute(resolved)}" alt="${escapeAttribute(token.alt)}"${titleAttribute} loading="lazy">`;
      }
      case "link": {
        const titleAttribute = token.title ? ` title="${escapeAttribute(token.title)}"` : "";
        return `<a href="${escapeAttribute(safeInlineUrl(token.destination))}" rel="noopener noreferrer"${titleAttribute}>${renderInlineTokens(token.children, footnotes, options)}</a>`;
      }
    }
  }).join("");
}

async function renderNode(node: MarkdownBlock, footnotes: ReadonlyMap<string, string>, options: RenderMarkdownCoreOptions): Promise<string> {
  const source = renderSourcePosition(node.line, node.raw);
  switch (node.type) {
    case "heading":
      return `<h${node.level} id="${escapeAttribute(node.slug)}"${source} tabindex="-1">${renderInlineMarkdown(node.text, footnotes, options)}</h${node.level}>`;
    case "paragraph":
      if (isRawHtmlParagraph(node.text)) {
        return renderRawHtmlBlock(node.text, source);
      }
      return `<p${source}>${renderInlineMarkdown(node.text, footnotes, options)}</p>`;
    case "blockquote": {
      const admonition = detectBlockquoteAdmonition(node.text);
      if (admonition) {
        const body = admonition.body ? await renderMarkdownCore(admonition.body, options) : "";
        return `<blockquote${source} class="admonition admonition-${escapeAttribute(admonition.type)}" data-admonition="${escapeAttribute(admonition.type)}"><p class="admonition-title">${escapeHtml(admonition.label)}</p>${body}</blockquote>`;
      }
      return `<blockquote${source}>${await renderMarkdownCore(node.text, options)}</blockquote>`;
    }
    case "list":
      return renderListBlock(node, footnotes, options);
    case "code": {
      const language = normalizeCodeLanguage(node.language);
      const languageLabel = codeLanguageLabel(node.language, language);
      const highlighted = options.highlight === false ? renderPlainCodeLinesHtml(node.code) : await highlightCodeBlockHtml(node.code, language);
      const actions = renderCodeActions({
        copyLabels: options.codeCopyButton,
        toneLabels: options.blockToneButton
      });
      return `<figure class="code-block"${source}><figcaption><span class="code-language">${escapeHtml(languageLabel)}</span>${actions}</figcaption><pre><code class="shiki shiki-themes light-plus dark-plus language-${escapeAttribute(language)}">${highlighted}</code></pre></figure>`;
    }
    case "mermaid":
      if (!options.mermaidEnabled) {
        return renderNode({ ...node, type: "code", language: "mermaid" }, footnotes, options);
      }
      return `<figure class="diagram-block"${source}><figcaption><span class="code-language">Mermaid</span>${renderCodeActions({
        copyLabels: options.codeCopyButton,
        toneLabels: options.blockToneButton
      })}</figcaption><template class="code-copy-source">${escapeHtml(node.code)}</template><pre class="mermaid">${escapeHtml(node.code)}</pre></figure>`;
    case "math":
      return `<figure class="math-block"${source}>${renderKatexHtml(node.expression, true, options)}</figure>`;
    case "table": {
      const headers = node.headers.map((header, index) => `<th${alignAttribute(node.aligns[index])}>${renderInlineMarkdown(header, footnotes, options)}</th>`).join("");
      const rows = node.rows.map((row) => `<tr>${node.headers.map((_header, index) => `<td${alignAttribute(node.aligns[index])}>${renderInlineMarkdown(row[index] ?? "", footnotes, options)}</td>`).join("")}</tr>`).join("");
      return `<table${source}><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>`;
    }
    case "hr":
      return `<hr${source}>`;
    case "footnote":
      return "";
  }
}

function codeLanguageLabel(rawLanguage: string | undefined, normalizedLanguage: string): string {
  const raw = (rawLanguage || "").trim().split(/\s+/)[0];
  return raw || normalizedLanguage || "text";
}

function renderListBlock(
  node: ListBlock,
  footnotes: ReadonlyMap<string, string>,
  options: RenderMarkdownCoreOptions
): string {
  const tag = node.ordered ? "ol" : "ul";
  const items = node.items.map((item) => {
    const task = item.checked === undefined
      ? ""
      : `<input type="checkbox" disabled${item.checked ? " checked" : ""}> `;
    const children = (item.children ?? [])
      .map((child) => renderListBlock(child, footnotes, options))
      .join("");
    return `<li data-source-line="${item.line}">${task}${renderInlineMarkdown(item.text, footnotes, options)}${children}</li>`;
  }).join("");
  return `<${tag}>${items}</${tag}>`;
}

function renderSourcePosition(startLine: number, raw: string): string {
  const lineCount = raw ? raw.split(/\r?\n/).length : 1;
  const endLine = startLine + Math.max(0, lineCount - 1);
  const endAttribute = endLine > startLine ? ` data-source-end-line="${endLine}"` : "";
  return ` data-source-line="${startLine}"${endAttribute}`;
}

function isRawHtmlParagraph(text: string): boolean {
  const trimmed = text.trim();
  const firstTag = trimmed.match(/^<\/?([a-z][a-z0-9-]*)(?:[\s>/]|$)/i);
  if (!firstTag) {
    return false;
  }
  return !isSafeInlineHtmlTag(firstTag[1]);
}

function renderRawHtmlBlock(text: string, source: string): string {
  return `<div class="visual-html-source raw-html-source"${source}><span class="visual-html-label">RAW HTML ESCAPED</span><span class="visual-html-code">${renderInertInlineHtml(text.trim())}</span></div>`;
}

function renderFootnotes(footnotes: ReadonlyMap<string, string>, options: RenderMarkdownCoreOptions): string {
  if (footnotes.size === 0) {
    return "";
  }
  const items = Array.from(footnotes.entries())
    .map(([id, value]) => renderFootnoteDefinitionHtml(resolveFootnoteReference(id, footnotes), renderInlineMarkdown(value, footnotes, options)))
    .join("");
  return `<section class="footnotes"><ol>${items}</ol></section>`;
}

function alignAttribute(value: "left" | "center" | "right" | undefined): string {
  return value ? ` style="text-align: ${value}"` : "";
}
