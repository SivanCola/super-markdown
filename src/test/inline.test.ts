import * as assert from "node:assert/strict";
import { extractInlineLinks, inlineTokensToPlainText, parseInlineMarkdown, stripInlineMarkdown } from "../markdown/inline";
import { extractMarkdownInlineLinks } from "../markdown/links";

suite("inline markdown parser", () => {
  test("parses image and link targets with title variants", () => {
    const links = extractInlineLinks([
      "![Icon](<../images/local icon.png> 'Local icon')",
      "[Docs](https://example.com/path(foo) \"Docs title\")",
      "[Api](api.md (API reference))"
    ].join(" "));

    assert.deepEqual(
      links.map((link) => ({
        image: link.image,
        label: link.label,
        destination: link.destination,
        title: link.title
      })),
      [
        { image: true, label: "Icon", destination: "../images/local icon.png", title: "Local icon" },
        { image: false, label: "Docs", destination: "https://example.com/path(foo)", title: "Docs title" },
        { image: false, label: "Api", destination: "api.md", title: "API reference" }
      ]
    );
  });

  test("strips inline markdown through shared token plain text", () => {
    const source = "![Logo](<icon file.png> \"Title\") [**API**](https://example.com/foo(bar) \"Title\") and `code`";
    assert.equal(stripInlineMarkdown(source), "Logo API and code");
    assert.equal(inlineTokensToPlainText(parseInlineMarkdown(source)), "Logo API and code");
  });

  test("parses safe underline, mark and keyboard tags as inline formatting", () => {
    const tokens = parseInlineMarkdown("<u>under **bold**</u> and <mark>*hot*</mark> with <kbd>Cmd</kbd>");
    assert.equal(tokens.some((token) => token.type === "underline"), true);
    assert.equal(tokens.some((token) => token.type === "mark"), true);
    assert.equal(tokens.some((token) => token.type === "kbd"), true);
    assert.equal(inlineTokensToPlainText(tokens), "under bold and hot with Cmd");
  });

  test("extracts document image links through block-aware parsing", () => {
    const links = extractMarkdownInlineLinks([
      "```text",
      "![ignored](inside-code.png)",
      "`",
      "```",
      "",
      "$$",
      "x = y",
      "$$",
      "",
      "![Icon](../images/icon.png \"Local icon\")",
      "",
      "> ![Quoted](../images/quoted.png)",
      "",
      "| Name | Asset |",
      "| --- | --- |",
      "| screenshot | ![Shot](../images/shot.png) |"
    ].join("\n"));

    assert.deepEqual(
      links.filter((link) => link.image).map((link) => link.destination),
      ["../images/icon.png", "../images/quoted.png", "../images/shot.png"]
    );
  });
});
