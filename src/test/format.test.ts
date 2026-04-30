import * as assert from "node:assert/strict";
import { formatMarkdown } from "../markdown/format";
import { FormatSettings } from "../types";

const settings: FormatSettings = {
  enable: true,
  punctuationWidth: "auto",
  punctuationSpacing: "half",
  table: { enabled: true, cjkCharWidth: 2 },
  list: { markerStyle: "cycle", markerCycle: ["*", "+", "-"], padOrderedNumbers: true },
  code: { enabled: true, indentedCodeToFenceLanguage: "", beautifyOptions: {} },
  timeHeader: { enabled: false },
  specialTextSpacing: true
};

suite("formatMarkdown", () => {
  test("respects file disable marker", () => {
    const input = "<!-- /* md-file-format-disable */ -->\n-   item";
    assert.equal(formatMarkdown(input, settings).text, input);
  });

  test("protects fenced code, inline code, and urls", () => {
    const input = "Text`code()`and https://example.com/a,b\n\n```js\nconst x={a:1};\n```";
    const result = formatMarkdown(input, settings).text;
    assert.match(result, /Text `code\(\)` and https:\/\/example\.com\/a,b/);
    assert.match(result, new RegExp("const x = \\{\\n {4}a: 1\\n\\};"));
  });

  test("formats CJK tables and quoted tables", () => {
    const result = formatMarkdown("> | 名称 | value |\n> |---|---:|\n> | 苹果 | 2 |", settings).text;
    assert.equal(result, "> | 名称 | value |\n> | ---- | -----: |\n> | 苹果 |     2 |");
  });

  test("cycles unordered list markers", () => {
    const result = formatMarkdown("- a\n  - b\n    - c", settings).text;
    assert.equal(result, "* a\n  + b\n    - c");
  });

  test("preserves CRLF", () => {
    const result = formatMarkdown("-   a\r\n-   b\r\n", settings).text;
    assert.equal(result, "* a\r\n* b\r\n");
  });
});
