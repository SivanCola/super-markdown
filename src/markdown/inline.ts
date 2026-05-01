import { isSafeInlineHtmlTag, type SafeInlineHtmlTag } from "./features";

export type InlineToken =
  | { type: "text"; value: string }
  | { type: "code"; value: string }
  | { type: "strong"; children: InlineToken[] }
  | { type: "emphasis"; children: InlineToken[] }
  | { type: "delete"; children: InlineToken[] }
  | { type: "underline"; children: InlineToken[] }
  | { type: "mark"; children: InlineToken[] }
  | { type: "kbd"; children: InlineToken[] }
  | { type: "math"; value: string }
  | { type: "footnote"; id: string }
  | LinkToken
  | ImageToken;

export interface LinkToken {
  type: "link";
  label: string;
  destination: string;
  title?: string;
  children: InlineToken[];
}

export interface ImageToken {
  type: "image";
  alt: string;
  destination: string;
  title?: string;
}

export interface InlineLink {
  image: boolean;
  label: string;
  destination: string;
  title?: string;
}

export function parseInlineMarkdown(markdown: string): InlineToken[] {
  const source = String(markdown || "");
  const tokens: InlineToken[] = [];
  let buffer = "";
  let index = 0;

  function pushText(): void {
    if (buffer) {
      tokens.push({ type: "text", value: buffer });
      buffer = "";
    }
  }

  while (index < source.length) {
    if (source[index] === "\\" && index + 1 < source.length) {
      buffer += source[index + 1];
      index += 2;
      continue;
    }

    const linked = parseLinkOrImage(source, index);
    if (linked) {
      pushText();
      tokens.push(linked.token);
      index = linked.end;
      continue;
    }

    const safeHtml = parseSafeHtmlInline(source, index);
    if (safeHtml) {
      pushText();
      tokens.push(safeHtml.token);
      index = safeHtml.end;
      continue;
    }

    if (source[index] === "`") {
      const end = findUnescaped(source, "`", index + 1);
      if (end > index + 1) {
        pushText();
        tokens.push({ type: "code", value: source.slice(index + 1, end) });
        index = end + 1;
        continue;
      }
    }

    if (source.startsWith("**", index)) {
      const strong = parseDelimited(source, index, "**", "strong");
      if (strong) {
        pushText();
        tokens.push(strong.token);
        index = strong.end;
        continue;
      }
    }

    if (source.startsWith("__", index)) {
      const strong = parseDelimited(source, index, "__", "strong");
      if (strong) {
        pushText();
        tokens.push(strong.token);
        index = strong.end;
        continue;
      }
    }

    if (source.startsWith("~~", index)) {
      const deleted = parseDelimited(source, index, "~~", "delete");
      if (deleted) {
        pushText();
        tokens.push(deleted.token);
        index = deleted.end;
        continue;
      }
    }

    if (source[index] === "*" && source[index + 1] !== "*") {
      const emphasis = parseDelimited(source, index, "*", "emphasis");
      if (emphasis) {
        pushText();
        tokens.push(emphasis.token);
        index = emphasis.end;
        continue;
      }
    }

    if (source[index] === "_" && source[index + 1] !== "_") {
      const emphasis = parseDelimited(source, index, "_", "emphasis");
      if (emphasis) {
        pushText();
        tokens.push(emphasis.token);
        index = emphasis.end;
        continue;
      }
    }

    if (source[index] === "$" && source[index + 1] !== "$") {
      const end = findUnescaped(source, "$", index + 1);
      if (end > index + 1 && !source.slice(index + 1, end).includes("\n")) {
        pushText();
        tokens.push({ type: "math", value: source.slice(index + 1, end) });
        index = end + 1;
        continue;
      }
    }

    if (source.startsWith("[^", index)) {
      const end = findUnescaped(source, "]", index + 2);
      if (end > index + 2) {
        pushText();
        tokens.push({ type: "footnote", id: source.slice(index + 2, end) });
        index = end + 1;
        continue;
      }
    }

    buffer += source[index];
    index += 1;
  }

  pushText();
  return tokens;
}

export function inlineTokensToPlainText(tokens: readonly InlineToken[]): string {
  return tokens.map((token) => {
    switch (token.type) {
      case "text":
      case "code":
      case "math":
        return token.value;
      case "image":
        return token.alt;
      case "link":
      case "strong":
      case "emphasis":
      case "delete":
      case "underline":
      case "mark":
      case "kbd":
        return inlineTokensToPlainText(token.children);
      case "footnote":
        return token.id;
    }
  }).join("");
}

export function stripInlineMarkdown(markdown: string): string {
  return inlineTokensToPlainText(parseInlineMarkdown(markdown)).replace(/<[^>]+>/g, "").replace(/[*_~]/g, "");
}

export function extractInlineLinks(markdown: string): InlineLink[] {
  const links: InlineLink[] = [];
  visitInlineTokens(parseInlineMarkdown(markdown), (token) => {
    if (token.type === "image") {
      links.push({ image: true, label: token.alt, destination: token.destination, title: token.title });
    }
    if (token.type === "link") {
      links.push({ image: false, label: token.label, destination: token.destination, title: token.title });
    }
  });
  return links;
}

function visitInlineTokens(tokens: readonly InlineToken[], visitor: (token: InlineToken) => void): void {
  for (const token of tokens) {
    visitor(token);
    if ("children" in token) {
      visitInlineTokens(token.children, visitor);
    }
  }
}

function parseDelimited(
  source: string,
  start: number,
  delimiter: string,
  type: "strong" | "emphasis" | "delete"
): { token: InlineToken; end: number } | null {
  const end = findUnescaped(source, delimiter, start + delimiter.length);
  if (end <= start + delimiter.length) {
    return null;
  }
  return {
    token: { type, children: parseInlineMarkdown(source.slice(start + delimiter.length, end)) } as InlineToken,
    end: end + delimiter.length
  };
}

function parseSafeHtmlInline(source: string, start: number): { token: InlineToken; end: number } | null {
  const opened = source.slice(start).match(/^<([a-z][a-z0-9-]*)>/i);
  if (!opened) {
    return null;
  }
  const tag = opened[1].toLowerCase();
  if (!isSafeInlineHtmlTag(tag)) {
    return null;
  }
  const openTag = opened[0];
  const closeTag = `</${tag}>`;
  const closeIndex = source.toLowerCase().indexOf(closeTag, start + openTag.length);
  if (closeIndex <= start + openTag.length) {
    return null;
  }
  const inner = source.slice(start + openTag.length, closeIndex);
  return {
    token: {
      type: safeInlineHtmlTagToTokenType(tag),
      children: parseInlineMarkdown(inner)
    } as InlineToken,
    end: closeIndex + closeTag.length
  };
}

function safeInlineHtmlTagToTokenType(tag: SafeInlineHtmlTag): "underline" | "mark" | "kbd" {
  return tag === "u" ? "underline" : tag;
}

function parseLinkOrImage(source: string, start: number): { token: InlineToken; end: number } | null {
  const image = source.startsWith("![", start);
  if (!image && source[start] !== "[") {
    return null;
  }
  const labelStart = start + (image ? 2 : 1);
  const labelEnd = findBalancedBracket(source, labelStart);
  if (labelEnd < 0 || source[labelEnd + 1] !== "(") {
    return null;
  }
  const target = parseLinkTarget(source, labelEnd + 2);
  if (!target) {
    return null;
  }
  const label = unescapeMarkdown(source.slice(labelStart, labelEnd));
  if (image) {
    return {
      token: { type: "image", alt: label, destination: target.destination, title: target.title },
      end: target.end
    };
  }
  return {
    token: {
      type: "link",
      label,
      destination: target.destination,
      title: target.title,
      children: parseInlineMarkdown(label)
    },
    end: target.end
  };
}

function parseLinkTarget(source: string, start: number): { destination: string; title?: string; end: number } | null {
  let index = skipSpaces(source, start);
  let destination = "";

  if (source[index] === "<") {
    index += 1;
    const end = findUnescaped(source, ">", index);
    if (end < 0) {
      return null;
    }
    destination = source.slice(index, end);
    index = end + 1;
  } else {
    let depth = 0;
    while (index < source.length) {
      const char = source[index];
      if (char === "\\") {
        destination += source[index + 1] ?? "";
        index += 2;
        continue;
      }
      if (char === "(") {
        depth += 1;
        destination += char;
        index += 1;
        continue;
      }
      if (char === ")") {
        if (depth === 0) {
          break;
        }
        depth -= 1;
        destination += char;
        index += 1;
        continue;
      }
      if (/\s/.test(char) && depth === 0) {
        break;
      }
      destination += char;
      index += 1;
    }
  }

  destination = unescapeMarkdown(destination.trim());
  if (!destination) {
    return null;
  }

  index = skipSpaces(source, index);
  if (source[index] === ")") {
    return { destination, end: index + 1 };
  }

  const title = parseLinkTitle(source, index);
  if (!title) {
    return null;
  }
  index = skipSpaces(source, title.end);
  if (source[index] !== ")") {
    return null;
  }
  return { destination, title: title.value, end: index + 1 };
}

function parseLinkTitle(source: string, start: number): { value: string; end: number } | null {
  const delimiter = source[start];
  if (delimiter === "\"" || delimiter === "'") {
    const end = findUnescaped(source, delimiter, start + 1);
    return end < 0 ? null : { value: unescapeMarkdown(source.slice(start + 1, end)), end: end + 1 };
  }
  if (delimiter !== "(") {
    return null;
  }
  let depth = 0;
  let index = start + 1;
  while (index < source.length) {
    const char = source[index];
    if (char === "\\") {
      index += 2;
      continue;
    }
    if (char === "(") {
      depth += 1;
    } else if (char === ")") {
      if (depth === 0) {
        return { value: unescapeMarkdown(source.slice(start + 1, index)), end: index + 1 };
      }
      depth -= 1;
    }
    index += 1;
  }
  return null;
}

function findBalancedBracket(source: string, start: number): number {
  let depth = 0;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (char === "\\") {
      index += 1;
      continue;
    }
    if (char === "[") {
      depth += 1;
    } else if (char === "]") {
      if (depth === 0) {
        return index;
      }
      depth -= 1;
    }
  }
  return -1;
}

function findUnescaped(source: string, pattern: string, start: number): number {
  for (let index = start; index <= source.length - pattern.length; index += 1) {
    if (source[index] === "\\") {
      index += 1;
      continue;
    }
    if (source.startsWith(pattern, index)) {
      return index;
    }
  }
  return -1;
}

function skipSpaces(source: string, start: number): number {
  let index = start;
  while (index < source.length && /\s/.test(source[index])) {
    index += 1;
  }
  return index;
}

function unescapeMarkdown(value: string): string {
  return value.replace(/\\([\\`*_[\](){}#+\-.!|>])/g, "$1");
}
