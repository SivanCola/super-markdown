import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as vscode from "vscode";
import puppeteer from "puppeteer-core";
import { getExportSettings } from "../config";
import { t } from "../i18n";
import { ExportSettings, ExportType } from "../types";
import { resolveChromiumPath } from "./chromium";
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
    const html = renderExportHtml({
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
  const executablePath = await resolveChromiumPath(
    settings.chromiumExecutablePath,
    path.join(context.globalStorageUri.fsPath, "chromium"),
    (downloaded, total) => {
      if (total > 0) {
        console.log(`Super Markdown Chromium download ${Math.round((downloaded / total) * 100)}%`);
      }
    }
  );
  if (!executablePath) {
    throw new Error(t("message.chromiumUnavailable"));
  }

  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    if (type === "pdf") {
      await page.pdf({
        path: output,
        format: settings.pdf.format as "A4",
        landscape: settings.pdf.landscape,
        printBackground: settings.pdf.printBackground,
        displayHeaderFooter: settings.pdf.displayHeaderFooter,
        headerTemplate: settings.pdf.headerTemplate,
        footerTemplate: settings.pdf.footerTemplate,
        margin: settings.pdf.margin
      });
    } else {
      await page.screenshot({
        path: output,
        type,
        quality: type === "jpeg" ? settings.image.quality : undefined,
        fullPage: settings.image.fullPage,
        omitBackground: settings.image.omitBackground,
        clip: settings.image.clip
      });
    }
  } finally {
    await browser.close();
  }
}
