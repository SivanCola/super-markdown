export const SHIKI_LIGHT_THEME = "light-plus";
export const SHIKI_DARK_THEME = "dark-plus";

const LANGUAGE_ALIASES: Record<string, string> = {
  bash: "sh",
  golang: "go",
  javascript: "js",
  markdown: "md",
  plaintext: "text",
  py: "python",
  shell: "sh",
  text: "text",
  ts: "ts",
  typescript: "ts",
  xml: "html",
  yml: "yaml",
  zsh: "sh"
};

const SUPPORTED_LANGUAGES = new Set([
  "css",
  "go",
  "html",
  "js",
  "jsx",
  "json",
  "md",
  "python",
  "sh",
  "sql",
  "text",
  "tsx",
  "ts",
  "yaml"
]);

export function normalizeCodeLanguage(language: string | undefined): string {
  const raw = (language || "text").trim().toLowerCase().split(/\s+/)[0] || "text";
  const normalized = LANGUAGE_ALIASES[raw] || raw;
  return SUPPORTED_LANGUAGES.has(normalized) ? normalized : "text";
}
