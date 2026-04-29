import { OrganizeEdit, OrganizeResult } from "../types";
import { TOC_END, TOC_START } from "./constants";
import { upsertToc } from "./toc";

export interface OrganizeOptions {
  levels: Set<number>;
  numberHeadings: boolean;
  updateToc?: boolean;
}

const ATX_HEADING = /^(#{1,6})\s+(.+?)\s*#*\s*$/;

export function organizeMarkdown(text: string, options: OrganizeOptions): OrganizeResult {
  let current = text;
  const edits: OrganizeEdit[] = [];
  const warnings: string[] = [];

  const listResult = normalizeListSpacing(current);
  if (listResult.text !== current) {
    current = listResult.text;
    edits.push({
      label: "Normalize list spacing",
      range: { start: 0, end: countLines(text) },
      replacement: current
    });
  }

  const tableResult = formatMarkdownTables(current);
  if (tableResult.text !== current) {
    current = tableResult.text;
    edits.push({
      label: "Format Markdown tables",
      range: { start: 0, end: countLines(text) },
      replacement: current
    });
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
  return mapMarkdownLines(text, (line) => {
    const taskMatch = line.match(/^(\s*)([-*+]|\d+[.)])\s*\[([ xX])\]\s*(.*)$/);
    if (taskMatch) {
      const checkbox = taskMatch[3].toLowerCase() === "x" ? "x" : " ";
      const content = taskMatch[4].trimStart();
      return `${taskMatch[1]}${taskMatch[2]} [${checkbox}]${content ? ` ${content}` : ""}`;
    }

    const unorderedMatch = line.match(/^(\s*)([-*+])\s+(.+)$/);
    if (unorderedMatch) {
      return `${unorderedMatch[1]}${unorderedMatch[2]} ${unorderedMatch[3].trimStart()}`;
    }

    const orderedMatch = line.match(/^(\s*)(\d+[.)])\s+(.+)$/);
    if (orderedMatch) {
      return `${orderedMatch[1]}${orderedMatch[2]} ${orderedMatch[3].trimStart()}`;
    }

    return line;
  });
}

export function formatMarkdownTables(text: string): { text: string } {
  const lines = splitLines(text);
  const nextLines: string[] = [];
  let index = 0;
  let inFence = false;
  let fenceMarker = "";
  let changed = false;

  while (index < lines.length) {
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
      index += 1;
      continue;
    }

    if (!inFence && isTableStart(lines, index)) {
      const tableLines: string[] = [];
      while (index < lines.length && isPipeRow(lines[index])) {
        tableLines.push(lines[index]);
        index += 1;
      }

      const formatted = formatTable(tableLines);
      changed = changed || formatted.join("\n") !== tableLines.join("\n");
      nextLines.push(...formatted);
      continue;
    }

    nextLines.push(line);
    index += 1;
  }

  return { text: changed ? joinLines(nextLines, text) : text };
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

function isTableStart(lines: string[], index: number): boolean {
  return Boolean(lines[index] && lines[index + 1] && isPipeRow(lines[index]) && isSeparatorRow(lines[index + 1]));
}

function isPipeRow(line: string): boolean {
  return line.includes("|") && splitTableRow(line).length > 1;
}

function isSeparatorRow(line: string): boolean {
  const cells = splitTableRow(line);
  return cells.length > 1 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.trim()));
}

function formatTable(rows: string[]): string[] {
  const indent = rows[0].match(/^\s*/)?.[0] ?? "";
  const parsedRows = rows.map(splitTableRow);
  const columnCount = Math.max(...parsedRows.map((row) => row.length));
  const normalizedRows = parsedRows.map((row) => [...row, ...Array<string>(columnCount - row.length).fill("")]);
  const alignments = normalizedRows[1].map(parseAlignment);
  const widths = Array.from({ length: columnCount }, (_, column) =>
    Math.max(...normalizedRows.map((row) => displayLength(row[column])))
  );

  return normalizedRows.map((row, rowIndex) => {
    if (rowIndex === 1) {
      return formatSeparatorRow(widths, alignments, indent);
    }
    return `${indent}| ${row.map((cell, column) => padCell(cell, widths[column], alignments[column])).join(" | ")} |`;
  });
}

function splitTableRow(row: string): string[] {
  const trimmed = row.trim();
  const withoutEdges = trimmed.replace(/^\|/, "").replace(/\|$/, "");
  return withoutEdges.split("|").map((cell) => cell.trim());
}

function parseAlignment(separator: string): "left" | "center" | "right" {
  const trimmed = separator.trim();
  if (trimmed.startsWith(":") && trimmed.endsWith(":")) {
    return "center";
  }
  if (trimmed.endsWith(":")) {
    return "right";
  }
  return "left";
}

function formatSeparatorRow(widths: number[], alignments: Array<"left" | "center" | "right">, indent: string): string {
  const cells = widths.map((width, index) => {
    const dashes = "-".repeat(Math.max(3, width));
    if (alignments[index] === "center") {
      return `:${dashes}:`;
    }
    if (alignments[index] === "right") {
      return `${dashes}:`;
    }
    return dashes;
  });
  return `${indent}| ${cells.join(" | ")} |`;
}

function padCell(cell: string, width: number, alignment: "left" | "center" | "right"): string {
  const padding = Math.max(0, width - displayLength(cell));
  if (alignment === "right") {
    return `${" ".repeat(padding)}${cell}`;
  }
  if (alignment === "center") {
    const left = Math.floor(padding / 2);
    const right = padding - left;
    return `${" ".repeat(left)}${cell}${" ".repeat(right)}`;
  }
  return `${cell}${" ".repeat(padding)}`;
}

function displayLength(value: string): number {
  return Array.from(value).length;
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
