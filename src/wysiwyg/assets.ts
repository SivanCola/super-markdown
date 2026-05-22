import * as path from "node:path";
import { WysiwygSettings } from "../types";

export interface UploadedImageData {
  id: string;
  name: string;
  dataUrl: string;
}

export interface StoredImageData {
  id: string;
  name: string;
  absolutePath: string;
  markdownPath: string;
  buffer: Buffer;
}

const DATA_URL_PATTERN = /^data:([\w.+-]+\/[\w.+-]+);base64,(.+)$/;

export function resolveImageDirectory(
  documentPath: string,
  settings: Pick<WysiwygSettings, "imageDirectory">,
  baseDirectory?: string
): string {
  const configured = settings.imageDirectory.trim() || "assets";
  if (path.isAbsolute(configured)) {
    return configured;
  }
  return path.resolve(baseDirectory ?? path.dirname(documentPath), configured);
}

export function prepareUploadedImage(
  documentPath: string,
  settings: Pick<WysiwygSettings, "imageDirectory">,
  image: UploadedImageData,
  existingNames: ReadonlySet<string> = new Set(),
  baseDirectory?: string
): StoredImageData {
  const match = image.dataUrl.match(DATA_URL_PATTERN);
  if (!match) {
    throw new Error("Unsupported image data.");
  }

  const directory = resolveImageDirectory(documentPath, settings, baseDirectory);
  const filename = uniqueFilename(sanitizeFilename(image.name, match[1]), existingNames);
  const absolutePath = path.join(directory, filename);
  const relativePath = path.relative(path.dirname(documentPath), absolutePath).replace(/\\/g, "/");

  return {
    id: image.id,
    name: filename,
    absolutePath,
    markdownPath: relativePath,
    buffer: Buffer.from(match[2], "base64")
  };
}

export function sanitizeFilename(name: string, mimeType = "image/png"): string {
  const extension = inferExtension(name, mimeType);
  const base = path
    .basename(name, path.extname(name))
    .trim()
    .replace(/[^\w.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `${base || "image"}${extension}`;
}

function inferExtension(name: string, mimeType: string): string {
  const existing = path.extname(name).toLowerCase();
  if (/^\.(png|jpe?g|gif|webp|svg|bmp)$/.test(existing)) {
    return existing;
  }
  switch (mimeType.toLowerCase()) {
    case "image/jpeg":
    case "image/jpg":
      return ".jpg";
    case "image/gif":
      return ".gif";
    case "image/webp":
      return ".webp";
    case "image/svg+xml":
      return ".svg";
    case "image/bmp":
      return ".bmp";
    default:
      return ".png";
  }
}

function uniqueFilename(name: string, existingNames: ReadonlySet<string>): string {
  if (!existingNames.has(name)) {
    return name;
  }

  const extension = path.extname(name);
  const base = path.basename(name, extension);
  let index = 2;
  let candidate = `${base}-${index}${extension}`;
  while (existingNames.has(candidate)) {
    index += 1;
    candidate = `${base}-${index}${extension}`;
  }
  return candidate;
}
