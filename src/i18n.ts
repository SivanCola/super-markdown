import * as vscode from "vscode";
import { DocumentIssue, PreviewTheme } from "./types";

export type DisplayLanguage = "auto" | "zh-CN" | "en";
export type RuntimeLanguage = "zh-CN" | "en";

type TranslationKey =
  | "command.switchDisplayLanguage.title"
  | "command.switchBackgroundTheme.title"
  | "language.auto.label"
  | "language.auto.detail"
  | "language.zhCN.label"
  | "language.zhCN.detail"
  | "language.en.label"
  | "language.en.detail"
  | "language.current"
  | "language.changed"
  | "language.button.label"
  | "language.button.title"
  | "theme.system.label"
  | "theme.system.detail"
  | "theme.light.label"
  | "theme.light.detail"
  | "theme.dark.label"
  | "theme.dark.detail"
  | "theme.sage.label"
  | "theme.sage.detail"
  | "theme.paper.label"
  | "theme.paper.detail"
  | "theme.solarized.label"
  | "theme.solarized.detail"
  | "theme.rose.label"
  | "theme.rose.detail"
  | "theme.lavender.label"
  | "theme.lavender.detail"
  | "theme.graphite.label"
  | "theme.graphite.detail"
  | "theme.forest.label"
  | "theme.forest.detail"
  | "theme.terminal.label"
  | "theme.terminal.detail"
  | "theme.ink.label"
  | "theme.ink.detail"
  | "theme.ocean.label"
  | "theme.ocean.detail"
  | "theme.highContrast.label"
  | "theme.highContrast.detail"
  | "theme.current"
  | "theme.changed"
  | "mode.preview"
  | "mode.splitEdit"
  | "mode.wysiwyg"
  | "webview.navigation"
  | "webview.searchHeadings"
  | "webview.headings"
  | "webview.health"
  | "webview.markdownPreview"
  | "webview.noHeadings"
  | "webview.noIssues"
  | "webview.showOutline"
  | "webview.hideOutline"
  | "webview.resizeOutline"
  | "webview.resizeSplit"
  | "webview.revealCurrentHeading"
  | "webview.collapseOutline"
  | "webview.footnote"
  | "webview.copy"
  | "webview.copied"
  | "webview.copyCode"
  | "webview.codeTheme"
  | "webview.codeThemeAuto"
  | "webview.codeThemeLight"
  | "webview.codeThemeDark"
  | "webview.save"
  | "sidebar.imageStorage.title"
  | "sidebar.imageStorage.directory"
  | "sidebar.imageStorage.saving"
  | "sidebar.imageStorage.saved"
  | "sidebar.imageStorage.failed"
  | "sidebar.markdownLibrary.title"
  | "sidebar.markdownLibrary.noWorkspace"
  | "sidebar.markdownLibrary.noFiles"
  | "sidebar.markdownLibrary.open"
  | "sidebar.markdownLibrary.ok"
  | "sidebar.markdownLibrary.headings"
  | "sidebar.markdownLibrary.issues"
  | "sidebar.markdownLibrary.tasks"
  | "sidebar.markdownLibrary.images"
  | "sidebar.markdownLibrary.links"
  | "sidebar.markdownLibrary.moreIssues"
  | "sidebar.workspaceSummary.title"
  | "sidebar.workspaceSummary.files"
  | "sidebar.workspaceSummary.issues"
  | "sidebar.workspaceSummary.missingImages"
  | "sidebar.workspaceSummary.missingLinks"
  | "sidebar.workspaceSummary.tasks"
  | "sidebar.workspaceSummary.staleToc"
  | "sidebar.workspaceSummary.images"
  | "sidebar.workspaceSummary.links"
  | "sidebar.workspaceSummary.actions"
  | "sidebar.workspaceSummary.refresh"
  | "sidebar.workspaceSummary.syntaxGuide"
  | "sidebar.workspaceSummary.theme"
  | "sidebar.workspaceSummary.assets"
  | "sidebar.workspaceSummary.directory"
  | "sidebar.workspaceSummary.noWorkspace"
  | "sidebar.workspaceSummary.refreshing"
  | "sidebar.workspaceSummary.refreshed"
  | "sidebar.workspaceSummary.saving"
  | "sidebar.workspaceSummary.saved"
  | "sidebar.workspaceSummary.failed"
  | "webview.copyMarkdown"
  | "webview.copyHtml"
  | "export.quickPickTitle"
  | "export.quickPickPlaceholder"
  | "export.settings.label"
  | "export.settings.detail"
  | "export.pdf.label"
  | "export.pdf.detail"
  | "export.html.label"
  | "export.html.detail"
  | "export.png.label"
  | "export.png.detail"
  | "export.jpeg.label"
  | "export.jpeg.detail"
  | "export.all.label"
  | "export.all.detail"
  | "message.noMarkdownRefresh"
  | "message.noMarkdownRun"
  | "message.selectMarkdownFile"
  | "message.noMarkdownFiles"
  | "message.noOrganizeChanges"
  | "message.organizeNoChangesWithIssues"
  | "message.organizeSummary"
  | "message.duplicateAnchorWarnings"
  | "message.applyFailed"
  | "message.noHealthIssues"
  | "message.previewError"
  | "message.copiedMarkdown"
  | "message.copiedHtml"
  | "message.wysiwygError"
  | "message.fileBackedOnly"
  | "message.chromiumUnavailable"
  | "message.exportDone"
  | "message.exportFailed"
  | "message.exportSkipped"
  | "message.tableJsonCopied"
  | "message.tableJsonFailed"
  | "message.jsonTableCopied"
  | "message.jsonTableFailed"
  | "action.applyChanges"
  | "action.viewDiff"
  | "action.viewReport"
  | "action.cancel"
  | "health.outputTitle"
  | "health.quickPickTitle"
  | "health.issueCount"
  | "health.noIssues"
  | "health.missingH1"
  | "health.skippedHeadingLevel"
  | "health.duplicateAnchor"
  | "health.staleToc"
  | "health.uncheckedTasks"
  | "health.brokenImage"
  | "health.brokenLink"
  | "health.issueLine";

const EN: Record<TranslationKey, string> = {
  "command.switchDisplayLanguage.title": "Switch Display Language",
  "command.switchBackgroundTheme.title": "Switch Reading Theme",
  "language.auto.label": "$(sync) Follow VS Code",
  "language.auto.detail": "Use the current VS Code display language.",
  "language.zhCN.label": "简体中文",
  "language.zhCN.detail": "Use Simplified Chinese for Super Markdown UI.",
  "language.en.label": "English",
  "language.en.detail": "Use English for Super Markdown UI.",
  "language.current": "Current",
  "language.changed": "Super Markdown display language switched to {0}.",
  "language.button.label": "EN",
  "language.button.title": "Switch display language",
  "theme.system.label": "$(sync) System",
  "theme.system.detail": "Follow the current VS Code color theme.",
  "theme.light.label": "$(color-mode) Light",
  "theme.light.detail": "Use a neutral light reading theme.",
  "theme.dark.label": "$(color-mode) Dark",
  "theme.dark.detail": "Use a neutral dark reading theme.",
  "theme.sage.label": "$(eye) Sage",
  "theme.sage.detail": "Use a calm green reading theme.",
  "theme.paper.label": "$(book) Paper",
  "theme.paper.detail": "Use a warm paper reading theme.",
  "theme.solarized.label": "$(symbol-color) Solarized",
  "theme.solarized.detail": "Use a low-contrast amber and teal reading theme.",
  "theme.rose.label": "$(heart) Rose",
  "theme.rose.detail": "Use a soft blush editorial reading theme.",
  "theme.lavender.label": "$(symbol-color) Lavender",
  "theme.lavender.detail": "Use a cool lavender reading theme.",
  "theme.graphite.label": "$(circle-large-outline) Graphite",
  "theme.graphite.detail": "Use a quiet gray reading theme.",
  "theme.forest.label": "$(symbol-color) Forest",
  "theme.forest.detail": "Use a deep green night-reading theme.",
  "theme.terminal.label": "$(terminal) Terminal",
  "theme.terminal.detail": "Use a retro green-on-black reading theme.",
  "theme.ink.label": "$(circle-filled) Ink",
  "theme.ink.detail": "Use a soft black night-reading theme.",
  "theme.ocean.label": "$(symbol-color) Ocean",
  "theme.ocean.detail": "Use a crisp blue reading theme.",
  "theme.highContrast.label": "$(circle-large-filled) High Contrast",
  "theme.highContrast.detail": "Use maximum contrast for accessibility.",
  "theme.current": "Current",
  "theme.changed": "Super Markdown reading theme switched to {0}.",
  "mode.preview": "Preview Mode",
  "mode.splitEdit": "Split Edit Mode",
  "mode.wysiwyg": "WYSIWYG Mode",
  "webview.navigation": "Document navigation",
  "webview.searchHeadings": "Search outline",
  "webview.headings": "Outline",
  "webview.health": "Health",
  "webview.markdownPreview": "Markdown preview",
  "webview.noHeadings": "No headings",
  "webview.noIssues": "No issues",
  "webview.showOutline": "Show outline",
  "webview.hideOutline": "Hide outline",
  "webview.resizeOutline": "Resize outline",
  "webview.resizeSplit": "Resize editor and preview panes",
  "webview.revealCurrentHeading": "Reveal current heading",
  "webview.collapseOutline": "Collapse outline",
  "webview.footnote": "Footnote",
  "webview.copy": "Copy",
  "webview.copied": "Copied",
  "webview.copyCode": "Copy code",
  "webview.codeTheme": "Code colors",
  "webview.codeThemeAuto": "Auto",
  "webview.codeThemeLight": "Light",
  "webview.codeThemeDark": "Dark",
  "webview.save": "Save",
  "sidebar.imageStorage.title": "Image storage",
  "sidebar.imageStorage.directory": "Directory",
  "sidebar.imageStorage.saving": "Saving...",
  "sidebar.imageStorage.saved": "Saved",
  "sidebar.imageStorage.failed": "Save failed",
  "sidebar.markdownLibrary.title": "Document Library",
  "sidebar.markdownLibrary.noWorkspace": "Open a workspace folder to build the Markdown library.",
  "sidebar.markdownLibrary.noFiles": "No Markdown files found in this workspace.",
  "sidebar.markdownLibrary.open": "Open Markdown document",
  "sidebar.markdownLibrary.ok": "OK",
  "sidebar.markdownLibrary.headings": "{0} headings",
  "sidebar.markdownLibrary.issues": "{0} issues",
  "sidebar.markdownLibrary.tasks": "{0} tasks",
  "sidebar.markdownLibrary.images": "{0} images",
  "sidebar.markdownLibrary.links": "{0} links",
  "sidebar.markdownLibrary.moreIssues": "{0} more issues",
  "sidebar.workspaceSummary.title": "Workspace Summary",
  "sidebar.workspaceSummary.files": "Files",
  "sidebar.workspaceSummary.issues": "Issues",
  "sidebar.workspaceSummary.missingImages": "Missing images",
  "sidebar.workspaceSummary.missingLinks": "Missing links",
  "sidebar.workspaceSummary.tasks": "Tasks",
  "sidebar.workspaceSummary.staleToc": "Stale TOC",
  "sidebar.workspaceSummary.images": "Images",
  "sidebar.workspaceSummary.links": "Links",
  "sidebar.workspaceSummary.actions": "Actions",
  "sidebar.workspaceSummary.refresh": "Refresh index",
  "sidebar.workspaceSummary.syntaxGuide": "Syntax guide",
  "sidebar.workspaceSummary.theme": "Reading theme",
  "sidebar.workspaceSummary.assets": "Assets",
  "sidebar.workspaceSummary.directory": "Image directory",
  "sidebar.workspaceSummary.noWorkspace": "Open a workspace folder first.",
  "sidebar.workspaceSummary.refreshing": "Refreshing...",
  "sidebar.workspaceSummary.refreshed": "Markdown library refreshed.",
  "sidebar.workspaceSummary.saving": "Saving...",
  "sidebar.workspaceSummary.saved": "Saved",
  "sidebar.workspaceSummary.failed": "Save failed",
  "webview.copyMarkdown": "Copy Markdown",
  "webview.copyHtml": "Copy HTML",
  "export.quickPickTitle": "Super Markdown Export",
  "export.quickPickPlaceholder": "Choose an export target",
  "export.settings.label": "$(settings-gear) Use Settings",
  "export.settings.detail": "Export using superMarkdown.export.type.",
  "export.pdf.label": "$(file-pdf) PDF",
  "export.pdf.detail": "Render the current Markdown document to PDF.",
  "export.html.label": "$(file-code) HTML",
  "export.html.detail": "Render the current Markdown document to a standalone HTML file.",
  "export.png.label": "$(file-media) PNG",
  "export.png.detail": "Render the current Markdown document to a PNG image.",
  "export.jpeg.label": "$(file-media) JPEG",
  "export.jpeg.detail": "Render the current Markdown document to a JPEG image.",
  "export.all.label": "$(files) All Formats",
  "export.all.detail": "Export HTML, PDF, PNG, and JPEG.",
  "message.noMarkdownRefresh": "Open a Markdown file before refreshing Super Markdown preview.",
  "message.noMarkdownRun": "Open a Markdown file before running Super Markdown.",
  "message.selectMarkdownFile": "Select a Markdown file",
  "message.noMarkdownFiles": "No Markdown files were found in this workspace.",
  "message.noOrganizeChanges": "Super Markdown found no organize changes.",
  "message.organizeNoChangesWithIssues": "Super Markdown found no organize changes. {0} health issue{1} found; see the report.",
  "message.organizeSummary": "Super Markdown found {0} organize change{1} and {2} health issue{3}.{4}",
  "message.duplicateAnchorWarnings": " {0} duplicate anchor warning{1}.",
  "message.applyFailed": "Super Markdown could not apply organize changes.",
  "message.noHealthIssues": "Super Markdown found no document health issues.",
  "message.previewError": "Super Markdown preview: {0}",
  "message.copiedMarkdown": "Markdown copied.",
  "message.copiedHtml": "HTML copied.",
  "message.wysiwygError": "Super Markdown WYSIWYG editor: {0}",
  "message.fileBackedOnly": "Image uploads require a file-backed Markdown document.",
  "message.chromiumUnavailable": "No usable Chrome or Chromium executable is available.",
  "message.exportDone": "Super Markdown exported: {0}",
  "message.exportFailed": "Super Markdown export failed: {0}",
  "message.exportSkipped": "Super Markdown export skipped this document.",
  "message.tableJsonCopied": "Markdown table JSON copied.",
  "message.tableJsonFailed": "Select a valid Markdown table before converting it to JSON.",
  "message.jsonTableCopied": "Markdown table copied.",
  "message.jsonTableFailed": "Select a valid JSON array before converting it to a Markdown table.",
  "action.applyChanges": "Apply Changes",
  "action.viewDiff": "View Diff",
  "action.viewReport": "View Report",
  "action.cancel": "Cancel",
  "health.outputTitle": "Super Markdown Health: {0}",
  "health.quickPickTitle": "Super Markdown Document Health",
  "health.issueCount": "{0} issue{1}",
  "health.noIssues": "No document health issues found.",
  "health.missingH1": "Document has no H1 heading.",
  "health.skippedHeadingLevel": "Heading level skips a parent level.",
  "health.duplicateAnchor": "Duplicate heading anchor base \"{0}\" appears more than once.",
  "health.staleToc": "Table of contents is out of date.",
  "health.uncheckedTasks": "{0} unchecked task{1} found.",
  "health.brokenImage": "Image target not found: {0}",
  "health.brokenLink": "Link target not found: {0}",
  "health.issueLine": "line {0}"
};

const ZH_CN: Record<TranslationKey, string> = {
  "command.switchDisplayLanguage.title": "切换界面语言",
  "command.switchBackgroundTheme.title": "切换阅读主题",
  "language.auto.label": "$(sync) 跟随 VS Code",
  "language.auto.detail": "使用当前 VS Code 显示语言。",
  "language.zhCN.label": "简体中文",
  "language.zhCN.detail": "Super Markdown 界面使用简体中文。",
  "language.en.label": "English",
  "language.en.detail": "Super Markdown 界面使用英文。",
  "language.current": "当前",
  "language.changed": "Super Markdown 界面语言已切换为{0}。",
  "language.button.label": "中",
  "language.button.title": "切换界面语言",
  "theme.system.label": "$(sync) 系统",
  "theme.system.detail": "跟随当前 VS Code 配色主题。",
  "theme.light.label": "$(color-mode) 浅色",
  "theme.light.detail": "使用中性的浅色阅读主题。",
  "theme.dark.label": "$(color-mode) 深色",
  "theme.dark.detail": "使用中性的深色阅读主题。",
  "theme.sage.label": "$(eye) 柔绿",
  "theme.sage.detail": "使用低饱和绿色阅读主题。",
  "theme.paper.label": "$(book) 纸页",
  "theme.paper.detail": "使用接近纸张的暖色阅读主题。",
  "theme.solarized.label": "$(symbol-color) 日光",
  "theme.solarized.detail": "使用低对比的琥珀和青色阅读主题。",
  "theme.rose.label": "$(heart) 玫瑰",
  "theme.rose.detail": "使用柔和粉调的编辑式阅读主题。",
  "theme.lavender.label": "$(symbol-color) 薰衣草",
  "theme.lavender.detail": "使用清冷淡紫阅读主题。",
  "theme.graphite.label": "$(circle-large-outline) 石墨",
  "theme.graphite.detail": "使用安静的灰调阅读主题。",
  "theme.forest.label": "$(symbol-color) 深林",
  "theme.forest.detail": "使用深绿色夜读主题。",
  "theme.terminal.label": "$(terminal) 终端",
  "theme.terminal.detail": "使用复古黑底绿字阅读主题。",
  "theme.ink.label": "$(circle-filled) 墨黑",
  "theme.ink.detail": "使用柔和黑色夜读主题。",
  "theme.ocean.label": "$(symbol-color) 海蓝",
  "theme.ocean.detail": "使用清爽的蓝色阅读主题。",
  "theme.highContrast.label": "$(circle-large-filled) 高对比",
  "theme.highContrast.detail": "使用最高对比度，提升可访问性。",
  "theme.current": "当前",
  "theme.changed": "Super Markdown 阅读主题已切换为{0}。",
  "mode.preview": "预览模式",
  "mode.splitEdit": "分屏编辑模式",
  "mode.wysiwyg": "所见即所得模式",
  "webview.navigation": "文档导航",
  "webview.searchHeadings": "搜索目录",
  "webview.headings": "目录",
  "webview.health": "健康检查",
  "webview.markdownPreview": "Markdown 预览",
  "webview.noHeadings": "没有标题",
  "webview.noIssues": "没有问题",
  "webview.showOutline": "显示大纲",
  "webview.hideOutline": "隐藏大纲",
  "webview.resizeOutline": "调整大纲高度",
  "webview.resizeSplit": "调整编辑区和预览区宽度",
  "webview.revealCurrentHeading": "定位当前标题",
  "webview.collapseOutline": "收起目录",
  "webview.footnote": "脚注",
  "webview.copy": "复制",
  "webview.copied": "已复制",
  "webview.copyCode": "复制代码",
  "webview.codeTheme": "代码配色",
  "webview.codeThemeAuto": "自动",
  "webview.codeThemeLight": "浅色",
  "webview.codeThemeDark": "深色",
  "webview.save": "保存",
  "sidebar.imageStorage.title": "图片保存",
  "sidebar.imageStorage.directory": "保存目录",
  "sidebar.imageStorage.saving": "保存中...",
  "sidebar.imageStorage.saved": "已保存",
  "sidebar.imageStorage.failed": "保存失败",
  "sidebar.markdownLibrary.title": "文档库",
  "sidebar.markdownLibrary.noWorkspace": "打开工作区文件夹后即可建立 Markdown 文档库。",
  "sidebar.markdownLibrary.noFiles": "当前工作区没有找到 Markdown 文件。",
  "sidebar.markdownLibrary.open": "打开 Markdown 文档",
  "sidebar.markdownLibrary.ok": "正常",
  "sidebar.markdownLibrary.headings": "{0} 个标题",
  "sidebar.markdownLibrary.issues": "{0} 个问题",
  "sidebar.markdownLibrary.tasks": "{0} 个任务",
  "sidebar.markdownLibrary.images": "{0} 张图片",
  "sidebar.markdownLibrary.links": "{0} 个链接",
  "sidebar.markdownLibrary.moreIssues": "还有 {0} 个问题",
  "sidebar.workspaceSummary.title": "工作区摘要",
  "sidebar.workspaceSummary.files": "文件",
  "sidebar.workspaceSummary.issues": "问题",
  "sidebar.workspaceSummary.missingImages": "缺失图片",
  "sidebar.workspaceSummary.missingLinks": "缺失链接",
  "sidebar.workspaceSummary.tasks": "未完成任务",
  "sidebar.workspaceSummary.staleToc": "过期目录",
  "sidebar.workspaceSummary.images": "图片",
  "sidebar.workspaceSummary.links": "链接",
  "sidebar.workspaceSummary.actions": "操作",
  "sidebar.workspaceSummary.refresh": "刷新索引",
  "sidebar.workspaceSummary.syntaxGuide": "语法速查",
  "sidebar.workspaceSummary.theme": "阅读主题",
  "sidebar.workspaceSummary.assets": "资源",
  "sidebar.workspaceSummary.directory": "图片目录",
  "sidebar.workspaceSummary.noWorkspace": "请先打开一个工作区文件夹。",
  "sidebar.workspaceSummary.refreshing": "刷新中...",
  "sidebar.workspaceSummary.refreshed": "Markdown 文档库已刷新。",
  "sidebar.workspaceSummary.saving": "保存中...",
  "sidebar.workspaceSummary.saved": "已保存",
  "sidebar.workspaceSummary.failed": "保存失败",
  "webview.copyMarkdown": "复制 Markdown",
  "webview.copyHtml": "复制 HTML",
  "export.quickPickTitle": "Super Markdown 导出",
  "export.quickPickPlaceholder": "选择导出目标",
  "export.settings.label": "$(settings-gear) 按设置导出",
  "export.settings.detail": "使用 superMarkdown.export.type 配置导出。",
  "export.pdf.label": "$(file-pdf) PDF",
  "export.pdf.detail": "将当前 Markdown 文档渲染为 PDF。",
  "export.html.label": "$(file-code) HTML",
  "export.html.detail": "将当前 Markdown 文档渲染为独立 HTML 文件。",
  "export.png.label": "$(file-media) PNG",
  "export.png.detail": "将当前 Markdown 文档渲染为 PNG 图片。",
  "export.jpeg.label": "$(file-media) JPEG",
  "export.jpeg.detail": "将当前 Markdown 文档渲染为 JPEG 图片。",
  "export.all.label": "$(files) 全部格式",
  "export.all.detail": "导出 HTML、PDF、PNG 和 JPEG。",
  "message.noMarkdownRefresh": "请先打开一个 Markdown 文件，再刷新 Super Markdown 预览。",
  "message.noMarkdownRun": "请先打开一个 Markdown 文件，再运行 Super Markdown。",
  "message.selectMarkdownFile": "选择 Markdown 文件",
  "message.noMarkdownFiles": "当前工作区没有找到 Markdown 文件。",
  "message.noOrganizeChanges": "Super Markdown 没有发现需要整理的内容。",
  "message.organizeNoChangesWithIssues": "Super Markdown 没有发现需要整理的内容。发现 {0} 个健康问题，请查看报告。",
  "message.organizeSummary": "Super Markdown 发现 {0} 项整理修改和 {2} 个健康问题。{4}",
  "message.duplicateAnchorWarnings": " 有 {0} 个重复锚点警告。",
  "message.applyFailed": "Super Markdown 无法应用整理修改。",
  "message.noHealthIssues": "Super Markdown 没有发现文档健康问题。",
  "message.previewError": "Super Markdown 预览：{0}",
  "message.copiedMarkdown": "已复制 Markdown。",
  "message.copiedHtml": "已复制 HTML。",
  "message.wysiwygError": "Super Markdown 所见即所得编辑器：{0}",
  "message.fileBackedOnly": "上传图片需要基于文件的 Markdown 文档。",
  "message.chromiumUnavailable": "没有可用的 Chrome 或 Chromium 可执行文件。",
  "message.exportDone": "Super Markdown 已导出：{0}",
  "message.exportFailed": "Super Markdown 导出失败：{0}",
  "message.exportSkipped": "Super Markdown 已跳过当前文档导出。",
  "message.tableJsonCopied": "已复制 Markdown 表格 JSON。",
  "message.tableJsonFailed": "请先选中有效的 Markdown 表格，再转换为 JSON。",
  "message.jsonTableCopied": "已复制 Markdown 表格。",
  "message.jsonTableFailed": "请先选中有效的 JSON 数组，再转换为 Markdown 表格。",
  "action.applyChanges": "应用修改",
  "action.viewDiff": "查看差异",
  "action.viewReport": "查看报告",
  "action.cancel": "取消",
  "health.outputTitle": "Super Markdown 健康检查：{0}",
  "health.quickPickTitle": "Super Markdown 文档健康检查",
  "health.issueCount": "{0} 个问题",
  "health.noIssues": "没有发现文档健康问题。",
  "health.missingH1": "文档缺少 H1 标题。",
  "health.skippedHeadingLevel": "标题级别跳过了父级标题。",
  "health.duplicateAnchor": "标题锚点基础值“{0}”重复出现。",
  "health.staleToc": "目录已过期。",
  "health.uncheckedTasks": "发现 {0} 个未完成任务。",
  "health.brokenImage": "图片目标不存在：{0}",
  "health.brokenLink": "链接目标不存在：{0}",
  "health.issueLine": "第 {0} 行"
};

const TRANSLATIONS: Record<RuntimeLanguage, Record<TranslationKey, string>> = {
  en: EN,
  "zh-CN": ZH_CN
};

export function getConfiguredDisplayLanguage(): DisplayLanguage {
  const value = vscode.workspace.getConfiguration("superMarkdown").get<DisplayLanguage>("displayLanguage", "auto");
  return value === "zh-CN" || value === "en" ? value : "auto";
}

export function getRuntimeLanguage(setting: DisplayLanguage = getConfiguredDisplayLanguage()): RuntimeLanguage {
  if (setting === "zh-CN" || setting === "en") {
    return setting;
  }
  return vscode.env.language.toLowerCase().startsWith("zh") ? "zh-CN" : "en";
}

export function t(key: TranslationKey, ...args: Array<string | number>): string {
  const language = getRuntimeLanguage();
  const template = TRANSLATIONS[language][key] ?? EN[key] ?? key;
  return format(template, args);
}

export function getLanguageButtonLabel(): string {
  return t("language.button.label");
}

export function getLanguageDisplayName(language: DisplayLanguage): string {
  if (language === "auto") {
    return getRuntimeLanguage("auto") === "zh-CN" ? "跟随 VS Code" : "Follow VS Code";
  }
  return language === "zh-CN" ? "简体中文" : "English";
}

export function getThemeDisplayName(theme: PreviewTheme): string {
  const language = getRuntimeLanguage();
  const names: Record<PreviewTheme, { en: string; "zh-CN": string }> = {
    system: { en: "System", "zh-CN": "系统" },
    light: { en: "Light", "zh-CN": "浅色" },
    dark: { en: "Dark", "zh-CN": "深色" },
    sage: { en: "Sage", "zh-CN": "柔绿" },
    paper: { en: "Paper", "zh-CN": "纸页" },
    solarized: { en: "Solarized", "zh-CN": "日光" },
    rose: { en: "Rose", "zh-CN": "玫瑰" },
    lavender: { en: "Lavender", "zh-CN": "薰衣草" },
    graphite: { en: "Graphite", "zh-CN": "石墨" },
    forest: { en: "Forest", "zh-CN": "深林" },
    terminal: { en: "Terminal", "zh-CN": "终端" },
    ink: { en: "Ink", "zh-CN": "墨黑" },
    ocean: { en: "Ocean", "zh-CN": "海蓝" },
    "high-contrast": { en: "High Contrast", "zh-CN": "高对比" }
  };
  return names[theme][language];
}

export function getThemeQuickPickLabel(theme: PreviewTheme): string {
  switch (theme) {
    case "system":
      return t("theme.system.label");
    case "light":
      return t("theme.light.label");
    case "dark":
      return t("theme.dark.label");
    case "sage":
      return t("theme.sage.label");
    case "paper":
      return t("theme.paper.label");
    case "solarized":
      return t("theme.solarized.label");
    case "rose":
      return t("theme.rose.label");
    case "lavender":
      return t("theme.lavender.label");
    case "graphite":
      return t("theme.graphite.label");
    case "forest":
      return t("theme.forest.label");
    case "terminal":
      return t("theme.terminal.label");
    case "ink":
      return t("theme.ink.label");
    case "ocean":
      return t("theme.ocean.label");
    case "high-contrast":
      return t("theme.highContrast.label");
  }
}

export function getThemeQuickPickDetail(theme: PreviewTheme): string {
  switch (theme) {
    case "system":
      return t("theme.system.detail");
    case "light":
      return t("theme.light.detail");
    case "dark":
      return t("theme.dark.detail");
    case "sage":
      return t("theme.sage.detail");
    case "paper":
      return t("theme.paper.detail");
    case "solarized":
      return t("theme.solarized.detail");
    case "rose":
      return t("theme.rose.detail");
    case "lavender":
      return t("theme.lavender.detail");
    case "graphite":
      return t("theme.graphite.detail");
    case "forest":
      return t("theme.forest.detail");
    case "terminal":
      return t("theme.terminal.detail");
    case "ink":
      return t("theme.ink.detail");
    case "ocean":
      return t("theme.ocean.detail");
    case "high-contrast":
      return t("theme.highContrast.detail");
  }
}

export function getWebviewTranslations(): Record<string, string> {
  return {
    copy: t("webview.copy"),
    copied: t("webview.copied"),
    copyCode: t("webview.copyCode"),
    codeTheme: t("webview.codeTheme"),
    codeThemeAuto: t("webview.codeThemeAuto"),
    codeThemeLight: t("webview.codeThemeLight"),
    codeThemeDark: t("webview.codeThemeDark"),
    showOutline: t("webview.showOutline"),
    hideOutline: t("webview.hideOutline"),
    resizeOutline: t("webview.resizeOutline"),
    revealCurrentHeading: t("webview.revealCurrentHeading"),
    collapseOutline: t("webview.collapseOutline")
  };
}

export function localizeIssue(issue: DocumentIssue): string {
  switch (issue.code) {
    case "missing-h1":
      return t("health.missingH1");
    case "skipped-heading-level":
      return t("health.skippedHeadingLevel");
    case "duplicate-anchor":
      return t("health.duplicateAnchor", issue.target ?? "");
    case "stale-toc":
      return t("health.staleToc");
    case "unchecked-tasks": {
      const count = issue.message.match(/\d+/)?.[0] ?? "0";
      return t("health.uncheckedTasks", count, count === "1" ? "" : "s");
    }
    case "broken-image":
      return t("health.brokenImage", issue.target ?? "");
    case "broken-link":
      return t("health.brokenLink", issue.target ?? "");
    default:
      return issue.message;
  }
}

export function formatLocalizedIssuesMarkdown(issues: DocumentIssue[], title: string): string {
  if (issues.length === 0) {
    return `# ${title}\n\n${t("health.noIssues")}\n`;
  }

  const lines = [`# ${title}`, ""];
  for (const issue of issues) {
    const lineLabel = issue.line === undefined ? "" : ` ${t("health.issueLine", issue.line + 1)}`;
    lines.push(`- **${issue.severity.toUpperCase()}** ${issue.code}${lineLabel}: ${localizeIssue(issue)}`);
  }
  lines.push("");
  return lines.join("\n");
}

function format(template: string, args: Array<string | number>): string {
  return template.replace(/\{(\d+)\}/g, (match, index) => {
    const value = args[Number(index)];
    return value === undefined ? match : String(value);
  });
}
