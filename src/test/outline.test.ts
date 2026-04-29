import * as assert from "node:assert/strict";
import { buildHeadingTree, extractHeadings, parseTocLevels } from "../markdown/outline";

suite("outline", () => {
  test("extracts ATX headings outside code fences", () => {
    const text = [
      "# Title",
      "",
      "```",
      "## Not a heading",
      "```",
      "## Section",
      "### Child"
    ].join("\n");

    const headings = extractHeadings(text);
    assert.deepEqual(
      headings.map((heading) => [heading.level, heading.text, heading.line]),
      [
        [1, "Title", 0],
        [2, "Section", 5],
        [3, "Child", 6]
      ]
    );
  });

  test("builds a heading tree", () => {
    const tree = buildHeadingTree(extractHeadings("# A\n## B\n### C\n## D"));
    assert.equal(tree.length, 1);
    assert.equal(tree[0].children.length, 2);
    assert.equal(tree[0].children[0].children[0].text, "C");
  });

  test("parses level ranges", () => {
    assert.deepEqual([...parseTocLevels("2..4")], [2, 3, 4]);
    assert.deepEqual([...parseTocLevels("3")], [3]);
  });
});
