import * as fs from "node:fs";
import * as path from "node:path";
import hljs from "highlight.js";
import MarkdownIt from "markdown-it";
import container from "markdown-it-container";
import { full as emojiFull } from "markdown-it-emoji";
import footnote from "markdown-it-footnote";
import plantuml from "markdown-it-plantuml";
import taskLists from "markdown-it-task-lists";
import { ExportSettings, ExportType } from "../types";
import { GithubSlugger } from "../markdown/slug";
import { markdownItInclude } from "./markdownItInclude";
import { parseFrontMatter, resolveStylePath, rewriteImageSource } from "./utils";

export interface RenderExportHtmlOptions {
  markdown: string;
  sourcePath: string;
  outputPath?: string;
  extensionPath: string;
  settings: ExportSettings;
  type: ExportType;
}

export function renderExportHtml(options: RenderExportHtmlOptions): string {
  const matter = parseFrontMatter(options.markdown);
  const title = getFrontMatterString(matter.data, "title") || path.basename(options.sourcePath);
  const slugger = new GithubSlugger();
  const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
    breaks: options.settings.breaks,
    highlight: (code, language) => highlightCode(code, language, options.settings)
  });

  md.use(taskLists, { enabled: false, label: true, labelAfter: true });
  md.use(footnote);
  if (options.settings.emoji) {
    md.use(emojiFull);
  }
  md.use(container, "info");
  md.use(container, "warning");
  md.use(container, "danger");
  md.use(container, "success");
  if (options.settings.include.enabled) {
    md.use(markdownItInclude, { root: path.dirname(options.sourcePath) });
  }
  if (options.settings.plantuml.enabled) {
    md.use(plantuml, {
      server: options.settings.plantuml.server,
      openMarker: options.settings.plantuml.openMarker,
      closeMarker: options.settings.plantuml.closeMarker
    });
  }

  const defaultFence =
    md.renderer.rules.fence ??
    ((tokens, index, rendererOptions, _env, self) => self.renderToken(tokens, index, rendererOptions));
  md.renderer.rules.fence = (tokens, index, rendererOptions, env, self) => {
    const token = tokens[index];
    const language = token.info.trim().split(/\s+/)[0];
    if (language && /\bmermaid\b/i.test(language) && options.settings.mermaid.enabled) {
      return `<div class="mermaid">${escapeHtml(token.content)}</div>\n`;
    }
    return defaultFence(tokens, index, rendererOptions, env, self);
  };

  const defaultHeading =
    md.renderer.rules.heading_open ??
    ((tokens, index, rendererOptions, _env, self) => self.renderToken(tokens, index, rendererOptions));
  md.renderer.rules.heading_open = (tokens, index, rendererOptions, env, self) => {
    const inline = tokens[index + 1];
    if (inline?.type === "inline") {
      tokens[index].attrSet("id", slugger.slug(inline.content));
    }
    return defaultHeading(tokens, index, rendererOptions, env, self);
  };

  const defaultImage =
    md.renderer.rules.image ??
    ((tokens, index, rendererOptions, _env, self) => self.renderToken(tokens, index, rendererOptions));
  md.renderer.rules.image = (tokens, index, rendererOptions, env, self) => {
    const src = tokens[index].attrGet("src");
    if (src) {
      tokens[index].attrSet("src", rewriteImageSource(src, options.sourcePath, options.type === "html", options.outputPath));
    }
    return defaultImage(tokens, index, rendererOptions, env, self);
  };

  const content = md.render(matter.content);
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
</body>
</html>`;
}

function highlightCode(code: string, language: string, settings: ExportSettings): string {
  if (language && /\bmermaid\b/i.test(language) && settings.mermaid.enabled) {
    return escapeHtml(code);
  }
  if (!settings.highlight) {
    return `<pre><code>${escapeHtml(code)}</code></pre>`;
  }
  if (language && hljs.getLanguage(language)) {
    try {
      return `<pre class="hljs"><code>${hljs.highlight(code, { language, ignoreIllegals: true }).value}</code></pre>`;
    } catch {
      // Fall through to escaped plain text.
    }
  }
  return `<pre class="hljs"><code>${escapeHtml(code)}</code></pre>`;
}

function buildStyleTags(options: RenderExportHtmlOptions): string {
  const styles: string[] = [];
  if (options.settings.includeDefaultStyles) {
    styles.push("media/export/markdown.css", "media/export/markdown-pdf.css");
  }
  if (options.settings.highlight) {
    styles.push(`node_modules/highlight.js/styles/${options.settings.highlightStyle}`, "media/export/tomorrow.css");
  }
  styles.push(...options.settings.styles);

  return styles
    .map((style) => {
      const resolved = resolveStylePath(style, options.sourcePath, options.extensionPath);
      if (/^file:/i.test(resolved)) {
        const filePath = decodeURIComponent(resolved.replace(/^file:\/\//, ""));
        if (fs.existsSync(filePath)) {
          return `<style>\n${fs.readFileSync(filePath, "utf8")}\n</style>`;
        }
      }
      return `<link rel="stylesheet" href="${escapeHtml(resolved)}">`;
    })
    .join("\n");
}

function pathToWebResource(extensionPath: string, relativePath: string): string {
  return `file://${path.resolve(extensionPath, relativePath).replace(/\\/g, "/")}`;
}

function getFrontMatterString(data: Record<string, unknown>, key: string): string | undefined {
  const value = data[key];
  return typeof value === "string" ? value : undefined;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
