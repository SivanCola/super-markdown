import { expect, type Page, test } from "@playwright/test";
import { HEADING_MENU_ACTIONS, MORE_MENU_ACTIONS, TOOLBAR_GROUPS } from "../../src/wysiwyg/toolbar";
import { createWebviewHarnessHtml, editorRuntimePath, type HarnessMode } from "./harness";

type HostMessage = Record<string, unknown>;
type OpenHarnessOptions = Omit<Parameters<typeof createWebviewHarnessHtml>[0], "mode"> & {
  mermaidRuntime?: "serial-only";
};

interface ActionExpectation {
  splitFragments?: string[];
  wysiwygFragments?: string[];
  message?: HostMessage;
  menu?: "heading" | "more";
  imageChooser?: true;
}

const ALL_TOOLBAR_ACTIONS = Array.from(new Set([
  ...TOOLBAR_GROUPS.flatMap((group) => group.actions),
  ...HEADING_MENU_ACTIONS,
  ...MORE_MENU_ACTIONS
]));

const EXPECTATIONS: Record<string, ActionExpectation> = {
  bold: { splitFragments: ["**alpha**"], wysiwygFragments: ["**alpha**"] },
  italic: { splitFragments: ["*alpha*"], wysiwygFragments: ["*alpha*"] },
  underline: { splitFragments: ["<u>alpha</u>"], wysiwygFragments: ["<u>alpha</u>"] },
  strike: { splitFragments: ["~~alpha~~"], wysiwygFragments: ["~~alpha~~"] },
  highlight: { splitFragments: ["==alpha=="], wysiwygFragments: ["==alpha=="] },
  heading: { menu: "heading" },
  "heading-1": { splitFragments: ["# alpha"], wysiwygFragments: ["# alpha"] },
  "heading-2": { splitFragments: ["## alpha"], wysiwygFragments: ["## alpha"] },
  "heading-3": { splitFragments: ["### alpha"], wysiwygFragments: ["### alpha"] },
  "heading-4": { splitFragments: ["#### alpha"], wysiwygFragments: ["#### alpha"] },
  "heading-5": { splitFragments: ["##### alpha"], wysiwygFragments: ["##### alpha"] },
  "heading-6": { splitFragments: ["###### alpha"], wysiwygFragments: ["###### alpha"] },
  hr: { splitFragments: ["---"], wysiwygFragments: ["***"] },
  quote: { splitFragments: ["> alpha"], wysiwygFragments: ["> alpha"] },
  list: { splitFragments: ["- alpha"], wysiwygFragments: ["* alpha"] },
  "ordered-list": { splitFragments: ["1. alpha"], wysiwygFragments: ["1. alpha"] },
  task: { splitFragments: ["- [ ] alpha"], wysiwygFragments: ["* [ ] Task"] },
  "task-checked": { splitFragments: ["- [x] alpha"], wysiwygFragments: ["* [x] Task"] },
  link: { splitFragments: ["[alpha](https://example.com)"], wysiwygFragments: ["[alpha](https://example.com)"] },
  image: { imageChooser: true },
  "inline-code": { splitFragments: ["`alpha`"], wysiwygFragments: ["`alpha`"] },
  code: { splitFragments: ["```alpha\ncode\n```"], wysiwygFragments: ["```", "alpha"] },
  table: {
    splitFragments: ["| Column | Value |", "| Item | Value |"],
    wysiwygFragments: ["|"]
  },
  math: { splitFragments: ["$$\nx = y\n$$"], wysiwygFragments: ["$$", "x = y"] },
  mermaid: { splitFragments: ["```mermaid", "A --> B"], wysiwygFragments: ["```mermaid", "A --> B"] },
  toc: { message: { type: "toolbarCommand", action: "toc" } },
  organizeMarkdown: { message: { type: "runHostCommand", command: "organizeMarkdown" } },
  more: { menu: "more" },
  "export-html": { message: { type: "export", format: "html" } },
  "export-pdf": { message: { type: "export", format: "pdf" } },
  "export-all": { message: { type: "export", format: "all" } },
  help: { message: { type: "openLink", href: "https://github.com/SivanCola/super-markdown/issues" } }
};

test("toolbar test matrix covers every rendered action", () => {
  expect(Object.keys(EXPECTATIONS).sort()).toEqual([...ALL_TOOLBAR_ACTIONS].sort());
});

test("toolbar uses Codicon icons with a small custom fallback set", async ({ page }) => {
  await openHarness(page, "split");
  const topLevelActionCount = TOOLBAR_GROUPS.reduce((total, group) => total + group.actions.length, 0);

  await expect(page.locator(".toolbar-icon .codicon")).toHaveCount(topLevelActionCount - 4);
  await expect(page.locator(".toolbar-custom-icon")).toHaveCount(4);
  await expect(page.locator('[data-action="inline-code"] .codicon-code')).toBeVisible();
  await expect(page.locator('[data-menu-toggle="more"] .codicon-more')).toBeVisible();
});

test("mermaid preview failures stay local to the diagram", async ({ page }) => {
  await openHarness(page, "split", {
    text: "```mermaid\nflowchart LR\n  A --> B\n```",
    previewHtml: '<figure class="diagram-block"><pre class="mermaid">flowchart LR\n  A --> B</pre></figure>'
  });

  const mermaid = page.locator(".diagram-block .mermaid").first();
  await expect(mermaid).toHaveClass(/mermaid-render-error/);
  await expect(mermaid).toHaveAttribute("data-super-markdown-mermaid-error", /Missing Mermaid runtime URI/);
  await expect(mermaid).toContainText("flowchart LR");
  await expect.poll(async () => {
    const messages = await readMessages(page);
    return messages.filter((message) => message.type === "error");
  }).toEqual([]);
});

test("mermaid preview renders diagrams one at a time", async ({ page }) => {
  await openHarness(page, "split", {
    mermaidRuntime: "serial-only",
    text: [
      "```mermaid",
      "sequenceDiagram",
      "  A->>B: ping",
      "```",
      "",
      "```mermaid",
      "classDiagram",
      "  A --> B",
      "```"
    ].join("\n"),
    previewHtml: [
      '<figure class="diagram-block"><pre class="mermaid">sequenceDiagram\n  A->>B: ping</pre></figure>',
      '<figure class="diagram-block"><pre class="mermaid">classDiagram\n  A --> B</pre></figure>'
    ].join("")
  });

  await expect(page.locator(".diagram-block .mermaid svg")).toHaveCount(2);
  await expect(page.locator(".diagram-block .mermaid-render-error")).toHaveCount(0);
});

for (const mode of ["split", "wysiwyg"] as const) {
  test.describe(`${mode} toolbar actions`, () => {
    for (const action of ALL_TOOLBAR_ACTIONS) {
      test(`${action} is observable`, async ({ page }) => {
        await openHarness(page, mode);
        await clearMessages(page);
        await prepareSelection(page, mode);

        const expectation = EXPECTATIONS[action];
        if (expectation.menu) {
          await openToolbarMenu(page, expectation.menu);
          return;
        }

        if (expectation.imageChooser) {
          await expectImageChooser(page, action);
          return;
        }

        await clickToolbarAction(page, action);

        if (expectation.message) {
          await expectPostedMessage(page, expectation.message);
          return;
        }

        const fragments = mode === "split" ? expectation.splitFragments : expectation.wysiwygFragments;
        expect(fragments, `Missing ${mode} assertion for ${action}`).toBeDefined();
        if (mode === "split") {
          await expectSourceValue(page, fragments!);
        } else {
          await expectEditMessage(page, fragments!);
        }
      });
    }
  });
}

test.describe("wysiwyg rich editing scenarios", () => {
  test("creates an editable 3 by 3 table", async ({ page }) => {
    await openHarness(page, "wysiwyg");
    await clearMessages(page);
    await page.locator(".ProseMirror").click();
    await clickToolbarAction(page, "table");

    await expect(page.locator(".ProseMirror table")).toBeVisible();
    await expect(page.locator(".ProseMirror table tr")).toHaveCount(3);
    await expect(page.locator(".ProseMirror table th")).toHaveCount(3);
    await expectEditMessage(page, ["|", ":-----"]);
  });

  test("keeps nested list structure editable", async ({ page }) => {
    await openHarness(page, "wysiwyg", {
      text: "- parent\n  - child\n\ntrailing"
    });

    await expect(page.locator(".ProseMirror li")).toHaveCount(2);
    await expect(page.locator(".ProseMirror li").nth(0)).toContainText("parent");
    await expect(page.locator(".ProseMirror li").nth(1)).toContainText("child");

    await clearMessages(page);
    await page.locator(".ProseMirror").click();
    await page.keyboard.press(process.platform === "darwin" ? "Meta+End" : "Control+End");
    await page.keyboard.type("\nmore");
    await expectEditMessage(page, ["parent", "child", "more"]);
  });

  test("supports undo and redo through ProseMirror history", async ({ page }) => {
    await openHarness(page, "wysiwyg");
    await page.locator(".ProseMirror").click();
    await page.keyboard.press(process.platform === "darwin" ? "Meta+End" : "Control+End");
    await page.keyboard.type(" beta");
    await expectEditMessage(page, ["alpha beta"]);

    await clearMessages(page);
    await page.keyboard.press(process.platform === "darwin" ? "Meta+Z" : "Control+Z");
    await expectLatestEditText(page, ["alpha"], ["beta"]);

    await clearMessages(page);
    await page.keyboard.press(process.platform === "darwin" ? "Meta+Shift+Z" : "Control+Y");
    await page.keyboard.press("Control+Shift+Z");
    await expectEditMessage(page, ["alpha beta"]);
  });

  test("keeps code blocks fully visible with action state inside the ProseMirror NodeView", async ({ page }) => {
    const codeText = [
      "<article>hello</article>",
      "<section>second line</section>",
      "<main>",
      "  <p>body line one</p>",
      "  <p>body line two</p>",
      "</main>",
      "<footer>done</footer>"
    ].join("\n");
    await openHarness(page, "wysiwyg", {
      text: `\`\`\`html\n${codeText}\n\`\`\``
    });

    const block = page.locator(".visual-code-node-view").first();
    const languageButton = block.locator(".visual-code-language-button");
    const languageInput = block.locator(".visual-code-language-input");
    const toneButton = block.locator(".code-color-toggle");
    const copyButton = block.locator(".copy-code");
    const highlightLayer = block.locator(".visual-code-highlight code");

    await expect(languageButton).toHaveText("html");
    await expect(block.locator(".visual-code-expand")).toHaveCount(0);
    await expect(block).not.toHaveClass(/is-expanded/);
    await expect(block.locator(".visual-code-editor code")).toContainText("<footer>done</footer>");
    await expect.poll(async () => {
      return await block.locator(".visual-code-frame").evaluate((frame) => frame.scrollHeight - frame.clientHeight);
    }).toBeLessThanOrEqual(1);
    await expect.poll(async () => {
      return await block.evaluate((element) => {
        const editorCode = element.querySelector<HTMLElement>(".visual-code-editor code");
        const highlightCode = element.querySelector<HTMLElement>(".visual-code-highlight code");
        if (!editorCode || !highlightCode) {
          return Number.POSITIVE_INFINITY;
        }
        return Math.abs(highlightCode.getBoundingClientRect().height - editorCode.getBoundingClientRect().height);
      });
    }).toBeLessThanOrEqual(2);
    await languageButton.dispatchEvent("click");
    await expect(languageInput).toBeVisible();
    await languageInput.fill("ts");
    await languageInput.press("Enter");
    await expect(languageButton).toHaveText("ts");
    await expectEditMessage(page, ["```ts"]);

    await expect(toneButton).toHaveText("Auto");
    await expect.poll(async () => await highlightLayer.innerHTML()).toContain("--shiki-light:");
    await expect.poll(async () => await highlightLayer.innerHTML()).toContain("--shiki-dark:");
    await toneButton.dispatchEvent("click");
    await expect(toneButton).toHaveText("Light");
    await expect(block).toHaveClass(/render-block-tone-light/);
    await expect(block).toHaveAttribute("data-render-block-tone", "light");

    await toneButton.dispatchEvent("click");
    await expect(toneButton).toHaveText("Dark");
    await expect(block).toHaveClass(/render-block-tone-dark/);
    await expect(block).toHaveAttribute("data-render-block-tone", "dark");

    await clearMessages(page);
    await copyButton.dispatchEvent("click");
    await expectPostedMessage(page, { type: "copyCode", text: codeText });
    await expect(copyButton).toHaveText("Copied");
  });

  test("renders mermaid fences as diagrams in WYSIWYG mode", async ({ page }) => {
    await openHarness(page, "wysiwyg", {
      mermaidRuntime: "serial-only",
      text: "```mermaid\nflowchart LR\n  A --> B\n```"
    });

    const block = page.locator(".visual-mermaid-node-view").first();
    await expect(block.locator(".code-language")).toHaveText("mermaid");
    await expect(block.locator(".visual-mermaid-preview svg")).toBeVisible();
    await expect(block.locator(".visual-code-frame")).not.toBeVisible();

    await block.locator(".visual-mermaid-preview").dblclick();
    await expect(block.locator(".visual-code-frame")).toBeVisible();
    await expect(block.locator(".visual-code-editor code")).toContainText("A --> B");
  });

  test("renders GFM alert blockquotes like the preview while keeping the source marker", async ({ page }) => {
    await openHarness(page, "wysiwyg", {
      text: "> [!NOTE]\n> GFM alert body\n\n> [!WARNING]\n> Warning body\n\n> Plain quote"
    });

    const note = page.locator(".visual-blockquote-node-view").nth(0);
    const warning = page.locator(".visual-blockquote-node-view").nth(1);
    const plain = page.locator(".visual-blockquote-node-view").nth(2);

    await expect(note).toHaveClass(/admonition-note/);
    await expect(note.locator(".visual-admonition-title")).toHaveText("NOTE");
    await expect(note.locator(".visual-admonition-body")).toContainText("GFM alert body");
    await expect(note.locator(".visual-admonition-source")).toContainText("[!NOTE]");

    await expect(warning).toHaveClass(/admonition-warning/);
    await expect(warning.locator(".visual-admonition-title")).toHaveText("WARNING");
    await expect(warning.locator(".visual-admonition-body")).toContainText("Warning body");
    await expect(warning.locator(".visual-admonition-source")).toContainText("[!WARNING]");

    await expect(plain).not.toHaveClass(/admonition/);
    await expect(plain.locator(".visual-admonition-title")).toBeHidden();
    await expect(plain.locator(".visual-blockquote-content")).toContainText("Plain quote");
  });

  test("keeps block math readable until the user edits the source", async ({ page }) => {
    await openHarness(page, "wysiwyg", {
      text: "$$\nx = y\n$$"
    });

    const block = page.locator(".visual-math-node-view").first();
    const preview = block.locator(".visual-math-preview");
    const source = block.locator(".visual-math-source");

    await expect(preview.locator(".katex")).toBeVisible();
    await expect(source).not.toBeVisible();

    await block.focus();
    await page.keyboard.press("Enter");
    await expect(source).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(source).not.toBeVisible();

    await preview.dblclick();
    await expect(source).toBeVisible();
    await source.fill("x = z");
    await expectEditMessage(page, ["$$", "x = z"]);

    await block.locator(".visual-math-done").click();
    await expect(source).not.toBeVisible();
    await expect(preview.locator(".katex")).toBeVisible();
  });

  test("edits inline math without opening a browser prompt", async ({ page }) => {
    page.on("dialog", (dialog) => {
      throw new Error(`Unexpected dialog: ${dialog.message()}`);
    });
    await openHarness(page, "wysiwyg", {
      text: "Inline $x = y$ math"
    });

    const inline = page.locator(".visual-math-inline-node").first();
    const input = inline.locator(".visual-math-inline-input");

    await expect(input).not.toBeVisible();
    await inline.dblclick();
    await expect(input).toBeVisible();
    await input.fill("x = z");
    await input.press("Enter");
    await expect(input).not.toBeVisible();
    await expectEditMessage(page, ["$x = z$"]);
  });

  test("renders raw html as explicit escaped content", async ({ page }) => {
    await openHarness(page, "wysiwyg", {
      text: '<script>alert("x")</script>'
    });

    const htmlSource = page.locator(".visual-html-source").first();
    await expect(htmlSource).toHaveJSProperty("tagName", "SPAN");
    await expect(htmlSource.locator(".visual-html-label")).toHaveText("Raw HTML escaped");
    await expect(htmlSource.locator(".safe-html-source")).toContainText("<script>");
    await expect(htmlSource).toHaveCSS("display", "grid");
    await expect.poll(async () => {
      return await htmlSource.evaluate((element) => {
        const label = element.querySelector(".visual-html-label")?.getBoundingClientRect();
        const code = element.querySelector(".safe-html-source")?.getBoundingClientRect();
        return label && code ? code.top - label.bottom : -1;
      });
    }).toBeGreaterThanOrEqual(0);
  });

  test("opens multiline raw html without reporting a WYSIWYG runtime error", async ({ page }) => {
    await openHarness(page, "wysiwyg", {
      text: [
        "Raw HTML should stay inert:",
        "",
        "<div class=\"custom-card\">",
        "  <strong>Raw HTML fixture</strong>",
        "  <script>console.log(\"this should not execute\")</script>",
        "</div>",
        "",
        "Inline HTML example: <kbd>Cmd</kbd> + <kbd>Shift</kbd> + <kbd>P</kbd>."
      ].join("\n")
    });

    await expect(page.locator(".ProseMirror")).toBeVisible();
    await expect(page.locator(".visual-html-source").first()).toHaveJSProperty("tagName", "SPAN");
    await expect(page.locator(".visual-safe-html-kbd")).toHaveCount(3);
    await expect.poll(async () => {
      const messages = await readMessages(page);
      return messages.filter((message) => message.type === "error");
    }).toEqual([]);
  });

  test("posts image upload data and inserts upload results", async ({ page }) => {
    await openHarness(page, "wysiwyg");
    await clearMessages(page);

    const fileChooserPromise = page.waitForEvent("filechooser");
    await clickToolbarAction(page, "image");
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles([{
      name: "diagram.png",
      mimeType: "image/png",
      buffer: Buffer.from("image-bytes")
    }]);

    const uploadMessage = await waitForUploadImagesMessage(page);
    expect(uploadMessage.images[0].name).toBe("diagram.png");
    expect(uploadMessage.images[0].dataUrl).toContain("data:image/png;base64,");

    await clearMessages(page);
    await page.evaluate(() => {
      window.dispatchEvent(new MessageEvent("message", {
        data: {
          type: "uploadImagesResult",
          images: [{ markdown: "![diagram](assets/diagram.png)" }]
        }
      }));
    });
    await expectEditMessage(page, ["![diagram](assets/diagram.png)"]);

    await clearMessages(page);
    await page.evaluate(() => {
      window.dispatchEvent(new MessageEvent("message", {
        data: {
          type: "uploadImagesResult",
          error: { name: "UploadError", message: "Cannot write image" }
        }
      }));
    });
    await expectPostedMessage(page, { type: "error", message: "UploadError: Cannot write image" });
  });

  test("uses outline headings to navigate a long WYSIWYG document", async ({ page }) => {
    const sections = Array.from({ length: 18 }, (_, index) => ({
      level: 2,
      text: `Section ${index + 1}`,
      slug: `section-${index + 1}`,
      line: index * 6
    }));
    const text = sections
      .map((heading, index) => {
        const tail = index === sections.length - 1
          ? Array.from({ length: 12 }, (_, tailIndex) => `Tail paragraph ${tailIndex + 1} for ${heading.text}`).join("\n\n")
          : "";
        return `## ${heading.text}\n\nParagraph ${heading.text}\n\nMore content for ${heading.text}\n\n${tail}\n\n`;
      })
      .join("");

    await openHarness(page, "wysiwyg", {
      text,
      headings: sections,
      previewHtml: sections
        .map((heading) => `<h2 data-source-line="${heading.line}" id="${heading.slug}">${heading.text}</h2><p data-source-line="${heading.line + 2}">Paragraph ${heading.text}</p><p data-source-line="${heading.line + 4}">More content for ${heading.text}</p>`)
        .join("")
    });

    await page.locator('.outline-item[data-line="102"]').click();
    await expect(page.locator(".outline-item.is-active")).toContainText("Section 18");
    const visualScrollTop = await page.locator(".visual-editor").evaluate((element) => element.scrollTop);
    expect(visualScrollTop).toBeGreaterThan(0);
  });
});

async function openHarness(page: Page, mode: HarnessMode, options: OpenHarnessOptions = {}): Promise<void> {
  const { mermaidRuntime, ...harnessOptions } = options;
  await page.setContent(createWebviewHarnessHtml({ mode, ...harnessOptions }), { waitUntil: "load" });
  if (mermaidRuntime === "serial-only") {
    await page.addScriptTag({
      content: `
        (() => {
          let active = false;
          let count = 0;
          window.mermaid = {
            initialize() {},
            async run({ nodes }) {
              if (active) {
                throw new Error("Concurrent Mermaid render");
              }
              active = true;
              await new Promise((resolve) => setTimeout(resolve, 10));
              Array.from(nodes).forEach((node) => {
                count += 1;
                node.innerHTML = '<svg data-render-index="' + count + '"><text>diagram ' + count + '</text></svg>';
              });
              active = false;
            }
          };
        })();
      `
    });
  }
  await page.addScriptTag({ path: editorRuntimePath });
  await page.waitForFunction(() => document.body.dataset.scriptState === "runtime-ready");
  await expect(page.locator("body")).not.toHaveAttribute("data-script-state", "error");
  if (mode === "wysiwyg") {
    await expect(page.locator(".ProseMirror")).toBeVisible();
  }
}

async function prepareSelection(page: Page, mode: HarnessMode): Promise<void> {
  if (mode === "split") {
    await page.locator("#source-editor").focus();
    await page.evaluate(() => {
      const source = document.getElementById("source-editor") as HTMLTextAreaElement;
      source.setSelectionRange(0, source.value.length);
      source.dispatchEvent(new Event("select", { bubbles: true }));
    });
    return;
  }

  await page.locator(".ProseMirror").click();
  await page.keyboard.press(await getSelectAllShortcut(page));
}

async function clickToolbarAction(page: Page, action: string): Promise<void> {
  if (HEADING_MENU_ACTIONS.includes(action)) {
    await openToolbarMenu(page, "heading");
  } else if (MORE_MENU_ACTIONS.includes(action)) {
    await openToolbarMenu(page, "more");
  }
  await page.locator(`[data-action="${action}"]`).click();
}

async function openToolbarMenu(page: Page, menu: "heading" | "more"): Promise<void> {
  await page.locator(`[data-menu-toggle="${menu}"]`).click();
  await expect(page.locator(`[data-menu="${menu}"]`)).toBeVisible();
  await expect(page.locator(`[data-menu-toggle="${menu}"]`)).toHaveAttribute("aria-expanded", "true");
}

async function expectImageChooser(page: Page, action: string): Promise<void> {
  const fileChooserPromise = page.waitForEvent("filechooser");
  await clickToolbarAction(page, action);
  const fileChooser = await fileChooserPromise;
  expect(fileChooser.isMultiple()).toBe(true);
}

async function expectSourceValue(page: Page, fragments: string[]): Promise<void> {
  const value = await page.locator("#source-editor").inputValue();
  for (const fragment of fragments) {
    expect(value).toContain(fragment);
  }
}

async function expectPostedMessage(page: Page, expected: HostMessage): Promise<void> {
  await page.waitForFunction((partial) => {
    const messages = ((window as unknown as { __messages?: HostMessage[] }).__messages) || [];
    return messages.some((message) => Object.entries(partial as HostMessage).every(([key, value]) => message[key] === value));
  }, expected);
}

async function readMessages(page: Page): Promise<HostMessage[]> {
  return page.evaluate(() => ((window as unknown as { __messages?: HostMessage[] }).__messages) || []);
}

async function expectEditMessage(page: Page, fragments: string[]): Promise<void> {
  await page.waitForFunction((expectedFragments) => {
    const messages = ((window as unknown as { __messages?: Array<{ type?: string; text?: string }> }).__messages) || [];
    return messages.some((message) => {
      if (message.type !== "edit" || typeof message.text !== "string") {
        return false;
      }
      return (expectedFragments as string[]).every((fragment) => message.text!.includes(fragment));
    });
  }, fragments);
}

async function expectLatestEditText(page: Page, requiredFragments: string[], forbiddenFragments: string[] = []): Promise<void> {
  await page.waitForFunction(({ required, forbidden }) => {
    const messages = ((window as unknown as { __messages?: Array<{ type?: string; text?: string }> }).__messages) || [];
    const edits = messages.filter((message) => message.type === "edit" && typeof message.text === "string");
    const latest = edits[edits.length - 1]?.text || "";
    return required.every((fragment) => latest.includes(fragment)) && forbidden.every((fragment) => !latest.includes(fragment));
  }, { required: requiredFragments, forbidden: forbiddenFragments });
}

async function waitForUploadImagesMessage(page: Page): Promise<{ type: string; images: Array<{ name: string; dataUrl: string }> }> {
  const index = await page.waitForFunction(() => {
    const messages = ((window as unknown as { __messages?: HostMessage[] }).__messages) || [];
    const matchIndex = messages.findIndex((message) => message.type === "uploadImages" && Array.isArray(message.images));
    return matchIndex >= 0 ? matchIndex + 1 : false;
  });
  const messageIndex = Number(await index.jsonValue()) - 1;
  return page.evaluate((targetIndex) => {
    return ((window as unknown as { __messages: HostMessage[] }).__messages)[targetIndex];
  }, messageIndex) as Promise<{ type: string; images: Array<{ name: string; dataUrl: string }> }>;
}

async function clearMessages(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as unknown as { __messages: HostMessage[] }).__messages = [];
  });
}

async function getSelectAllShortcut(page: Page): Promise<"Meta+A" | "Control+A"> {
  const isMacLikeBrowser = await page.evaluate(() => {
    const platform = navigator.platform || "";
    const userAgent = navigator.userAgent || "";
    return /Mac|iPhone|iPad|iPod/i.test(`${platform} ${userAgent}`);
  });
  return isMacLikeBrowser ? "Meta+A" : "Control+A";
}
