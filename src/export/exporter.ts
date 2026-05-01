import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as vscode from "vscode";
import { getExportSettings } from "../config";
import { t } from "../i18n";
import { ExportSettings, ExportType } from "../types";
import { exportHtmlWithChromium, resolveChromiumPath } from "./chromium";
import { renderExportHtml } from "./renderer";
import { isExcluded, resolveExportTypes, resolveOutputPath } from "./utils";

export type ExportCommandType = ExportType | "settings" | "all";

export async function exportMarkdownDocument(
  context: vscode.ExtensionContext,
  document: vscode.TextDocument,
  commandType: ExportCommandType
): Promise<string[]> {
  if (document.uri.scheme !== "file") {
    throw new Error(t("message.fileBackedOnly"));
  }

  const settings = getExportSettings();
  if (isExcluded(document.uri.fsPath, settings.exclude)) {
    return [];
  }

  const types = resolveExportTypes(commandType, settings.defaultType);
  const outputs: string[] = [];
  for (const type of types) {
    const workspaceFolderPath = vscode.workspace.getWorkspaceFolder(document.uri)?.uri.fsPath;
    const output = resolveOutputPath(document.uri.fsPath, type, settings, workspaceFolderPath);
    await fs.mkdir(path.dirname(output), { recursive: true });
    const html = await renderExportHtml({
      markdown: document.getText(),
      sourcePath: document.uri.fsPath,
      outputPath: output,
      extensionPath: context.extensionPath,
      settings,
      type
    });

    if (type === "html") {
      await fs.writeFile(output, html, "utf8");
    } else {
      await exportWithChromium(context, html, output, type, settings);
    }
    outputs.push(output);
  }
  return outputs;
}

async function exportWithChromium(
  context: vscode.ExtensionContext,
  html: string,
  output: string,
  type: Exclude<ExportType, "html">,
  settings: ExportSettings
): Promise<void> {
  const executablePath = resolveChromiumPath(settings.chromiumExecutablePath);
  if (!executablePath) {
    throw new Error(t("message.chromiumUnavailable"));
  }
  await exportHtmlWithChromium(executablePath, html, output, type, settings);
}
