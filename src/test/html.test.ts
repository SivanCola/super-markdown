import * as assert from "node:assert/strict";
import { escapeAttribute, escapeHtml, escapeJsonForScript, safeInlineUrl } from "../utils/html";

suite("html utils", () => {
  test("escapes html text and attributes", () => {
    assert.equal(escapeHtml("<a&b\""), "&lt;a&amp;b&quot;");
    assert.equal(escapeAttribute("'quoted'"), "&#39;quoted&#39;");
  });

  test("blocks unsafe inline urls", () => {
    assert.equal(safeInlineUrl("javascript:alert(1)"), "#");
    assert.equal(safeInlineUrl("java\nscript:alert(1)"), "#");
    assert.equal(safeInlineUrl("command:workbench.action.reloadWindow"), "#");
    assert.equal(safeInlineUrl("vscode://file/tmp/a"), "#");
    assert.equal(safeInlineUrl("file:///tmp/a.md"), "#");
    assert.equal(safeInlineUrl("data:text/html,boom"), "#");
    assert.equal(safeInlineUrl("https://example.com"), "https://example.com");
    assert.equal(safeInlineUrl("mailto:test@example.com"), "mailto:test@example.com");
    assert.equal(safeInlineUrl("../relative doc.md#heading"), "../relative doc.md#heading");
    assert.equal(safeInlineUrl("#local-heading"), "#local-heading");
  });

  test("escapes json before embedding in webview script data", () => {
    const json = JSON.stringify({
      markdown: '<script>console.log("x")</script><template>bad</template>&'
    });
    const escaped = escapeJsonForScript(json);

    assert.equal(escaped.includes("<script>"), false);
    assert.equal(escaped.includes("</script>"), false);
    assert.equal(escaped.includes("<template>"), false);
    assert.equal(escaped.includes("&"), false);
    assert.deepEqual(JSON.parse(escaped), JSON.parse(json));
  });
});
