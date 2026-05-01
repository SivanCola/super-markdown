import * as assert from "node:assert/strict";
import {
  formatMarkdownTableRows,
  isMarkdownTableDelimiter,
  parseMarkdownTableAt,
  serializeMarkdownTable,
  splitMarkdownTableRow
} from "../markdown/table";

suite("shared markdown table parser", () => {
  test("splits escaped pipes and inline code pipes consistently", () => {
    assert.deepEqual(splitMarkdownTableRow("| name | `x\\|y` | a\\|b |"), ["name", "`x|y`", "a|b"]);
  });

  test("parses table alignment and ragged rows", () => {
    const parsed = parseMarkdownTableAt([
      "| left | center | right |",
      "| :--- | :---: | ---: |",
      "| a | b |",
      "after"
    ], 0);
    assert.ok(parsed);
    assert.deepEqual(parsed.table.aligns, ["left", "center", "right"]);
    assert.deepEqual(parsed.table.rows, [["a", "b"]]);
    assert.equal(parsed.nextLine, 3);
  });

  test("serializes and formats through the shared table model", () => {
    assert.equal(isMarkdownTableDelimiter("| :--- | ---: |"), true);
    assert.equal(serializeMarkdownTable({
      headers: ["name", "code"],
      aligns: [undefined, "right"],
      rows: [["a", "`x|y`"]]
    }), "| name | code |\n| --- | ---: |\n| a | `x\\|y` |");
    assert.deepEqual(
      formatMarkdownTableRows(["| 名称 | value |", "|---|---:|", "| 苹果 | 2 |"], 2),
      ["| 名称 | value |", "| ---- | -----: |", "| 苹果 |     2 |"]
    );
  });
});
