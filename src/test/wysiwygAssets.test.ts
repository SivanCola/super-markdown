import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { prepareUploadedImage, resolveImageDirectory, sanitizeFilename } from "../wysiwyg/assets";
import { resolveWysiwygDefaultMode } from "../wysiwyg/mode";

suite("wysiwyg assets", () => {
  test("resolves relative image directory near document", () => {
    assert.equal(resolveImageDirectory(path.join(path.sep, "tmp", "doc.md"), { imageDirectory: "assets" }), path.join(path.sep, "tmp", "assets"));
  });

  test("sanitizes filenames and infers extension", () => {
    assert.equal(sanitizeFilename("my image", "image/jpeg"), "my-image.jpg");
  });

  test("prepares uploaded image with unique name", () => {
    const image = prepareUploadedImage(
      path.join(path.sep, "tmp", "doc.md"),
      { imageDirectory: "assets" },
      { id: "1", name: "a.png", dataUrl: "data:image/png;base64,YQ==" },
      new Set(["a.png"])
    );
    assert.equal(image.name, "a-2.png");
    assert.equal(image.markdownPath, "assets/a-2.png");
    assert.equal(image.buffer.toString("utf8"), "a");
  });

  test("uses editor default mode unless wysiwyg mode is explicitly configured", () => {
    assert.equal(resolveWysiwygDefaultMode("source"), "sv");
    assert.equal(resolveWysiwygDefaultMode("ir"), "ir");
    assert.equal(resolveWysiwygDefaultMode("wysiwyg", "sv"), "sv");
  });

  test("webview mode switch avoids removed Vditor API and keeps a fallback editor", () => {
    const script = fs.readFileSync(path.join(__dirname, "..", "..", "media", "wysiwyg", "editor.js"), "utf8");
    assert.equal(script.includes(".setMode("), false);
    assert.equal(script.includes("function initFallbackEditor"), true);
    assert.equal(script.includes("renderSidePanels(currentMarkdown);"), true);
  });

  test("webview payload reads template content before text fallback", () => {
    const script = fs.readFileSync(path.join(__dirname, "..", "..", "media", "wysiwyg", "editor.js"), "utf8");
    assert.equal(script.includes("payloadElement.content?.textContent || payloadElement.textContent"), true);
    assert.equal(script.includes("const translations = payload.translations || {};"), true);
  });

  test("preview-only layout does not initialize the editor pane", () => {
    const script = fs.readFileSync(path.join(__dirname, "..", "..", "media", "wysiwyg", "editor.js"), "utf8");
    const providerSource = fs.readFileSync(
      path.join(__dirname, "..", "..", "src", "wysiwyg", "SuperMarkdownWysiwygEditorProvider.ts"),
      "utf8"
    );
    assert.equal(script.includes("if (currentLayout === \"previewOnly\") {\n      clearEditorForPreview();"), true);
    assert.equal(script.includes("if (currentLayout !== \"previewOnly\") {\n    initVditor(currentMode);"), true);
    assert.equal(providerSource.includes('<div class="toolbar">'), false);
  });

  test("webview supports distinct split edit layout", () => {
    const script = fs.readFileSync(path.join(__dirname, "..", "..", "media", "wysiwyg", "editor.js"), "utf8");
    const style = fs.readFileSync(path.join(__dirname, "..", "..", "media", "wysiwyg", "editor.css"), "utf8");
    assert.equal(script.includes("\"splitEdit\""), true);
    assert.equal(script.includes("layout-splitEdit"), true);
    assert.equal(style.includes("body.layout-splitEdit .workbench-shell"), true);
    assert.equal(/body\.layout-splitEdit\s+\.side-panel\s*{[^}]*display:\s*none/s.test(style), false);
    assert.equal(/body\.layout-splitEdit\s+\.preview-panel\s*{[^}]*display:\s*none/s.test(style), false);
  });

  test("split edit mode syncs editor scroll to preview scroll", () => {
    const script = fs.readFileSync(path.join(__dirname, "..", "..", "media", "wysiwyg", "editor.js"), "utf8");
    assert.equal(script.includes("function bindEditorScrollSync()"), true);
    assert.equal(script.includes('currentLayout !== "splitEdit"'), true);
    assert.equal(script.includes('editorElement.querySelector(".vditor-sv")'), true);
    assert.equal(script.includes('editorElement.querySelector(".vditor-ir")'), true);
    assert.equal(script.includes('editorElement.querySelector(".vditor-wysiwyg")'), true);
    assert.equal(script.includes('scrollElement.addEventListener("scroll", onScroll, { passive: true })'), true);
    assert.equal(script.includes("function syncPreviewScrollFromEditor"), true);
    assert.equal(script.includes("previewElement.scrollTop = Math.round(previewMax * ratio);"), true);
  });

  test("focused layouts keep navigation and scroll content panes", () => {
    const htmlSource = fs.readFileSync(
      path.join(__dirname, "..", "wysiwyg", "SuperMarkdownWysiwygEditorProvider.js"),
      "utf8"
    );
    const script = fs.readFileSync(path.join(__dirname, "..", "..", "media", "wysiwyg", "editor.js"), "utf8");
    const style = fs.readFileSync(path.join(__dirname, "..", "..", "media", "wysiwyg", "editor.css"), "utf8");
    assert.equal(htmlSource.includes('<main id="preview" class="markdown-preview">'), true);
    assert.equal(htmlSource.includes('<article class="markdown-body">${preview.html}</article>'), true);
    assert.equal(/body\.layout-editorOnly\s+\.side-panel\s*{[^}]*display:\s*none/s.test(style), false);
    assert.equal(style.includes("body.layout-previewOnly .side-panel"), true);
    assert.equal(style.includes("body.layout-previewOnly .preview-panel"), true);
    assert.equal(style.includes("#editor .vditor-wysiwyg"), true);
    assert.equal(style.includes("#editor .vditor-ir"), true);
    assert.equal(script.includes("function setPreviewHtml"), true);
    assert.equal(script.includes("previewElement.scrollTo({"), true);
  });

  test("layouts use collapsible outline navigation", () => {
    const providerSource = fs.readFileSync(
      path.join(__dirname, "..", "..", "src", "wysiwyg", "SuperMarkdownWysiwygEditorProvider.ts"),
      "utf8"
    );
    const script = fs.readFileSync(path.join(__dirname, "..", "..", "media", "wysiwyg", "editor.js"), "utf8");
    const style = fs.readFileSync(path.join(__dirname, "..", "..", "media", "wysiwyg", "editor.css"), "utf8");
    assert.equal(providerSource.includes('id="side-panel-toggle"'), true);
    assert.equal(providerSource.includes('id="side-panel"'), true);
    assert.equal(script.includes("const sidePanelToggleElement = document.getElementById(\"side-panel-toggle\");"), true);
    assert.equal(script.includes("function setSidePanelOpen(open)"), true);
    assert.equal(script.includes("function shouldAutoCloseSidePanel()"), true);
    assert.equal(script.includes('return currentLayout !== "previewOnly" && currentLayout !== "splitEdit" && currentMode !== "wysiwyg";'), true);
    assert.equal(script.includes("side-panel-open"), true);
    assert.equal(style.includes(".side-panel-toggle"), true);
    assert.equal(style.includes("body:not(.layout-previewOnly) .side-panel"), true);
    assert.equal(style.includes("transform: translateX(calc(-100% - 24px))"), true);
    assert.equal(style.includes("body.side-panel-open .side-panel"), true);
    assert.equal(style.includes("body.layout-splitEdit.side-panel-open .workbench-shell"), true);
    assert.equal(style.includes("grid-template-columns: var(--side-panel-dock-width) minmax(0, 1fr) minmax(0, 1fr);"), true);
    assert.equal(style.includes("body.layout-splitEdit.side-panel-open .editor-toolbar-slot"), true);
    assert.equal(style.includes("grid-column: 2 / -1;"), true);
    assert.equal(style.includes("body.layout-splitEdit.side-panel-open .editor-panel"), true);
    assert.equal(style.includes("body.layout-splitEdit.side-panel-open .preview-panel"), true);
    assert.equal(style.includes("grid-column: 1 / -1"), true);
    assert.equal(script.includes("setSidePanelOpen(false);"), true);
    assert.equal(style.includes("body.layout-previewOnly:not(.side-panel-open) .workbench-shell"), false);
    assert.equal(style.includes("body.layout-previewOnly:not(.side-panel-open) .preview-panel"), false);
  });

  test("webview side panel is only for the heading outline", () => {
    const providerSource = fs.readFileSync(
      path.join(__dirname, "..", "..", "src", "wysiwyg", "SuperMarkdownWysiwygEditorProvider.ts"),
      "utf8"
    );
    const script = fs.readFileSync(path.join(__dirname, "..", "..", "media", "wysiwyg", "editor.js"), "utf8");
    const style = fs.readFileSync(path.join(__dirname, "..", "..", "media", "wysiwyg", "editor.css"), "utf8");
    assert.equal(providerSource.includes('class="panel-heading"'), true);
    assert.equal(providerSource.includes('data-panel="health"'), false);
    assert.equal(providerSource.includes('id="health"'), false);
    assert.equal(script.includes("healthElement"), false);
    assert.equal(script.includes("function renderHealth"), false);
    assert.equal(style.includes(".panel-tab"), false);
    assert.equal(style.includes(".health-list"), false);
  });

  test("outline headings scroll the visible editor before the hidden preview", () => {
    const script = fs.readFileSync(path.join(__dirname, "..", "..", "media", "wysiwyg", "editor.js"), "utf8");
    assert.equal(script.includes('data-heading-index="${index}"'), true);
    assert.equal(script.includes("function scrollEditorToHeading"), true);
    assert.equal(script.includes("outlineElement.contains(target)"), true);
    assert.equal(script.includes("scrollToNavigationTarget(target);"), true);
    assert.equal(script.includes("scrollPreviewToElement(document.getElementById(target.dataset.slug))"), false);
  });

  test("webview initializes the product toolbar through Vditor", () => {
    const script = fs.readFileSync(path.join(__dirname, "..", "..", "media", "wysiwyg", "editor.js"), "utf8");
    const style = fs.readFileSync(path.join(__dirname, "..", "..", "media", "wysiwyg", "editor.css"), "utf8");
    const providerSource = fs.readFileSync(
      path.join(__dirname, "..", "..", "src", "wysiwyg", "SuperMarkdownWysiwygEditorProvider.ts"),
      "utf8"
    );
    assert.equal(script.includes("function buildToolbar()"), true);
    assert.equal(script.includes("function relocateToolbar()"), true);
    assert.equal(script.includes("function collapseToolbarPanels()"), true);
    assert.equal(script.includes("function enhanceToolbarA11y()"), true);
    assert.equal(script.includes("toolbar: buildToolbar()"), true);
    assert.equal(script.includes("toolbarConfig: { pin: true }"), true);
    assert.equal(script.includes('mode: "editor",'), true);
    assert.equal(script.includes('builtInToolbarItem("bold"'), true);
    assert.equal(script.includes('iconLabel(`${toolbarLabel("more", "More")} ▾`)'), true);
    assert.equal(script.includes("xlink:href"), false);
    assert.equal(providerSource.includes('id="editor-toolbar-slot"'), true);
    assert.equal(style.includes(".editor-toolbar-slot"), true);
    assert.equal(style.includes("body.layout-editorOnly .editor-toolbar-slot"), true);
    assert.equal(style.includes("body.layout-splitEdit .editor-toolbar-slot"), true);
    assert.equal(style.includes("justify-content: flex-start"), true);
    assert.equal(style.includes("background: #ffffff"), true);
    assert.equal(style.includes("min-height: 44px"), true);
    assert.equal(style.includes("width: 21px"), true);
    assert.equal(style.includes('data-type="more"'), true);
    assert.equal(style.includes("top: calc(100% + 6px)"), true);
    assert.equal(style.includes("body.layout-splitEdit .preview-title"), true);
  });

  test("webview toolbar keeps custom markdown actions and removes old mode buttons", () => {
    const script = fs.readFileSync(path.join(__dirname, "..", "..", "media", "wysiwyg", "editor.js"), "utf8");
    const providerSource = fs.readFileSync(
      path.join(__dirname, "..", "..", "src", "wysiwyg", "SuperMarkdownWysiwygEditorProvider.ts"),
      "utf8"
    );
    for (const name of ["underline", "mark", "math", "mermaid", "more"]) {
      assert.equal(script.includes(`name: "${name}"`), true);
    }
    assert.equal(script.includes("[data-command]"), false);
    assert.equal(providerSource.includes('data-command="mode-sv"'), false);
    assert.equal(providerSource.includes('data-command="mode-ir"'), false);
    assert.equal(providerSource.includes('data-command="mode-wysiwyg"'), false);
    assert.equal(providerSource.includes("Source</button>"), false);
    assert.equal(providerSource.includes("WYSIWYG</button>"), false);
  });
});
