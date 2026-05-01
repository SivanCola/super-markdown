import * as path from "node:path";
import { pathToFileURL } from "node:url";

export type MarkdownResourceKind = "external" | "data" | "file" | "local";

export interface MarkdownResourceTarget {
  original: string;
  normalized: string;
  withoutHashAndQuery: string;
  decodedPath: string;
  kind: MarkdownResourceKind;
  absolutePath?: string;
}

export function parseMarkdownResourceTarget(src: string, sourcePath?: string): MarkdownResourceTarget {
  const normalized = String(src || "").trim().replace(/^</, "").replace(/>$/, "").replace(/^["']|["']$/g, "");
  const withoutHashAndQuery = stripHashAndQuery(normalized);
  const decodedPath = safeDecodeURIComponent(withoutHashAndQuery);
  const kind = classifyResourceTarget(normalized);
  const absolutePath = kind === "local" && sourcePath
    ? path.isAbsolute(decodedPath)
      ? decodedPath
      : path.resolve(path.dirname(sourcePath), decodedPath)
    : undefined;

  return {
    original: src,
    normalized,
    withoutHashAndQuery,
    decodedPath,
    kind,
    absolutePath
  };
}

export function isSkippableLocalTarget(target: MarkdownResourceTarget): boolean {
  return target.normalized.startsWith("#") || target.kind !== "local";
}

export function pathToFileUrl(filename: string): string {
  return pathToFileURL(filename).href;
}

export function stripHashAndQuery(target: string): string {
  return target.split("#")[0].split("?")[0];
}

function classifyResourceTarget(target: string): MarkdownResourceKind {
  if (/^data:/i.test(target)) {
    return "data";
  }
  if (/^file:/i.test(target)) {
    return "file";
  }
  if (/^[a-z][a-z\d+.-]*:/i.test(target)) {
    return "external";
  }
  return "local";
}

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
