import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { getImageFilesFromTransfer } from "../wysiwyg/clipboard";
import { prepareUploadedImage, resolveImageDirectory, sanitizeFilename } from "../wysiwyg/assets";
import { resolveWysiwygDefaultMode } from "../wysiwyg/mode";
import {
  EXPORT_MENU_ACTIONS,
  getToolbarGroups,
  HEADING_MENU_ACTIONS,
  HOST_TOOLBAR_ACTIONS,
  PREVIEW_TOOLBAR_GROUPS,
  renderToolbarIcon,
  SUPER_MARKDOWN_ISSUES_URL,
  TOOLBAR_GROUPS
} from "../wysiwyg/toolbar";

suite("visual editor assets", () => {
  test("resolves relative image directory near document", () => {
    assert.equal(resolveImageDirectory(path.join(path.sep, "tmp", "doc.md"), { imageDirectory: "assets" }), path.join(path.sep, "tmp", "assets"));
    assert.equal(resolveImageDirectory(path.join(path.sep, "tmp", "doc.md"), { imageDirectory: "   " }), path.join(path.sep, "tmp", "assets"));
  });

  test("resolves workspace resource directory for nested documents", () => {
    const workspaceRoot = path.join(path.sep, "tmp", "project");
    const documentPath = path.join(workspaceRoot, "docs", "guide.md");

    assert.equal(resolveImageDirectory(documentPath, { imageDirectory: "assets" }, workspaceRoot), path.join(workspaceRoot, "assets"));

    const image = prepareUploadedImage(
      documentPath,
      { imageDirectory: "assets" },
      { id: "1", name: "diagram.png", dataUrl: "data:image/png;base64,YQ==" },
      new Set(),
      workspaceRoot
    );
    assert.equal(image.absolutePath, path.join(workspaceRoot, "assets", "diagram.png"));
    assert.equal(image.markdownPath, "../assets/diagram.png");
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

  test("uses clipboard files before mirrored transfer items for pasted images", () => {
    const fromFiles = createTestFile("image.png", "image/png", 1);
    const mirroredItem = createTestFile("image.png", "image/png", 2);

    const files = getImageFilesFromTransfer({
      files: [fromFiles],
      items: [{ kind: "file", type: "image/png", getAsFile: () => mirroredItem }]
    });

    assert.equal(files.length, 1);
    assert.equal(files[0], fromFiles);
  });

  test("falls back to transfer items when the clipboard file list has no images", () => {
    const image = createTestFile("image.png", "image/png", 1);

    const files = getImageFilesFromTransfer({
      files: [createTestFile("note.txt", "text/plain", 1)],
      items: [{ kind: "file", type: "image/png", getAsFile: () => image }]
    });

    assert.deepEqual(files, [image]);
  });

  test("maps legacy visual mode settings to the self-hosted editor modes", () => {
    assert.equal(resolveWysiwygDefaultMode("source"), "source");
    assert.equal(resolveWysiwygDefaultMode("ir"), "wysiwyg");
    assert.equal(resolveWysiwygDefaultMode("wysiwyg", "sv"), "source");
  });

  test("declares the runtime webview assets without copying unused KaTeX script", () => {
    const manifest = readProjectJson<{
      files: string[];
      scripts: Record<string, string>;
      dependencies: Record<string, string>;
    }>("package.json");

    for (const expectedFile of [
      "out/extension.js",
      "media/preview.css",
      "media/vendor/codicons/codicon.css",
      "media/vendor/codicons/codicon.ttf",
      "media/vendor/katex/katex.min.css",
      "media/vendor/katex/fonts/**",
      "media/vendor/mermaid/mermaid.min.js",
      "media/wysiwyg/editor.css",
      "media/wysiwyg/editor.js"
    ]) {
      assert.equal(manifest.files.includes(expectedFile), true, `${expectedFile} should be packaged`);
    }

    for (const expectedAsset of [
      "media/preview.css",
      "media/vendor/codicons/codicon.css",
      "media/vendor/codicons/codicon.ttf",
      "media/vendor/katex/katex.min.css",
      "media/vendor/mermaid/mermaid.min.js",
      "media/wysiwyg/editor.css",
      "media/wysiwyg/editor.js"
    ]) {
      assert.equal(fileExists(expectedAsset), true, `${expectedAsset} should exist after build`);
    }

    assert.match(manifest.scripts["bundle:webview"], /media\/wysiwyg\/editor-runtime\.ts/);
    assert.match(manifest.scripts["bundle:webview"], /--outfile=media\/wysiwyg\/editor\.js/);
    assert.match(manifest.scripts["bundle:webview"], /--sourcemap=external/);
    assert.equal(Boolean(manifest.dependencies["remark-math"]), true);
    assert.equal(manifest.files.includes("media/icons/**"), false);
    assert.equal(manifest.files.includes("media/vendor/katex/katex.min.js"), false);
    assert.equal(fileExists("media/vendor/katex/katex.min.js"), false);
    assert.equal(readProjectFile("scripts/copy-assets.mjs").includes("katex.min.js"), false);
  });

  test("toolbar model covers all actions with deterministic icons and host routing", () => {
    const topLevelActions = TOOLBAR_GROUPS.flatMap((group) => group.actions);
    const allActions = [...topLevelActions, ...HEADING_MENU_ACTIONS, ...EXPORT_MENU_ACTIONS];
    const previewTopLevelActions = PREVIEW_TOOLBAR_GROUPS.flatMap((group) => group.actions);
    const previewActions = [...previewTopLevelActions, ...EXPORT_MENU_ACTIONS];

    assert.equal(new Set(topLevelActions).size, topLevelActions.length);
    assert.equal(new Set(allActions).size, allActions.length);
    assert.equal(new Set(previewTopLevelActions).size, previewTopLevelActions.length);
    assert.deepEqual(getToolbarGroups("preview"), PREVIEW_TOOLBAR_GROUPS);
    assert.deepEqual(getToolbarGroups("source", "previewOnly"), PREVIEW_TOOLBAR_GROUPS);
    assert.deepEqual(getToolbarGroups("split"), TOOLBAR_GROUPS);
    assert.deepEqual(previewTopLevelActions, ["switchBackgroundTheme", "switchDisplayLanguage", "export", "help"]);
    assert.equal(previewActions.includes("bold"), false);
    assert.equal(previewActions.includes("table"), false);
    assert.equal(previewActions.includes("image"), false);
    assert.equal(previewActions.includes("toc"), false);
    assert.equal(previewActions.includes("organizeMarkdown"), false);
    assert.deepEqual([...HOST_TOOLBAR_ACTIONS].sort(), [
      "export-all",
      "export-html",
      "export-pdf",
      "help",
      "organizeMarkdown",
      "switchBackgroundTheme",
      "switchDisplayLanguage",
      "toc"
    ]);
    assert.equal(SUPER_MARKDOWN_ISSUES_URL, "https://github.com/SivanCola/super-markdown/issues");

    for (const action of allActions) {
      const icon = renderToolbarIcon(action);
      assert.match(icon, /toolbar-custom-icon|codicon codicon-/);
    }

    assert.match(renderToolbarIcon("inline-code"), /codicon-code/);
    assert.match(renderToolbarIcon("switchBackgroundTheme"), /codicon-color-mode/);
    assert.match(renderToolbarIcon("switchDisplayLanguage"), /codicon-globe/);
    assert.match(renderToolbarIcon("export"), /codicon-export/);
    assert.match(renderToolbarIcon("underline"), /toolbar-custom-icon/);
    assert.match(renderToolbarIcon("math"), /toolbar-custom-icon/);
    assert.match(renderToolbarIcon("mermaid"), /toolbar-custom-icon/);
    assert.match(renderToolbarIcon("unknown-action"), /codicon-question/);
  });
});

function projectPath(relativePath: string): string {
  return path.join(__dirname, "..", "..", relativePath);
}

function fileExists(relativePath: string): boolean {
  return fs.existsSync(projectPath(relativePath));
}

function readProjectFile(relativePath: string): string {
  return fs.readFileSync(projectPath(relativePath), "utf8");
}

function readProjectJson<T>(relativePath: string): T {
  return JSON.parse(readProjectFile(relativePath)) as T;
}

function createTestFile(name: string, type: string, lastModified: number): File {
  return new File([new Uint8Array([1, 2, 3])], name, { type, lastModified });
}
