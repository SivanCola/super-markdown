import beautify = require("js-beautify");
import { FormatSettings, OrganizeEdit, OrganizeResult } from "../types";

export interface MarkdownFormatOptions {
  date?: Date;
}

const DISABLE_FILE = /<!--\s*\/\*\s*md-file-format-disable\s*\*\/\s*-->/;
const IGNORE_BLOCK = /<!--\s*md-ignore-block-start\s*-->[\s\S]*?<!--\s*md-ignore-block-end\s*-->/g;
const FENCE_START = /^(\s*)(```+|~~~+)\s*([^\s`]*)[^\n]*$/;
const ATX_HEADING_LINE = /^#{1,6}\s+\S/;
const IMAGE_LINE = /^(\s*)!\[[^\]]*]\([^)]+\)\s*$/;
const TIME_HEADER = /^<!--\nCreated: ([^\n]+)\nModified: [^\n]+\n-->\n*/;

const FULL_WIDTH_SYMBOLS = "，、：；！“”‘’（）？。";
const HALF_WIDTH_SYMBOLS = ",,:;!\"\"''()?.";
const FULL_TO_HALF = new Map(Array.from(FULL_WIDTH_SYMBOLS).map((char, index) => [char, HALF_WIDTH_SYMBOLS[index]]));
const HALF_TO_FULL = new Map(Array.from(HALF_WIDTH_SYMBOLS).map((char, index) => [char, FULL_WIDTH_SYMBOLS[index]]));

interface ProtectedBlock {
  token: string;
  value: string;
}

interface ProtectResult {
  text: string;
  blocks: ProtectedBlock[];
}

type Alignment = "left" | "center" | "right";

export function formatMarkdown(text: string, settings: FormatSettings, options: MarkdownFormatOptions = {}): OrganizeResult {
  if (!settings.enable || DISABLE_FILE.test(text)) {
    return { text, edits: [], warnings: [] };
  }

  const eol = detectEol(text);
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const edits: OrganizeEdit[] = [];
  let current = normalized;

  const ignored = protectPattern(current, IGNORE_BLOCK, "ignore");
  current = ignored.text;

  if (settings.timeHeader.enabled) {
    current = upsertTimeHeader(current, options.date ?? new Date());
  }

  if (settings.code.enabled && settings.code.indentedCodeToFenceLanguage.trim()) {
    current = convertIndentedCodeBlocks(current, settings.code.indentedCodeToFenceLanguage.trim());
  }

  if (settings.code.enabled) {
    current = formatFencedCodeBlocks(current, settings.code.beautifyOptions);
  }

  const fenced = protectFencedCodeBlocks(current);
  current = fenced.text;
  const urls = protectPattern(current, /(?:https?|file|ftp):\/\/[^\s<>)]+/g, "url");
  current = urls.text;

  current = formatInlineCodeSpacing(current);
  const inlineCode = protectPattern(current, /`[^`\n]+`/g, "inline");
  current = inlineCode.text;
  current = normalizePunctuation(current, settings);

  current = normalizeListSpacing(current, settings);
  current = formatMarkdownTables(current, settings).text;
  current = normalizeMarkdownStructure(current);
  if (settings.specialTextSpacing) {
    current = formatSpecialTextSpacing(current);
  }
  current = collapseExtraBlankLines(current);

  current = restoreProtected(current, inlineCode.blocks);
  current = restoreProtected(current, urls.blocks);
  current = restoreProtected(current, fenced.blocks);
  current = restoreProtected(current, ignored.blocks);
  current = restoreEol(current, eol);

  if (current !== text) {
    edits.push({
      label: "Format Markdown",
      range: { start: 0, end: countLines(text) },
      replacement: current
    });
  }

  return { text: current, edits, warnings: [] };
}

export function normalizeListSpacing(text: string, settings: Pick<FormatSettings, "list"> = defaultListSettings()): string {
  const lines = splitLines(text);
  const next = lines.map((line) => normalizeListLine(line, settings));
  const padded = settings.list.padOrderedNumbers ? padOrderedListNumbers(next) : next;
  return joinLines(padded, text);
}

export function formatMarkdownTables(
  text: string,
  settings: Pick<FormatSettings, "table"> = defaultTableSettings()
): { text: string } {
  if (!settings.table.enabled) {
    return { text };
  }

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
      const prefix = getQuotePrefix(lines[index]);
      const tableLines: string[] = [];
      while (index < lines.length && getQuotePrefix(lines[index]) === prefix && isPipeRow(stripQuotePrefix(lines[index]))) {
        tableLines.push(stripQuotePrefix(lines[index]));
        index += 1;
      }

      const formatted = formatTable(tableLines, settings.table.cjkCharWidth).map((tableLine) => `${prefix}${tableLine}`);
      changed = changed || formatted.join("\n") !== lines.slice(index - tableLines.length, index).join("\n");
      nextLines.push(...formatted);
      continue;
    }

    nextLines.push(line);
    index += 1;
  }

  return { text: changed ? joinLines(nextLines, text) : text };
}

function normalizePunctuation(text: string, settings: FormatSettings): string {
  return mapNonFenceLines(text, (line) => {
    let next = "";
    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      const previous = previousVisibleChar(next);
      if (settings.punctuationWidth === "half" && FULL_TO_HALF.has(char)) {
        next += FULL_TO_HALF.get(char);
      } else if (settings.punctuationWidth === "auto" && FULL_TO_HALF.has(char) && isAsciiWord(previous)) {
        next += FULL_TO_HALF.get(char);
      } else if (settings.punctuationWidth === "auto" && HALF_TO_FULL.has(char) && isCjk(previous)) {
        next += HALF_TO_FULL.get(char);
      } else {
        next += char;
      }
    }

    if (settings.punctuationSpacing === "half" || settings.punctuationSpacing === "all") {
      next = next.replace(/([,;])\s*(?=\S)/g, "$1 ");
      next = next.replace(/([.!?:])(?=[A-Z\u4e00-\u9fff])/g, "$1 ");
    }
    if (settings.punctuationSpacing === "full" || settings.punctuationSpacing === "all") {
      next = next.replace(/([，。；！、？：])\s*(?=\S)/g, "$1 ");
    }
    return next.trimEnd();
  });
}

function normalizeMarkdownStructure(text: string): string {
  const lines = splitLines(text);
  const next: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const previous = next[next.length - 1];
    const shouldPad =
      ATX_HEADING_LINE.test(line) ||
      IMAGE_LINE.test(line) ||
      isFenceBoundary(line);

    if (shouldPad && previous !== undefined && previous.trim() !== "") {
      next.push("");
    }

    if (isBlockQuoteStart(line)) {
      next.push(line.replace(/^(\s*>+)\s*/, "$1 "));
    } else if (/^\s*-\s+-\s+-(?:\s+-)*\s*$/.test(line)) {
      next.push(line.replace(/^\s*/, "").replace(/\s+/g, ""));
    } else {
      next.push(line);
    }

    const following = lines[index + 1];
    if (shouldPad && following !== undefined && following.trim() !== "" && !isListStart(following)) {
      next.push("");
    }
  }

  return joinLines(next, text);
}

function collapseExtraBlankLines(text: string): string {
  return text.replace(/\n{3,}/g, "\n\n").replace(/^\n+/, "").replace(/\n{2,}$/, "\n");
}

function formatInlineCodeSpacing(text: string): string {
  return mapNonFenceLines(text, (line) =>
    line
      .replace(/([^\s`])(`[^`\n]+`)/g, "$1 $2")
      .replace(/(`[^`\n]+`)([^\s`.,;:!?，。；：！？、])/g, "$1 $2")
  );
}

function formatSpecialTextSpacing(text: string): string {
  const emphasis = /\*\*\*[^*\n]+?\*\*\*|\*\*[^*\n]+?\*\*|~~[^~\n]+?~~|\*[^*\n]+?\*/g;
  return mapNonFenceLines(text, (line) =>
    line.replace(emphasis, (match, offset: number) => {
      const start = offset;
      const end = start + match.length;
      const before = start > 0 ? line[start - 1] : "";
      const after = end < line.length ? line[end] : "";
      const prefix = before && !/\s/.test(before) ? " " : "";
      const suffix = after && !/[\s,.;:!?，。；：！？、]/.test(after) ? " " : "";
      return `${prefix}${match}${suffix}`;
    })
  );
}

function upsertTimeHeader(text: string, date: Date): string {
  const stamp = formatTimestamp(date);
  if (TIME_HEADER.test(text)) {
    return text.replace(TIME_HEADER, (_match, created: string) => `<!--\nCreated: ${created}\nModified: ${stamp}\n-->\n\n`);
  }
  return `<!--\nCreated: ${stamp}\nModified: ${stamp}\n-->\n\n${text}`;
}

function formatTimestamp(date: Date): string {
  return date.toString();
}

function convertIndentedCodeBlocks(text: string, language: string): string {
  const lines = splitLines(text);
  const next: string[] = [];
  let index = 0;
  let inFence = false;
  let fenceMarker = "";

  while (index < lines.length) {
    const trimmed = lines[index].trim();
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
      next.push(lines[index]);
      index += 1;
      continue;
    }

    if (!inFence && isIndentedCodeLine(lines[index])) {
      const block: string[] = [];
      while (index < lines.length && (isIndentedCodeLine(lines[index]) || lines[index].trim() === "")) {
        block.push(lines[index].replace(/^( {4}|\t)/, ""));
        index += 1;
      }
      while (block.length > 0 && block[block.length - 1].trim() === "") {
        block.pop();
      }
      next.push(`\`\`\`${language}`, ...block, "```");
      continue;
    }

    next.push(lines[index]);
    index += 1;
  }

  return joinLines(next, text);
}

function formatFencedCodeBlocks(text: string, options: Record<string, unknown>): string {
  const lines = splitLines(text);
  const next: string[] = [];
  let index = 0;

  while (index < lines.length) {
    const opening = lines[index].match(FENCE_START);
    if (!opening) {
      next.push(lines[index]);
      index += 1;
      continue;
    }

    const fence = opening[2];
    const marker = fence[0];
    const language = opening[3].toLowerCase();
    const blockLines = [lines[index]];
    index += 1;
    const code: string[] = [];

    while (index < lines.length && !lines[index].trim().startsWith(marker.repeat(fence.length))) {
      code.push(lines[index]);
      index += 1;
    }

    if (index < lines.length) {
      const formatted = beautifyCode(language, code.join("\n"), options);
      blockLines.push(...formatted.split("\n"));
      blockLines.push(lines[index]);
      index += 1;
      next.push(...blockLines);
    } else {
      next.push(...blockLines, ...code);
    }
  }

  return joinLines(next, text);
}

function beautifyCode(language: string, code: string, options: Record<string, unknown>): string {
  const beautifyOptions = options as js_beautify.JSBeautifyOptions;
  if (language === "js" || language === "javascript") {
    return beautify.js(code, beautifyOptions).replace(/\n$/, "");
  }
  if (language === "html") {
    return beautify.html(code, beautifyOptions as js_beautify.HTMLBeautifyOptions).replace(/\n$/, "");
  }
  if (language === "css") {
    return beautify.css(code, beautifyOptions as js_beautify.CSSBeautifyOptions).replace(/\n$/, "");
  }
  return code;
}

function protectFencedCodeBlocks(text: string): ProtectResult {
  const lines = splitLines(text);
  const blocks: ProtectedBlock[] = [];
  const next: string[] = [];
  let index = 0;

  while (index < lines.length) {
    const opening = lines[index].match(FENCE_START);
    if (!opening) {
      next.push(lines[index]);
      index += 1;
      continue;
    }

    const marker = opening[2][0];
    const fenceLength = opening[2].length;
    const block = [lines[index]];
    index += 1;
    while (index < lines.length) {
      block.push(lines[index]);
      const closesFence = lines[index].trim().startsWith(marker.repeat(fenceLength));
      index += 1;
      if (closesFence) {
        break;
      }
    }

    const token = makeToken("fence", blocks.length);
    blocks.push({ token, value: block.join("\n") });
    next.push(token);
  }

  return { text: joinLines(next, text), blocks };
}

function protectPattern(text: string, pattern: RegExp, prefix: string): ProtectResult {
  const blocks: ProtectedBlock[] = [];
  const next = text.replace(pattern, (value) => {
    const token = makeToken(prefix, blocks.length);
    blocks.push({ token, value });
    return token;
  });
  return { text: next, blocks };
}

function restoreProtected(text: string, blocks: ProtectedBlock[]): string {
  let current = text;
  for (const block of blocks) {
    current = current.replace(new RegExp(escapeRegExp(block.token), "g"), block.value);
  }
  return current;
}

function makeToken(prefix: string, index: number): string {
  return `\u0000SUPER_MARKDOWN_${prefix}_${index}\u0000`;
}

function normalizeListLine(line: string, settings: Pick<FormatSettings, "list">): string {
  const taskMatch = line.match(/^(\s*)([-*+]|\d+[.)])\s*\[([ xX])\]\s*(.*)$/);
  if (taskMatch) {
    const marker = normalizeUnorderedMarker(taskMatch[1], taskMatch[2], settings);
    const checkbox = taskMatch[3].toLowerCase() === "x" ? "x" : " ";
    const content = taskMatch[4].trimStart();
    return `${taskMatch[1]}${marker} [${checkbox}]${content ? ` ${content}` : ""}`;
  }

  const unorderedMatch = line.match(/^(\s*)([-*+])\s+(.+)$/);
  if (unorderedMatch) {
    const marker = normalizeUnorderedMarker(unorderedMatch[1], unorderedMatch[2], settings);
    return `${unorderedMatch[1]}${marker} ${unorderedMatch[3].trimStart()}`;
  }

  const orderedMatch = line.match(/^(\s*)(\d+)([.)])\s+(.+)$/);
  if (orderedMatch) {
    return `${orderedMatch[1]}${orderedMatch[2]}${orderedMatch[3]} ${orderedMatch[4].trimStart()}`;
  }

  return line;
}

function normalizeUnorderedMarker(indent: string, marker: string, settings: Pick<FormatSettings, "list">): string {
  if (settings.list.markerStyle !== "cycle" || settings.list.markerCycle.length === 0 || /^\d/.test(marker)) {
    return marker;
  }
  const level = Math.max(0, Math.floor(indent.replace(/\t/g, "  ").length / 2));
  return settings.list.markerCycle[level % settings.list.markerCycle.length] ?? marker;
}

function padOrderedListNumbers(lines: string[]): string[] {
  const next = [...lines];
  let index = 0;

  while (index < next.length) {
    const blockStart = index;
    const block: number[] = [];
    while (index < next.length) {
      const match = next[index].match(/^(\s*)(\d+)([.)])\s+/);
      if (!match) {
        break;
      }
      block.push(index);
      index += 1;
    }

    if (block.length > 0) {
      const maxLength = Math.max(...block.map((lineIndex) => next[lineIndex].match(/^(\s*)(\d+)([.)])\s+/)?.[2].length ?? 0));
      if (maxLength > 1) {
        for (const lineIndex of block) {
          next[lineIndex] = next[lineIndex].replace(/^(\s*)(\d+)([.)])\s+/, (_match, indent, number, suffix) => {
            return `${indent}${number.padStart(maxLength, "0")}${suffix} `;
          });
        }
      }
    }

    index = block.length > 0 ? index : blockStart + 1;
  }

  return next;
}

function isTableStart(lines: string[], index: number): boolean {
  const current = stripQuotePrefix(lines[index] ?? "");
  const next = stripQuotePrefix(lines[index + 1] ?? "");
  return Boolean(current && next && isPipeRow(current) && isSeparatorRow(next));
}

function isPipeRow(line: string): boolean {
  return line.includes("|") && splitTableRow(line).length > 1;
}

function isSeparatorRow(line: string): boolean {
  const cells = splitTableRow(line);
  return cells.length > 1 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.trim()));
}

function formatTable(rows: string[], cjkCharWidth: number): string[] {
  const indent = rows[0].match(/^\s*/)?.[0] ?? "";
  const parsedRows = rows.map(splitTableRow);
  const columnCount = Math.max(...parsedRows.map((row) => row.length));
  const normalizedRows = parsedRows.map((row) => [...row, ...Array<string>(columnCount - row.length).fill("")]);
  const alignments = normalizedRows[1].map(parseAlignment);
  const widths = Array.from({ length: columnCount }, (_, column) =>
    Math.max(...normalizedRows.map((row) => displayLength(row[column], cjkCharWidth)))
  );

  return normalizedRows.map((row, rowIndex) => {
    if (rowIndex === 1) {
      return formatSeparatorRow(widths, alignments, indent);
    }
    return `${indent}| ${row.map((cell, column) => padCell(cell, widths[column], alignments[column], cjkCharWidth)).join(" | ")} |`;
  });
}

function splitTableRow(row: string): string[] {
  const trimmed = row.trim();
  const withoutEdges = trimmed.replace(/^\|/, "").replace(/\|$/, "");
  return withoutEdges.split("|").map((cell) => cell.trim());
}

function parseAlignment(separator: string): Alignment {
  const trimmed = separator.trim();
  if (trimmed.startsWith(":") && trimmed.endsWith(":")) {
    return "center";
  }
  if (trimmed.endsWith(":")) {
    return "right";
  }
  return "left";
}

function formatSeparatorRow(widths: number[], alignments: Alignment[], indent: string): string {
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

function padCell(cell: string, width: number, alignment: Alignment, cjkCharWidth: number): string {
  const padding = Math.max(0, width - displayLength(cell, cjkCharWidth));
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

function displayLength(value: string, cjkCharWidth: number): number {
  return Array.from(value).reduce((length, char) => length + (isCjk(char) ? cjkCharWidth : 1), 0);
}

function mapNonFenceLines(text: string, mapper: (line: string) => string): string {
  const lines = splitLines(text);
  const next: string[] = [];
  let inFence = false;
  let fenceMarker = "";

  for (const line of lines) {
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
      next.push(line);
      continue;
    }

    next.push(inFence ? line : mapper(line));
  }

  return joinLines(next, text);
}

function getQuotePrefix(line: string): string {
  return line.match(/^(\s*(?:>\s*)*)/)?.[1] ?? "";
}

function stripQuotePrefix(line: string): string {
  return line.slice(getQuotePrefix(line).length);
}

function previousVisibleChar(value: string): string {
  return value.match(/\S(?=\s*$)/)?.[0] ?? "";
}

function isCjk(value: string): boolean {
  return /[\u3400-\u9fff]/.test(value);
}

function isAsciiWord(value: string): boolean {
  return /[A-Za-z0-9]/.test(value);
}

function isIndentedCodeLine(line: string): boolean {
  return /^( {4}|\t)\S/.test(line) && !/^\s*(?:[-*+]|\d+[.)])\s+/.test(line);
}

function isFenceBoundary(line: string): boolean {
  return /^\s*(```+|~~~+)/.test(line);
}

function isBlockQuoteStart(line: string): boolean {
  return /^\s*>/.test(line);
}

function isListStart(line: string): boolean {
  return /^\s*(?:[-*+]|\d+[.)])\s+/.test(line);
}

function defaultTableSettings(): Pick<FormatSettings, "table"> {
  return { table: { enabled: true, cjkCharWidth: 2 } };
}

function defaultListSettings(): Pick<FormatSettings, "list"> {
  return { list: { markerStyle: "preserve", markerCycle: ["*", "+", "-"], padOrderedNumbers: true } };
}

function detectEol(text: string): "\n" | "\r\n" {
  return text.includes("\r\n") ? "\r\n" : "\n";
}

function restoreEol(text: string, eol: "\n" | "\r\n"): string {
  return eol === "\n" ? text : text.replace(/\n/g, eol);
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
