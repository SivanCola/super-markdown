import { createHighlighterCore, type HighlighterCore } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import css from "@shikijs/langs/css";
import go from "@shikijs/langs/go";
import html from "@shikijs/langs/html";
import javascript from "@shikijs/langs/javascript";
import json from "@shikijs/langs/json";
import jsx from "@shikijs/langs/jsx";
import markdown from "@shikijs/langs/md";
import python from "@shikijs/langs/python";
import shell from "@shikijs/langs/sh";
import sql from "@shikijs/langs/sql";
import tsx from "@shikijs/langs/tsx";
import typescript from "@shikijs/langs/typescript";
import yaml from "@shikijs/langs/yaml";
import darkPlus from "@shikijs/themes/dark-plus";
import lightPlus from "@shikijs/themes/light-plus";
import { normalizeCodeLanguage, SHIKI_DARK_THEME, SHIKI_LIGHT_THEME } from "../../src/markdown/highlightLanguage";
import { escapeHtml } from "../../src/utils/html";

let highlighterPromise: Promise<HighlighterCore> | undefined;

export { normalizeCodeLanguage, SHIKI_DARK_THEME, SHIKI_LIGHT_THEME };

export async function highlightCodeBlockHtml(code: string, language: string | undefined): Promise<string> {
  const normalizedLanguage = normalizeCodeLanguage(language);
  try {
    const highlighter = await getHighlighter();
    const html = highlighter.codeToHtml(code, {
      lang: normalizedLanguage,
      themes: {
        light: SHIKI_LIGHT_THEME,
        dark: SHIKI_DARK_THEME
      },
      defaultColor: false
    });
    return extractCodeHtml(html, code);
  } catch {
    return renderPlainCodeLinesHtml(code);
  }
}

function renderPlainCodeLinesHtml(code: string): string {
  const normalized = code.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  return normalized
    .split("\n")
    .map((line) => `<span class="line">${escapeHtml(line)}</span>`)
    .join("\n");
}

function getHighlighter(): Promise<HighlighterCore> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighterCore({
      themes: [lightPlus, darkPlus],
      langs: [
        css,
        go,
        html,
        javascript,
        json,
        jsx,
        markdown,
        python,
        shell,
        sql,
        tsx,
        typescript,
        yaml
      ],
      engine: createJavaScriptRegexEngine()
    });
  }
  return highlighterPromise;
}

function extractCodeHtml(html: string, fallbackCode: string): string {
  const match = html.match(/<code>([\s\S]*)<\/code>\s*<\/pre>$/);
  return match ? match[1] : renderPlainCodeLinesHtml(fallbackCode);
}
