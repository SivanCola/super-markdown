import * as path from "node:path";
import * as vscode from "vscode";
import { Heading, PreviewSettings } from "../types";
import { renderMarkdownCore } from "./core";
import { t } from "../i18n";
import { parseMarkdownResourceTarget } from "./resource";

export interface RenderMarkdownOptions {
  document: vscode.TextDocument;
  webview: vscode.Webview;
  headings: Heading[];
  settings: PreviewSettings;
}

export async function renderMarkdown(options: RenderMarkdownOptions): Promise<string> {
  return renderMarkdownCore(options.document.getText(), {
    mermaidEnabled: options.settings.mermaidEnabled,
    katexEnabled: options.settings.katexEnabled,
    highlight: true,
    codeCopyButton: {
      copyLabel: t("webview.copyCode"),
      copiedLabel: t("webview.copied")
    },
    blockToneButton: {
      toneLabel: t("webview.codeTheme"),
      autoLabel: t("webview.codeThemeAuto"),
      lightLabel: t("webview.codeThemeLight"),
      darkLabel: t("webview.codeThemeDark")
    },
    resolveImageSource: (src) => resolveImageSrc(src, options.document, options.webview)
  });
}

export function resolveImageSrc(src: string, document: vscode.TextDocument, webview: vscode.Webview): string {
  const target = parseMarkdownResourceTarget(src, document.uri.scheme === "file" ? document.uri.fsPath : undefined);
  if (target.kind !== "local" || document.uri.scheme !== "file") {
    return target.normalized;
  }
  const absolute = vscode.Uri.file(target.absolutePath ?? path.resolve(path.dirname(document.uri.fsPath), target.decodedPath));
  return webview.asWebviewUri(absolute).toString();
}
