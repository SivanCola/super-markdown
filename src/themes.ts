import * as vscode from "vscode";
import { PreviewTheme } from "./types";

export const PREVIEW_THEMES: readonly PreviewTheme[] = [
  "system",
  "light",
  "dark",
  "sage",
  "paper",
  "ocean",
  "solarized",
  "rose",
  "lavender",
  "graphite",
  "forest",
  "terminal",
  "ink",
  "high-contrast"
];

const LEGACY_THEME_MAP: Record<string, PreviewTheme> = {
  auto: "system",
  "eye-care-green": "sage",
  "warm-paper": "paper",
  "coastal-blue": "ocean",
  "ink-black": "ink"
};

export function normalizePreviewTheme(value: unknown): PreviewTheme {
  if (typeof value !== "string") {
    return "system";
  }
  if (isPreviewTheme(value)) {
    return value;
  }
  return LEGACY_THEME_MAP[value] ?? "system";
}

export async function migratePreviewThemeConfiguration(): Promise<void> {
  const config = vscode.workspace.getConfiguration("superMarkdown");
  const inspection = config.inspect<string>("preview.theme");

  await migrateConfiguredTheme(config, inspection?.globalValue, vscode.ConfigurationTarget.Global);
  await migrateConfiguredTheme(config, inspection?.workspaceValue, vscode.ConfigurationTarget.Workspace);

  await Promise.all(
    (vscode.workspace.workspaceFolders ?? []).map(async (folder) => {
      const folderConfig = vscode.workspace.getConfiguration("superMarkdown", folder.uri);
      const folderInspection = folderConfig.inspect<string>("preview.theme");
      await migrateConfiguredTheme(
        folderConfig,
        folderInspection?.workspaceFolderValue,
        vscode.ConfigurationTarget.WorkspaceFolder
      );
    })
  );
}

function isPreviewTheme(value: string): value is PreviewTheme {
  return PREVIEW_THEMES.includes(value as PreviewTheme);
}

async function migrateConfiguredTheme(
  config: vscode.WorkspaceConfiguration,
  value: string | undefined,
  target: vscode.ConfigurationTarget
): Promise<void> {
  const nextTheme = value ? LEGACY_THEME_MAP[value] : undefined;
  if (!nextTheme) {
    return;
  }

  try {
    await config.update("preview.theme", nextTheme, target);
  } catch {
    // Rendering still normalizes legacy values; migration is best-effort only.
  }
}
