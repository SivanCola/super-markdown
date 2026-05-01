import katex from "katex";
import { escapeAttribute, escapeHtml } from "../utils/html";

export type SafeInlineHtmlTag = "u" | "mark" | "kbd";

export interface MarkdownFeaturePolicy {
  katexEnabled?: boolean;
  safeInlineHtmlTags?: readonly SafeInlineHtmlTag[];
}

export interface RenderMathOptions {
  katexEnabled?: boolean;
  errorColor?: string;
}

export interface FootnoteRenderModel {
  id: string;
  normalizedId: string;
  label: string;
  exists: boolean;
  referenceId: string;
  definitionId: string;
  fallbackMarkdown: string;
}

export interface BlockquoteAdmonition {
  type: "note" | "tip" | "important" | "warning" | "caution";
  label: string;
  body: string;
}

export const DEFAULT_SAFE_INLINE_HTML_TAGS: readonly SafeInlineHtmlTag[] = ["u", "mark", "kbd"];

export function renderKatexHtml(expression: string, displayMode: boolean, options: RenderMathOptions = {}): string {
  if (!options.katexEnabled) {
    return `<code>${escapeHtml(displayMode ? `$$\n${expression}\n$$` : `$${expression}$`)}</code>`;
  }
  try {
    return katex.renderToString(expression, {
      displayMode,
      throwOnError: false,
      errorColor: options.errorColor || "#cc0000"
    });
  } catch {
    return `<code>${escapeHtml(expression)}</code>`;
  }
}

export function normalizeFootnoteId(id: string): string {
  return String(id || "").trim().replace(/\s+/g, "-").toLowerCase();
}

export function resolveFootnoteReference(id: string, footnotes?: ReadonlyMap<string, string>): FootnoteRenderModel {
  const label = String(id || "").trim();
  const normalizedId = normalizeFootnoteId(label);
  return {
    id: label,
    normalizedId,
    label,
    exists: footnotes ? hasFootnote(footnotes, label, normalizedId) : true,
    referenceId: `fnref-${normalizedId}`,
    definitionId: `fn-${normalizedId}`,
    fallbackMarkdown: `[^${label}]`
  };
}

function hasFootnote(footnotes: ReadonlyMap<string, string>, label: string, normalizedId: string): boolean {
  if (footnotes.has(label)) {
    return true;
  }
  for (const id of footnotes.keys()) {
    if (normalizeFootnoteId(id) === normalizedId) {
      return true;
    }
  }
  return false;
}

export function renderSafeInlineHtmlToken(tag: SafeInlineHtmlTag, innerHtml: string): string {
  return `<${tag}>${innerHtml}</${tag}>`;
}

export function isSafeInlineHtmlTag(value: string, policy: MarkdownFeaturePolicy = {}): value is SafeInlineHtmlTag {
  const normalized = value.toLowerCase();
  const allowed = policy.safeInlineHtmlTags || DEFAULT_SAFE_INLINE_HTML_TAGS;
  return allowed.includes(normalized as SafeInlineHtmlTag);
}

export function renderInertInlineHtml(value: string): string {
  return `<code class="safe-html-source">${escapeHtml(value)}</code>`;
}

export function renderFootnoteReferenceHtml(model: FootnoteRenderModel): string {
  if (!model.exists) {
    return escapeHtml(model.fallbackMarkdown);
  }
  return `<sup id="${escapeAttribute(model.referenceId)}"><a href="#${escapeAttribute(model.definitionId)}">${escapeHtml(model.label)}</a></sup>`;
}

export function renderFootnoteDefinitionHtml(model: FootnoteRenderModel, html: string): string {
  return `<li id="${escapeAttribute(model.definitionId)}">${html}</li>`;
}

export function detectBlockquoteAdmonition(text: string): BlockquoteAdmonition | null {
  const lines = String(text || "").split(/\r?\n/);
  const match = lines[0]?.trim().match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)]\s*(.*)$/i);
  if (!match) {
    return null;
  }
  const type = match[1].toLowerCase() as BlockquoteAdmonition["type"];
  const rest = match[2] ? [match[2]] : [];
  return {
    type,
    label: match[1].toUpperCase(),
    body: [...rest, ...lines.slice(1)].join("\n").trim()
  };
}
