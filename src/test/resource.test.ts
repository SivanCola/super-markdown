import * as assert from "node:assert/strict";
import * as path from "node:path";
import { parseMarkdownResourceTarget, pathToFileUrl } from "../markdown/resource";

suite("markdown resource targets", () => {
  test("normalizes local targets with spaces, query, and hash", () => {
    const source = path.join(path.sep, "tmp", "docs", "doc.md");
    const target = parseMarkdownResourceTarget("<images/a%20b.png?raw=1#pic>", source);
    assert.equal(target.kind, "local");
    assert.equal(target.withoutHashAndQuery, "images/a%20b.png");
    assert.equal(target.decodedPath, "images/a b.png");
    assert.equal(target.absolutePath, path.join(path.sep, "tmp", "docs", "images", "a b.png"));
  });

  test("keeps external and file targets distinct", () => {
    assert.equal(parseMarkdownResourceTarget("https://example.com/a.png").kind, "external");
    assert.equal(parseMarkdownResourceTarget("data:image/png;base64,AA==").kind, "data");
    assert.equal(parseMarkdownResourceTarget("file:///tmp/a.png").kind, "file");
    assert.equal(pathToFileUrl(path.join(path.sep, "tmp", "a b.png")), "file:///tmp/a%20b.png");
  });
});
