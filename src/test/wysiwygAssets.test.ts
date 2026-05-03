import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { prepareUploadedImage, resolveImageDirectory, sanitizeFilename } from "../wysiwyg/assets";
import { resolveWysiwygDefaultMode } from "../wysiwyg/mode";

suite("visual editor assets", () => {
  test("resolves relative image directory near document", () => {
    assert.equal(resolveImageDirectory(path.join(path.sep, "tmp", "doc.md"), { imageDirectory: "assets" }), path.join(path.sep, "tmp", "assets"));
    assert.equal(resolveImageDirectory(path.join(path.sep, "tmp", "doc.md"), { imageDirectory: "   " }), path.join(path.sep, "tmp", "assets"));
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

  test("maps legacy visual mode settings to the self-hosted editor modes", () => {
    assert.equal(resolveWysiwygDefaultMode("source"), "source");
    assert.equal(resolveWysiwygDefaultMode("ir"), "wysiwyg");
    assert.equal(resolveWysiwygDefaultMode("wysiwyg", "sv"), "source");
  });

  test("webview loads one bundled Milkdown runtime with explicit diagnostics", () => {
    const providerSource = readProjectFile("src/wysiwyg/SuperMarkdownWysiwygEditorProvider.ts");
    const packageJson = readProjectFile("package.json");
    const copyAssets = readProjectFile("scripts/copy-assets.mjs");
    const runtimeSource = readProjectFile("media/wysiwyg/editor-runtime.ts");
    const bundledScript = readProjectFile("media/wysiwyg/editor.js");
    const style = readProjectFile("media/wysiwyg/editor.css");

    assert.equal(providerSource.includes('data-script-state="html-rendered"'), true);
    assert.equal(providerSource.includes("const versionedMedia"), true);
    assert.equal(providerSource.includes('versionedMedia("media/wysiwyg/editor.js")'), true);
    assert.equal(providerSource.includes('versionedMedia("media/wysiwyg/editor.css")'), true);
    assert.equal(providerSource.includes('versionedMedia("media/preview.css")'), true);
    assert.equal(providerSource.includes('<template id="payload">'), false);
    assert.equal(providerSource.includes('type="application/json"'), true);
    assert.equal(providerSource.includes("escapeJsonForScript"), true);
    assert.equal(providerSource.includes("mermaidScript"), true);
    assert.equal(providerSource.includes("media/vendor/mermaid/mermaid.min.js"), true);
    assert.equal(providerSource.includes("media/vendor/codicons/codicon.css"), true);
    assert.equal(packageJson.includes("media/vendor/codicons/codicon.css"), true);
    assert.equal(packageJson.includes("media/vendor/codicons/codicon.ttf"), true);
    assert.equal(copyAssets.includes("node_modules/@vscode/codicons/dist/codicon.css"), true);
    assert.equal(copyAssets.includes("node_modules/@vscode/codicons/dist/codicon.ttf"), true);
    assert.equal(providerSource.includes("media/vendor/katex/katex.min.js"), false);
    assert.equal(providerSource.includes("formatWebviewError"), true);
    assert.equal(providerSource.includes("lastWebviewErrors"), true);
    assert.equal(providerSource.includes("csp-timeout"), true);
    assert.equal(providerSource.includes("runtime-ready"), true);
    assert.equal(packageJson.includes("bundle:webview"), true);
    assert.equal(packageJson.includes("media/wysiwyg/editor-runtime.ts --bundle"), true);
    assert.equal(packageJson.includes("remark-math"), true);
    assert.equal(providerSource.includes('from "./toolbar"'), true);
    assert.equal(runtimeSource.includes("../../src/wysiwyg/toolbar"), true);
    assert.equal(runtimeSource.includes("renderToolbarIcon"), true);
    assert.equal(runtimeSource.includes("@milkdown/kit/core"), true);
    assert.equal(runtimeSource.includes("Editor.make()"), true);
    assert.equal(runtimeSource.includes(".use(commonmark)"), true);
    assert.equal(runtimeSource.includes(".use(gfm)"), true);
    assert.equal(runtimeSource.includes(".use(remarkMathPlugin)"), true);
    assert.equal(runtimeSource.includes(".use(mathInlineSchema)"), true);
    assert.equal(runtimeSource.includes(".use(mathBlockSchema)"), true);
    assert.equal(runtimeSource.includes(".use(safeHtmlInlineSchema)"), true);
    assert.equal(runtimeSource.includes("listenerCtx"), true);
    assert.equal(runtimeSource.includes('import mermaid from "mermaid"'), false);
    assert.equal(runtimeSource.includes("loadMermaid"), true);
    assert.equal(runtimeSource.includes("window.mermaid"), true);
    assert.equal(runtimeSource.includes("markMermaidRenderError"), true);
    assert.equal(runtimeSource.includes("superMarkdownMermaidError"), true);
    assert.equal(runtimeSource.includes("getErrorMessage(message.error)"), true);
    assert.equal(runtimeSource.includes("JSON.stringify(error)"), true);
    assert.equal(packageJson.includes("--minify"), true);
    assert.equal(bundledScript.includes("new " + "V" + "ditor"), false);
    assert.equal(style.includes("show-delayed-runtime-diagnostic"), true);
    assert.equal(style.includes(".toolbar-icon .codicon"), true);
    assert.equal(style.includes(".toolbar-custom-icon"), true);
    assert.equal(readProjectFile("media/preview.css").includes(".diagram-block .mermaid-render-error"), true);
    assert.equal(style.includes('body[data-script-state="bootstrap-ran"] .editor-toolbar-slot::after'), false);
    assert.equal(style.includes('body[data-script-state="runtime-loading"] .editor-toolbar-slot::after'), false);
    assert.equal(style.includes("Editor runtime loading"), false);
  });

  test("toolbar actions are backed by ProseMirror commands and host fallbacks", () => {
    const runtimeSource = readProjectFile("media/wysiwyg/editor-runtime.ts");
    const providerSource = readProjectFile("src/wysiwyg/SuperMarkdownWysiwygEditorProvider.ts");
    const extensionSource = readProjectFile("src/extension.ts");
    const toolbarSource = readProjectFile("src/wysiwyg/toolbar.ts");
    const style = readProjectFile("media/wysiwyg/editor.css");

    for (const command of [
      "toggleStrongCommand",
      "toggleEmphasisCommand",
      "toggleStrikethroughCommand",
      "toggleInlineCodeCommand",
      "wrapInHeadingCommand",
      "insertHrCommand",
      "wrapInBlockquoteCommand",
      "wrapInBulletListCommand",
      "wrapInOrderedListCommand",
      "createCodeBlockCommand",
      "insertTableCommand"
    ]) {
      assert.equal(runtimeSource.includes(command), true);
    }
    for (const action of ["bold", "italic", "underline", "highlight", "ordered-list", "task-checked", "table", "math", "mermaid", "toc", "organizeMarkdown", "switchBackgroundTheme", "help", "export-pdf", "export-all"]) {
      assert.equal(runtimeSource.includes(action), true);
    }
    assert.equal(runtimeSource.includes('post("toolbarCommand"'), true);
    assert.equal(runtimeSource.includes('post("openLink", { href: SUPER_MARKDOWN_ISSUES_URL })'), true);
    assert.equal(toolbarSource.includes("TOOLBAR_CODICON_ACTIONS"), true);
    assert.equal(toolbarSource.includes('SUPER_MARKDOWN_ISSUES_URL = "https://github.com/SivanCola/super-markdown/issues"'), true);
    assert.equal(toolbarSource.includes('bold: "bold"'), true);
    assert.equal(toolbarSource.includes('"inline-code": "code"'), true);
    assert.equal(toolbarSource.includes('switchBackgroundTheme: "color-mode"'), true);
    assert.equal(toolbarSource.includes("TOOLBAR_CUSTOM_ICONS"), true);
    assert.equal(toolbarSource.includes("highlight: customSvg"), true);
    assert.equal(toolbarSource.includes("math: customSvg"), true);
    assert.equal(toolbarSource.includes("mermaid: customSvg"), true);
    assert.equal(providerSource.includes("renderToolbarIcon(action)"), true);
    assert.equal(providerSource.includes("vscode.env.openExternal(vscode.Uri.parse(SUPER_MARKDOWN_ISSUES_URL))"), true);
    assert.equal(runtimeSource.includes("toolbarActionIcons"), false);
    assert.equal(providerSource.includes("enableCommandUris: [SUPER_MARKDOWN_TOOLBAR_COMMAND]"), true);
    assert.equal(providerSource.includes('case "toolbarCommand"'), true);
    assert.equal(providerSource.includes('vscode.commands.executeCommand("superMarkdown.switchBackgroundTheme")'), true);
    assert.equal(extensionSource.includes("superMarkdownEditorProvider.handleToolbarCommand"), true);
    assert.equal(style.includes(".visual-editor .ProseMirror"), true);
    assert.equal(style.includes(".toolbar-menu"), true);
  });

  test("split editor syncs by source line anchors rather than scroll percentage", () => {
    const runtimeSource = readProjectFile("media/wysiwyg/editor-runtime.ts");
    const style = readProjectFile("media/wysiwyg/editor.css");

    assert.equal(runtimeSource.includes("sourceEditor.onscroll"), true);
    assert.equal(runtimeSource.includes("previewElement.onscroll"), true);
    assert.equal(runtimeSource.includes("[data-source-line]"), true);
    assert.equal(runtimeSource.includes("findPreviewElementForLine"), true);
    assert.equal(runtimeSource.includes("getFirstVisiblePreviewSourceLine"), true);
    assert.equal(runtimeSource.includes("syncPreviewToSourceLine(getFirstVisibleSourceLine())"), true);
    assert.equal(runtimeSource.includes("syncSourceToPreviewLine(line)"), true);
    assert.equal(runtimeSource.includes("scrollSyncSuppressTarget"), true);
    assert.equal(runtimeSource.includes("getMaxPreviewScrollTop"), false);
    assert.equal(runtimeSource.includes("mapScrollTop"), false);
    assert.equal(style.includes("body.mode-split .editor-toolbar-slot {\n  display: none;"), false);
    assert.equal(style.includes("body.mode-wysiwyg .editor-toolbar-slot {\n  display: none;"), false);
  });

  test("preview outline and image upload remain wired through the webview host protocol", () => {
    const runtimeSource = readProjectFile("media/wysiwyg/editor-runtime.ts");
    const providerSource = readProjectFile("src/wysiwyg/SuperMarkdownWysiwygEditorProvider.ts");
    const style = readProjectFile("media/wysiwyg/editor.css");

    for (const name of ["chooseImagesForInsert", "readImageFileData", "uploadImages", "uploadImagesResult"]) {
      assert.equal(runtimeSource.includes(name), true);
    }
    for (const name of ["extractHeadings", "renderOutline", "updateActiveOutlineFromScroll", "data-outline-id"]) {
      assert.equal(runtimeSource.includes(name), true);
    }
    assert.equal(providerSource.includes('id="outline-current"'), true);
    assert.equal(providerSource.includes('id="side-panel-collapse"'), true);
    assert.equal(style.includes("--outline-rail-width: 44px;"), true);
    assert.equal(style.includes(".outline-item.is-active"), true);
  });

  test("shared resources keep Milkdown visuals aligned with the host preview", () => {
    const runtimeSource = readProjectFile("media/wysiwyg/editor-runtime.ts");
    const providerSource = readProjectFile("src/wysiwyg/SuperMarkdownWysiwygEditorProvider.ts");
    const renderSource = readProjectFile("src/markdown/render.ts");
    const style = readProjectFile("media/wysiwyg/editor.css");

    assert.equal(renderSource.includes("export function resolveImageSrc"), true);
    assert.equal(providerSource.includes("collectImageResources"), true);
    assert.equal(providerSource.includes('from "../markdown/links"'), true);
    assert.equal(providerSource.includes("extractMarkdownInlineLinks(document.getText())"), true);
    assert.equal(providerSource.includes("imageResources: this.collectImageResources"), true);
    assert.equal(providerSource.includes("katexEnabled: previewSettings.katexEnabled"), true);
    assert.equal(providerSource.includes("rawHtmlEscaped"), true);
    assert.equal(providerSource.includes("mathEdit"), true);
    assert.equal(providerSource.includes("codeExpand"), false);
    assert.equal(providerSource.includes("codeCollapse"), false);
    assert.equal(providerSource.includes("resolveImageSrc(source, document, webview)"), true);
    assert.equal(runtimeSource.includes("normalizeImageResources"), true);
    assert.equal(runtimeSource.includes("../../src/markdown/codeBlockActions"), true);
    assert.equal(runtimeSource.includes("../../src/markdown/features"), true);
    assert.equal(runtimeSource.includes("./highlight-runtime"), true);
    assert.equal(readProjectFile("media/wysiwyg/highlight-runtime.ts").includes("shiki/core"), true);
    assert.equal(runtimeSource.includes("renderKatexHtml"), true);
    assert.equal(runtimeSource.includes("renderInertInlineHtml"), true);
    assert.equal(runtimeSource.includes("resolveFootnoteReference"), true);
    assert.equal(runtimeSource.includes("enhanceVisualCodeBlocks"), false);
    assert.equal(runtimeSource.includes("visual-code-action-block"), false);
    assert.equal(runtimeSource.includes("nodeViewCtx"), true);
    assert.equal(runtimeSource.includes("createCodeBlockNodeView"), true);
    assert.equal(runtimeSource.includes("registerVisualNodeViews"), true);
    assert.equal(runtimeSource.includes("visual-code-node-view"), true);
    assert.equal(runtimeSource.includes("visual-code-highlight"), true);
    assert.equal(runtimeSource.includes("highlightCodeBlockHtml"), true);
    assert.equal(runtimeSource.includes("visual-code-expand"), false);
    assert.equal(runtimeSource.includes("visual-code-language-input"), true);
    assert.equal(runtimeSource.includes("visual-math-edit"), true);
    assert.equal(runtimeSource.includes("visual-math-done"), true);
    assert.equal(runtimeSource.includes("visual-math-inline-input"), true);
    assert.equal(runtimeSource.includes("visual-html-label"), true);
    assert.equal(runtimeSource.includes("contentDOM: code"), true);
    assert.equal(runtimeSource.includes("bindCodeBlockActionButton"), true);
    assert.equal(runtimeSource.includes("stopEvent(event)"), true);
    assert.equal(runtimeSource.includes("ignoreMutation(mutation)"), true);
    assert.equal(runtimeSource.includes("mutation.target === dom"), true);
    assert.equal(runtimeSource.includes("visual-admonition-title"), true);
    assert.equal(runtimeSource.includes("visual-admonition-body"), true);
    assert.equal(runtimeSource.includes("visual-admonition-source"), true);
    for (const name of [
      "createMathInlineNodeView",
      "createMathBlockNodeView",
      "createFootnoteReferenceNodeView",
      "createFootnoteDefinitionNodeView",
      "createHtmlNodeView",
      "createSafeHtmlInlineNodeView",
      "createBlockquoteNodeView",
      "math_inline",
      "math_block",
      "footnote_reference",
      "footnote_definition",
      "safe_html_inline"
    ]) {
      assert.equal(runtimeSource.includes(name), true);
    }
    assert.equal(runtimeSource.includes("handleCodeBlockActionClick"), true);
    assert.equal(style.includes(".visual-code-node-view.render-block-tone-light"), true);
    assert.equal(style.includes(".visual-code-node-view.render-block-tone-dark"), true);
    assert.equal(style.includes(".visual-code-node-view.is-expanded .visual-code-frame"), false);
    assert.equal(style.includes("max-height: min(62vh, 560px);"), false);
    assert.equal(style.includes("line-height: 1.55;"), true);
    assert.equal(style.includes(".visual-blockquote-node-view.admonition"), true);
    assert.equal(style.includes(".visual-admonition-title"), true);
    assert.equal(style.includes(".visual-admonition-body"), true);
    assert.equal(style.includes(".visual-admonition-source"), true);
    assert.equal(style.includes(".visual-math-node-view.is-editing .visual-math-source"), true);
    assert.equal(style.includes(".visual-html-label"), true);
    assert.equal(style.includes("display: grid;"), true);
    assert.equal(style.includes("white-space: pre-wrap;"), true);
    assert.equal(runtimeSource.includes("resolveVisualImagesSoon"), true);
    assert.equal(runtimeSource.includes("startVisualImageObserver"), true);
    assert.equal(runtimeSource.includes("new MutationObserver"), true);
    assert.equal(runtimeSource.includes('visualEditor.querySelectorAll<HTMLImageElement>("img")'), true);
    assert.equal(runtimeSource.includes("scrollVisualEditorToHeading"), true);
    assert.equal(runtimeSource.includes("findVisualHeadingForLine"), true);
    assert.equal(runtimeSource.includes("getFirstVisibleVisualHeadingLine"), true);
  });
});

function readProjectFile(relativePath: string): string {
  return fs.readFileSync(path.join(__dirname, "..", "..", relativePath), "utf8");
}
