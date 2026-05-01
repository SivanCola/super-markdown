export type TableAlignment = "left" | "center" | "right";

export interface MarkdownTable {
  headers: string[];
  aligns: Array<TableAlignment | undefined>;
  rows: string[][];
}

export interface ParsedMarkdownTable {
  table: MarkdownTable;
  raw: string;
  nextLine: number;
}

export function splitMarkdownTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  const cells: string[] = [];
  let current = "";
  let inlineCodeDelimiter = "";
  let escaped = false;

  for (const char of trimmed) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }

    if (char === "\\") {
      current += char;
      escaped = true;
      continue;
    }

    if (char === "`") {
      inlineCodeDelimiter = inlineCodeDelimiter ? "" : "`";
      current += char;
      continue;
    }

    if (char === "|" && !inlineCodeDelimiter) {
      cells.push(unescapeMarkdownTableCell(current.trim()));
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(unescapeMarkdownTableCell(current.trim()));
  return cells;
}

export function isMarkdownTableRow(line: string): boolean {
  return line.includes("|") && splitMarkdownTableRow(line).length > 1;
}

export function isMarkdownTableDelimiter(line: string): boolean {
  const cells = splitMarkdownTableRow(line);
  return cells.length > 1 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.trim()));
}

export function isMarkdownTableStart(lines: readonly string[], index: number): boolean {
  return Boolean(lines[index] && lines[index + 1] && isMarkdownTableRow(lines[index]) && isMarkdownTableDelimiter(lines[index + 1]));
}

export function parseTableAlignment(value: string): TableAlignment | undefined {
  const trimmed = value.trim();
  if (trimmed.startsWith(":") && trimmed.endsWith(":")) {
    return "center";
  }
  if (trimmed.endsWith(":")) {
    return "right";
  }
  if (trimmed.startsWith(":")) {
    return "left";
  }
  return undefined;
}

export function parseMarkdownTableAt(lines: readonly string[], index: number): ParsedMarkdownTable | null {
  if (!isMarkdownTableStart(lines, index)) {
    return null;
  }

  const start = index;
  const headers = splitMarkdownTableRow(lines[index]);
  const aligns = splitMarkdownTableRow(lines[index + 1]).map(parseTableAlignment);
  const rows: string[][] = [];
  index += 2;

  while (index < lines.length && isMarkdownTableRow(lines[index])) {
    rows.push(splitMarkdownTableRow(lines[index]));
    index += 1;
  }

  return {
    table: { headers, aligns, rows },
    raw: lines.slice(start, index).join("\n"),
    nextLine: index
  };
}

export function serializeMarkdownTable(table: MarkdownTable): string {
  const delimiter = table.headers.map((_header, index) => alignmentDelimiter(table.aligns[index]));
  return [table.headers, delimiter, ...table.rows]
    .map((row) => `| ${row.map(escapeMarkdownTableCell).join(" | ")} |`)
    .join("\n");
}

export function formatMarkdownTableRows(rows: readonly string[], cjkCharWidth: number): string[] {
  const indent = rows[0]?.match(/^\s*/)?.[0] ?? "";
  const parsedRows = rows.map(splitMarkdownTableRow);
  const columnCount = Math.max(...parsedRows.map((row) => row.length));
  const normalizedRows = parsedRows.map((row) => [...row, ...Array<string>(columnCount - row.length).fill("")]);
  const alignments = normalizedRows[1].map(parseTableAlignment);
  const widths = Array.from({ length: columnCount }, (_value, column) =>
    Math.max(...normalizedRows.map((row) => displayWidth(row[column], cjkCharWidth)))
  );

  return normalizedRows.map((row, rowIndex) => {
    if (rowIndex === 1) {
      return formatSeparatorRow(widths, alignments, indent);
    }
    return `${indent}| ${row.map((cell, column) => padTableCell(cell, widths[column], alignments[column], cjkCharWidth)).join(" | ")} |`;
  });
}

export function escapeMarkdownTableCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>");
}

export function unescapeMarkdownTableCell(value: string): string {
  return value.replace(/\\\|/g, "|");
}

export function displayWidth(value: string, cjkCharWidth = 2): number {
  return Array.from(value).reduce((length, char) => length + (/[\u3400-\u9fff]/.test(char) ? cjkCharWidth : 1), 0);
}

function alignmentDelimiter(alignment: TableAlignment | undefined): string {
  if (alignment === "center") {
    return ":---:";
  }
  if (alignment === "right") {
    return "---:";
  }
  if (alignment === "left") {
    return ":---";
  }
  return "---";
}

function formatSeparatorRow(widths: number[], alignments: Array<TableAlignment | undefined>, indent: string): string {
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

function padTableCell(cell: string, width: number, alignment: TableAlignment | undefined, cjkCharWidth: number): string {
  const padding = Math.max(0, width - displayWidth(cell, cjkCharWidth));
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
