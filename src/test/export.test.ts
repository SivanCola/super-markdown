import * as assert from "node:assert/strict";
import * as path from "node:path";
import { expandIncludes } from "../export/markdownItInclude";
import { renderExportHtml } from "../export/renderer";
import { parseFrontMatter, resolveExportTypes, resolveOutputPath, rewriteImageSource } from "../export/utils";
import { ExportSettings } from "../types";

const exportSettings: ExportSettings = {
  defaultType: "pdf",
  convertOnSave: false,
  exclude: [],
  outputDirectory: "",
  outputDirectoryRelativePathFile: true,
  includeDefaultStyles: false,
  styles: [],
  highlight: true,
  highlightStyle: "tomorrow.css",
  emoji: false,
  breaks: false,
  chromiumExecutablePath: "",
  include: { enabled: false },
  mermaid: { enabled: true },
  plantuml: { enabled: false, server: "", openMarker: "@startuml", closeMarker: "@enduml" },
  pdf: {
    format: "A4",
    landscape: false,
    printBackground: true,
    displayHeaderFooter: false,
    headerTemplate: "",
    footerTemplate: "",
    margin: { top: "1cm", right: "1cm", bottom: "1cm", left: "1cm" }
  },
  image: { quality: 100, fullPage: true, omitBackground: false }
};

suite("export utils", () => {
  test("parses frontmatter", () => {
    const result = parseFrontMatter("---\ntitle: Demo\n---\n# Body");
    assert.equal(result.data.title, "Demo");
    assert.equal(result.content, "# Body");
  });

  test("resolves export types", () => {
    assert.deepEqual(resolveExportTypes("all", "pdf"), ["html", "pdf", "png", "jpeg"]);
    assert.deepEqual(resolveExportTypes("settings", ["html", "pdf"]), ["html", "pdf"]);
  });

  test("resolves output path near source file", () => {
    const source = path.join(path.sep, "tmp", "doc.md");
    const output = resolveOutputPath(source, "html", {
      outputDirectory: "dist",
      outputDirectoryRelativePathFile: true
    } as Pick<ExportSettings, "outputDirectory" | "outputDirectoryRelativePathFile">);
    assert.equal(output, path.join(path.sep, "tmp", "dist", "doc.html"));
  });

  test("resolves relative output path from workspace when configured", () => {
    const source = path.join(path.sep, "tmp", "workspace", "docs", "doc.md");
    const output = resolveOutputPath(
      source,
      "pdf",
      {
        outputDirectory: "exports",
        outputDirectoryRelativePathFile: false
      } as Pick<ExportSettings, "outputDirectory" | "outputDirectoryRelativePathFile">,
      path.join(path.sep, "tmp", "workspace")
    );
    assert.equal(output, path.join(path.sep, "tmp", "workspace", "exports", "doc.pdf"));
  });

  test("rewrites image paths for non-html export", () => {
    const source = path.join(path.sep, "tmp", "doc.md");
    assert.match(rewriteImageSource("images/a b.png", source, false), /^file:\/\//);
  });

  test("rewrites html image paths relative to output file", () => {
    const source = path.join(path.sep, "tmp", "workspace", "docs", "doc.md");
    const output = path.join(path.sep, "tmp", "workspace", "exports", "doc.html");
    assert.equal(rewriteImageSource("images/a b.png", source, true, output), "../docs/images/a%20b.png");
  });

  test("renders mermaid fences as diagram divs", () => {
    const html = renderExportHtml({
      markdown: "```mermaid\ngraph TD; A-->B;\n```",
      sourcePath: path.join(path.sep, "tmp", "doc.md"),
      outputPath: path.join(path.sep, "tmp", "doc.html"),
      extensionPath: process.cwd(),
      settings: exportSettings,
      type: "html"
    });
    assert.match(html, /<div class="mermaid">graph TD; A--&gt;B;\n<\/div>/);
    assert.doesNotMatch(html, /language-mermaid/);
  });

  test("does not expand include directives inside fences", () => {
    const text = "```md\n:[x](missing.md)\n```";
    assert.equal(expandIncludes(text, process.cwd(), []), text);
  });
});
