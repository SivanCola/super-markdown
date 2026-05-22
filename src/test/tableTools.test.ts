import * as assert from "node:assert/strict";
import { createMarkdownTable, jsonToMarkdownTable, mdTableToJson } from "../markdown/tableTools";

suite("tableTools", () => {
  test("converts markdown table to json", () => {
    const json = mdTableToJson("| name | code |\n| --- | --- |\n| a | `x\\|y` |");
    assert.deepEqual(json, [{ name: "a", code: "`x|y`" }]);
  });

  test("converts json array to markdown table", () => {
    const table = jsonToMarkdownTable([{ name: "a", count: 2 }]);
    assert.equal(table, "| name | count |\n| ---- | ----- |\n|  a   |   2   |");
  });

  test("creates an empty markdown table with the requested dimensions", () => {
    const table = createMarkdownTable(3, 4);

    assert.equal(
      table,
      [
        "| Column 1 | Column 2 | Column 3 | Column 4 |",
        "| --- | --- | --- | --- |",
        "|  |  |  |  |",
        "|  |  |  |  |"
      ].join("\n")
    );
  });

  test("rejects invalid values", () => {
    assert.throws(() => jsonToMarkdownTable({ name: "a" }));
    assert.throws(() => mdTableToJson("not a table"));
  });
});
