import * as assert from "node:assert/strict";
import {
  detectBlockquoteAdmonition,
  normalizeFootnoteId,
  renderInertInlineHtml,
  renderKatexHtml,
  renderSafeInlineHtmlToken,
  resolveFootnoteReference
} from "../markdown/features";

suite("shared markdown feature layer", () => {
  test("renders math through the shared KaTeX fragment renderer", () => {
    const enabled = renderKatexHtml("x^2", false, { katexEnabled: true });
    const disabled = renderKatexHtml("x^2", false, { katexEnabled: false });

    assert.match(enabled, /katex/);
    assert.match(disabled, /<code>\$x\^2\$<\/code>/);
  });

  test("normalizes footnote references for renderers and editor node views", () => {
    const model = resolveFootnoteReference("Render Note", new Map([["Render Note", "text"]]));

    assert.equal(normalizeFootnoteId("Render Note"), "render-note");
    assert.equal(model.exists, true);
    assert.equal(model.referenceId, "fnref-render-note");
    assert.equal(model.definitionId, "fn-render-note");
  });

  test("keeps only safe inline html semantic tags active", () => {
    assert.equal(renderSafeInlineHtmlToken("kbd", "Cmd"), "<kbd>Cmd</kbd>");
    assert.equal(renderInertInlineHtml("<script>alert(1)</script>"), '<code class="safe-html-source">&lt;script&gt;alert(1)&lt;/script&gt;</code>');
  });

  test("detects blockquote alert syntax as inert semantics", () => {
    assert.deepEqual(detectBlockquoteAdmonition("[!NOTE]\nBody"), {
      type: "note",
      label: "NOTE",
      body: "Body"
    });
    assert.equal(detectBlockquoteAdmonition("Plain quote"), null);
  });
});
