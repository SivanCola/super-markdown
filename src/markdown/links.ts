import { parseMarkdownBlocks, type MarkdownBlock } from "./block";
import { extractInlineLinks, type InlineLink } from "./inline";

export function extractMarkdownInlineLinks(markdown: string): InlineLink[] {
  const links: InlineLink[] = [];
  for (const block of parseMarkdownBlocks(markdown).nodes) {
    collectBlockLinks(block, links);
  }
  return links;
}

function collectBlockLinks(block: MarkdownBlock, links: InlineLink[]): void {
  switch (block.type) {
    case "heading":
    case "paragraph":
    case "footnote":
      links.push(...extractInlineLinks(block.text));
      return;
    case "list":
      for (const item of block.items) {
        links.push(...extractInlineLinks(item.text));
      }
      return;
    case "blockquote":
      links.push(...extractMarkdownInlineLinks(block.text));
      return;
    case "table":
      for (const cell of [...block.headers, ...block.rows.flat()]) {
        links.push(...extractInlineLinks(cell));
      }
      return;
    case "code":
    case "math":
    case "mermaid":
    case "hr":
      return;
  }
}
