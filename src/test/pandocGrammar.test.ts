import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";

suite("pandoc grammar assets", () => {
  test("includes Pandoc-aware markdown grammar", () => {
    const grammarPath = path.resolve(__dirname, "..", "..", "syntaxes", "markdown.tmLanguage.json");
    const grammar = fs.readFileSync(grammarPath, "utf8");
    assert.match(grammar, /citation/);
    assert.match(grammar, /fenced[-_ ]?div/i);
    assert.match(grammar, /bracketed[-_ ]?span/i);
  });
});
