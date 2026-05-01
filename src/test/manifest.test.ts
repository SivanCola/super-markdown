import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";

suite("extension manifest", () => {
  const root = path.join(__dirname, "..", "..");
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

  test("uses Super Markdown Editor as the only Markdown custom editor", () => {
    assert.deepEqual(
      manifest.contributes.customEditors.map((editor: { viewType: string }) => editor.viewType),
      ["superMarkdown.editor"]
    );
    assert.equal(manifest.contributes.customEditors[0].priority, "default");
    assert.deepEqual(manifest.activationEvents.filter((event: string) => event.startsWith("onCustomEditor:")), [
      "onCustomEditor:superMarkdown.editor"
    ]);
  });

  test("associates Markdown files with the main editor", () => {
    assert.deepEqual(manifest.contributes.configurationDefaults["workbench.editorAssociations"], {
      "*.md": "superMarkdown.editor",
      "*.markdown": "superMarkdown.editor",
      "*.mdown": "superMarkdown.editor",
      "*.mkdn": "superMarkdown.editor"
    });
  });

  test("declares limited Restricted Mode support for webview editing", () => {
    assert.deepEqual(manifest.capabilities.untrustedWorkspaces.supported, "limited");
    assert.match(manifest.capabilities.untrustedWorkspaces.description, /split scroll sync/);
  });

  test("does not keep the legacy preview editor command", () => {
    const contributedCommands = manifest.contributes.commands.map((item: { command: string }) => item.command);
    const menuCommands = Object.values(manifest.contributes.menus).flatMap((items) =>
      (items as Array<{ command?: string }>).map((item) => item.command).filter(Boolean)
    );
    assert.equal(manifest.activationEvents.includes("onCommand:superMarkdown.openWithPreviewEditor"), false);
    assert.equal(contributedCommands.includes("superMarkdown.openWithPreviewEditor"), false);
    assert.equal(menuCommands.includes("superMarkdown.openWithPreviewEditor"), false);
  });

  test("does not expose a standalone document health command", () => {
    const contributedCommands = manifest.contributes.commands.map((item: { command: string }) => item.command);
    const menuCommands = Object.values(manifest.contributes.menus).flatMap((items) =>
      (items as Array<{ command?: string }>).map((item) => item.command).filter(Boolean)
    );
    const extensionSource = fs.readFileSync(path.join(root, "src", "extension.ts"), "utf8");
    const webviewSource = fs.readFileSync(
      path.join(root, "src", "wysiwyg", "SuperMarkdownWysiwygEditorProvider.ts"),
      "utf8"
    );
    const webviewScript = fs.readFileSync(path.join(root, "media", "wysiwyg", "editor.js"), "utf8");

    for (const command of [
      "superMarkdown.showDocumentHealth",
      "superMarkdown.en.showDocumentHealth",
      "superMarkdown.zhCN.showDocumentHealth"
    ]) {
      assert.equal(manifest.activationEvents.includes(`onCommand:${command}`), false);
      assert.equal(contributedCommands.includes(command), false);
      assert.equal(menuCommands.includes(command), false);
    }
    assert.equal(extensionSource.includes("showDocumentHealth"), false);
    assert.equal(webviewSource.includes("showDocumentHealth"), false);
    assert.equal(webviewScript.includes("showDocumentHealth"), false);
  });

  test("uses localized aliases for visible Markdown mode menus", () => {
    const visibleMenuCommands = Object.entries(manifest.contributes.menus)
      .filter(([menu]) => menu !== "commandPalette")
      .flatMap(([, items]) => (items as Array<{ command?: string }>).map((item) => item.command).filter(Boolean));
    for (const command of [
      "superMarkdown.openEditor",
      "superMarkdown.openNativeTextEditor",
      "superMarkdown.openWysiwygEditor"
    ]) {
      assert.equal(visibleMenuCommands.includes(command), false);
    }
    for (const command of [
      "superMarkdown.en.openEditor",
      "superMarkdown.zhCN.openEditor",
      "superMarkdown.en.openNativeTextEditor",
      "superMarkdown.zhCN.openNativeTextEditor",
      "superMarkdown.en.openWysiwygEditor",
      "superMarkdown.zhCN.openWysiwygEditor"
    ]) {
      assert.equal(manifest.contributes.commands.some((item: { command: string }) => item.command === command), true);
    }
  });

  test("keeps the editor title context menu focused on opening the native editor", () => {
    const titleContextCommands = manifest.contributes.menus["editor/title/context"]
      .map((item: { command?: string }) => item.command)
      .filter(Boolean);

    assert.deepEqual(titleContextCommands, [
      "superMarkdown.en.openNativeTextEditor",
      "superMarkdown.zhCN.openNativeTextEditor"
    ]);
  });

  test("does not add a Super Markdown button to the native editor title bar", () => {
    assert.equal(manifest.contributes.submenus, undefined);
    assert.equal(manifest.contributes.menus["editor/title"], undefined);
    assert.equal(manifest.contributes.menus["superMarkdown.editorTitle"], undefined);
  });

  test("keeps the native editor context menu focused on modes and document actions", () => {
    const editorContextItems = manifest.contributes.menus["editor/context"] as Array<{
      command?: string;
      group?: string;
    }>;
    const editorContextCommands = editorContextItems.map((item) => item.command).filter(Boolean);

    assert.deepEqual(editorContextCommands, [
      "superMarkdown.en.openPreview",
      "superMarkdown.zhCN.openPreview",
      "superMarkdown.en.openSplitEditMode",
      "superMarkdown.zhCN.openSplitEditMode",
      "superMarkdown.en.openWysiwygEditor",
      "superMarkdown.zhCN.openWysiwygEditor",
      "superMarkdown.export.choose"
    ]);
    assert.deepEqual(
      editorContextItems.map((item) => item.group),
      [
        "navigation@20",
        "navigation@20",
        "navigation@21",
        "navigation@21",
        "navigation@22",
        "navigation@22",
        "navigation@23"
      ]
    );
  });

  test("routes Markdown modes through the main custom editor", () => {
    const extensionSource = fs.readFileSync(path.join(root, "src", "extension.ts"), "utf8");
    assert.equal(extensionSource.includes("SUPER_MARKDOWN_WYSIWYG_EDITOR_VIEW_TYPE"), false);
    assert.equal(extensionSource.includes("SUPER_MARKDOWN_PREVIEW_EDITOR_VIEW_TYPE"), false);
    assert.equal(extensionSource.includes("PreviewManager"), false);
    assert.equal(fs.existsSync(path.join(root, "src", "preview", "PreviewManager.ts")), false);
    assert.equal(fs.existsSync(path.join(root, "src", "preview", "SuperMarkdownPreviewEditorProvider.ts")), false);
    assert.equal(fs.existsSync(path.join(root, "src", "preview", "html.ts")), false);
    assert.equal(fs.existsSync(path.join(root, "media", "preview.js")), false);
    assert.equal(extensionSource.includes("superMarkdown.previewEditor"), false);
    assert.equal(extensionSource.includes("superMarkdown.wysiwygEditor"), false);
  });
});
