import * as assert from "node:assert/strict";
import {
  aggregateMarkdownWorkspaceSummary,
  analyzeMarkdownWorkspaceText,
  buildMarkdownWorkspaceTree,
  isExcludedMarkdownWorkspacePath,
  isMarkdownWorkspacePath,
  MarkdownWorkspaceFile
} from "../sidebar/markdownWorkspace";
import { DocumentIssue } from "../types";

suite("markdown workspace sidebar", () => {
  test("matches Markdown extensions and excludes common generated directories", () => {
    assert.equal(isMarkdownWorkspacePath("README.md"), true);
    assert.equal(isMarkdownWorkspacePath("guide.MARKDOWN"), true);
    assert.equal(isMarkdownWorkspacePath("notes.txt"), false);
    assert.equal(isExcludedMarkdownWorkspacePath("docs/readme.md"), false);
    assert.equal(isExcludedMarkdownWorkspacePath("node_modules/pkg/readme.md"), true);
    assert.equal(isExcludedMarkdownWorkspacePath("packages/app/dist/readme.md"), true);
  });

  test("analyzes document title, resources, tasks, and issue counts", () => {
    const issues: DocumentIssue[] = [
      { severity: "warning", code: "stale-toc", message: "stale" },
      { severity: "error", code: "broken-image", message: "missing", target: "missing.png" }
    ];
    const result = analyzeMarkdownWorkspaceText(
      "# Product Guide\n\n![Logo](missing.png)\n[Home](../README.md)\n- [ ] ship it",
      "fallback.md",
      issues
    );

    assert.equal(result.title, "Product Guide");
    assert.equal(result.stats.headingCount, 1);
    assert.equal(result.stats.issueCount, 2);
    assert.equal(result.stats.errorCount, 1);
    assert.equal(result.stats.warningCount, 1);
    assert.equal(result.stats.uncheckedTaskCount, 1);
    assert.equal(result.stats.imageCount, 1);
    assert.equal(result.stats.linkCount, 1);
    assert.equal(result.stats.brokenImageCount, 1);
    assert.equal(result.stats.staleToc, true);
  });

  test("aggregates workspace summary and builds single-root directory trees", () => {
    const files: MarkdownWorkspaceFile[] = [
      workspaceFile("docs/a.md", "A", { issueCount: 1, uncheckedTaskCount: 2, imageCount: 1 }),
      workspaceFile("docs/nested/b.md", "B", { brokenLinkCount: 1, staleToc: true }),
      workspaceFile("README.md", "Readme", { linkCount: 3 })
    ];

    const summary = aggregateMarkdownWorkspaceSummary(files);
    const tree = buildMarkdownWorkspaceTree(files, { multiRoot: false });

    assert.equal(summary.fileCount, 3);
    assert.equal(summary.issueCount, 1);
    assert.equal(summary.uncheckedTaskCount, 2);
    assert.equal(summary.brokenLinkCount, 1);
    assert.equal(summary.staleTocFileCount, 1);
    assert.deepEqual(tree.map((node) => node.name), ["docs", "README.md"]);
    assert.equal(tree[0].type, "directory");
    assert.deepEqual(tree[0].children.map((node) => node.name), ["nested", "a.md"]);
  });

  test("groups tree roots by workspace folder when multiple roots are open", () => {
    const files = [
      workspaceFile("a.md", "A", {}, "docs"),
      workspaceFile("b.md", "B", {}, "notes")
    ];
    const tree = buildMarkdownWorkspaceTree(files, { multiRoot: true });

    assert.deepEqual(tree.map((node) => node.name), ["docs", "notes"]);
  });
});

function workspaceFile(
  relativePath: string,
  title: string,
  stats: Partial<MarkdownWorkspaceFile["stats"]>,
  workspaceFolderName = "workspace"
): MarkdownWorkspaceFile {
  return {
    uriString: `file:///${relativePath}`,
    workspaceFolderName,
    relativePath,
    filename: relativePath.split("/").pop() || relativePath,
    title,
    issues: [],
    updatedAt: 0,
    stats: {
      headingCount: 0,
      issueCount: 0,
      errorCount: 0,
      warningCount: 0,
      infoCount: 0,
      uncheckedTaskCount: 0,
      imageCount: 0,
      linkCount: 0,
      brokenImageCount: 0,
      brokenLinkCount: 0,
      staleToc: false,
      ...stats
    }
  };
}
