import { displayWidth, escapeMarkdownTableCell, isMarkdownTableDelimiter, splitMarkdownTableRow } from "./table";

export { splitMarkdownTableRow } from "./table";

export function createMarkdownTable(rows: number, columns: number): string {
  const rowCount = normalizeTableDimension(rows);
  const columnCount = normalizeTableDimension(columns);
  const headers = Array.from({ length: columnCount }, (_, index) => `Column ${index + 1}`);
  const separator = Array.from({ length: columnCount }, () => "---");
  const emptyRow = Array.from({ length: columnCount }, () => "");
  const bodyRows = Array.from({ length: Math.max(0, rowCount - 1) }, () => formatSimpleRow(emptyRow));

  return [
    formatSimpleRow(headers),
    formatSimpleRow(separator),
    ...bodyRows
  ].join("\n");
}

export function mdTableToJson(text: string): Array<Record<string, string | null>> {
  const lines = text
    .trim()
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2 || !isMarkdownTableDelimiter(lines[1])) {
    throw new Error("Selection is not a Markdown table.");
  }

  const headers = splitMarkdownTableRow(lines[0]);
  if (headers.length === 0) {
    throw new Error("Markdown table has no headers.");
  }

  return lines.slice(2).map((line) => {
    const cells = splitMarkdownTableRow(line);
    return headers.reduce<Record<string, string | null>>((record, header, index) => {
      record[header] = cells[index] ?? null;
      return record;
    }, {});
  });
}

export function jsonToMarkdownTable(value: unknown): string {
  if (!Array.isArray(value)) {
    throw new Error("Selection is not a JSON array.");
  }
  if (value.length === 0) {
    throw new Error("JSON array is empty.");
  }
  if (!value.every(isPlainRecord)) {
    throw new Error("JSON array items must be objects.");
  }

  const headers = Array.from(
    value.reduce<Set<string>>((keys, item) => {
      Object.keys(item).forEach((key) => keys.add(key));
      return keys;
    }, new Set<string>())
  );

  if (headers.length === 0) {
    throw new Error("JSON objects have no keys.");
  }

  const rows = value.map((item) => headers.map((header) => stringifyCell(item[header])));
  const widths = headers.map((header, index) =>
    Math.max(displayLength(header), ...rows.map((row) => displayLength(row[index])))
  );

  const headerRow = formatCenteredRow(headers, widths);
  const separatorRow = `| ${widths.map((width) => "-".repeat(Math.max(3, width))).join(" | ")} |`;
  return [headerRow, separatorRow, ...rows.map((row) => formatCenteredRow(row, widths))].join("\n");
}

function formatSimpleRow(cells: string[]): string {
  return `| ${cells.join(" | ")} |`;
}

function normalizeTableDimension(value: number): number {
  return Number.isInteger(value) && value > 0 ? value : 1;
}

function formatCenteredRow(cells: string[], widths: number[]): string {
  return `| ${cells.map((cell, index) => padCentered(cell, widths[index])).join(" | ")} |`;
}

function padCentered(value: string, width: number): string {
  const padding = Math.max(0, width - displayLength(value));
  const left = Math.floor(padding / 2);
  const right = padding - left;
  return `${" ".repeat(left)}${value}${" ".repeat(right)}`;
}

function stringifyCell(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "object") {
    return escapeMarkdownTableCell(JSON.stringify(value));
  }
  return escapeMarkdownTableCell(String(value));
}

function displayLength(value: string): number {
  return displayWidth(value);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
