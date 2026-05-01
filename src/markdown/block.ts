import { GithubSlugger } from "./slug";
import { isMarkdownTableRow, parseMarkdownTableAt, type TableAlignment } from "./table";

export type MarkdownBlock =
  | HeadingBlock
  | ParagraphBlock
  | ListBlock
  | BlockquoteBlock
  | CodeBlock
  | MathBlock
  | MermaidBlock
  | TableBlock
  | HorizontalRuleBlock
  | FootnoteBlock;

export interface BaseBlock {
  type: MarkdownBlock["type"];
  line: number;
  raw: string;
}

export interface HeadingBlock extends BaseBlock {
  type: "heading";
  level: number;
  text: string;
  slug: string;
}

export interface ParagraphBlock extends BaseBlock {
  type: "paragraph";
  text: string;
}

export interface ListBlock extends BaseBlock {
  type: "list";
  ordered: boolean;
  items: Array<{
    text: string;
    checked?: boolean;
    line: number;
  }>;
}

export interface BlockquoteBlock extends BaseBlock {
  type: "blockquote";
  text: string;
}

export interface CodeBlock extends BaseBlock {
  type: "code";
  language: string;
  code: string;
}

export interface MathBlock extends BaseBlock {
  type: "math";
  expression: string;
}

export interface MermaidBlock extends BaseBlock {
  type: "mermaid";
  code: string;
}

export interface TableBlock extends BaseBlock {
  type: "table";
  headers: string[];
  aligns: Array<TableAlignment | undefined>;
  rows: string[][];
}

export interface HorizontalRuleBlock extends BaseBlock {
  type: "hr";
}

export interface FootnoteBlock extends BaseBlock {
  type: "footnote";
  id: string;
  text: string;
}

export interface MarkdownDocument {
  nodes: MarkdownBlock[];
  footnotes: Map<string, string>;
}

export function parseMarkdownBlocks(text: string): MarkdownDocument {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n");
  const slugger = new GithubSlugger();
  const nodes: MarkdownBlock[] = [];
  const footnotes = new Map<string, string>();
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    const fence = line.match(/^(\s*)(```+|~~~+)\s*([^\s`]*)?.*$/);
    if (fence) {
      const marker = fence[2];
      const language = (fence[3] ?? "").trim().toLowerCase();
      const start = index;
      const content: string[] = [];
      index += 1;
      while (index < lines.length && !isClosingFence(lines[index], marker)) {
        content.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) {
        index += 1;
      }
      const raw = lines.slice(start, index).join("\n");
      if (language === "mermaid") {
        nodes.push({ type: "mermaid", line: start, raw, code: content.join("\n") });
      } else {
        nodes.push({ type: "code", line: start, raw, language, code: content.join("\n") });
      }
      continue;
    }

    if (trimmed === "$$") {
      const start = index;
      const content: string[] = [];
      index += 1;
      while (index < lines.length && lines[index].trim() !== "$$") {
        content.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) {
        index += 1;
      }
      nodes.push({
        type: "math",
        line: start,
        raw: lines.slice(start, index).join("\n"),
        expression: content.join("\n")
      });
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+?)\s*#*$/);
    if (heading) {
      const textValue = heading[2].trim();
      nodes.push({
        type: "heading",
        line: index,
        raw: line,
        level: heading[1].length,
        text: textValue,
        slug: slugger.slug(textValue)
      });
      index += 1;
      continue;
    }

    if (/^ {0,3}([-*_])(?:\s*\1){2,}\s*$/.test(line)) {
      nodes.push({ type: "hr", line: index, raw: line });
      index += 1;
      continue;
    }

    const footnote = line.match(/^\[\^([^\]]+)]:\s*(.*)$/);
    if (footnote) {
      const value = footnote[2];
      footnotes.set(footnote[1], value);
      nodes.push({ type: "footnote", line: index, raw: line, id: footnote[1], text: value });
      index += 1;
      continue;
    }

    const table = parseMarkdownTableAt(lines, index);
    if (table) {
      nodes.push({
        type: "table",
        line: index,
        raw: table.raw,
        headers: table.table.headers,
        aligns: table.table.aligns,
        rows: table.table.rows
      });
      index = table.nextLine;
      continue;
    }

    const listMatch = line.match(/^(\s*)([-+*]|\d+[.)])\s+(?:\[([ xX])]\s+)?(.*)$/);
    if (listMatch) {
      const start = index;
      const ordered = /\d/.test(listMatch[2]);
      const items: ListBlock["items"] = [];
      while (index < lines.length) {
        const item = lines[index].match(/^(\s*)([-+*]|\d+[.)])\s+(?:\[([ xX])]\s+)?(.*)$/);
        if (!item || /\d/.test(item[2]) !== ordered) {
          break;
        }
        items.push({
          text: item[4],
          checked: item[3] ? item[3].toLowerCase() === "x" : undefined,
          line: index
        });
        index += 1;
      }
      nodes.push({ type: "list", line: start, raw: lines.slice(start, index).join("\n"), ordered, items });
      continue;
    }

    if (/^>\s?/.test(line)) {
      const start = index;
      const content: string[] = [];
      while (index < lines.length && /^>\s?/.test(lines[index])) {
        content.push(lines[index].replace(/^>\s?/, ""));
        index += 1;
      }
      nodes.push({ type: "blockquote", line: start, raw: lines.slice(start, index).join("\n"), text: content.join("\n") });
      continue;
    }

    const start = index;
    const content: string[] = [];
    while (index < lines.length && lines[index].trim() && !isBlockStart(lines, index)) {
      content.push(lines[index]);
      index += 1;
    }
    nodes.push({
      type: "paragraph",
      line: start,
      raw: lines.slice(start, index).join("\n"),
      text: content.join("\n")
    });
  }

  return { nodes, footnotes };
}

function isBlockStart(lines: string[], index: number): boolean {
  const line = lines[index];
  const trimmed = line.trim();
  return /^(#{1,6})\s+/.test(line) ||
    /^(\s*)(```+|~~~+)/.test(line) ||
    trimmed === "$$" ||
    /^ {0,3}([-*_])(?:\s*\1){2,}\s*$/.test(line) ||
    /^\[\^([^\]]+)]:\s*/.test(line) ||
    parseMarkdownTableAt(lines, index) !== null ||
    /^(\s*)([-+*]|\d+[.)])\s+/.test(line) ||
    /^>\s?/.test(line);
}

function isClosingFence(line: string, openingMarker: string): boolean {
  const match = line.match(/^ {0,3}(```+|~~~+)\s*$/);
  return Boolean(match && match[1][0] === openingMarker[0] && match[1].length >= openingMarker.length);
}

export function isMarkdownBlockTableRow(line: string): boolean {
  return isMarkdownTableRow(line);
}
