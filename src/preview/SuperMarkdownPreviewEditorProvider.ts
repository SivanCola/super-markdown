import * as path from "node:path";
import * as vscode from "vscode";
import { getPreviewSettings } from "../config";
import { t } from "../i18n";
import { analyzeMarkdownHealth } from "../markdown/health";
import { extractHeadings } from "../markdown/outline";
import { renderMarkdown } from "../markdown/render";
import { buildPreviewHtml } from "./html";
import { fileExistsNearDocument, openMarkdownLink, revealDocumentLine } from "./PreviewManager";

export const SUPER_MARKDOWN_PREVIEW_EDITOR_VIEW_TYPE = "superMarkdown.previewEditor";

export class SuperMarkdownPreviewEditorProvider implements vscode.CustomTextEditorProvider {
  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly onDidChangeDisplayLanguage?: vscode.Event<void>
  ) {}

  async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        this.context.extensionUri,
        ...(vscode.workspace.workspaceFolders?.map((folder) => folder.uri) ?? []),
        document.uri.scheme === "file"
          ? vscode.Uri.file(path.dirname(document.uri.fsPath))
          : this.context.extensionUri
      ]
    };

    const update = async () => {
      webviewPanel.title = `${t("mode.preview")}: ${path.basename(document.fileName)}`;
      webviewPanel.webview.html = await this.render(document, webviewPanel.webview);
    };

    const disposables: vscode.Disposable[] = [
      vscode.workspace.onDidChangeTextDocument((event) => {
        if (event.document.uri.toString() === document.uri.toString()) {
          void update();
        }
      }),
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration("superMarkdown")) {
          void update();
        }
      }),
      ...(this.onDidChangeDisplayLanguage ? [this.onDidChangeDisplayLanguage(() => void update())] : []),
      webviewPanel.webview.onDidReceiveMessage((message) => {
        void this.handleMessage(document, message);
      })
    ];

    webviewPanel.onDidDispose(() => {
      disposables.forEach((disposable) => disposable.dispose());
    });

    await update();
  }

  private async render(document: vscode.TextDocument, webview: vscode.Webview): Promise<string> {
    const settings = getPreviewSettings();
    const headings = extractHeadings(document.getText(), { levels: settings.tocLevels });
    const issues = await analyzeMarkdownHealth(document.getText(), {
      levels: settings.tocLevels,
      fileExists: async (target) => fileExistsNearDocument(document, target)
    });
    const contentHtml = renderMarkdown({
      document,
      webview,
      headings,
      settings
    });

    return buildPreviewHtml({
      webview,
      extensionUri: this.context.extensionUri,
      document,
      contentHtml,
      headings,
      issues,
      mode: "preview",
      settings
    });
  }

  private async handleMessage(
    document: vscode.TextDocument,
    message: { type?: string; line?: number; text?: string; href?: string; message?: string }
  ): Promise<void> {
    switch (message.type) {
      case "revealLine":
        if (typeof message.line === "number") {
          await revealDocumentLine(document.uri, message.line);
        }
        break;
      case "copyText":
        if (typeof message.text === "string") {
          await vscode.env.clipboard.writeText(message.text);
        }
        break;
      case "openLink":
        if (typeof message.href === "string") {
          await openMarkdownLink(document, message.href);
        }
        break;
      case "switchDisplayLanguage":
        await vscode.commands.executeCommand("superMarkdown.switchDisplayLanguage");
        break;
      case "previewError":
        if (message.message) {
          void vscode.window.showWarningMessage(t("message.previewError", message.message));
        }
        break;
      default:
        break;
    }
  }
}
