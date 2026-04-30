import * as assert from "node:assert/strict";
import { jsonToMarkdownTable, mdTableToJson } from "../markdown/tableTools";

suite("tableTools", () => {
  test("converts markdown table to json", () => {
    const json = mdTableToJson("| name | code |\n| --- | --- |\n| a | `x\\|y` |");
    assert.deepEqual(json, [{ name: "a", code: "`x|y`" }]);
  });

  test("converts json array to markdown table", () => {
    const table = jsonToMarkdownTable([{ name: "a", count: 2 }]);
    assert.equal(table, "| name | count |\n| ---- | ----- |\n|  a   |   2   |");
  });

  test("rejects invalid values", () => {
    assert.throws(() => jsonToMarkdownTable({ name: "a" }));
    assert.throws(() => mdTableToJson("not a table"));
  });
});
