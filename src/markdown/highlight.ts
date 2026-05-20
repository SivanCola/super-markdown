import type { HighlighterCore } from "shiki/core";
import { escapeHtml } from "../utils/html";
import { normalizeCodeLanguage, SHIKI_DARK_THEME, SHIKI_LIGHT_THEME } from "./highlightLanguage";

export { normalizeCodeLanguage, SHIKI_DARK_THEME, SHIKI_LIGHT_THEME } from "./highlightLanguage";

type CreateHighlighterCore = typeof import("shiki/core")["createHighlighterCore"];
type CreateJavaScriptRegexEngine = typeof import("shiki/engine/javascript")["createJavaScriptRegexEngine"];
type DefaultModule<T> = { default: T };

interface ShikiModules {
  createHighlighterCore: CreateHighlighterCore;
  createJavaScriptRegexEngine: CreateJavaScriptRegexEngine;
  langs: unknown[];
  themes: unknown[];
}

let highlighterPromise: Promise<HighlighterCore> | undefined;
let shikiModulesPromise: Promise<ShikiModules> | undefined;
const importEsm = new Function("specifier", "return import(specifier)") as <T>(specifier: string) => Promise<T>;

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

export function renderPlainCodeLinesHtml(code: string): string {
  const normalized = code.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  return normalized
    .split("\n")
    .map((line) => `<span class="line">${escapeHtml(line)}</span>`)
    .join("\n");
}

function getHighlighter(): Promise<HighlighterCore> {
  if (!highlighterPromise) {
    highlighterPromise = loadShikiModules().then((modules) =>
      modules.createHighlighterCore({
        themes: modules.themes,
        langs: modules.langs,
        engine: modules.createJavaScriptRegexEngine()
      })
    );
  }
  return highlighterPromise;
}

function loadShikiModules(): Promise<ShikiModules> {
  if (!shikiModulesPromise) {
    shikiModulesPromise = Promise.all([
      importEsm<Pick<typeof import("shiki/core"), "createHighlighterCore">>("shiki/core"),
      importEsm<Pick<typeof import("shiki/engine/javascript"), "createJavaScriptRegexEngine">>("shiki/engine/javascript"),
      importEsm<DefaultModule<unknown>>("@shikijs/langs/css"),
      importEsm<DefaultModule<unknown>>("@shikijs/langs/go"),
      importEsm<DefaultModule<unknown>>("@shikijs/langs/html"),
      importEsm<DefaultModule<unknown>>("@shikijs/langs/javascript"),
      importEsm<DefaultModule<unknown>>("@shikijs/langs/json"),
      importEsm<DefaultModule<unknown>>("@shikijs/langs/jsx"),
      importEsm<DefaultModule<unknown>>("@shikijs/langs/md"),
      importEsm<DefaultModule<unknown>>("@shikijs/langs/python"),
      importEsm<DefaultModule<unknown>>("@shikijs/langs/sh"),
      importEsm<DefaultModule<unknown>>("@shikijs/langs/sql"),
      importEsm<DefaultModule<unknown>>("@shikijs/langs/tsx"),
      importEsm<DefaultModule<unknown>>("@shikijs/langs/typescript"),
      importEsm<DefaultModule<unknown>>("@shikijs/langs/yaml"),
      importEsm<DefaultModule<unknown>>("@shikijs/themes/dark-plus"),
      importEsm<DefaultModule<unknown>>("@shikijs/themes/light-plus")
    ]).then(([
      core,
      engine,
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
      yaml,
      darkPlus,
      lightPlus
    ]) => ({
      createHighlighterCore: core.createHighlighterCore,
      createJavaScriptRegexEngine: engine.createJavaScriptRegexEngine,
      themes: [lightPlus.default, darkPlus.default],
      langs: [
        css.default,
        go.default,
        html.default,
        javascript.default,
        json.default,
        jsx.default,
        markdown.default,
        python.default,
        shell.default,
        sql.default,
        tsx.default,
        typescript.default,
        yaml.default
      ]
    }));
  }
  return shikiModulesPromise;
}

function extractCodeHtml(html: string, fallbackCode: string): string {
  const match = html.match(/<code>([\s\S]*)<\/code>\s*<\/pre>$/);
  return match ? match[1] : renderPlainCodeLinesHtml(fallbackCode);
}
