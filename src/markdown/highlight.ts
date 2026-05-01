import type { HighlighterCore } from "shiki/core";
import type { LanguageInput, ThemeInput } from "@shikijs/types";
import { escapeHtml } from "../utils/html";
import { normalizeCodeLanguage, SHIKI_DARK_THEME, SHIKI_LIGHT_THEME } from "./highlightLanguage";

export { normalizeCodeLanguage, SHIKI_DARK_THEME, SHIKI_LIGHT_THEME } from "./highlightLanguage";

type CreateHighlighterCore = typeof import("shiki/core")["createHighlighterCore"];
type CreateJavaScriptRegexEngine = typeof import("shiki/engine/javascript")["createJavaScriptRegexEngine"];
type DefaultModule<T> = { default: T };

interface ShikiModules {
  createHighlighterCore: CreateHighlighterCore;
  createJavaScriptRegexEngine: CreateJavaScriptRegexEngine;
  langs: LanguageInput[];
  themes: ThemeInput[];
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
    return extractCodeHtml(html);
  } catch {
    return escapeHtml(code);
  }
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
      importEsm<DefaultModule<LanguageInput>>("@shikijs/langs/css"),
      importEsm<DefaultModule<LanguageInput>>("@shikijs/langs/go"),
      importEsm<DefaultModule<LanguageInput>>("@shikijs/langs/html"),
      importEsm<DefaultModule<LanguageInput>>("@shikijs/langs/javascript"),
      importEsm<DefaultModule<LanguageInput>>("@shikijs/langs/json"),
      importEsm<DefaultModule<LanguageInput>>("@shikijs/langs/jsx"),
      importEsm<DefaultModule<LanguageInput>>("@shikijs/langs/md"),
      importEsm<DefaultModule<LanguageInput>>("@shikijs/langs/python"),
      importEsm<DefaultModule<LanguageInput>>("@shikijs/langs/sh"),
      importEsm<DefaultModule<LanguageInput>>("@shikijs/langs/sql"),
      importEsm<DefaultModule<LanguageInput>>("@shikijs/langs/tsx"),
      importEsm<DefaultModule<LanguageInput>>("@shikijs/langs/typescript"),
      importEsm<DefaultModule<LanguageInput>>("@shikijs/langs/yaml"),
      importEsm<DefaultModule<ThemeInput>>("@shikijs/themes/dark-plus"),
      importEsm<DefaultModule<ThemeInput>>("@shikijs/themes/light-plus")
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

function extractCodeHtml(html: string): string {
  const match = html.match(/<code>([\s\S]*)<\/code>\s*<\/pre>$/);
  return match ? match[1] : escapeHtml(html);
}
