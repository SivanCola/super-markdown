import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const { JSDOM } = await import("jsdom").catch(() => {
  console.error("Missing optional dependency `jsdom`. Install it before running scripts/diag-editor.mjs.");
  process.exit(1);
});

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const editorJs = await readFile(resolve(root, "media/wysiwyg/editor.js"), "utf8");

const testFile = process.argv[2] || resolve(root, "tests", "overview.md");
const docText = await readFile(testFile, "utf8");
console.log("[input]", testFile, `(${docText.length} chars)`);

const payload = {
  text: docText,
  mode: "source",
  layout: "splitEdit",
  customCss: "",
  useVsCodeThemeColors: false,
  fileName: "test.md",
  mermaidScript: "media/vendor/mermaid/mermaid.min.js",
  preview: {
    html: "<p data-source-line=\"0\">stub</p>",
    markdown: docText,
    headings: [],
    blocks: []
  },
  translations: { toolbar: {} }
};

const html = `<!DOCTYPE html><html><body class="layout-splitEdit mode-source" data-script-state="pending">
<button id="side-panel-toggle"></button>
<aside id="side-panel"><nav id="outline"></nav><input id="outline-search"></aside>
<div id="editor-toolbar-slot"></div>
<textarea id="source-editor"></textarea>
<div id="visual-editor"></div>
<main id="preview"><article class="markdown-body">${payload.preview.html}</article></main>
<script id="payload" type="application/json">${JSON.stringify(payload).replace(/<\/script/gi, "<\\/script")}</script>
</body></html>`;

const dom = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true });
const { window } = dom;

window.acquireVsCodeApi = () => ({
  postMessage: (m) => console.log("[postMessage]", m.type, Object.keys(m)),
  getState: () => null,
  setState: () => {}
});
window.requestAnimationFrame = (cb) => setTimeout(cb, 0);
window.cancelAnimationFrame = (id) => clearTimeout(id);
window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
window.addEventListener("error", (e) => {
  console.error("[window.error]", e.error?.message || e.message, e.error?.stack);
});

try {
  window.eval(editorJs);
  console.log("[done] scriptState =", window.document.body.dataset.scriptState);
  const src = window.document.getElementById("source-editor");
  const prev = window.document.getElementById("preview");
  console.log("[scroll handlers] source.onscroll=", typeof src.onscroll, "preview.onscroll=", typeof prev.onscroll);
  console.log("[body classes]", window.document.body.className);
} catch (err) {
  console.error("[THROW]", err.message);
  console.error(err.stack);
}
