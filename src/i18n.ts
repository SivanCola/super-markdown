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
  | "theme.auto.label"
  | "theme.auto.detail"
  | "theme.light.label"
  | "theme.light.detail"
  | "theme.dark.label"
  | "theme.dark.detail"
  | "theme.eyeCareGreen.label"
  | "theme.eyeCareGreen.detail"
  | "theme.warmPaper.label"
  | "theme.warmPaper.detail"
  | "theme.inkBlack.label"
  | "theme.inkBlack.detail"
  | "theme.coastalBlue.label"
  | "theme.coastalBlue.detail"
  | "theme.highContrast.label"
  | "theme.highContrast.detail"
  | "theme.current"
  | "theme.changed"
  | "mode.preview"
  | "mode.splitEdit"
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
  | "webview.copy"
  | "webview.copied"
  | "webview.copyCode"
  | "message.noMarkdownRefresh"
  | "message.noMarkdownRun"
  | "message.selectMarkdownFile"
  | "message.noMarkdownFiles"
  | "message.noOrganizeChanges"
  | "message.organizeApply"
  | "message.duplicateAnchorWarnings"
  | "message.applyFailed"
  | "message.noHealthIssues"
  | "message.previewError"
  | "action.applyChanges"
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
  "command.switchBackgroundTheme.title": "Switch Background Theme",
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
  "theme.auto.label": "$(sync) Follow VS Code",
  "theme.auto.detail": "Use the current VS Code color theme.",
  "theme.light.label": "$(color-mode) Light",
  "theme.light.detail": "Use a light preview background.",
  "theme.dark.label": "$(color-mode) Dark",
  "theme.dark.detail": "Use a dark preview background.",
  "theme.eyeCareGreen.label": "$(eye) Eye-Care Green",
  "theme.eyeCareGreen.detail": "Use a low-saturation green background for long reading.",
  "theme.warmPaper.label": "$(book) Warm Paper",
  "theme.warmPaper.detail": "Use a warm paper-like reading background.",
  "theme.inkBlack.label": "$(circle-filled) Ink Black",
  "theme.inkBlack.detail": "Use a soft black night-reading background.",
  "theme.coastalBlue.label": "$(symbol-color) Coastal Blue",
  "theme.coastalBlue.detail": "Use a clean blue-tinted reading background.",
  "theme.highContrast.label": "$(circle-large-filled) High Contrast",
  "theme.highContrast.detail": "Use maximum contrast for accessibility.",
  "theme.current": "Current",
  "theme.changed": "Super Markdown background theme switched to {0}.",
  "mode.preview": "Preview Mode",
  "mode.splitEdit": "Split Edit Mode",
  "webview.navigation": "Document navigation",
  "webview.searchHeadings": "Search headings",
  "webview.headings": "Headings",
  "webview.health": "Health",
  "webview.markdownPreview": "Markdown preview",
  "webview.noHeadings": "No headings",
  "webview.noIssues": "No issues",
  "webview.showOutline": "Show outline",
  "webview.hideOutline": "Hide outline",
  "webview.resizeOutline": "Resize outline",
  "webview.copy": "Copy",
  "webview.copied": "Copied",
  "webview.copyCode": "Copy code",
  "message.noMarkdownRefresh": "Open a Markdown file before refreshing Super Markdown preview.",
  "message.noMarkdownRun": "Open a Markdown file before running Super Markdown.",
  "message.selectMarkdownFile": "Select a Markdown file",
  "message.noMarkdownFiles": "No Markdown files were found in this workspace.",
  "message.noOrganizeChanges": "Super Markdown found no organize changes.",
  "message.organizeApply": "Apply {0} Super Markdown change{1}?{2}",
  "message.duplicateAnchorWarnings": " {0} duplicate anchor warning{1}.",
  "message.applyFailed": "Super Markdown could not apply organize changes.",
  "message.noHealthIssues": "Super Markdown found no document health issues.",
  "message.previewError": "Super Markdown preview: {0}",
  "action.applyChanges": "Apply Changes",
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
  "command.switchBackgroundTheme.title": "切换背景主题",
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
  "theme.auto.label": "$(sync) 跟随 VS Code",
  "theme.auto.detail": "使用当前 VS Code 配色主题。",
  "theme.light.label": "$(color-mode) 浅色",
  "theme.light.detail": "使用浅色预览背景。",
  "theme.dark.label": "$(color-mode) 深色",
  "theme.dark.detail": "使用深色预览背景。",
  "theme.eyeCareGreen.label": "$(eye) 护眼绿",
  "theme.eyeCareGreen.detail": "使用低饱和绿色背景，适合长时间阅读。",
  "theme.warmPaper.label": "$(book) 暖纸色",
  "theme.warmPaper.detail": "使用接近纸张的暖色阅读背景。",
  "theme.inkBlack.label": "$(circle-filled) 墨水黑",
  "theme.inkBlack.detail": "使用柔和黑色背景，适合夜间阅读。",
  "theme.coastalBlue.label": "$(symbol-color) 海岸蓝",
  "theme.coastalBlue.detail": "使用清爽的蓝色调阅读背景。",
  "theme.highContrast.label": "$(circle-large-filled) 高对比",
  "theme.highContrast.detail": "使用最高对比度，提升可访问性。",
  "theme.current": "当前",
  "theme.changed": "Super Markdown 背景主题已切换为{0}。",
  "mode.preview": "预览模式",
  "mode.splitEdit": "分屏编辑模式",
  "webview.navigation": "文档导航",
  "webview.searchHeadings": "搜索标题",
  "webview.headings": "标题",
  "webview.health": "健康检查",
  "webview.markdownPreview": "Markdown 预览",
  "webview.noHeadings": "没有标题",
  "webview.noIssues": "没有问题",
  "webview.showOutline": "显示大纲",
  "webview.hideOutline": "隐藏大纲",
  "webview.resizeOutline": "调整大纲高度",
  "webview.copy": "复制",
  "webview.copied": "已复制",
  "webview.copyCode": "复制代码",
  "message.noMarkdownRefresh": "请先打开一个 Markdown 文件，再刷新 Super Markdown 预览。",
  "message.noMarkdownRun": "请先打开一个 Markdown 文件，再运行 Super Markdown。",
  "message.selectMarkdownFile": "选择 Markdown 文件",
  "message.noMarkdownFiles": "当前工作区没有找到 Markdown 文件。",
  "message.noOrganizeChanges": "Super Markdown 没有发现需要整理的内容。",
  "message.organizeApply": "是否应用 {0} 项 Super Markdown 修改？{2}",
  "message.duplicateAnchorWarnings": " 有 {0} 个重复锚点警告。",
  "message.applyFailed": "Super Markdown 无法应用整理修改。",
  "message.noHealthIssues": "Super Markdown 没有发现文档健康问题。",
  "message.previewError": "Super Markdown 预览：{0}",
  "action.applyChanges": "应用修改",
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
    auto: { en: "Follow VS Code", "zh-CN": "跟随 VS Code" },
    light: { en: "Light", "zh-CN": "浅色" },
    dark: { en: "Dark", "zh-CN": "深色" },
    "eye-care-green": { en: "Eye-Care Green", "zh-CN": "护眼绿" },
    "warm-paper": { en: "Warm Paper", "zh-CN": "暖纸色" },
    "ink-black": { en: "Ink Black", "zh-CN": "墨水黑" },
    "coastal-blue": { en: "Coastal Blue", "zh-CN": "海岸蓝" },
    "high-contrast": { en: "High Contrast", "zh-CN": "高对比" }
  };
  return names[theme][language];
}

export function getThemeQuickPickLabel(theme: PreviewTheme): string {
  switch (theme) {
    case "auto":
      return t("theme.auto.label");
    case "light":
      return t("theme.light.label");
    case "dark":
      return t("theme.dark.label");
    case "eye-care-green":
      return t("theme.eyeCareGreen.label");
    case "warm-paper":
      return t("theme.warmPaper.label");
    case "ink-black":
      return t("theme.inkBlack.label");
    case "coastal-blue":
      return t("theme.coastalBlue.label");
    case "high-contrast":
      return t("theme.highContrast.label");
  }
}

export function getThemeQuickPickDetail(theme: PreviewTheme): string {
  switch (theme) {
    case "auto":
      return t("theme.auto.detail");
    case "light":
      return t("theme.light.detail");
    case "dark":
      return t("theme.dark.detail");
    case "eye-care-green":
      return t("theme.eyeCareGreen.detail");
    case "warm-paper":
      return t("theme.warmPaper.detail");
    case "ink-black":
      return t("theme.inkBlack.detail");
    case "coastal-blue":
      return t("theme.coastalBlue.detail");
    case "high-contrast":
      return t("theme.highContrast.detail");
  }
}

export function getWebviewTranslations(): Record<string, string> {
  return {
    copy: t("webview.copy"),
    copied: t("webview.copied"),
    copyCode: t("webview.copyCode"),
    showOutline: t("webview.showOutline"),
    hideOutline: t("webview.hideOutline"),
    resizeOutline: t("webview.resizeOutline")
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
