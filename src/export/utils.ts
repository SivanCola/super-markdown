import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { parseMarkdownResourceTarget, pathToFileUrl } from "../markdown/resource";
import { ExportSettings, ExportType } from "../types";

export { pathToFileUrl } from "../markdown/resource";

export function parseFrontMatter(text: string): { data: Record<string, unknown>; content: string } {
  const match = text.match(/^(?:\uFEFF)?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/);
  if (!match) {
    return { data: {}, content: text };
  }
  return {
    data: parseSimpleYamlRecord(match[1]),
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
  const target = parseMarkdownResourceTarget(src, sourcePath);
  if (target.kind !== "local") {
    return target.normalized;
  }
  const absolute = target.absolutePath ?? target.decodedPath;
  if (forHtml) {
    if (!outputPath) {
      return target.decodedPath;
    }
    const relative = path.relative(path.dirname(outputPath), absolute).replace(/\\/g, "/");
    return encodeURI(relative || path.basename(absolute));
  }
  return pathToFileUrl(absolute);
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

function parseSimpleYamlRecord(source: string): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const line of source.split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z0-9_.-]+)\s*:\s*(.*)$/);
    if (!match) {
      continue;
    }
    const raw = match[2].trim();
    if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
      data[match[1]] = raw.slice(1, -1);
    } else if (raw === "true" || raw === "false") {
      data[match[1]] = raw === "true";
    } else if (/^-?\d+(?:\.\d+)?$/.test(raw)) {
      data[match[1]] = Number(raw);
    } else {
      data[match[1]] = raw;
    }
  }
  return data;
}
