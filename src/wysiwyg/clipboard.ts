export interface ImageTransferItem {
  kind: string;
  type: string;
  getAsFile(): File | null;
}

export interface ImageTransfer {
  files?: ArrayLike<File> | null;
  items?: ArrayLike<ImageTransferItem> | null;
}

export function isImageFile(file: File): boolean {
  return file.type.startsWith("image/");
}

export function getImageFilesFromTransfer(dataTransfer: ImageTransfer | null | undefined): File[] {
  if (!dataTransfer) {
    return [];
  }

  const files = collectUniqueImageFiles(dataTransfer.files);
  if (files.length > 0) {
    return files;
  }

  return collectUniqueImageFiles(
    Array.from(dataTransfer.items || [])
      .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
  );
}

function collectUniqueImageFiles(source: ArrayLike<File | null> | null | undefined): File[] {
  const files: File[] = [];
  const seen = new Set<string>();
  for (const file of Array.from(source || [])) {
    if (!file || !isImageFile(file)) {
      continue;
    }
    const key = `${file.name}:${file.type}:${file.size}:${file.lastModified}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    files.push(file);
  }
  return files;
}
