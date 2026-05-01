import * as vscode from "vscode";
import {
  ExportSettings,
  ExportType,
  FormatSettings,
  PreviewSettings,
  PreviewTheme,
  SyntaxToolsSettings,
  WysiwygSettings
} from "./types";
import { parseTocLevels } from "./markdown/outline";
import { getConfiguredDisplayLanguage, getRuntimeLanguage } from "./i18n";
import { normalizePreviewTheme } from "./themes";
import { resolveWysiwygDefaultMode } from "./wysiwyg/mode";

export function getPreviewSettings(): PreviewSettings {
  const config = vscode.workspace.getConfiguration("superMarkdown");
  const displayLanguage = getConfiguredDisplayLanguage();
  return {
    theme: getPreviewTheme(config),
    fontSize: clamp(config.get<number>("preview.fontSize", 14), 10, 24),
    maxWidth: clamp(config.get<number>("preview.maxWidth", 860), 520, 1400),
    tocLevels: parseTocLevels(config.get<string>("toc.levels", "1..6")),
    displayLanguage,
    activeLanguage: getRuntimeLanguage(displayLanguage),
    mermaidEnabled: config.get<boolean>("mermaid.enabled", true),
    katexEnabled: config.get<boolean>("katex.enabled", true),
    numberHeadings: config.get<boolean>("organize.numberHeadings", false),
    updateTocOnSave: config.get<boolean>("organize.updateTocOnSave", false),
    format: getFormatSettings(config)
  };
}

export function getFormatSettings(config = vscode.workspace.getConfiguration("superMarkdown")): FormatSettings {
  return {
    enable: config.get<boolean>("format.enable", true),
    punctuationWidth: getEnum(config.get<string>("format.punctuationWidth", "auto"), ["auto", "half", "preserve"], "auto"),
    punctuationSpacing: getEnum(
      config.get<string>("format.punctuationSpacing", "half"),
      ["half", "full", "all", "none"],
      "half"
    ),
    table: {
      enabled: config.get<boolean>("format.table.enabled", true),
      cjkCharWidth: clamp(config.get<number>("format.table.cjkCharWidth", 2), 1, 3)
    },
    list: {
      markerStyle: getEnum(config.get<string>("format.list.markerStyle", "cycle"), ["preserve", "cycle"], "cycle"),
      markerCycle: getMarkerCycle(config.get<string[]>("format.list.markerCycle", ["*", "+", "-"])),
      padOrderedNumbers: config.get<boolean>("format.list.padOrderedNumbers", true)
    },
    code: {
      enabled: config.get<boolean>("format.code.enabled", true),
      indentedCodeToFenceLanguage: config.get<string>("format.code.indentedCodeToFenceLanguage", ""),
      beautifyOptions: config.get<Record<string, unknown>>("format.code.beautifyOptions", {})
    },
    timeHeader: {
      enabled: config.get<boolean>("format.timeHeader.enabled", false)
    },
    specialTextSpacing: config.get<boolean>("format.specialTextSpacing", true)
  };
}

export function getWysiwygSettings(config = vscode.workspace.getConfiguration("superMarkdown")): WysiwygSettings {
  const editorMode = config.get<string>("editor.defaultMode", "source");
  const wysiwygMode = config.inspect<string>("wysiwyg.defaultMode");
  const configuredWysiwygMode =
    wysiwygMode?.workspaceFolderValue ??
    wysiwygMode?.workspaceValue ??
    wysiwygMode?.globalValue ??
    wysiwygMode?.defaultLanguageValue ??
    wysiwygMode?.globalLanguageValue ??
    wysiwygMode?.workspaceLanguageValue ??
    wysiwygMode?.workspaceFolderLanguageValue;
  return {
    defaultMode: resolveWysiwygDefaultMode(editorMode, configuredWysiwygMode),
    layout: getEnum(config.get<string>("editor.layout", "workbench"), ["workbench", "editorOnly", "splitEdit", "previewOnly"], "workbench"),
    imageDirectory: config.get<string>("wysiwyg.imageDirectory", "assets"),
    useVsCodeThemeColors: config.get<boolean>("wysiwyg.useVsCodeThemeColors", true),
    customCss: config.get<string>("wysiwyg.customCss", ""),
    theme: getEnum(config.get<string>("wysiwyg.theme", "classic"), ["classic", "dark"], "classic")
  };
}

export function getExportSettings(config = vscode.workspace.getConfiguration("superMarkdown")): ExportSettings {
  const defaultType = config.get<ExportType | ExportType[]>("export.type", "pdf");
  return {
    defaultType: normalizeExportType(defaultType),
    convertOnSave: config.get<boolean>("export.convertOnSave", false),
    exclude: config.get<string[]>("export.exclude", []),
    outputDirectory: config.get<string>("export.outputDirectory", ""),
    outputDirectoryRelativePathFile: config.get<boolean>("export.outputDirectoryRelativePathFile", true),
    includeDefaultStyles: config.get<boolean>("export.includeDefaultStyles", true),
    styles: normalizeStringArray(config.get<string[] | string>("export.styles", [])),
    highlight: config.get<boolean>("export.highlight", true),
    highlightStyle: config.get<string>("export.highlightStyle", "super-markdown"),
    emoji: config.get<boolean>("export.emoji", true),
    breaks: config.get<boolean>("export.breaks", false),
    chromiumExecutablePath: config.get<string>("export.chromium.executablePath", ""),
    include: {
      enabled: config.get<boolean>("export.include.enabled", true)
    },
    mermaid: {
      enabled: config.get<boolean>("export.mermaid.enabled", true)
    },
    plantuml: {
      enabled: config.get<boolean>("export.plantuml.enabled", false),
      server: config.get<string>("export.plantuml.server", "http://www.plantuml.com/plantuml"),
      openMarker: config.get<string>("export.plantuml.openMarker", "@startuml"),
      closeMarker: config.get<string>("export.plantuml.closeMarker", "@enduml")
    },
    pdf: {
      format: config.get<string>("export.pdf.format", "A4"),
      landscape: config.get<boolean>("export.pdf.landscape", false),
      printBackground: config.get<boolean>("export.pdf.printBackground", true),
      displayHeaderFooter: config.get<boolean>("export.pdf.displayHeaderFooter", false),
      headerTemplate: config.get<string>("export.pdf.headerTemplate", ""),
      footerTemplate: config.get<string>("export.pdf.footerTemplate", ""),
      margin: {
        top: config.get<string>("export.pdf.margin.top", "1cm"),
        right: config.get<string>("export.pdf.margin.right", "1cm"),
        bottom: config.get<string>("export.pdf.margin.bottom", "1cm"),
        left: config.get<string>("export.pdf.margin.left", "1cm")
      }
    },
    image: {
      quality: clamp(config.get<number>("export.image.quality", 100), 1, 100),
      fullPage: config.get<boolean>("export.image.fullPage", true),
      omitBackground: config.get<boolean>("export.image.omitBackground", false),
      clip: getImageClip(config)
    }
  };
}

export function getSyntaxToolsSettings(
  config = vscode.workspace.getConfiguration("superMarkdown")
): SyntaxToolsSettings {
  return {
    showMessages: config.get<boolean>("syntaxTools.showMessages", true)
  };
}

function getPreviewTheme(config: vscode.WorkspaceConfiguration): PreviewTheme {
  return normalizePreviewTheme(config.get<string>("preview.theme", "system"));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getEnum<T extends string>(value: string, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function getMarkerCycle(value: string[]): string[] {
  const markers = value.filter((item) => item === "*" || item === "+" || item === "-");
  return markers.length > 0 ? markers : ["*", "+", "-"];
}

function normalizeStringArray(value: string[] | string): string[] {
  if (Array.isArray(value)) {
    return value.filter((item) => typeof item === "string" && item.trim().length > 0);
  }
  return value.trim() ? [value] : [];
}

function normalizeExportType(value: ExportType | ExportType[]): ExportType | ExportType[] {
  const allowed: ExportType[] = ["html", "pdf", "png", "jpeg"];
  if (Array.isArray(value)) {
    const types = value.filter((item): item is ExportType => allowed.includes(item));
    return types.length > 0 ? types : "pdf";
  }
  return allowed.includes(value) ? value : "pdf";
}

function getImageClip(config: vscode.WorkspaceConfiguration): ExportSettings["image"]["clip"] {
  const width = config.get<number>("export.image.clip.width", 0);
  const height = config.get<number>("export.image.clip.height", 0);
  if (!width || !height || width <= 0 || height <= 0) {
    return undefined;
  }
  return {
    x: Math.max(0, config.get<number>("export.image.clip.x", 0)),
    y: Math.max(0, config.get<number>("export.image.clip.y", 0)),
    width,
    height
  };
}
