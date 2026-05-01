import * as assert from "node:assert/strict";
import { CODE_BLOCK_CLASSES, codeBlockToneLabel, nextCodeBlockTone } from "../markdown/codeBlockActions";
import { parseMarkdown, renderMarkdownCore, serializeMarkdown } from "../markdown/core";

suite("self hosted markdown core", () => {
  test("round trips common blocks through the AST serializer", () => {
    const markdown = [
      "# Title",
      "",
      "- [x] Done",
      "- [ ] Next",
      "",
      "| A | B |",
      "| --- | --- |",
      "| 1 | 2 |",
      "",
      "```ts",
      "const value = 1;",
      "```"
    ].join("\n");
    assert.equal(serializeMarkdown(parseMarkdown(markdown)), markdown);
  });

  test("renders source line attributes and heading anchors", async () => {
    const html = await renderMarkdownCore("# Hello World\n\nText");
    assert.match(html, /id="hello-world"/);
    assert.match(html, /data-source-line="0"/);
  });

  test("renders source line ranges for multiline scroll mapping", async () => {
    const html = await renderMarkdownCore("```ts\nconst value = 1;\nconsole.log(value);\n```\n\n- a\n- b", {
      highlight: false
    });
    assert.match(html, /class="code-block" data-source-line="0" data-source-end-line="3"/);
    assert.doesNotMatch(html, /<ul data-source-line=/);
    assert.match(html, /<li data-source-line="5">a<\/li>/);
    assert.match(html, /<li data-source-line="6">b<\/li>/);
  });

  test("renders mermaid and katex blocks as dedicated blocks", async () => {
    const html = await renderMarkdownCore("```mermaid\nflowchart LR\n```\n\n$$\nE = mc^2\n$$", {
      mermaidEnabled: true,
      katexEnabled: true
    });
    assert.match(html, /class="diagram-block"/);
    assert.match(html, /class="math-block"/);
  });

  test("keeps the Mermaid language label when diagrams are disabled", async () => {
    const html = await renderMarkdownCore("```mermaid\nflowchart LR\n  A --> B\n```", {
      mermaidEnabled: false,
      highlight: false
    });
    assert.match(html, /class="code-block"/);
    assert.match(html, /class="code-language">mermaid<\/span>/);
    assert.match(html, /class="shiki shiki-themes light-plus dark-plus language-text"/);
  });

  test("highlights supported languages with Shiki dual theme variables", async () => {
    const html = await renderMarkdownCore("```ts\nconst value = 1;\n```");
    assert.match(html, /class="shiki shiki-themes light-plus dark-plus language-ts"/);
    assert.match(html, /--shiki-light:/);
    assert.match(html, /--shiki-dark:/);
    assert.doesNotMatch(html, /tok-keyword/);
  });

  test("normalizes and highlights the supported code fence language set", async () => {
    for (const language of ["ts", "js", "json", "html", "css", "shell", "go", "python", "sql", "markdown", "yaml"]) {
      const html = await renderMarkdownCore(`\`\`\`${language}\nconst value = 1;\n\`\`\``);
      assert.match(html, /class="code-block"/);
      assert.match(html, /--shiki-light:/);
      assert.match(html, /--shiki-dark:/);
    }
    const text = await renderMarkdownCore("```text\nconst value = 1;\n```");
    assert.match(text, /language-text/);
    assert.match(text, /const value = 1;/);
    const unknown = await renderMarkdownCore("```made-up\n<script>alert(1)</script>\n```");
    assert.match(unknown, /language-text/);
    assert.match(unknown, /(?:&lt;|&#x3C;)script>alert\(1\)(?:&lt;|&#x3C;)\/script>/);
    assert.doesNotMatch(unknown, /<script>/);
  });

  test("can render copy controls for code blocks", async () => {
    const html = await renderMarkdownCore("```ts\nconst value = 1;\n```", {
      codeCopyButton: { copyLabel: "Copy", copiedLabel: "Copied" },
      blockToneButton: { toneLabel: "Colors", autoLabel: "Auto", lightLabel: "Light", darkLabel: "Dark" }
    });
    assert.match(html, /class="copy-code"/);
    assert.match(html, /class="code-color-toggle"/);
    assert.match(html, /data-copied-label="Copied"/);
    assert.match(html, new RegExp(`class="${CODE_BLOCK_CLASSES.copyButton}"`));
  });

  test("shares code block action model across renderers", () => {
    const labels = { toneLabel: "Colors", autoLabel: "Auto", lightLabel: "Light", darkLabel: "Dark" };
    assert.equal(nextCodeBlockTone("auto"), "light");
    assert.equal(nextCodeBlockTone("light"), "dark");
    assert.equal(nextCodeBlockTone("dark"), "auto");
    assert.equal(codeBlockToneLabel("dark", labels), "Dark");
    assert.equal(CODE_BLOCK_CLASSES.actionGroup, "code-actions");
  });

  test("renders diagram actions with copy text and tone controls", async () => {
    const html = await renderMarkdownCore("```mermaid\nsequenceDiagram\n  A->>B: ping\n```", {
      mermaidEnabled: true,
      codeCopyButton: { copyLabel: "Copy", copiedLabel: "Copied" },
      blockToneButton: { toneLabel: "Colors", autoLabel: "Auto", lightLabel: "Light", darkLabel: "Dark" }
    });
    assert.match(html, /class="diagram-block"/);
    assert.match(html, /class="code-copy-source">sequenceDiagram/);
    assert.match(html, /class="code-color-toggle"/);
  });

  test("renders image and link titles after escaping inline markdown", async () => {
    const html = await renderMarkdownCore('![Icon](<../images/local icon.png> "Local icon")\n\n[Docs](https://example.com/path(foo) \'Docs title\')');
    assert.match(html, /<img src="\.\.\/images\/local icon\.png" alt="Icon" title="Local icon"/);
    assert.match(html, /<a href="https:\/\/example\.com\/path\(foo\)" rel="noopener noreferrer" title="Docs title">Docs<\/a>/);
    assert.doesNotMatch(html, /!\[Icon]/);
  });

  test("blocks unsafe image and link urls in rendered html", async () => {
    const html = await renderMarkdownCore([
      "![x](javascript:alert(1))",
      "",
      "[bad](data:text/html,boom)",
      "",
      "[command](command:workbench.action.reloadWindow)",
      "",
      "[file](file:///tmp/a.md)",
      "",
      "[vscode](vscode://file/tmp/a.md)"
    ].join("\n"));
    assert.match(html, /<img src="#" alt="x"/);
    assert.match(html, /<a href="#" rel="noopener noreferrer">bad<\/a>/);
    assert.match(html, /<a href="#" rel="noopener noreferrer">command<\/a>/);
    assert.match(html, /<a href="#" rel="noopener noreferrer">file<\/a>/);
    assert.match(html, /<a href="#" rel="noopener noreferrer">vscode<\/a>/);
    assert.doesNotMatch(html, /javascript:alert/);
    assert.doesNotMatch(html, /data:text\/html/);
    assert.doesNotMatch(html, /command:workbench/);
    assert.doesNotMatch(html, /file:\/\/\//);
    assert.doesNotMatch(html, /vscode:\/\//);
  });

  test("renders safe underline, mark and keyboard inline tags while escaping unknown html", async () => {
    const html = await renderMarkdownCore("<u>under **bold**</u> and <mark>*hot*</mark> <kbd>Cmd</kbd> <span>raw</span>");
    assert.match(html, /<u>under <strong>bold<\/strong><\/u>/);
    assert.match(html, /<mark><em>hot<\/em><\/mark>/);
    assert.match(html, /<kbd>Cmd<\/kbd>/);
    assert.match(html, /&lt;span&gt;raw&lt;\/span&gt;/);
  });

  test("renders footnote references and missing footnotes through shared helpers", async () => {
    const html = await renderMarkdownCore("Known[^render] and missing[^missing-note].\n\n[^render]: local renderer");
    assert.match(html, /<sup id="fnref-render"><a href="#fn-render">render<\/a><\/sup>/);
    assert.match(html, /<li id="fn-render">local renderer<\/li>/);
    assert.match(html, /missing\[\^missing-note\]/);
  });

  test("detects GFM alert blockquotes without allowing executable html", async () => {
    const html = await renderMarkdownCore("> [!WARNING]\n> Stay safe <script>alert(1)</script>");
    assert.match(html, /class="admonition admonition-warning"/);
    assert.match(html, /<p class="admonition-title">WARNING<\/p>/);
    assert.doesNotMatch(html, /<script/i);
    assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  });

  test("escapes hostile raw html without creating executable nodes", async () => {
    const html = await renderMarkdownCore([
      "Raw HTML should stay inert:",
      "",
      "<script>console.log('x')</script>",
      "",
      "<img src=x onerror=alert(1)>",
      "",
      "</textarea><script>alert(2)</script>",
      "",
      "</script><template><script>alert(3)</script></template>"
    ].join("\n"));

    assert.doesNotMatch(html, /<script/i);
    assert.doesNotMatch(html, /<template/i);
    assert.doesNotMatch(html, /<\/textarea>/i);
    assert.match(html, /class="visual-html-source raw-html-source"/);
    assert.match(html, /class="visual-html-label">RAW HTML ESCAPED/);
    assert.match(html, /class="safe-html-source"/);
    assert.match(html, /&lt;script&gt;console\.log/);
    assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  });
});
