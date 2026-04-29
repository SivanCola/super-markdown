import { Heading, OrganizeEdit } from "../types";
import { TOC_END, TOC_START } from "./constants";
import { extractHeadings } from "./outline";

export interface TocBlock {
  startLine: number;
  endLine: number;
  content: string;
}

export interface TocUpdateResult {
  text: string;
  edit?: OrganizeEdit;
}

export function findTocBlock(text: string): TocBlock | undefined {
  const lines = splitLines(text);
  const startLine = lines.findIndex((line) => line.trim() === TOC_START);
  if (startLine === -1) {
    return undefined;
  }

  const relativeEnd = lines.slice(startLine + 1).findIndex((line) => line.trim() === TOC_END);
  if (relativeEnd === -1) {
    return undefined;
  }

  const endLine = startLine + relativeEnd + 1;
  return {
    startLine,
    endLine,
    content: lines.slice(startLine, endLine + 1).join("\n")
  };
}

export function generateTocMarkdown(headings: Heading[]): string {
  const visibleHeadings = headings.filter((heading) => heading.text.length > 0);
  const minLevel = visibleHeadings.length === 0 ? 1 : Math.min(...visibleHeadings.map((heading) => heading.level));
  const lines = [TOC_START, "## Table of Contents", ""];

  if (visibleHeadings.length === 0) {
    lines.push("_No headings found._");
  } else {
    for (const heading of visibleHeadings) {
      const indent = "  ".repeat(Math.max(0, heading.level - minLevel));
      lines.push(`${indent}- [${escapeTocLabel(heading.text)}](#${heading.slug})`);
    }
  }

  lines.push(TOC_END);
  return lines.join("\n");
}

export function upsertToc(text: string, levels: Set<number>): TocUpdateResult {
  const headings = extractHeadings(text, { levels });
  const toc = generateTocMarkdown(headings);
  const block = findTocBlock(text);

  if (block) {
    if (normalizeBlock(block.content) === normalizeBlock(toc)) {
      return { text };
    }

    const lines = splitLines(text);
    const nextLines = [
      ...lines.slice(0, block.startLine),
      ...toc.split("\n"),
      ...lines.slice(block.endLine + 1)
    ];
    return {
      text: joinLines(nextLines, text),
      edit: {
        label: "Update table of contents",
        range: { start: block.startLine, end: block.endLine + 1 },
        replacement: toc
      }
    };
  }

  const lines = splitLines(text);
  const insertLine = findTocInsertionLine(lines);
  const nextLines = [
    ...lines.slice(0, insertLine),
    ...toc.split("\n"),
    "",
    ...lines.slice(insertLine)
  ];

  return {
    text: joinLines(nextLines, text),
    edit: {
      label: "Insert table of contents",
      range: { start: insertLine, end: insertLine },
      replacement: `${toc}\n`
    }
  };
}

export function isTocStale(text: string, levels: Set<number>): boolean {
  const block = findTocBlock(text);
  if (!block) {
    return false;
  }
  const headings = extractHeadings(text, { levels });
  return normalizeBlock(block.content) !== normalizeBlock(generateTocMarkdown(headings));
}

function findTocInsertionLine(lines: string[]): number {
  const frontmatterEnd = findFrontmatterEnd(lines);
  const searchStart = frontmatterEnd === -1 ? 0 : frontmatterEnd + 1;
  const firstH1 = lines.findIndex((line, index) => index >= searchStart && /^#\s+/.test(line));
  if (firstH1 !== -1) {
    return firstH1 + 1;
  }
  return searchStart;
}

function findFrontmatterEnd(lines: string[]): number {
  if (lines[0]?.trim() !== "---") {
    return -1;
  }

  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index].trim() === "---") {
      return index;
    }
  }

  return -1;
}

function escapeTocLabel(text: string): string {
  return text.replace(/\[/g, "\\[").replace(/\]/g, "\\]");
}

function normalizeBlock(text: string): string {
  return text.replace(/\r\n/g, "\n").trim();
}

function splitLines(text: string): string[] {
  return text.replace(/\r\n/g, "\n").split("\n");
}

function joinLines(lines: string[], original: string): string {
  const joined = lines.join("\n");
  return original.endsWith("\n") && !joined.endsWith("\n") ? `${joined}\n` : joined;
}
