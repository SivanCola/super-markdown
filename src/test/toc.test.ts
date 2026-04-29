import * as assert from "node:assert/strict";
import { isTocStale, upsertToc } from "../markdown/toc";

suite("toc", () => {
  const levels = new Set([1, 2, 3, 4, 5, 6]);

  test("inserts a marked table of contents after H1", () => {
    const result = upsertToc("# Title\n\n## Section\n", levels);
    assert.match(result.text, /# Title\n<!-- super-markdown-toc -->/);
    assert.match(result.text, /- \[Title\]\(#title\)/);
    assert.equal(result.text.includes("  - [Section](#section)"), true);
  });

  test("detects stale toc blocks", () => {
    const text = [
      "# Title",
      "<!-- super-markdown-toc -->",
      "## Table of Contents",
      "",
      "- [Old](#old)",
      "<!-- /super-markdown-toc -->",
      "## New"
    ].join("\n");

    assert.equal(isTocStale(text, levels), true);
  });
});
