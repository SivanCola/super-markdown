import * as assert from "node:assert/strict";
import { parseMarkdownBlocks } from "../markdown/block";

suite("shared markdown block parser", () => {
  test("parses first-class markdown blocks with source lines", () => {
    const document = parseMarkdownBlocks([
      "# 标题",
      "",
      "- [x] task",
      "",
      "| A | B |",
      "| --- | --- |",
      "| 1 | 2 |",
      "",
      "```mermaid",
      "flowchart LR",
      "```",
      "",
      "$$",
      "E = mc^2",
      "$$",
      "",
      "[^1]: note"
    ].join("\n"));

    assert.deepEqual(document.nodes.map((node) => [node.type, node.line]), [
      ["heading", 0],
      ["list", 2],
      ["table", 4],
      ["mermaid", 8],
      ["math", 12],
      ["footnote", 16]
    ]);
    assert.equal(document.footnotes.get("1"), "note");
  });

  test("closes fenced code with up to three leading spaces", () => {
    const document = parseMarkdownBlocks([
      "```js",
      "const value = 1;",
      "   ```   ",
      "# After"
    ].join("\n"));

    assert.deepEqual(document.nodes.map((node) => [node.type, node.line]), [
      ["code", 0],
      ["heading", 3]
    ]);
  });

  test("requires closing fences to match marker character and length", () => {
    const document = parseMarkdownBlocks([
      "````js",
      "```",
      "# still code",
      "````",
      "# After"
    ].join("\n"));

    assert.deepEqual(document.nodes.map((node) => [node.type, node.line]), [
      ["code", 0],
      ["heading", 4]
    ]);
    assert.equal(document.nodes[0].raw, "````js\n```\n# still code\n````");
  });

  test("preserves nested list structure and continuation lines", () => {
    const document = parseMarkdownBlocks([
      "- parent",
      "  - child",
      "    continuation",
      "- next"
    ].join("\n"));

    assert.equal(document.nodes.length, 1);
    const list = document.nodes[0];
    assert.equal(list.type, "list");
    if (list.type !== "list") {
      return;
    }

    assert.equal(list.items.length, 2);
    assert.equal(list.items[0].text, "parent");
    assert.equal(list.items[0].children?.length, 1);
    assert.equal(list.items[0].children?.[0].items[0].text, "child continuation");
    assert.equal(list.items[1].text, "next");
  });
});
