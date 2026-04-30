import * as fs from "node:fs";
import * as path from "node:path";
import type MarkdownIt from "markdown-it";

const INCLUDE_PATTERN = /:\[[^\]]*]\(\s*([^)]+?)\s*\)/g;

export function markdownItInclude(md: MarkdownIt, options: { root: string }): void {
  md.core.ruler.before("normalize", "super_markdown_include", (state) => {
    state.src = expandIncludes(state.src, options.root, []);
  });
}

export function expandIncludes(text: string, root: string, seen: string[]): string {
  return protectCodeRegions(text, (plain) =>
    plain.replace(INCLUDE_PATTERN, (_match, includePath: string) => {
      const filename = path.resolve(root, includePath.trim());
      if (seen.includes(filename)) {
        return `\n\n# INCLUDE ERROR: Circular include ${filename}\n\n`;
      }
      if (!fs.existsSync(filename)) {
        return `\n\n# INCLUDE ERROR: File not found ${filename}\n\n`;
      }
      const content = fs.readFileSync(filename, "utf8");
      return expandIncludes(content.replace(/\n$/, ""), path.dirname(filename), [...seen, filename]);
    })
  );
}

function protectCodeRegions(text: string, mapper: (plain: string) => string): string {
  const fence = /^(```+|~~~+)/gm;
  let result = "";
  let last = 0;
  let opening: RegExpExecArray | null;

  while ((opening = fence.exec(text)) !== null) {
    result += mapper(text.slice(last, opening.index));
    const marker = opening[1][0];
    const length = opening[1].length;
    const closing = new RegExp(`^${marker === "`" ? "`" : "~"}{${length},}\\s*$`, "gm");
    closing.lastIndex = fence.lastIndex;
    const close = closing.exec(text);
    const end = close ? close.index + close[0].length : text.length;
    result += text.slice(opening.index, end);
    last = end;
    fence.lastIndex = end;
  }

  return result + mapper(text.slice(last));
}
