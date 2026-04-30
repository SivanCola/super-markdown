import { OrganizeEdit, OrganizeResult } from "../types";
import { TOC_END, TOC_START } from "./constants";
import {
  formatMarkdown,
  formatMarkdownTables as formatMarkdownTablesWithSettings,
  normalizeListSpacing as normalizeListSpacingWithSettings
} from "./format";
import { upsertToc } from "./toc";

export interface OrganizeOptions {
  levels: Set<number>;
  numberHeadings: boolean;
  updateToc?: boolean;
  format?: Parameters<typeof formatMarkdown>[1];
}

const ATX_HEADING = /^(#{1,6})\s+(.+?)\s*#*\s*$/;

export function organizeMarkdown(text: string, options: OrganizeOptions): OrganizeResult {
  let current = text;
  const edits: OrganizeEdit[] = [];
  const warnings: string[] = [];

  if (options.format) {
    const formatResult = formatMarkdown(current, options.format);
    if (formatResult.text !== current) {
      current = formatResult.text;
      edits.push(...formatResult.edits);
      warnings.push(...formatResult.warnings);
    }
  }

  if (options.numberHeadings) {
    const numbered = numberMarkdownHeadings(current);
    if (numbered.text !== current) {
      current = numbered.text;
      edits.push({
        label: "Update heading numbers",
        range: { start: 0, end: countLines(text) },
        replacement: current
      });
    }
  }

  if (options.updateToc !== false) {
    const tocResult = upsertToc(current, options.levels);
    if (tocResult.text !== current) {
      current = tocResult.text;
      if (tocResult.edit) {
        edits.push(tocResult.edit);
      }
    }
  }

  return { text: current, edits, warnings };
}

export function normalizeListSpacing(text: string): { text: string } {
  return { text: normalizeListSpacingWithSettings(text) };
}

export function formatMarkdownTables(text: string): { text: string } {
  return formatMarkdownTablesWithSettings(text);
}

export function numberMarkdownHeadings(text: string): { text: string } {
  const counts = [0, 0, 0, 0, 0, 0, 0];
  let inTocBlock = false;

  return mapMarkdownLines(text, (line) => {
    const trimmed = line.trim();
    if (trimmed === TOC_START) {
      inTocBlock = true;
      return line;
    }
    if (trimmed === TOC_END) {
      inTocBlock = false;
      return line;
    }
    if (inTocBlock) {
      return line;
    }

    const match = line.match(ATX_HEADING);
    if (!match) {
      return line;
    }

    const level = match[1].length;
    if (level === 1) {
      counts.fill(0, 2);
      return line;
    }

    counts[level] += 1;
    for (let index = level + 1; index < counts.length; index += 1) {
      counts[index] = 0;
    }

    const number = counts
      .slice(2, level + 1)
      .map((part) => (part === 0 ? 1 : part))
      .join(".");
    const cleanText = match[2].replace(/^\d+(?:\.\d+)*\.?\s+/, "").trim();
    return `${match[1]} ${number}. ${cleanText}`;
  });
}

function mapMarkdownLines(text: string, mapper: (line: string, index: number) => string): { text: string } {
  const lines = splitLines(text);
  const nextLines: string[] = [];
  let inFence = false;
  let fenceMarker = "";

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();
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
      nextLines.push(line);
      continue;
    }

    nextLines.push(inFence ? line : mapper(line, index));
  }

  return { text: joinLines(nextLines, text) };
}

function countLines(text: string): number {
  return splitLines(text).length;
}

function splitLines(text: string): string[] {
  return text.replace(/\r\n/g, "\n").split("\n");
}

function joinLines(lines: string[], original: string): string {
  const joined = lines.join("\n");
  return original.endsWith("\n") && !joined.endsWith("\n") ? `${joined}\n` : joined;
}
