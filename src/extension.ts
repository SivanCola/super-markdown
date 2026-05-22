import * as path from "node:path";
import * as vscode from "vscode";
import { getExportSettings, getFormatSettings, getPreviewSettings, getSyntaxToolsSettings } from "./config";
import {
  DisplayLanguage,
  formatLocalizedIssuesMarkdown,
  getLanguageDisplayName,
  getRuntimeLanguage,
  getThemeDisplayName,
  getThemeQuickPickDetail,
  getThemeQuickPickLabel,
  t
} from "./i18n";
import { analyzeMarkdownHealth } from "./markdown/health";
import { exportMarkdownDocument, ExportCommandType } from "./export/exporter";
import { formatMarkdown } from "./markdown/format";
import { organizeMarkdown } from "./markdown/organize";
import { jsonToMarkdownTable, mdTableToJson } from "./markdown/tableTools";
import { upsertToc } from "./markdown/toc";
import { OrganizedDocumentProvider } from "./preview/OrganizedDocumentProvider";
import {
  fileExistsNearDocument,
  resolveMarkdownDocument,
} from "./preview/document";
import {
  MarkdownLibraryTreeProvider,
  SUPER_MARKDOWN_MARKDOWN_LIBRARY_VIEW_ID
} from "./sidebar/MarkdownLibraryTreeProvider";
import { MarkdownWorkspaceIndex } from "./sidebar/MarkdownWorkspaceIndex";
import { isMarkdownWorkspacePath } from "./sidebar/markdownWorkspace";
import {
  SUPER_MARKDOWN_WORKSPACE_SUMMARY_VIEW_ID,
  WorkspaceSummaryViewProvider
} from "./sidebar/WorkspaceSummaryViewProvider";
import { fullDocumentRange } from "./utils/vscode";
import {
  SUPER_MARKDOWN_EDITOR_VIEW_TYPE,
  SUPER_MARKDOWN_TOOLBAR_COMMAND,
  SuperMarkdownWysiwygEditorProvider
} from "./wysiwyg/SuperMarkdownWysiwygEditorProvider";
import { migratePreviewThemeConfiguration, normalizePreviewTheme, PREVIEW_THEMES } from "./themes";

export function activate(context: vscode.ExtensionContext): void {
  const displayLanguageChanged = new vscode.EventEmitter<void>();
  const organizedProvider = new OrganizedDocumentProvider();
  const organizeOutput = vscode.window.createOutputChannel("Super Markdown");
  const superMarkdownEditorProvider = new SuperMarkdownWysiwygEditorProvider(context);
  const markdownWorkspaceIndex = new MarkdownWorkspaceIndex();
  const markdownLibraryTreeProvider = new MarkdownLibraryTreeProvider(markdownWorkspaceIndex);
  const workspaceSummaryViewProvider = new WorkspaceSummaryViewProvider(markdownWorkspaceIndex);
  const markdownLibraryTreeView = vscode.window.createTreeView(SUPER_MARKDOWN_MARKDOWN_LIBRARY_VIEW_ID, {
    treeDataProvider: markdownLibraryTreeProvider,
    showCollapseAll: true
  });
  const updateMarkdownLibraryView = () => {
    markdownLibraryTreeView.title = markdownLibraryTreeProvider.getTitle();
    markdownLibraryTreeView.message = markdownLibraryTreeProvider.getEmptyMessage();
  };
  void migratePreviewThemeConfiguration();
  void updateDisplayLanguageContexts();
  updateMarkdownLibraryView();
  void markdownWorkspaceIndex.refresh().then(updateMarkdownLibraryView);

  context.subscriptions.push(
    displayLanguageChanged,
    organizedProvider,
    organizeOutput,
    markdownWorkspaceIndex,
    markdownLibraryTreeProvider,
    workspaceSummaryViewProvider,
    markdownLibraryTreeView,
    markdownWorkspaceIndex.onDidChange(updateMarkdownLibraryView),
    markdownLibraryTreeView.onDidChangeSelection((event) => {
      workspaceSummaryViewProvider.setSelectedMarkdownTreeNode(event.selection[0]);
    }),
    ...registerLocalizedCommandAliases(),
    vscode.languages.registerDocumentFormattingEditProvider("markdown", {
      provideDocumentFormattingEdits(document) {
        const result = formatMarkdown(document.getText(), getFormatSettings());
        if (result.text === document.getText()) {
          return [];
        }
        return [vscode.TextEdit.replace(fullDocumentRange(document), result.text)];
      }
    }),
    vscode.workspace.registerTextDocumentContentProvider("super-markdown-organized", organizedProvider),
    vscode.window.registerCustomEditorProvider(
      SUPER_MARKDOWN_EDITOR_VIEW_TYPE,
      superMarkdownEditorProvider,
      {
        webviewOptions: {
          retainContextWhenHidden: true
        }
      }
    ),
    vscode.window.registerWebviewViewProvider(SUPER_MARKDOWN_WORKSPACE_SUMMARY_VIEW_ID, workspaceSummaryViewProvider),
    vscode.commands.registerCommand("superMarkdown.openPreview", async (resource?: vscode.Uri) => {
      const document = await requireMarkdownDocument(resource);
      if (document) {
        await superMarkdownEditorProvider.openDocument(document, SUPER_MARKDOWN_EDITOR_VIEW_TYPE, {
          layout: "previewOnly"
        });
      }
    }),
    vscode.commands.registerCommand("superMarkdown.openEditor", async (resource?: vscode.Uri) => {
      const document = await requireMarkdownDocument(resource);
      if (document) {
        await superMarkdownEditorProvider.openDocument(document, SUPER_MARKDOWN_EDITOR_VIEW_TYPE, {
          layout: "editorOnly",
          mode: "source"
        });
      }
    }),
    vscode.commands.registerCommand("superMarkdown.openWysiwygEditor", async (resource?: vscode.Uri) => {
      const document = await requireMarkdownDocument(resource);
      if (document) {
        await superMarkdownEditorProvider.openDocument(document, SUPER_MARKDOWN_EDITOR_VIEW_TYPE, {
          layout: "editorOnly",
          mode: "wysiwyg"
        });
      }
    }),
    vscode.commands.registerCommand("superMarkdown.openNativeTextEditor", async (resource?: vscode.Uri) => {
      const document = await requireMarkdownDocument(resource);
      if (document) {
        await vscode.commands.executeCommand("vscode.openWith", document.uri, "default");
      }
    }),
    vscode.commands.registerCommand("superMarkdown.openSplitEditMode", async (resource?: vscode.Uri) => {
      const document = await requireMarkdownDocument(resource);
      if (document) {
        await superMarkdownEditorProvider.openDocument(document, SUPER_MARKDOWN_EDITOR_VIEW_TYPE, {
          layout: "splitEdit",
          mode: "source"
        });
      }
    }),
    vscode.commands.registerCommand(SUPER_MARKDOWN_TOOLBAR_COMMAND, async (payload?: unknown) => {
      await superMarkdownEditorProvider.handleToolbarCommand(payload);
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
      const document = await requireMarkdownDocument(resource);
      if (document) {
        await superMarkdownEditorProvider.openDocument(document, SUPER_MARKDOWN_EDITOR_VIEW_TYPE, {
          layout: "previewOnly"
        });
      }
    }),
    vscode.commands.registerCommand("superMarkdown.organizeMarkdown", async (resource?: vscode.Uri) => {
      await organizeActiveMarkdownDocument(organizedProvider, organizeOutput, resource);
    }),
    vscode.commands.registerCommand("superMarkdown.export.settings", async (resource?: vscode.Uri) => {
      await exportActiveMarkdown(context, "settings", resource);
    }),
    vscode.commands.registerCommand("superMarkdown.export.html", async (resource?: vscode.Uri) => {
      await exportActiveMarkdown(context, "html", resource);
    }),
    vscode.commands.registerCommand("superMarkdown.export.pdf", async (resource?: vscode.Uri) => {
      await exportActiveMarkdown(context, "pdf", resource);
    }),
    vscode.commands.registerCommand("superMarkdown.export.png", async (resource?: vscode.Uri) => {
      await exportActiveMarkdown(context, "png", resource);
    }),
    vscode.commands.registerCommand("superMarkdown.export.jpeg", async (resource?: vscode.Uri) => {
      await exportActiveMarkdown(context, "jpeg", resource);
    }),
    vscode.commands.registerCommand("superMarkdown.export.all", async (resource?: vscode.Uri) => {
      await exportActiveMarkdown(context, "all", resource);
    }),
    vscode.commands.registerCommand("superMarkdown.export.choose", async (resource?: vscode.Uri) => {
      await chooseExportFormat(context, resource);
    }),
    vscode.commands.registerCommand("superMarkdown.markdownLibrary.refresh", async () => {
      await markdownWorkspaceIndex.refresh();
    }),
    vscode.commands.registerCommand("superMarkdown.markdownLibrary.toggleProblemFilter", () => {
      markdownLibraryTreeProvider.toggleProblemFilter();
      updateMarkdownLibraryView();
    }),
    vscode.commands.registerCommand("superMarkdown.markdownLibrary.openEditor", async (node?: unknown) => {
      const uri = resolveMarkdownLibraryUri(node);
      if (uri) {
        await vscode.commands.executeCommand("superMarkdown.openEditor", uri);
      }
    }),
    vscode.commands.registerCommand("superMarkdown.markdownLibrary.openPreview", async (node?: unknown) => {
      const uri = resolveMarkdownLibraryUri(node);
      if (uri) {
        await vscode.commands.executeCommand("superMarkdown.openPreview", uri);
      }
    }),
    vscode.commands.registerCommand("superMarkdown.markdownLibrary.openSplitEditMode", async (node?: unknown) => {
      const uri = resolveMarkdownLibraryUri(node);
      if (uri) {
        await vscode.commands.executeCommand("superMarkdown.openSplitEditMode", uri);
      }
    }),
    vscode.commands.registerCommand("superMarkdown.markdownLibrary.openWysiwygEditor", async (node?: unknown) => {
      const uri = resolveMarkdownLibraryUri(node);
      if (uri) {
        await vscode.commands.executeCommand("superMarkdown.openWysiwygEditor", uri);
      }
    }),
    vscode.commands.registerCommand("superMarkdown.markdownLibrary.openNativeTextEditor", async (node?: unknown) => {
      const uri = resolveMarkdownLibraryUri(node);
      if (uri) {
        await vscode.commands.executeCommand("superMarkdown.openNativeTextEditor", uri);
      }
    }),
    vscode.commands.registerCommand("superMarkdown.markdownLibrary.organizeMarkdown", async (node?: unknown) => {
      const uri = resolveMarkdownLibraryUri(node);
      if (uri) {
        await vscode.commands.executeCommand("superMarkdown.organizeMarkdown", uri);
      }
    }),
    vscode.commands.registerCommand("superMarkdown.markdownLibrary.export", async (node?: unknown) => {
      const uri = resolveMarkdownLibraryUri(node);
      if (uri) {
        await chooseExportFormat(context, uri);
      }
    }),
    vscode.commands.registerCommand("superMarkdown.openSyntaxGuide", async () => {
      await openSyntaxGuide(context);
    }),
    vscode.commands.registerCommand("superMarkdown.copyTableAsJson", async () => {
      await copyTableAsJson();
    }),
    vscode.commands.registerCommand("superMarkdown.copyJsonAsTable", async () => {
      await copyJsonAsTable();
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("superMarkdown.displayLanguage")) {
        void updateDisplayLanguageContexts();
        displayLanguageChanged.fire();
        markdownLibraryTreeProvider.refresh();
        updateMarkdownLibraryView();
      }
      if (event.affectsConfiguration("superMarkdown.toc.levels")) {
        void markdownWorkspaceIndex.refresh();
      }
    }),
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      void markdownWorkspaceIndex.refresh();
    }),
    ...createMarkdownWorkspaceWatchers(markdownWorkspaceIndex),
    vscode.workspace.onWillSaveTextDocument((event) => {
      const settings = getPreviewSettings();
      if (!settings.updateTocOnSave || event.document.languageId !== "markdown") {
        return;
      }

      const result = upsertToc(event.document.getText(), settings.tocLevels);
      if (result.text !== event.document.getText()) {
        event.waitUntil(Promise.resolve([vscode.TextEdit.replace(fullDocumentRange(event.document), result.text)]));
      }
    }),
    vscode.workspace.onDidSaveTextDocument((document) => {
      void exportOnSave(context, document);
      if (document.uri.scheme === "file" && isMarkdownWorkspacePath(document.uri.fsPath)) {
        void markdownWorkspaceIndex.refreshFile(document.uri);
      }
    })
  );
}

export function deactivate(): void {
  // VS Code disposes registered subscriptions for this extension.
}

function createMarkdownWorkspaceWatchers(index: MarkdownWorkspaceIndex): vscode.Disposable[] {
  return [".md", ".markdown", ".mdown", ".mkdn"].map((extension) => {
    const watcher = vscode.workspace.createFileSystemWatcher(`**/*${extension}`);
    watcher.onDidCreate((uri) => {
      void index.refreshFile(uri);
    });
    watcher.onDidChange((uri) => {
      void index.refreshFile(uri);
    });
    watcher.onDidDelete((uri) => {
      index.removeFile(uri);
    });
    return watcher;
  });
}

function resolveMarkdownLibraryUri(node: unknown): vscode.Uri | undefined {
  if (node instanceof vscode.Uri) {
    return node;
  }

  if (typeof node !== "object" || node === null) {
    return undefined;
  }

  const maybeFile = "file" in node ? (node as { file?: { uriString?: unknown } }).file : undefined;
  if (maybeFile && typeof maybeFile.uriString === "string") {
    return vscode.Uri.parse(maybeFile.uriString);
  }

  const maybeResourceUri = "resourceUri" in node ? (node as { resourceUri?: unknown }).resourceUri : undefined;
  return maybeResourceUri instanceof vscode.Uri ? maybeResourceUri : undefined;
}

async function organizeActiveMarkdownDocument(
  provider: OrganizedDocumentProvider,
  output: vscode.OutputChannel,
  resource?: vscode.Uri
): Promise<void> {
  const document = await requireMarkdownDocument(resource);
  if (!document) {
    return;
  }

  const settings = getPreviewSettings();
  const result = organizeMarkdown(document.getText(), {
    levels: settings.tocLevels,
    numberHeadings: settings.numberHeadings,
    format: settings.format,
    updateToc: true
  });
  const issues = await analyzeMarkdownHealth(result.text, {
    levels: settings.tocLevels,
    fileExists: async (target) => fileExistsNearDocument(document, target)
  });
  output.clear();
  output.append(formatLocalizedIssuesMarkdown(issues, t("health.outputTitle", path.basename(document.fileName))));

  if (result.text === document.getText()) {
    if (issues.length > 0) {
      output.show(true);
    }
    const message = issues.length === 0
      ? `${t("message.noOrganizeChanges")} ${t("message.noHealthIssues")}`
      : t("message.organizeNoChangesWithIssues", issues.length, issues.length === 1 ? "" : "s");
    void vscode.window.showInformationMessage(message);
    return;
  }

  const previewUri = provider.setContent(document.uri, result.text);
  const issueCount = issues.filter((issue) => issue.code === "duplicate-anchor").length;
  const duplicateSuffix =
    issueCount > 0 ? t("message.duplicateAnchorWarnings", issueCount, issueCount === 1 ? "" : "s") : "";
  const applyAction = t("action.applyChanges");
  const viewDiffAction = t("action.viewDiff");
  const viewReportAction = t("action.viewReport");
  const cancelAction = t("action.cancel");
  const summary = t(
    "message.organizeSummary",
    result.edits.length,
    result.edits.length === 1 ? "" : "s",
    issues.length,
    issues.length === 1 ? "" : "s",
    duplicateSuffix
  );
  let diffShown = false;
  let shouldApply = false;

  while (!shouldApply) {
    const actions = [
      ...(diffShown ? [] : [viewDiffAction]),
      ...(issues.length > 0 ? [viewReportAction] : []),
      applyAction,
      cancelAction
    ];
    const choice = await vscode.window.showInformationMessage(summary, { modal: false }, ...actions);

    if (choice === viewDiffAction) {
      await vscode.commands.executeCommand(
        "vscode.diff",
        document.uri,
        previewUri,
        `Super Markdown Organize: ${path.basename(document.fileName)}`
      );
      diffShown = true;
      continue;
    }

    if (choice === viewReportAction) {
      output.show(true);
      continue;
    }

    if (choice !== applyAction) {
      return;
    }

    shouldApply = true;
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
  const current = normalizePreviewTheme(config.get<string>("preview.theme", "system"));
  const selected = await vscode.window.showQuickPick(
    PREVIEW_THEMES.map((theme) => ({
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
    ["superMarkdown.en.openEditor", "superMarkdown.openEditor"],
    ["superMarkdown.zhCN.openEditor", "superMarkdown.openEditor"],
    ["superMarkdown.en.openNativeTextEditor", "superMarkdown.openNativeTextEditor"],
    ["superMarkdown.zhCN.openNativeTextEditor", "superMarkdown.openNativeTextEditor"],
    ["superMarkdown.en.openWysiwygEditor", "superMarkdown.openWysiwygEditor"],
    ["superMarkdown.zhCN.openWysiwygEditor", "superMarkdown.openWysiwygEditor"],
    ["superMarkdown.en.openPreview", "superMarkdown.openPreview"],
    ["superMarkdown.zhCN.openPreview", "superMarkdown.openPreview"],
    ["superMarkdown.en.openSplitEditMode", "superMarkdown.openSplitEditMode"],
    ["superMarkdown.zhCN.openSplitEditMode", "superMarkdown.openSplitEditMode"],
    ["superMarkdown.en.switchDisplayLanguage", "superMarkdown.switchDisplayLanguage"],
    ["superMarkdown.zhCN.switchDisplayLanguage", "superMarkdown.switchDisplayLanguage"],
    ["superMarkdown.en.switchBackgroundTheme", "superMarkdown.switchBackgroundTheme"],
    ["superMarkdown.zhCN.switchBackgroundTheme", "superMarkdown.switchBackgroundTheme"],
    ["superMarkdown.en.refreshPreview", "superMarkdown.refreshPreview"],
    ["superMarkdown.zhCN.refreshPreview", "superMarkdown.refreshPreview"],
    ["superMarkdown.en.organizeMarkdown", "superMarkdown.organizeMarkdown"],
    ["superMarkdown.zhCN.organizeMarkdown", "superMarkdown.organizeMarkdown"],
    ["superMarkdown.en.export.settings", "superMarkdown.export.settings"],
    ["superMarkdown.zhCN.export.settings", "superMarkdown.export.settings"],
    ["superMarkdown.en.export.html", "superMarkdown.export.html"],
    ["superMarkdown.zhCN.export.html", "superMarkdown.export.html"],
    ["superMarkdown.en.export.pdf", "superMarkdown.export.pdf"],
    ["superMarkdown.zhCN.export.pdf", "superMarkdown.export.pdf"],
    ["superMarkdown.en.export.png", "superMarkdown.export.png"],
    ["superMarkdown.zhCN.export.png", "superMarkdown.export.png"],
    ["superMarkdown.en.export.jpeg", "superMarkdown.export.jpeg"],
    ["superMarkdown.zhCN.export.jpeg", "superMarkdown.export.jpeg"],
    ["superMarkdown.en.export.all", "superMarkdown.export.all"],
    ["superMarkdown.zhCN.export.all", "superMarkdown.export.all"],
    ["superMarkdown.en.openSyntaxGuide", "superMarkdown.openSyntaxGuide"],
    ["superMarkdown.zhCN.openSyntaxGuide", "superMarkdown.openSyntaxGuide"],
    ["superMarkdown.en.copyTableAsJson", "superMarkdown.copyTableAsJson"],
    ["superMarkdown.zhCN.copyTableAsJson", "superMarkdown.copyTableAsJson"],
    ["superMarkdown.en.copyJsonAsTable", "superMarkdown.copyJsonAsTable"],
    ["superMarkdown.zhCN.copyJsonAsTable", "superMarkdown.copyJsonAsTable"]
  ];

  return aliases.map(([alias, target]) =>
    vscode.commands.registerCommand(alias, (...args: unknown[]) => vscode.commands.executeCommand(target, ...args))
  );
}

async function exportActiveMarkdown(context: vscode.ExtensionContext, type: ExportCommandType, resource?: vscode.Uri): Promise<void> {
  const document = await requireMarkdownDocument(resource);
  if (!document) {
    return;
  }

  try {
    const outputs = await exportMarkdownDocument(context, document, type);
    if (outputs.length === 0) {
      void vscode.window.showInformationMessage(t("message.exportSkipped"));
      return;
    }
    void vscode.window.showInformationMessage(t("message.exportDone", outputs.join(", ")));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    void vscode.window.showErrorMessage(t("message.exportFailed", message));
  }
}

async function chooseExportFormat(context: vscode.ExtensionContext, resource?: vscode.Uri): Promise<void> {
  const items: Array<vscode.QuickPickItem & { type: ExportCommandType }> = [
    {
      label: t("export.settings.label"),
      detail: t("export.settings.detail"),
      type: "settings"
    },
    {
      label: t("export.pdf.label"),
      detail: t("export.pdf.detail"),
      type: "pdf"
    },
    {
      label: t("export.html.label"),
      detail: t("export.html.detail"),
      type: "html"
    },
    {
      label: t("export.png.label"),
      detail: t("export.png.detail"),
      type: "png"
    },
    {
      label: t("export.jpeg.label"),
      detail: t("export.jpeg.detail"),
      type: "jpeg"
    },
    {
      label: t("export.all.label"),
      detail: t("export.all.detail"),
      type: "all"
    }
  ];
  const selected = await vscode.window.showQuickPick(items, {
    title: t("export.quickPickTitle"),
    placeHolder: t("export.quickPickPlaceholder")
  });
  if (selected) {
    await exportActiveMarkdown(context, selected.type, resource);
  }
}

async function exportOnSave(context: vscode.ExtensionContext, document: vscode.TextDocument): Promise<void> {
  if (document.languageId !== "markdown") {
    return;
  }
  const settings = getExportSettings();
  if (!settings.convertOnSave) {
    return;
  }
  try {
    await exportMarkdownDocument(context, document, "settings");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    void vscode.window.showWarningMessage(t("message.exportFailed", message));
  }
}

async function openSyntaxGuide(context: vscode.ExtensionContext): Promise<void> {
  const language = getRuntimeLanguage();
  const filename = language === "zh-CN" ? "syntax_zh-cn.md" : "syntax_en.md";
  const uri = vscode.Uri.joinPath(context.extensionUri, "docs", "super-markdown", filename);
  const document = await vscode.workspace.openTextDocument(uri);
  await vscode.window.showTextDocument(document, vscode.ViewColumn.One);
  await vscode.commands.executeCommand("markdown.showPreviewToSide", uri);
}

async function copyTableAsJson(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    void vscode.window.showWarningMessage(t("message.noMarkdownRun"));
    return;
  }
  try {
    const json = mdTableToJson(editor.document.getText(editor.selection));
    await vscode.env.clipboard.writeText(JSON.stringify(json, null, 2));
    if (getSyntaxToolsSettings().showMessages) {
      void vscode.window.showInformationMessage(t("message.tableJsonCopied"));
    }
  } catch (error) {
    void vscode.window.showErrorMessage(t("message.tableJsonFailed"));
  }
}

async function copyJsonAsTable(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    void vscode.window.showWarningMessage(t("message.noMarkdownRun"));
    return;
  }
  try {
    const table = jsonToMarkdownTable(JSON.parse(editor.document.getText(editor.selection)));
    await vscode.env.clipboard.writeText(table);
    if (getSyntaxToolsSettings().showMessages) {
      void vscode.window.showInformationMessage(t("message.jsonTableCopied"));
    }
  } catch {
    void vscode.window.showErrorMessage(t("message.jsonTableFailed"));
  }
}

async function updateDisplayLanguageContexts(): Promise<void> {
  const isZhCN = getRuntimeLanguage() === "zh-CN";
  await vscode.commands.executeCommand("setContext", "superMarkdown.runtimeLanguageZhCN", isZhCN);
}

async function requireMarkdownDocument(resource?: vscode.Uri): Promise<vscode.TextDocument | undefined> {
  const document = await resolveMarkdownDocument(resource);
  if (!document) {
    void vscode.window.showWarningMessage(t("message.noMarkdownRun"));
  }
  return document;
}
