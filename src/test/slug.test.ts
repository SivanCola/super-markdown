import * as assert from "node:assert/strict";
import { baseSlug, slugifyHeadings } from "../markdown/slug";

suite("slug", () => {
  test("creates GitHub-style base slugs", () => {
    assert.equal(baseSlug("Hello World!"), "hello-world");
    assert.equal(baseSlug("中文 标题"), "中文-标题");
    assert.equal(baseSlug("Use `code` and **bold**"), "use-code-and-bold");
  });

  test("deduplicates repeated headings", () => {
    assert.deepEqual(slugifyHeadings(["Intro", "Intro", "Intro"]), ["intro", "intro-1", "intro-2"]);
  });
});
