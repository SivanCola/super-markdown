import * as assert from "node:assert/strict";
import { formatMarkdownTables, normalizeListSpacing, numberMarkdownHeadings } from "../markdown/organize";

suite("organize", () => {
  test("normalizes list and task spacing", () => {
    const result = normalizeListSpacing("-   item\n- [x]done\n1.   ordered").text;
    assert.equal(result, "- item\n- [x] done\n1. ordered");
  });

  test("formats simple markdown tables", () => {
    const result = formatMarkdownTables("| a | longer |\n|---|---:|\n| x | y |").text;
    assert.equal(result, "| a   | longer |\n| --- | ------: |\n| x   |      y |");
  });

  test("numbers h2-h6 headings", () => {
    const result = numberMarkdownHeadings("# Title\n## Intro\n### Deep\n## Next").text;
    assert.equal(result, "# Title\n## 1. Intro\n### 1.1. Deep\n## 2. Next");
  });
});
