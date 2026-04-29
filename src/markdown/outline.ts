import { Heading } from "../types";
import { TOC_END, TOC_START } from "./constants";
import { GithubSlugger } from "./slug";

export interface ExtractHeadingOptions {
  levels?: Set<number>;
  includeTocBlock?: boolean;
}

const ATX_HEADING = /^(#{1,6})\s+(.+?)\s*#*\s*$/;
const OMIT_FROM_TOC = /<!--\s*omit from toc\s*-->/i;

export function parseTocLevels(value: unknown): Set<number> {
  if (typeof value !== "string") {
    return new Set([1, 2, 3, 4, 5, 6]);
  }

  const trimmed = value.trim();
  const rangeMatch = trimmed.match(/^([1-6])\.\.([1-6])$/);
  if (rangeMatch) {
    const start = Number(rangeMatch[1]);
    const end = Number(rangeMatch[2]);
    const min = Math.min(start, end);
    const max = Math.max(start, end);
    return new Set(Array.from({ length: max - min + 1 }, (_, index) => min + index));
  }

  const singleMatch = trimmed.match(/^[1-6]$/);
  if (singleMatch) {
    return new Set([Number(trimmed)]);
  }

  return new Set([1, 2, 3, 4, 5, 6]);
}

export function extractHeadings(text: string, options: ExtractHeadingOptions = {}): Heading[] {
  const levels = options.levels ?? new Set([1, 2, 3, 4, 5, 6]);
  const slugger = new GithubSlugger();
  const headings: Heading[] = [];
  const lines = text.split(/\r?\n/);
  let inFence = false;
  let fenceMarker = "";
  let inTocBlock = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();

    if (trimmed === TOC_START) {
      inTocBlock = true;
      if (!options.includeTocBlock) {
        continue;
      }
    }

    if (trimmed === TOC_END) {
      inTocBlock = false;
      if (!options.includeTocBlock) {
        continue;
      }
    }

    const fenceMatch = trimmed.match(/^(```+|~~~+)/);
    if (fenceMatch) {
      const marker = fenceMatch[1][0];
      if (!inFence) {
        inFence = true;
        fenceMarker = marker;
      } else if (marker === fenceMarker) {
        inFence = false;
        fenceMarker = "";
      }
      continue;
    }

    if (inFence || (inTocBlock && !options.includeTocBlock)) {
      continue;
    }

    const headingMatch = line.match(ATX_HEADING);
    if (!headingMatch || OMIT_FROM_TOC.test(line)) {
      continue;
    }

    const level = headingMatch[1].length;
    if (!levels.has(level)) {
      continue;
    }

    const textContent = cleanHeadingText(headingMatch[2]);
    headings.push({
      level,
      text: textContent,
      slug: slugger.slug(textContent),
      line: index,
      children: []
    });
  }

  return headings;
}

export function buildHeadingTree(headings: Heading[]): Heading[] {
  const roots: Heading[] = [];
  const stack: Heading[] = [];

  for (const heading of headings) {
    const node: Heading = { ...heading, children: [] };
    while (stack.length > 0 && stack[stack.length - 1].level >= node.level) {
      stack.pop();
    }

    const parent = stack[stack.length - 1];
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
    stack.push(node);
  }

  return roots;
}

export function flattenHeadingTree(headings: Heading[]): Heading[] {
  const flattened: Heading[] = [];

  function visit(nodes: Heading[]): void {
    for (const node of nodes) {
      flattened.push(node);
      visit(node.children);
    }
  }

  visit(headings);
  return flattened;
}

export function cleanHeadingText(rawText: string): string {
  return rawText
    .replace(OMIT_FROM_TOC, "")
    .replace(/\s+#+\s*$/, "")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/[*_~]/g, "")
    .trim();
}
