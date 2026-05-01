import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildCodeCopyScript } from "../markdown/codeCopy";
import { renderMarkdownCore } from "../markdown/core";
import { escapeHtml } from "../utils/html";
import { ExportSettings, ExportType } from "../types";
import { parseFrontMatter, resolveStylePath, rewriteImageSource } from "./utils";

export interface RenderExportHtmlOptions {
  markdown: string;
  sourcePath: string;
  outputPath?: string;
  extensionPath: string;
  settings: ExportSettings;
  type: ExportType;
}

export async function renderExportHtml(options: RenderExportHtmlOptions): Promise<string> {
  const matter = parseFrontMatter(options.markdown);
  const title = getFrontMatterString(matter.data, "title") || path.basename(options.sourcePath);
  const content = await renderMarkdownCore(matter.content, {
    mermaidEnabled: options.settings.mermaid.enabled,
    katexEnabled: true,
    highlight: options.settings.highlight,
    breaks: options.settings.breaks,
    codeCopyButton: options.type === "html" ? { copyLabel: "Copy code", copiedLabel: "Copied" } : undefined,
    blockToneButton: options.type === "html"
      ? { toneLabel: "Block colors", autoLabel: "Auto", lightLabel: "Light", darkLabel: "Dark" }
      : undefined,
    resolveImageSource: (src) => rewriteImageSource(src, options.sourcePath, options.type === "html", options.outputPath)
  });
  const styles = buildStyleTags(options);
  const mermaidScript = options.settings.mermaid.enabled
    ? `<script src="${pathToWebResource(options.extensionPath, "media/vendor/mermaid/mermaid.min.js")}"></script><script>mermaid.initialize({startOnLoad:true});</script>`
    : "";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  ${styles}
</head>
<body>
  <article class="markdown-body">
${content}
  </article>
  ${mermaidScript}
  ${options.type === "html" ? buildCodeCopyScript() : ""}
</body>
</html>`;
}

function buildStyleTags(options: RenderExportHtmlOptions): string {
  const styles: string[] = [];
  if (options.settings.includeDefaultStyles) {
    styles.push("media/export/markdown.css");
  }
  styles.push("media/vendor/katex/katex.min.css", ...options.settings.styles);

  return styles
    .map((style) => {
      const resolved = resolveStylePath(style, options.sourcePath, options.extensionPath);
      if (/^file:/i.test(resolved)) {
        try {
          const filePath = fileURLToPath(resolved);
          if (fs.existsSync(filePath)) {
            return `<style>\n${fs.readFileSync(filePath, "utf8")}\n</style>`;
          }
        } catch {
          return `<link rel="stylesheet" href="${escapeHtml(resolved)}">`;
        }
      }
      return `<link rel="stylesheet" href="${escapeHtml(resolved)}">`;
    })
    .join("\n");
}

function pathToWebResource(extensionPath: string, relativePath: string): string {
  return pathToFileURL(path.resolve(extensionPath, relativePath)).href;
}

function getFrontMatterString(data: Record<string, unknown>, key: string): string | undefined {
  const value = data[key];
  return typeof value === "string" ? value : undefined;
}
