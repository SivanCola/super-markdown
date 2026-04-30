import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import yaml from "js-yaml";
import { ExportSettings, ExportType } from "../types";

export function parseFrontMatter(text: string): { data: Record<string, unknown>; content: string } {
  const match = text.match(/^(?:\uFEFF)?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/);
  if (!match) {
    return { data: {}, content: text };
  }
  const parsed = yaml.load(match[1]);
  return {
    data: isPlainRecord(parsed) ? parsed : {},
    content: match[2]
  };
}

export function resolveExportTypes(optionType: ExportType | "settings" | "all", configured: ExportSettings["defaultType"]): ExportType[] {
  if (optionType === "all") {
    return ["html", "pdf", "png", "jpeg"];
  }
  if (optionType !== "settings") {
    return [optionType];
  }
  return Array.isArray(configured) ? configured : [configured];
}

export function isExcluded(filename: string, patterns: string[]): boolean {
  return patterns.some((pattern) => {
    try {
      return new RegExp(pattern).test(filename);
    } catch {
      return false;
    }
  });
}

export function resolveOutputPath(
  sourcePath: string,
  type: ExportType,
  settings: Pick<ExportSettings, "outputDirectory" | "outputDirectoryRelativePathFile">,
  workspaceFolderPath = path.dirname(sourcePath)
): string {
  const basename = `${path.basename(sourcePath, path.extname(sourcePath))}.${type}`;
  const configured = settings.outputDirectory.trim();
  if (!configured) {
    return path.join(path.dirname(sourcePath), basename);
  }
  const expanded = configured.startsWith("~") ? path.join(os.homedir(), configured.slice(1)) : configured;
  if (path.isAbsolute(expanded)) {
    return path.join(expanded, basename);
  }
  const root = settings.outputDirectoryRelativePathFile ? path.dirname(sourcePath) : workspaceFolderPath;
  return path.join(root, expanded, basename);
}

export function rewriteImageSource(src: string, sourcePath: string, forHtml: boolean, outputPath?: string): string {
  if (/^(https?:|data:|file:)/i.test(src)) {
    return src;
  }
  const decoded = decodeURIComponent(src).replace(/["']/g, "");
  const absolute = path.isAbsolute(decoded) ? decoded : path.resolve(path.dirname(sourcePath), decoded);
  if (forHtml) {
    if (!outputPath) {
      return decoded;
    }
    const relative = path.relative(path.dirname(outputPath), absolute).replace(/\\/g, "/");
    return encodeURI(relative || path.basename(absolute));
  }
  return pathToFileUrl(absolute.replace(/#/g, "%23"));
}

export function resolveStylePath(style: string, sourcePath: string, extensionPath: string): string {
  if (/^(https?:|file:|data:)/i.test(style)) {
    return style;
  }
  if (path.isAbsolute(style)) {
    return pathToFileUrl(style);
  }
  const nearDocument = path.resolve(path.dirname(sourcePath), style);
  if (fs.existsSync(nearDocument)) {
    return pathToFileUrl(nearDocument);
  }
  return pathToFileUrl(path.resolve(extensionPath, style));
}

export function pathToFileUrl(filename: string): string {
  const normalized = filename.replace(/\\/g, "/");
  if (normalized.startsWith("/")) {
    return `file://${normalized}`;
  }
  return `file:///${normalized}`;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
