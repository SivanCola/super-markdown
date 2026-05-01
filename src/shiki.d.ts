declare module "shiki/core" {
  export interface HighlighterCore {
    codeToHtml(code: string, options: unknown): string;
  }

  export function createHighlighterCore(options: unknown): Promise<HighlighterCore>;
}

declare module "shiki/engine/javascript" {
  export function createJavaScriptRegexEngine(): unknown;
}

declare module "@shikijs/langs/*" {
  const language: unknown;
  export default language;
}

declare module "@shikijs/themes/*" {
  const theme: unknown;
  export default theme;
}
