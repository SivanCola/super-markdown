import * as vscode from "vscode";
import { PreviewSettings, PreviewTheme } from "./types";
import { parseTocLevels } from "./markdown/outline";
import { getConfiguredDisplayLanguage, getRuntimeLanguage } from "./i18n";

export function getPreviewSettings(): PreviewSettings {
  const config = vscode.workspace.getConfiguration("superMarkdown");
  const displayLanguage = getConfiguredDisplayLanguage();
  return {
    theme: getPreviewTheme(config),
    fontSize: clamp(config.get<number>("preview.fontSize", 14), 10, 24),
    maxWidth: clamp(config.get<number>("preview.maxWidth", 860), 520, 1400),
    tocLevels: parseTocLevels(config.get<string>("toc.levels", "1..6")),
    displayLanguage,
    activeLanguage: getRuntimeLanguage(displayLanguage),
    mermaidEnabled: config.get<boolean>("mermaid.enabled", true),
    katexEnabled: config.get<boolean>("katex.enabled", true),
    numberHeadings: config.get<boolean>("organize.numberHeadings", false),
    updateTocOnSave: config.get<boolean>("organize.updateTocOnSave", false)
  };
}

function getPreviewTheme(config: vscode.WorkspaceConfiguration): PreviewTheme {
  const value = config.get<PreviewTheme>("preview.theme", "auto");
  return [
    "auto",
    "light",
    "dark",
    "eye-care-green",
    "warm-paper",
    "ink-black",
    "coastal-blue",
    "high-contrast"
  ].includes(value)
    ? value
    : "auto";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
