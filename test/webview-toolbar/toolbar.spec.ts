import { expect, type Page, test } from "@playwright/test";
import { EXPORT_MENU_ACTIONS, getToolbarGroups, HEADING_MENU_ACTIONS, PREVIEW_TOOLBAR_GROUPS, TOOLBAR_GROUPS } from "../../src/wysiwyg/toolbar";
import { createWebviewHarnessHtml, editorRuntimePath, type HarnessMode } from "./harness";

type HostMessage = Record<string, unknown>;
type OpenHarnessOptions = Omit<Parameters<typeof createWebviewHarnessHtml>[0], "mode"> & {
  mermaidRuntime?: "serial-only";
};

interface ActionExpectation {
  splitFragments?: string[];
  wysiwygFragments?: string[];
  message?: HostMessage;
  menu?: "heading" | "export";
  imageChooser?: true;
}

const ALL_TOOLBAR_ACTIONS = Array.from(new Set([
  ...TOOLBAR_GROUPS.flatMap((group) => group.actions),
  ...HEADING_MENU_ACTIONS,
  ...EXPORT_MENU_ACTIONS
]));
const PREVIEW_TOP_LEVEL_ACTIONS = PREVIEW_TOOLBAR_GROUPS.flatMap((group) => group.actions);
const PREVIEW_ALL_ACTIONS = Array.from(new Set([...PREVIEW_TOP_LEVEL_ACTIONS, ...EXPORT_MENU_ACTIONS]));

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
    splitFragments: ["| Column 1 | Column 2 | Column 3 |", "|  |  |  |"],
    wysiwygFragments: ["|"]
  },
  math: { splitFragments: ["$$\nx = y\n$$"], wysiwygFragments: ["$$", "x = y"] },
  mermaid: { splitFragments: ["```mermaid", "A --> B"], wysiwygFragments: ["```mermaid", "A --> B"] },
  toc: { message: { type: "toolbarCommand", action: "toc" } },
  organizeMarkdown: { message: { type: "runHostCommand", command: "organizeMarkdown" } },
  switchBackgroundTheme: { message: { type: "toolbarCommand", action: "switchBackgroundTheme" } },
  switchDisplayLanguage: { message: { type: "toolbarCommand", action: "switchDisplayLanguage" } },
  export: { menu: "export" },
  "export-html": { message: { type: "export", format: "html" } },
  "export-pdf": { message: { type: "export", format: "pdf" } },
  "export-all": { message: { type: "export", format: "all" } },
  help: { message: { type: "openLink", href: "https://github.com/SivanCola/super-markdown/issues" } }
};

test("toolbar test matrix covers every rendered action", () => {
  expect(Object.keys(EXPECTATIONS).sort()).toEqual([...ALL_TOOLBAR_ACTIONS].sort());
});

test("preview toolbar model is read-only", () => {
  expect(getToolbarGroups("preview")).toEqual(PREVIEW_TOOLBAR_GROUPS);
  expect(getToolbarGroups("source", "previewOnly")).toEqual(PREVIEW_TOOLBAR_GROUPS);
  expect(PREVIEW_TOP_LEVEL_ACTIONS).toEqual(["switchBackgroundTheme", "switchDisplayLanguage", "export", "help"]);
  expect(PREVIEW_ALL_ACTIONS).not.toEqual(expect.arrayContaining(["bold", "table", "image", "toc", "organizeMarkdown"]));
});

test("toolbar uses Codicon icons with a small custom fallback set", async ({ page }) => {
  await openHarness(page, "split");
  const topLevelActionCount = TOOLBAR_GROUPS.reduce((total, group) => total + group.actions.length, 0);

  await expect(page.locator(".toolbar-icon .codicon")).toHaveCount(topLevelActionCount - 4);
  await expect(page.locator(".toolbar-custom-icon")).toHaveCount(4);
  await expect(page.locator('[data-action="inline-code"] .codicon-code')).toBeVisible();
  await expect(page.locator('[data-action="switchBackgroundTheme"] .codicon-color-mode')).toBeVisible();
  await expect(page.locator('[data-action="switchDisplayLanguage"] .codicon-globe')).toBeVisible();
  await expect(page.locator('[data-menu-toggle="export"] .codicon-export')).toBeVisible();
  await expect(page.locator('[data-menu-toggle="export"] .toolbar-caret')).toHaveCount(0);
  await expect(page.locator('[data-menu-toggle="heading"] .toolbar-caret')).toHaveCount(1);
});

test("toolbar places export between display language and help", async ({ page }) => {
  await openHarness(page, "split");

  const helpActions = await page.locator(".toolbar-group-help .toolbar-button").evaluateAll((buttons) =>
    buttons.map((button) => (button as HTMLElement).dataset.action || (button as HTMLElement).dataset.menuToggle)
  );

  expect(helpActions).toEqual(["switchBackgroundTheme", "switchDisplayLanguage", "export", "help"]);
});

test("preview toolbar only exposes read-only actions", async ({ page }) => {
  await openHarness(page, "preview");

  await expect(page.locator(".editor-toolbar-slot")).toBeVisible();
  const topLevelActions = await page.locator(".editor-toolbar-slot > .toolbar-group > [data-action]").evaluateAll((buttons) =>
    buttons.map((button) => (button as HTMLElement).dataset.action)
  );
  const menuToggles = await page.locator(".editor-toolbar-slot > .toolbar-group [data-menu-toggle]").evaluateAll((buttons) =>
    buttons.map((button) => (button as HTMLElement).dataset.menuToggle)
  );

  expect(topLevelActions).toEqual(["switchBackgroundTheme", "switchDisplayLanguage", "help"]);
  expect(menuToggles).toEqual(["export"]);
  for (const action of ["bold", "table", "image", "toc", "organizeMarkdown"]) {
    await expect(page.locator(`[data-action="${action}"]`)).toHaveCount(0);
  }
});

test("preview toolbar actions stay read-only", async ({ page }) => {
  await openHarness(page, "preview");
  await clearMessages(page);

  await clickToolbarAction(page, "switchBackgroundTheme");
  await expectPostedMessage(page, { type: "toolbarCommand", action: "switchBackgroundTheme" });

  await clearMessages(page);
  await clickToolbarAction(page, "export-pdf");
  await expectPostedMessage(page, { type: "export", format: "pdf" });

  await clearMessages(page);
  await clickToolbarAction(page, "help");
  await expectPostedMessage(page, { type: "openLink", href: "https://github.com/SivanCola/super-markdown/issues" });

  await clearMessages(page);
  await page.evaluate(() => {
    const toolbar = document.getElementById("editor-toolbar-slot");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "toolbar-button";
    button.dataset.action = "bold";
    button.textContent = "Bold";
    toolbar?.append(button);
    button.click();
  });

  const messages = await readMessages(page);
  expect(messages).toEqual([]);
  await expect(page.locator("#source-editor")).toHaveValue("alpha");
});

test("toolbar menu keeps internal theme colors over dark VS Code dropdown colors", async ({ page }) => {
  await openHarness(page, "split", {
    bodyClass: "sm-theme-paper vscode-dark",
    bodyStyle: [
      "--vscode-dropdown-background: #050505",
      "--vscode-dropdown-foreground: #fafafa",
      "--vscode-icon-foreground: #fafafa",
      "--vscode-list-hoverBackground: #111111"
    ].join("; ")
  });

  await openToolbarMenu(page, "export");

  const colors = await page.evaluate(() => {
    function resolveCssColor(value: string, property: "backgroundColor" | "color"): string {
      const probe = document.createElement("div");
      if (property === "backgroundColor") {
        probe.style.backgroundColor = value.trim();
      } else {
        probe.style.color = value.trim();
      }
      document.body.append(probe);
      const color = getComputedStyle(probe)[property];
      probe.remove();
      return color;
    }

    const bodyStyle = getComputedStyle(document.body);
    const menu = document.querySelector('[data-menu="export"]') as HTMLElement;
    const menuButton = menu.querySelector(".toolbar-menu-button") as HTMLElement;
    const menuIcon = menuButton.querySelector(".toolbar-menu-icon") as HTMLElement;
    const toggle = document.querySelector('[data-menu-toggle="export"]') as HTMLElement;

    return {
      darkDropdownBackground: resolveCssColor("var(--vscode-dropdown-background)", "backgroundColor"),
      menuBackground: getComputedStyle(menu).backgroundColor,
      menuBackgroundToken: resolveCssColor(bodyStyle.getPropertyValue("--sm-menu-bg"), "backgroundColor"),
      menuText: getComputedStyle(menuButton).color,
      menuTextToken: resolveCssColor(bodyStyle.getPropertyValue("--sm-menu-text"), "color"),
      menuIcon: getComputedStyle(menuIcon).color,
      menuIconToken: resolveCssColor(bodyStyle.getPropertyValue("--sm-menu-icon"), "color"),
      toggleBackground: getComputedStyle(toggle).backgroundColor,
      toggleBackgroundToken: resolveCssColor(bodyStyle.getPropertyValue("--sm-toolbar-active-bg"), "backgroundColor")
    };
  });

  expect(colors.menuBackground).toBe(colors.menuBackgroundToken);
  expect(colors.menuText).toBe(colors.menuTextToken);
  expect(colors.menuIcon).toBe(colors.menuIconToken);
  expect(colors.toggleBackground).toBe(colors.toggleBackgroundToken);
  expect(colors.menuBackground).not.toBe(colors.darkDropdownBackground);

  await page.locator('[data-menu="export"] .toolbar-menu-button').first().hover();
  const hoverColors = await page.evaluate(() => {
    const bodyStyle = getComputedStyle(document.body);
    const menuButton = document.querySelector('[data-menu="export"] .toolbar-menu-button') as HTMLElement;
    const probe = document.createElement("div");
    probe.style.backgroundColor = bodyStyle.getPropertyValue("--sm-menu-hover-bg").trim();
    document.body.append(probe);
    const hoverToken = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return {
      menuHover: getComputedStyle(menuButton).backgroundColor,
      menuHoverToken: hoverToken
    };
  });
  expect(hoverColors.menuHover).toBe(hoverColors.menuHoverToken);
});

test("table picker highlights the hovered size with theme-aware colors", async ({ page }) => {
  await openHarness(page, "split", {
    bodyClass: "sm-theme-paper vscode-dark",
    bodyStyle: [
      "--vscode-dropdown-background: #050505",
      "--vscode-dropdown-foreground: #fafafa",
      "--vscode-icon-foreground: #fafafa",
      "--vscode-focusBorder: #4daafc",
      "--vscode-list-hoverBackground: #111111"
    ].join("; ")
  });

  await openToolbarMenu(page, "table");
  await page.locator('[data-table-rows="5"][data-table-columns="5"]').hover();
  await expect(page.locator(".toolbar-table-picker-size")).toHaveText("5 x 5");
  await expect(page.locator(".toolbar-table-picker-cell.is-selected")).toHaveCount(25);

  const colors = await page.evaluate(() => {
    function resolveCssColor(value: string, property: "backgroundColor" | "color"): string {
      const probe = document.createElement("div");
      if (property === "backgroundColor") {
        probe.style.backgroundColor = value.trim();
      } else {
        probe.style.color = value.trim();
      }
      document.body.append(probe);
      const color = getComputedStyle(probe)[property];
      probe.remove();
      return color;
    }

    const bodyStyle = getComputedStyle(document.body);
    const panel = document.querySelector('[data-menu="table"]') as HTMLElement;
    const selectedCell = document.querySelector(".toolbar-table-picker-cell.is-selected") as HTMLElement;
    const label = document.querySelector(".toolbar-table-picker-size") as HTMLElement;

    return {
      darkDropdownBackground: resolveCssColor("var(--vscode-dropdown-background)", "backgroundColor"),
      panelBackground: getComputedStyle(panel).backgroundColor,
      panelBackgroundToken: resolveCssColor(bodyStyle.getPropertyValue("--sm-menu-bg"), "backgroundColor"),
      selectedBackground: getComputedStyle(selectedCell).backgroundColor,
      selectedBackgroundToken: resolveCssColor(bodyStyle.getPropertyValue("--sm-table-picker-cell-selected-bg"), "backgroundColor"),
      labelColor: getComputedStyle(label).color,
      labelColorToken: resolveCssColor(bodyStyle.getPropertyValue("--sm-table-picker-label"), "color")
    };
  });

  expect(colors.panelBackground).toBe(colors.panelBackgroundToken);
  expect(colors.panelBackground).not.toBe(colors.darkDropdownBackground);
  expect(colors.selectedBackground).toBe(colors.selectedBackgroundToken);
  expect(colors.labelColor).toBe(colors.labelColorToken);
});

test("reading themes choose outline and code colors independently from the VS Code shell", async ({ page }) => {
  await openHarness(page, "split", {
    bodyClass: "sm-theme-paper vscode-dark",
    bodyStyle: [
      "--vscode-foreground: #cccccc",
      "--vscode-descriptionForeground: #bbbbbb",
      "--vscode-scrollbarSlider-background: #000000",
      "--vscode-scrollbarSlider-hoverBackground: #000000"
    ].join("; "),
    headings: [
      { level: 2, text: "Readable heading", slug: "readable-heading", line: 0 },
      { level: 2, text: "Readable second heading", slug: "readable-second-heading", line: 4 }
    ],
    previewHtml: `
      <figure class="code-block">
        <figcaption><span class="code-language">json</span></figcaption>
        <pre><code class="shiki"><span style="--shiki-light:#111111;--shiki-dark:#eeeeee">"code"</span></code></pre>
      </figure>
    `
  });

  await page.locator("#side-panel-toggle").click();
  await expect(page.locator(".outline-item")).toHaveCount(2);

  const colors = await page.evaluate(() => {
    function resolveCssColor(value: string, property: "backgroundColor" | "color"): string {
      const probe = document.createElement("div");
      if (property === "backgroundColor") {
        probe.style.backgroundColor = value.trim();
      } else {
        probe.style.color = value.trim();
      }
      document.body.append(probe);
      const color = getComputedStyle(probe)[property];
      probe.remove();
      return color;
    }

    const visualRoot = document.querySelector(".visual-editor") as HTMLElement;
    visualRoot.innerHTML = `
      <div class="ProseMirror">
        <figure class="visual-code-node-view">
          <div class="visual-code-frame">
            <pre class="visual-code-highlight"><code><span style="--shiki-light:#111111;--shiki-dark:#eeeeee">"code"</span></code></pre>
          </div>
        </figure>
      </div>
    `;

    const bodyStyle = getComputedStyle(document.body);
    const outline = document.querySelectorAll(".outline-item")[1] as HTMLElement;
    const outlineScroller = document.querySelector("#outline") as HTMLElement;
    const sourceEditor = document.querySelector("#source-editor") as HTMLElement;
    const preview = document.querySelector("#preview") as HTMLElement;
    const previewToken = document.querySelector(".code-block .shiki span") as HTMLElement;
    const visualToken = document.querySelector(".visual-code-highlight span") as HTMLElement;

    return {
      outline: getComputedStyle(outline).color,
      themeText: resolveCssColor(bodyStyle.getPropertyValue("--sm-text"), "color"),
      shellForeground: resolveCssColor("var(--vscode-foreground)", "color"),
      outlineScrollbarThumb: getComputedStyle(outlineScroller, "::-webkit-scrollbar-thumb").backgroundColor,
      sourceScrollbarThumb: getComputedStyle(sourceEditor, "::-webkit-scrollbar-thumb").backgroundColor,
      previewScrollbarThumb: getComputedStyle(preview, "::-webkit-scrollbar-thumb").backgroundColor,
      expectedScrollbarThumb: resolveCssColor(bodyStyle.getPropertyValue("--sm-scrollbar-thumb"), "backgroundColor"),
      shellScrollbarThumb: resolveCssColor("var(--vscode-scrollbarSlider-background)", "backgroundColor"),
      previewToken: getComputedStyle(previewToken).color,
      visualToken: getComputedStyle(visualToken).color,
      expectedLightToken: resolveCssColor("#111111", "color"),
      expectedDarkToken: resolveCssColor("#eeeeee", "color")
    };
  });

  expect(colors.outline).toBe(colors.themeText);
  expect(colors.outline).not.toBe(colors.shellForeground);
  expect(colors.outlineScrollbarThumb).toBe(colors.expectedScrollbarThumb);
  expect(colors.sourceScrollbarThumb).toBe(colors.expectedScrollbarThumb);
  expect(colors.previewScrollbarThumb).toBe(colors.expectedScrollbarThumb);
  expect(colors.sourceScrollbarThumb).not.toBe(colors.shellScrollbarThumb);
  expect(colors.previewToken).toBe(colors.expectedLightToken);
  expect(colors.visualToken).toBe(colors.expectedLightToken);
  expect(colors.previewToken).not.toBe(colors.expectedDarkToken);
});

test("webview controls share delayed hover tooltips", async ({ page }) => {
  await openHarness(page, "split");

  await expect(page.locator('[data-action="bold"]')).not.toHaveAttribute("title", /.+/);
  await page.locator('[data-action="bold"]').hover();
  await expect(page.locator("#hover-tooltip")).toHaveText("Bold");
  await page.mouse.move(0, 0);
  await expect(page.locator("#hover-tooltip")).toBeHidden();

  await page.locator("#side-panel-toggle").click();

  await page.locator("#outline-current").hover();
  await page.waitForTimeout(250);
  await expect(page.locator(".hover-tooltip.is-visible")).toHaveCount(0, { timeout: 100 });
  await expect(page.locator("#hover-tooltip")).toHaveText("Reveal current heading");

  await page.locator("#side-panel-collapse").hover();
  await expect(page.locator("#hover-tooltip")).toHaveText("Collapse outline");

  await page.mouse.move(0, 0);
  await expect(page.locator("#hover-tooltip")).toBeHidden();
});

test("keeps source caret stable when a stale host update arrives during typing", async ({ page }) => {
  const original = "alpha\nbravo\ncharlie";
  await openHarness(page, "split", { text: original });
  await clearMessages(page);

  await placeSourceCursor(page, original.indexOf("bravo") + 2);
  await page.keyboard.type("X");

  const typed = "alpha\nbrXavo\ncharlie";
  const caretAfterType = await getSourceCaret(page);

  await dispatchHostMarkdown(page, original, 0);

  await expect(page.locator("#source-editor")).toHaveValue(typed);
  const caretAfterStaleUpdate = await getSourceCaret(page);
  expect(caretAfterStaleUpdate).toBe(caretAfterType);
});

test("keeps source caret stable when host echoes the current edit revision", async ({ page }) => {
  const original = "alpha\nbravo\ncharlie";
  await openHarness(page, "split", { text: original });
  await clearMessages(page);

  await placeSourceCursor(page, original.indexOf("bravo") + 2);
  await page.keyboard.type("X");

  const typed = "alpha\nbrXavo\ncharlie";
  const editRevision = await waitForLatestEditRevision(page, typed);
  const caretAfterType = await getSourceCaret(page);

  await dispatchHostMarkdown(page, typed, editRevision);

  await expect(page.locator("#source-editor")).toHaveValue(typed);
  expect(await getSourceCaret(page)).toBe(caretAfterType);
});

test("accepts external markdown after the local edit revision is acknowledged", async ({ page }) => {
  const original = "alpha\nbravo\ncharlie";
  await openHarness(page, "split", { text: original });
  await clearMessages(page);

  await placeSourceCursor(page, original.indexOf("bravo") + 2);
  await page.keyboard.type("X");

  const typed = "alpha\nbrXavo\ncharlie";
  const editRevision = await waitForLatestEditRevision(page, typed);
  await dispatchHostMarkdown(page, typed, editRevision);

  const external = "external\nworkspace\nchange";
  await dispatchHostMarkdown(page, external);

  await expect(page.locator("#source-editor")).toHaveValue(external);
});

test("keeps WYSIWYG content when a stale host update arrives during typing", async ({ page }) => {
  const original = "alpha bravo charlie";
  await openHarness(page, "wysiwyg", { text: original });
  await clearMessages(page);

  await placeProseMirrorCursor(page, "bravo", 2);
  await page.keyboard.type("X");

  const typed = "alpha brXavo charlie";
  await expect(page.locator(".ProseMirror")).toContainText(typed);
  await expectEditMessage(page, [typed]);

  await dispatchHostMarkdown(page, original, 0);

  await expect(page.locator(".ProseMirror")).toContainText(typed);
  await expectEditMessage(page, [typed]);
});

test("keeps WYSIWYG caret stable when host echoes the current edit revision", async ({ page }) => {
  const original = "alpha bravo charlie";
  await openHarness(page, "wysiwyg", { text: original });
  await clearMessages(page);

  await placeProseMirrorCursor(page, "bravo", 2);
  await page.keyboard.type("X");

  const typed = "alpha brXavo charlie";
  const edit = await waitForLatestEdit(page, typed);
  await dispatchHostMarkdown(page, edit.text, edit.editRevision);
  await page.keyboard.type("Y");

  await expect(page.locator(".ProseMirror")).toContainText("alpha brXYavo charlie");
  await expectLatestEditText(page, ["alpha brXYavo charlie"]);
});

test("split resizer adjusts editor and preview widths", async ({ page }) => {
  await openHarness(page, "split", { bodyClass: "harness-compact-side-panel" });

  const editorBefore = await page.locator(".editor-panel").boundingBox();
  const previewBefore = await page.locator(".preview-panel").boundingBox();
  const resizer = await page.locator("#split-resizer").boundingBox();
  expect(editorBefore).not.toBeNull();
  expect(previewBefore).not.toBeNull();
  expect(resizer).not.toBeNull();

  await page.mouse.move(resizer!.x + resizer!.width / 2, resizer!.y + resizer!.height / 2);
  await page.mouse.down();
  await page.mouse.move(resizer!.x - 120, resizer!.y + resizer!.height / 2);
  await page.mouse.up();

  const editorAfter = await page.locator(".editor-panel").boundingBox();
  const previewAfter = await page.locator(".preview-panel").boundingBox();
  expect(editorAfter!.width).toBeLessThan(editorBefore!.width - 40);
  expect(previewAfter!.width).toBeGreaterThan(previewBefore!.width + 40);

  const state = await page.evaluate(() => (window as unknown as { __state?: { splitRatio?: number } }).__state);
  expect(state?.splitRatio).toBeLessThan(0.5);
  await expect(page.locator("#split-resizer")).toHaveAttribute("aria-valuenow", String(Math.round((state?.splitRatio || 0) * 100)));

  await page.locator("#split-resizer").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#split-resizer")).toHaveAttribute("aria-valuenow", "50");
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

test("inserts the selected table size from the picker", async ({ page }) => {
  await openHarness(page, "split");
  await clearMessages(page);
  await page.locator("#source-editor").focus();
  await chooseTableSize(page, 5, 5);

  await expectSourceValue(page, [
    "| Column 1 | Column 2 | Column 3 | Column 4 | Column 5 |",
    "| --- | --- | --- | --- | --- |"
  ]);
  const value = await page.locator("#source-editor").inputValue();
  expect(value.split("\n").filter((line) => line === "|  |  |  |  |  |")).toHaveLength(4);
});

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

    await expect(page.locator(".visual-editor")).toBeVisible();
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
    await page.evaluate((requestId) => {
      window.dispatchEvent(new MessageEvent("message", {
        data: {
          type: "uploadImagesResult",
          requestId,
          images: [{ markdown: "![diagram](assets/diagram.png)" }]
        }
      }));
    }, uploadMessage.requestId);
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
    await expect.poll(async () => {
      const messages = await readMessages(page);
      return messages.filter((message) => message.type === "edit");
    }).toEqual([]);
  });

  test("pastes and drops images into the split source editor", async ({ page }) => {
    await openHarness(page, "split", { text: "before\nafter" });
    await clearMessages(page);
    await placeSourceCursor(page, "before\n".length);
    await dispatchImagePaste(page, "#source-editor", "pasted.png");

    const pasteUpload = await waitForUploadImagesMessage(page);
    expect(pasteUpload.images[0].name).toBe("pasted.png");
    await resolveUpload(page, pasteUpload.requestId, "![pasted.png](assets/pasted.png)");
    await expectSourceValue(page, ["before\n\n![pasted.png](assets/pasted.png)", "after"]);

    await clearMessages(page);
    await placeSourceCursor(page, await page.locator("#source-editor").evaluate((element) => (element as HTMLTextAreaElement).value.length));
    await dispatchImageDrop(page, "#source-editor", "dropped.png");
    const dropUpload = await waitForUploadImagesMessage(page);
    expect(dropUpload.images[0].name).toBe("dropped.png");
    await resolveUpload(page, dropUpload.requestId, "![dropped.png](assets/dropped.png)");
    await expectSourceValue(page, ["![dropped.png](assets/dropped.png)"]);
  });

  test("pastes and drops images into the WYSIWYG editor at the active document position", async ({ page }) => {
    await openHarness(page, "wysiwyg", { text: "alpha\n\nomega" });
    await clearMessages(page);
    await page.locator(".ProseMirror").click();
    await page.keyboard.press(await getSelectAllShortcut(page));
    await page.keyboard.press("ArrowRight");
    await dispatchImagePaste(page, ".ProseMirror", "visual-paste.png");

    const pasteUpload = await waitForUploadImagesMessage(page);
    expect(pasteUpload.images[0].name).toBe("visual-paste.png");
    await resolveUpload(page, pasteUpload.requestId, "![visual-paste.png](assets/visual-paste.png)");
    await expectEditMessage(page, ["assets/visual-paste.png"]);

    await clearMessages(page);
    await dispatchImageDrop(page, ".ProseMirror", "visual-drop.png");
    const dropUpload = await waitForUploadImagesMessage(page);
    expect(dropUpload.images[0].name).toBe("visual-drop.png");
    await resolveUpload(page, dropUpload.requestId, "![visual-drop.png](assets/visual-drop.png)");
    await expectEditMessage(page, ["assets/visual-drop.png"]);
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

    await page.locator("#side-panel-toggle").click();
    await expect(page.locator("#side-panel")).toBeVisible();
    await page.locator('.outline-item[data-line="102"]').scrollIntoViewIfNeeded();
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
    await expect(page.locator(".visual-editor")).toBeVisible();
    await expect(page.locator(".ProseMirror")).toHaveCount(1);
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
  if (action === "table") {
    await chooseTableSize(page, 3, 3);
    return;
  }
  if (HEADING_MENU_ACTIONS.includes(action)) {
    await openToolbarMenu(page, "heading");
  } else if (EXPORT_MENU_ACTIONS.includes(action)) {
    await openToolbarMenu(page, "export");
  }
  await page.locator(`[data-action="${action}"]`).click();
}

async function chooseTableSize(page: Page, rows: number, columns: number): Promise<void> {
  await openToolbarMenu(page, "table");
  const cell = page.locator(`[data-table-rows="${rows}"][data-table-columns="${columns}"]`);
  await cell.hover();
  await expect(page.locator(".toolbar-table-picker-size")).toHaveText(`${rows} x ${columns}`);
  await cell.click();
}

async function openToolbarMenu(page: Page, menu: "heading" | "export" | "table"): Promise<void> {
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

async function waitForUploadImagesMessage(page: Page): Promise<{ type: string; requestId: string; images: Array<{ name: string; dataUrl: string }> }> {
  const index = await page.waitForFunction(() => {
    const messages = ((window as unknown as { __messages?: HostMessage[] }).__messages) || [];
    const matchIndex = messages.findIndex((message) => message.type === "uploadImages" && Array.isArray(message.images));
    return matchIndex >= 0 ? matchIndex + 1 : false;
  });
  const messageIndex = Number(await index.jsonValue()) - 1;
  return page.evaluate((targetIndex) => {
    return ((window as unknown as { __messages: HostMessage[] }).__messages)[targetIndex];
  }, messageIndex) as Promise<{ type: string; requestId: string; images: Array<{ name: string; dataUrl: string }> }>;
}

async function resolveUpload(page: Page, requestId: string, markdown: string): Promise<void> {
  await page.evaluate(({ id, imageMarkdown }) => {
    window.dispatchEvent(new MessageEvent("message", {
      data: {
        type: "uploadImagesResult",
        requestId: id,
        images: [{ markdown: imageMarkdown }]
      }
    }));
  }, { id: requestId, imageMarkdown: markdown });
}

async function placeSourceCursor(page: Page, position: number): Promise<void> {
  await page.locator("#source-editor").focus();
  await page.evaluate((cursor) => {
    const source = document.getElementById("source-editor") as HTMLTextAreaElement;
    source.setSelectionRange(cursor, cursor);
    source.dispatchEvent(new Event("select", { bubbles: true }));
  }, position);
}

async function getSourceCaret(page: Page): Promise<number> {
  return page.evaluate(() => {
    const source = document.getElementById("source-editor") as HTMLTextAreaElement;
    return source.selectionStart;
  });
}

async function placeProseMirrorCursor(page: Page, searchText: string, offset: number): Promise<void> {
  await page.locator(".ProseMirror").focus();
  await page.evaluate(({ search, cursorOffset }) => {
    const editor = document.querySelector(".ProseMirror") as HTMLElement | null;
    if (!editor) {
      throw new Error("Missing ProseMirror editor.");
    }
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      const text = node.textContent || "";
      const index = text.indexOf(search);
      if (index >= 0) {
        const selection = window.getSelection();
        const range = document.createRange();
        range.setStart(node, index + cursorOffset);
        range.collapse(true);
        selection?.removeAllRanges();
        selection?.addRange(range);
        editor.focus();
        return;
      }
      node = walker.nextNode();
    }
    throw new Error(`Could not find ProseMirror text: ${search}`);
  }, { search: searchText, cursorOffset: offset });
}

async function waitForLatestEditRevision(page: Page, text: string): Promise<number> {
  const edit = await waitForLatestEdit(page, text);
  return edit.editRevision;
}

async function waitForLatestEdit(page: Page, text: string): Promise<{ text: string; editRevision: number }> {
  const edit = await page.waitForFunction((expectedText) => {
    const messages = ((window as unknown as { __messages?: Array<{ type?: string; text?: string; editRevision?: unknown }> }).__messages) || [];
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (
        message.type === "edit"
        && typeof message.text === "string"
        && message.text.includes(expectedText as string)
        && typeof message.editRevision === "number"
      ) {
        return { text: message.text, editRevision: message.editRevision };
      }
    }
    return false;
  }, text);
  return edit.jsonValue() as Promise<{ text: string; editRevision: number }>;
}

async function dispatchHostMarkdown(page: Page, markdown: string, editRevision?: number): Promise<void> {
  await page.evaluate(({ nextMarkdown, revision }) => {
    const escapeHtml = (value: string) => value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
    const data: Record<string, unknown> = {
      type: "setMarkdown",
      text: nextMarkdown,
      preview: {
        markdown: nextMarkdown,
        html: nextMarkdown
          .split(/\r?\n/)
          .map((line, index) => `<p data-source-line="${index}">${escapeHtml(line)}</p>`)
          .join(""),
        headings: []
      }
    };
    if (typeof revision === "number") {
      data.editRevision = revision;
    }
    window.dispatchEvent(new MessageEvent("message", { data }));
  }, { nextMarkdown: markdown, revision: editRevision });
}

async function dispatchImagePaste(page: Page, selector: string, name: string): Promise<void> {
  await dispatchImageTransferEvent(page, selector, name, "paste");
}

async function dispatchImageDrop(page: Page, selector: string, name: string): Promise<void> {
  await dispatchImageTransferEvent(page, selector, name, "drop");
}

async function dispatchImageTransferEvent(page: Page, selector: string, name: string, eventName: "paste" | "drop"): Promise<void> {
  await page.locator(selector).evaluate((target, options) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File([new Uint8Array([1, 2, 3])], options.name, { type: "image/png" }));
    const event = options.eventName === "paste"
      ? new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: transfer })
      : new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: transfer });
    Object.defineProperty(event, options.eventName === "paste" ? "clipboardData" : "dataTransfer", {
      configurable: true,
      value: transfer
    });
    target.dispatchEvent(event);
  }, { name, eventName });
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
