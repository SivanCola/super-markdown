import * as path from "node:path";
import * as vscode from "vscode";
import { t } from "../i18n";

export function getActiveMarkdownDocument(): vscode.TextDocument | undefined {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== "markdown") {
    return undefined;
  }
  return editor.document;
}

export async function resolveMarkdownDocument(resource?: vscode.Uri): Promise<vscode.TextDocument | undefined> {
  if (resource) {
    const document = await tryOpenMarkdownDocument(resource);
    if (document) {
      return document;
    }
  }

  const active = getActiveMarkdownDocument();
  if (active) {
    return active;
  }

  const tabDocument = await getMarkdownDocumentFromActiveTab();
  if (tabDocument) {
    return tabDocument;
  }

  const visibleMarkdownEditors = vscode.window.visibleTextEditors.filter((editor) => isMarkdownDocument(editor.document));
  if (visibleMarkdownEditors.length === 1) {
    return visibleMarkdownEditors[0].document;
  }

  const openMarkdownDocuments = vscode.workspace.textDocuments.filter(isMarkdownDocument);
  if (openMarkdownDocuments.length === 1) {
    return openMarkdownDocuments[0];
  }

  return pickMarkdownDocument();
}

async function getMarkdownDocumentFromActiveTab(): Promise<vscode.TextDocument | undefined> {
  const tab = vscode.window.tabGroups.activeTabGroup.activeTab;
  const input = tab?.input;
  const candidateUris: vscode.Uri[] = [];

  if (input instanceof vscode.TabInputText || input instanceof vscode.TabInputCustom) {
    candidateUris.push(input.uri);
  } else if (input instanceof vscode.TabInputTextDiff) {
    candidateUris.push(input.modified, input.original);
  }

  for (const uri of candidateUris) {
    const document = await tryOpenMarkdownDocument(uri);
    if (document) {
      return document;
    }
  }

  return undefined;
}

async function pickMarkdownDocument(): Promise<vscode.TextDocument | undefined> {
  const files = await vscode.workspace.findFiles("**/*.{md,markdown,mdown,mkdn}", "**/{node_modules,out,media/vendor}/**", 100);
  if (files.length === 0) {
    void vscode.window.showWarningMessage(t("message.noMarkdownFiles"));
    return undefined;
  }

  const workspaceFolders = vscode.workspace.workspaceFolders ?? [];
  const selected = await vscode.window.showQuickPick(
    files.map((uri) => ({
      label: path.basename(uri.fsPath),
      description: workspaceFolders.length > 0 ? vscode.workspace.asRelativePath(uri, false) : uri.fsPath,
      uri
    })),
    { title: t("message.selectMarkdownFile") }
  );

  if (!selected) {
    return undefined;
  }

  return vscode.workspace.openTextDocument(selected.uri);
}

export async function tryOpenMarkdownDocument(uri: vscode.Uri): Promise<vscode.TextDocument | undefined> {
  if (!isMarkdownUri(uri)) {
    return undefined;
  }

  try {
    const document = await vscode.workspace.openTextDocument(uri);
    return isMarkdownDocument(document) ? document : undefined;
  } catch {
    return undefined;
  }
}

function isMarkdownDocument(document: vscode.TextDocument): boolean {
  return document.languageId === "markdown" || isMarkdownUri(document.uri);
}

function isMarkdownUri(uri: vscode.Uri): boolean {
  if (uri.scheme !== "file" && uri.scheme !== "untitled") {
    return false;
  }
  return [".md", ".markdown", ".mdown", ".mkdn"].includes(path.extname(uri.fsPath).toLowerCase());
}

export async function revealDocumentLine(uri: vscode.Uri, line: number): Promise<void> {
  const existingEditor = vscode.window.visibleTextEditors.find((editor) => editor.document.uri.toString() === uri.toString());
  const document = existingEditor?.document ?? (await vscode.workspace.openTextDocument(uri));
  const editor = await vscode.window.showTextDocument(document, {
    viewColumn: existingEditor?.viewColumn ?? vscode.ViewColumn.One,
    preview: false,
    preserveFocus: false
  });

  const safeLine = Math.max(0, Math.min(line, document.lineCount - 1));
  const range = new vscode.Range(safeLine, 0, safeLine, document.lineAt(safeLine).text.length);
  editor.selection = new vscode.Selection(range.start, range.end);
  editor.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
}

export async function fileExistsNearDocument(document: vscode.TextDocument, target: string): Promise<boolean> {
  if (document.uri.scheme !== "file") {
    return true;
  }

  try {
    const decoded = decodeURIComponent(target);
    const uri = path.isAbsolute(decoded)
      ? vscode.Uri.file(decoded)
      : vscode.Uri.file(path.resolve(path.dirname(document.uri.fsPath), decoded));
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
}
