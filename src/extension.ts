import * as path from "node:path";
import * as vscode from "vscode";
import { getPreviewSettings } from "./config";
import {
  DisplayLanguage,
  formatLocalizedIssuesMarkdown,
  getLanguageDisplayName,
  getRuntimeLanguage,
  getThemeDisplayName,
  getThemeQuickPickDetail,
  getThemeQuickPickLabel,
  localizeIssue,
  t
} from "./i18n";
import { analyzeMarkdownHealth } from "./markdown/health";
import { organizeMarkdown } from "./markdown/organize";
import { upsertToc } from "./markdown/toc";
import { OrganizedDocumentProvider } from "./preview/OrganizedDocumentProvider";
import {
  PreviewManager,
  resolveMarkdownDocument,
  revealDocumentLine
} from "./preview/PreviewManager";
import {
  SUPER_MARKDOWN_PREVIEW_EDITOR_VIEW_TYPE,
  SuperMarkdownPreviewEditorProvider
} from "./preview/SuperMarkdownPreviewEditorProvider";
import { PreviewTheme } from "./types";

export function activate(context: vscode.ExtensionContext): void {
  const displayLanguageChanged = new vscode.EventEmitter<void>();
  const previewManager = new PreviewManager(context, displayLanguageChanged.event);
  const organizedProvider = new OrganizedDocumentProvider();
  const healthOutput = vscode.window.createOutputChannel("Super Markdown");
  void updateDisplayLanguageContexts();

  context.subscriptions.push(
    displayLanguageChanged,
    previewManager,
    organizedProvider,
    healthOutput,
    ...registerLocalizedCommandAliases(),
    vscode.workspace.registerTextDocumentContentProvider("super-markdown-organized", organizedProvider),
    vscode.window.registerCustomEditorProvider(
      SUPER_MARKDOWN_PREVIEW_EDITOR_VIEW_TYPE,
      new SuperMarkdownPreviewEditorProvider(context, displayLanguageChanged.event),
      {
        webviewOptions: {
          retainContextWhenHidden: false
        }
      }
    ),
    vscode.commands.registerCommand("superMarkdown.openPreview", async (resource?: vscode.Uri) => {
      const document = await requireMarkdownDocument(resource);
      if (document) {
        await previewManager.openPreview(document, vscode.ViewColumn.Active);
      }
    }),
    vscode.commands.registerCommand("superMarkdown.openSplitEditMode", async (resource?: vscode.Uri) => {
      const document = await requireMarkdownDocument(resource);
      if (document) {
        await previewManager.openSplitEditMode(document);
      }
    }),
    vscode.commands.registerCommand("superMarkdown.openWithPreviewEditor", async (resource?: vscode.Uri) => {
      const document = await requireMarkdownDocument(resource);
      if (document) {
        await vscode.commands.executeCommand("vscode.openWith", document.uri, SUPER_MARKDOWN_PREVIEW_EDITOR_VIEW_TYPE);
      }
    }),
    vscode.commands.registerCommand("superMarkdown.switchDisplayLanguage", async () => {
      const changed = await switchDisplayLanguage();
      if (changed) {
        await updateDisplayLanguageContexts();
        displayLanguageChanged.fire();
      }
      return changed;
    }),
    vscode.commands.registerCommand("superMarkdown.switchBackgroundTheme", async () => {
      await switchBackgroundTheme();
    }),
    vscode.commands.registerCommand("superMarkdown.refreshPreview", async (resource?: vscode.Uri) => {
      await previewManager.refreshActive(resource);
    }),
    vscode.commands.registerCommand("superMarkdown.organizeMarkdown", async () => {
      await organizeActiveMarkdownDocument(organizedProvider);
    }),
    vscode.commands.registerCommand("superMarkdown.showDocumentHealth", async () => {
      await showDocumentHealth(healthOutput);
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("superMarkdown.displayLanguage")) {
        void updateDisplayLanguageContexts();
        displayLanguageChanged.fire();
      }
    }),
    vscode.workspace.onWillSaveTextDocument((event) => {
      const settings = getPreviewSettings();
      if (!settings.updateTocOnSave || event.document.languageId !== "markdown") {
        return;
      }

      const result = upsertToc(event.document.getText(), settings.tocLevels);
      if (result.text !== event.document.getText()) {
        event.waitUntil(Promise.resolve([vscode.TextEdit.replace(fullDocumentRange(event.document), result.text)]));
      }
    })
  );
}

export function deactivate(): void {
  // VS Code disposes registered subscriptions for this extension.
}

async function organizeActiveMarkdownDocument(provider: OrganizedDocumentProvider): Promise<void> {
  const document = await requireMarkdownDocument();
  if (!document) {
    return;
  }

  const settings = getPreviewSettings();
  const result = organizeMarkdown(document.getText(), {
    levels: settings.tocLevels,
    numberHeadings: settings.numberHeadings,
    updateToc: true
  });

  if (result.text === document.getText()) {
    void vscode.window.showInformationMessage(t("message.noOrganizeChanges"));
    return;
  }

  const previewUri = provider.setContent(document.uri, result.text);
  await vscode.commands.executeCommand(
    "vscode.diff",
    document.uri,
    previewUri,
    `Super Markdown Organize: ${path.basename(document.fileName)}`
  );

  const issueCount = (await analyzeMarkdownHealth(result.text, { levels: settings.tocLevels })).filter(
    (issue) => issue.code === "duplicate-anchor"
  ).length;
  const duplicateSuffix =
    issueCount > 0 ? t("message.duplicateAnchorWarnings", issueCount, issueCount === 1 ? "" : "s") : "";
  const applyAction = t("action.applyChanges");
  const choice = await vscode.window.showInformationMessage(
    t("message.organizeApply", result.edits.length, result.edits.length === 1 ? "" : "s", duplicateSuffix),
    { modal: false },
    applyAction,
    t("action.cancel")
  );

  if (choice !== applyAction) {
    return;
  }

  const workspaceEdit = new vscode.WorkspaceEdit();
  workspaceEdit.replace(document.uri, fullDocumentRange(document), result.text);
  const applied = await vscode.workspace.applyEdit(workspaceEdit);
  if (!applied) {
    void vscode.window.showErrorMessage(t("message.applyFailed"));
    return;
  }
  await document.save();
}

async function switchDisplayLanguage(): Promise<boolean> {
  const config = vscode.workspace.getConfiguration("superMarkdown");
  const current = config.get<DisplayLanguage>("displayLanguage", "auto");
  const selected = await vscode.window.showQuickPick(
    [
      {
        label: t("language.auto.label"),
        description: current === "auto" ? t("language.current") : undefined,
        detail: t("language.auto.detail"),
        value: "auto" as DisplayLanguage
      },
      {
        label: t("language.zhCN.label"),
        description: current === "zh-CN" ? t("language.current") : undefined,
        detail: t("language.zhCN.detail"),
        value: "zh-CN" as DisplayLanguage
      },
      {
        label: t("language.en.label"),
        description: current === "en" ? t("language.current") : undefined,
        detail: t("language.en.detail"),
        value: "en" as DisplayLanguage
      }
    ],
    { title: t("command.switchDisplayLanguage.title") }
  );

  if (!selected) {
    return false;
  }

  if (selected.value === current) {
    return false;
  }

  const target =
    vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0
      ? vscode.ConfigurationTarget.Workspace
      : vscode.ConfigurationTarget.Global;
  await config.update("displayLanguage", selected.value, target);
  void vscode.window.showInformationMessage(t("language.changed", getLanguageDisplayName(selected.value)));
  return true;
}

async function switchBackgroundTheme(): Promise<boolean> {
  const config = vscode.workspace.getConfiguration("superMarkdown");
  const current = config.get<PreviewTheme>("preview.theme", "auto");
  const themes: PreviewTheme[] = [
    "auto",
    "light",
    "dark",
    "eye-care-green",
    "warm-paper",
    "ink-black",
    "coastal-blue",
    "high-contrast"
  ];
  const selected = await vscode.window.showQuickPick(
    themes.map((theme) => ({
      label: getThemeQuickPickLabel(theme),
      description: current === theme ? t("theme.current") : undefined,
      detail: getThemeQuickPickDetail(theme),
      value: theme
    })),
    { title: t("command.switchBackgroundTheme.title") }
  );

  if (!selected || selected.value === current) {
    return false;
  }

  const target =
    vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0
      ? vscode.ConfigurationTarget.Workspace
      : vscode.ConfigurationTarget.Global;
  await config.update("preview.theme", selected.value, target);
  void vscode.window.showInformationMessage(t("theme.changed", getThemeDisplayName(selected.value)));
  return true;
}

function registerLocalizedCommandAliases(): vscode.Disposable[] {
  const aliases: Array<[alias: string, target: string]> = [
    ["superMarkdown.en.openPreview", "superMarkdown.openPreview"],
    ["superMarkdown.zhCN.openPreview", "superMarkdown.openPreview"],
    ["superMarkdown.en.openSplitEditMode", "superMarkdown.openSplitEditMode"],
    ["superMarkdown.zhCN.openSplitEditMode", "superMarkdown.openSplitEditMode"],
    ["superMarkdown.en.openWithPreviewEditor", "superMarkdown.openWithPreviewEditor"],
    ["superMarkdown.zhCN.openWithPreviewEditor", "superMarkdown.openWithPreviewEditor"],
    ["superMarkdown.en.switchDisplayLanguage", "superMarkdown.switchDisplayLanguage"],
    ["superMarkdown.zhCN.switchDisplayLanguage", "superMarkdown.switchDisplayLanguage"],
    ["superMarkdown.en.switchBackgroundTheme", "superMarkdown.switchBackgroundTheme"],
    ["superMarkdown.zhCN.switchBackgroundTheme", "superMarkdown.switchBackgroundTheme"],
    ["superMarkdown.en.refreshPreview", "superMarkdown.refreshPreview"],
    ["superMarkdown.zhCN.refreshPreview", "superMarkdown.refreshPreview"],
    ["superMarkdown.en.organizeMarkdown", "superMarkdown.organizeMarkdown"],
    ["superMarkdown.zhCN.organizeMarkdown", "superMarkdown.organizeMarkdown"],
    ["superMarkdown.en.showDocumentHealth", "superMarkdown.showDocumentHealth"],
    ["superMarkdown.zhCN.showDocumentHealth", "superMarkdown.showDocumentHealth"]
  ];

  return aliases.map(([alias, target]) =>
    vscode.commands.registerCommand(alias, (...args: unknown[]) => vscode.commands.executeCommand(target, ...args))
  );
}

async function updateDisplayLanguageContexts(): Promise<void> {
  const isZhCN = getRuntimeLanguage() === "zh-CN";
  await vscode.commands.executeCommand("setContext", "superMarkdown.runtimeLanguageZhCN", isZhCN);
}

async function showDocumentHealth(output: vscode.OutputChannel): Promise<void> {
  const document = await requireMarkdownDocument();
  if (!document) {
    return;
  }

  const settings = getPreviewSettings();
  const issues = await analyzeMarkdownHealth(document.getText(), {
    levels: settings.tocLevels,
    fileExists: async (target) => fileExistsNearDocument(document, target)
  });

  output.clear();
  output.append(formatLocalizedIssuesMarkdown(issues, t("health.outputTitle", path.basename(document.fileName))));
  output.show(true);

  if (issues.length === 0) {
    void vscode.window.showInformationMessage(t("message.noHealthIssues"));
    return;
  }

  const selected = await vscode.window.showQuickPick(
    issues.map((issue) => ({
      label: `${iconForSeverity(issue.severity)} ${issue.code}`,
      description: issue.line === undefined ? undefined : t("health.issueLine", issue.line + 1),
      detail: localizeIssue(issue),
      issue
    })),
    {
      title: t("health.quickPickTitle"),
      placeHolder: t("health.issueCount", issues.length, issues.length === 1 ? "" : "s")
    }
  );

  if (selected?.issue.line !== undefined) {
    await revealDocumentLine(document.uri, selected.issue.line);
  }
}

async function requireMarkdownDocument(resource?: vscode.Uri): Promise<vscode.TextDocument | undefined> {
  const document = await resolveMarkdownDocument(resource);
  if (!document) {
    void vscode.window.showWarningMessage(t("message.noMarkdownRun"));
  }
  return document;
}

function fullDocumentRange(document: vscode.TextDocument): vscode.Range {
  const lastLine = Math.max(0, document.lineCount - 1);
  const lastCharacter = document.lineAt(lastLine).text.length;
  return new vscode.Range(0, 0, lastLine, lastCharacter);
}

function iconForSeverity(severity: string): string {
  if (severity === "error") {
    return "$(error)";
  }
  if (severity === "warning") {
    return "$(warning)";
  }
  return "$(info)";
}

async function fileExistsNearDocument(document: vscode.TextDocument, target: string): Promise<boolean> {
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
