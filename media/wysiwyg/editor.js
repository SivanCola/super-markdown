(function () {
  const vscode = acquireVsCodeApi();
  const payloadElement = document.getElementById("payload");
  const payloadText = payloadElement ? payloadElement.content?.textContent || payloadElement.textContent || "{}" : "{}";
  const payload = JSON.parse(payloadText);
  const translations = payload.translations || {};
  const editorElement = document.getElementById("editor");
  const toolbarSlotElement = document.getElementById("editor-toolbar-slot");
  const sidePanelElement = document.getElementById("side-panel");
  const sidePanelToggleElement = document.getElementById("side-panel-toggle");
  const previewElement = document.getElementById("preview");
  const outlineElement = document.getElementById("outline");
  const searchElement = document.getElementById("outline-search");
  let currentMarkdown = payload.text || "";
  let applyingHostUpdate = false;
  let currentMode = payload.mode || "sv";
  let currentLayout = payload.layout || "workbench";
  let previewState = normalizePreviewState(payload.preview);
  let vditor;
  let fallbackEditor;
  let unbindEditorScrollSync;
  let editorScrollSyncFrame = 0;
  let sidePanelOpen = false;

  function post(type, body) {
    vscode.postMessage(Object.assign({ type }, body || {}));
  }

  function debounce(fn, delay) {
    let timer;
    return function () {
      clearTimeout(timer);
      timer = setTimeout(fn, delay);
    };
  }

  const syncToHost = debounce(function () {
    if (applyingHostUpdate || (!vditor && !fallbackEditor)) {
      return;
    }
    currentMarkdown = getEditorValue();
    previewState = null;
    renderSidePanels(currentMarkdown);
    post("edit", { text: currentMarkdown });
  }, 250);

  function getEditorValue() {
    if (vditor) {
      return vditor.getValue();
    }
    if (fallbackEditor) {
      return fallbackEditor.value;
    }
    return currentMarkdown;
  }

  function setEditorValue(markdown) {
    if (vditor) {
      vditor.setValue(markdown);
    }
    if (fallbackEditor) {
      fallbackEditor.value = markdown;
    }
  }

  function normalizePreviewState(value) {
    if (!value || typeof value !== "object") {
      return null;
    }
    return {
      markdown: typeof value.markdown === "string" ? value.markdown : currentMarkdown,
      html: typeof value.html === "string" ? value.html : "",
      headings: Array.isArray(value.headings) ? value.headings : []
    };
  }

  function hasPreviewState(markdown) {
    return Boolean(previewState && previewState.markdown === markdown);
  }

  function setPreviewHtml(html) {
    previewElement.innerHTML = `<article class="markdown-body">${html}</article>`;
  }

  function getPreviewHtml() {
    return previewElement.querySelector(".markdown-body")?.innerHTML || previewElement.innerHTML;
  }

  function buildToolbar() {
    return [
      builtInToolbarItem("bold", iconText("B", "bold")),
      builtInToolbarItem("italic", iconText("I", "italic")),
      {
        name: "underline",
        icon: iconText("U", "underline"),
        tip: toolbarLabel("underline", "Underline"),
        tipPosition: "ne",
        click(event, editor) {
          insertAround(editor, "<u>", "</u>", "text");
        }
      },
      builtInToolbarItem("strike", iconText("S", "strike")),
      {
        name: "mark",
        icon: iconText("M", "mark"),
        tip: toolbarLabel("mark", "Highlight"),
        tipPosition: "ne",
        click(event, editor) {
          insertAround(editor, "<mark>", "</mark>", "text");
        }
      },
      "|",
      builtInToolbarItem("headings", iconText("H", "headings")),
      builtInToolbarItem("line", iconSvg('<path d="M6 16h20"></path>')),
      builtInToolbarItem("quote", iconText("66", "quote")),
      builtInToolbarItem("list", iconSvg('<path d="M12 9h14M12 16h14M12 23h14"></path><circle cx="7" cy="9" r="1.5"></circle><circle cx="7" cy="16" r="1.5"></circle><circle cx="7" cy="23" r="1.5"></circle>')),
      builtInToolbarItem("ordered-list", iconSvg('<path d="M13 9h13M13 16h13M13 23h13"></path><path d="M6 7h2v5M6 14h3l-3 5h3M6 22h3v4H6"></path>')),
      builtInToolbarItem("check", iconSvg('<rect x="6" y="7" width="20" height="20" rx="3"></rect><path d="M10 17l4 4 8-10"></path>')),
      {
        name: "completed-task",
        icon: iconSvg('<rect x="6" y="7" width="20" height="20" rx="3"></rect><path d="M10 17l4 4 8-10"></path>'),
        tip: toolbarLabel("completedTask", "Completed task"),
        tipPosition: "n",
        click(event, editor) {
          insertSnippet(editor, "- [x] Completed task\n");
        }
      },
      "|",
      builtInToolbarItem("link", iconSvg('<path d="M13 11l-2 2a5 5 0 0 0 7 7l2-2"></path><path d="M19 21l2-2a5 5 0 0 0-7-7l-2 2"></path><path d="M13 19l6-6"></path>')),
      builtInToolbarItem("upload", iconSvg('<rect x="5" y="7" width="22" height="18" rx="2"></rect><circle cx="12" cy="13" r="2"></circle><path d="M7 23l6-6 4 4 3-3 5 5"></path>')),
      builtInToolbarItem("inline-code", iconText("</>", "inline-code")),
      builtInToolbarItem("code", iconSvg('<path d="M12 10l-5 6 5 6M20 10l5 6-5 6M18 7l-4 18"></path>')),
      builtInToolbarItem("table", iconSvg('<rect x="6" y="7" width="20" height="18" rx="1"></rect><path d="M6 13h20M6 19h20M13 7v18M20 7v18"></path>')),
      "|",
      {
        name: "math",
        icon: iconText("fx", "math"),
        tip: toolbarLabel("math", "Math"),
        tipPosition: "n",
        click(event, editor) {
          insertMath(editor);
        }
      },
      {
        name: "mermaid",
        icon: iconSvg('<rect x="5" y="7" width="8" height="6" rx="1"></rect><rect x="19" y="7" width="8" height="6" rx="1"></rect><rect x="12" y="21" width="8" height="6" rx="1"></rect><path d="M13 10h6M23 13v5l-7 3M9 13v5l7 3"></path>'),
        tip: toolbarLabel("mermaid", "Mermaid"),
        tipPosition: "n",
        click(event, editor) {
          insertSnippet(editor, "\n```mermaid\nflowchart LR\n  A[Markdown] --> B[Super Markdown Preview]\n```\n");
        }
      },
      "|",
      buildMoreMenu(),
      builtInToolbarItem("help", iconSvg('<circle cx="16" cy="16" r="11"></circle><path d="M13 12a3 3 0 1 1 5 2.2c-1.4 1-2 1.7-2 3.3"></path><path d="M16 23h.01"></path>'))
    ];
  }

  function buildMoreMenu() {
    return {
      name: "more",
      icon: iconLabel(`${toolbarLabel("more", "More")} ▾`),
      tip: toolbarLabel("more", "More"),
      tipPosition: "nw",
      toolbar: [
        moreItem("save", translations.save || "Save", function () {
          post("save");
        }),
        moreItem("copyMarkdown", translations.copyMarkdown || "Copy Markdown", function () {
          post("copyMarkdown");
        }),
        moreItem("copyHtml", translations.copyHtml || "Copy HTML", function () {
          post("copyHtml", { html: getPreviewHtml() });
        }),
        moreItem("tocBlock", toolbarLabel("tocBlock", "Table of contents block"), function (editor) {
          insertSnippet(editor, "\n<!-- super-markdown-toc -->\n<!-- /super-markdown-toc -->\n");
        }),
        moreItem("footnote", toolbarLabel("footnote", "Footnote"), function (editor) {
          insertSnippet(editor, "Here is a footnote reference.[^1]\n\n[^1]: Footnote text.\n");
        }),
        moreItem("htmlComment", toolbarLabel("htmlComment", "HTML comment"), function (editor) {
          insertSnippet(editor, "<!-- comment -->");
        }),
        moreItem("organizeMarkdown", toolbarLabel("organizeMarkdown", "Organize Markdown"), function () {
          post("runHostCommand", { command: "organizeMarkdown" });
        })
      ]
    };
  }

  function builtInToolbarItem(name, icon) {
    return { name, icon };
  }

  function moreItem(name, label, action) {
    return {
      name,
      icon: escapeHtml(label),
      tip: label,
      click(event, editor) {
        action(editor);
      }
    };
  }

  function toolbarLabel(name, fallback) {
    const toolbarTranslations = translations.toolbar || {};
    return typeof toolbarTranslations[name] === "string" ? toolbarTranslations[name] : fallback;
  }

  function iconSvg(paths) {
    return `<svg viewBox="0 0 32 32" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${paths}</g></svg>`;
  }

  function iconText(text, className) {
    return `<svg viewBox="0 0 32 32" aria-hidden="true" class="sm-toolbar-icon-${className}"><text x="16" y="22" text-anchor="middle" font-size="19" font-family="Arial, sans-serif" font-weight="700" fill="currentColor">${escapeHtml(text)}</text></svg>`;
  }

  function iconLabel(text) {
    return `<span class="sm-toolbar-text-icon">${escapeHtml(text)}</span>`;
  }

  function insertAround(editor, prefix, suffix, placeholder) {
    const target = editor || vditor;
    if (!target) {
      return;
    }
    const selection = getSelectionText(target);
    const value = `${prefix}${selection || placeholder}${suffix}`;
    try {
      if (selection && typeof target.updateValue === "function") {
        target.updateValue(value);
      } else {
        target.insertValue(value);
      }
    } catch (error) {
      target.insertValue(value);
    }
    syncToolbarEdit();
  }

  function insertSnippet(editor, snippet) {
    const target = editor || vditor;
    if (!target) {
      return;
    }
    target.insertValue(snippet);
    syncToolbarEdit();
  }

  function insertMath(editor) {
    const target = editor || vditor;
    const selection = getSelectionText(target);
    if (selection.includes("\n")) {
      insertAround(target, "\n$$\n", "\n$$\n", "E = mc^2");
      return;
    }
    insertAround(target, "$", "$", "E = mc^2");
  }

  function getSelectionText(editor) {
    try {
      return editor && typeof editor.getSelection === "function" ? editor.getSelection() : "";
    } catch (error) {
      return "";
    }
  }

  function syncToolbarEdit() {
    window.setTimeout(function () {
      currentMarkdown = getEditorValue();
      previewState = null;
      renderSidePanels(currentMarkdown);
      post("edit", { text: currentMarkdown });
    }, 0);
  }

  function relocateToolbar() {
    if (!toolbarSlotElement) {
      return;
    }
    if (currentLayout === "previewOnly") {
      clearToolbarSlot();
      return;
    }
    toolbarSlotElement.hidden = false;
    const toolbar = editorElement.querySelector(".vditor-toolbar") || toolbarSlotElement.querySelector(".vditor-toolbar");
    if (toolbar && toolbar.parentElement !== toolbarSlotElement) {
      toolbarSlotElement.replaceChildren(toolbar);
    }
    enhanceToolbarA11y();
  }

  function collapseToolbarPanels() {
    const toolbarRoot = toolbarSlotElement || editorElement;
    toolbarRoot.querySelectorAll(".vditor-hint, .vditor-panel").forEach((panel) => {
      panel.style.display = "none";
    });
    toolbarRoot.querySelectorAll(".vditor-hint--current").forEach((item) => {
      item.classList.remove("vditor-hint--current");
    });
  }

  function enhanceToolbarA11y() {
    const toolbarRoot = toolbarSlotElement || editorElement;
    toolbarRoot.querySelectorAll(".vditor-toolbar__item > button, .vditor-toolbar__item > div").forEach((button) => {
      const label = button.getAttribute("aria-label") || button.textContent || button.getAttribute("data-type") || "";
      const cleanLabel = label.replace(/\s+<[^>]+>\s*$/, "").trim();
      if (cleanLabel && !button.getAttribute("title")) {
        button.setAttribute("title", cleanLabel);
      }
    });
  }

  function clearToolbarSlot() {
    if (!toolbarSlotElement) {
      return;
    }
    toolbarSlotElement.replaceChildren();
    toolbarSlotElement.hidden = currentLayout === "previewOnly";
  }

  function setSidePanelOpen(open) {
    sidePanelOpen = Boolean(open);
    document.body.classList.toggle("side-panel-open", sidePanelOpen);
    if (sidePanelToggleElement) {
      sidePanelToggleElement.setAttribute("aria-expanded", String(sidePanelOpen));
    }
  }

  function shouldAutoCloseSidePanel() {
    return currentLayout !== "previewOnly" && currentLayout !== "splitEdit" && currentMode !== "wysiwyg";
  }

  function initVditor(mode) {
    if (currentLayout === "previewOnly") {
      clearEditorForPreview();
      return;
    }
    if (typeof Vditor === "undefined") {
      initFallbackEditor("Vditor assets are unavailable. Run npm run copy-assets and reload the extension.");
      return;
    }

    try {
      fallbackEditor = undefined;
      editorElement.innerHTML = "";
      vditor = new Vditor(editorElement, {
        value: currentMarkdown,
        mode: mode || currentMode,
        theme: payload.theme || "classic",
        cdn: payload.cdn,
        height: "100%",
        cache: { enable: false },
        counter: { enable: false },
        toolbar: buildToolbar(),
        toolbarConfig: { pin: true },
        preview: {
          mode: "editor",
          hljs: { enable: true },
          markdown: { toc: true, mark: true, footnotes: true }
        },
        upload: {
          handler(files) {
            uploadImages(files);
            return null;
          }
        },
        input: syncToHost,
        after() {
          relocateToolbar();
          collapseToolbarPanels();
          renderSidePanels(currentMarkdown);
          bindEditorScrollSync();
        }
      });
      relocateToolbar();
      collapseToolbarPanels();
      window.setTimeout(collapseToolbarPanels, 0);
      window.setTimeout(collapseToolbarPanels, 50);
      bindEditorScrollSync();
    } catch (error) {
      vditor = undefined;
      const message = error && error.message ? error.message : String(error);
      initFallbackEditor(`Vditor failed to initialize: ${message}`);
      post("error", { message });
    }
  }

  function applyLayout(layout) {
    currentLayout = ["workbench", "editorOnly", "splitEdit", "previewOnly"].includes(layout) ? layout : "workbench";
    document.body.classList.remove("layout-workbench", "layout-editorOnly", "layout-splitEdit", "layout-previewOnly");
    document.body.classList.add(`layout-${currentLayout}`);
    setSidePanelOpen(false);
    if (currentLayout === "previewOnly") {
      clearEditorForPreview();
    } else {
      relocateToolbar();
      bindEditorScrollSync();
    }
  }

  function clearEditorForPreview() {
    unbindEditorScrollSync?.();
    unbindEditorScrollSync = undefined;
    if (vditor && typeof vditor.destroy === "function") {
      vditor.destroy();
    }
    vditor = undefined;
    fallbackEditor = undefined;
    editorElement.innerHTML = "";
    clearToolbarSlot();
  }

  function initFallbackEditor(message) {
    clearToolbarSlot();
    editorElement.innerHTML = "";
    const fallback = document.createElement("div");
    fallback.className = "fallback-editor";

    const notice = document.createElement("div");
    notice.className = "fallback-notice";
    notice.textContent = message;

    const textarea = document.createElement("textarea");
    textarea.value = currentMarkdown;
    textarea.setAttribute("aria-label", "Markdown source");
    textarea.addEventListener("input", syncToHost);

    fallback.appendChild(notice);
    fallback.appendChild(textarea);
    editorElement.appendChild(fallback);
    fallbackEditor = textarea;
    bindEditorScrollSync();
  }

  function switchMode(mode) {
    if (mode === currentMode) {
      return;
    }

    currentMarkdown = getEditorValue();
    currentMode = mode;
    if (vditor && typeof vditor.destroy === "function") {
      vditor.destroy();
    }
    vditor = undefined;
    fallbackEditor = undefined;
    editorElement.innerHTML = "";
    clearToolbarSlot();
    if (currentLayout === "previewOnly") {
      renderSidePanels(currentMarkdown);
      return;
    }
    initVditor(currentMode);
    renderSidePanels(currentMarkdown);
    post("edit", { text: currentMarkdown });
  }

  function bindEditorScrollSync() {
    unbindEditorScrollSync?.();
    unbindEditorScrollSync = undefined;

    if (currentLayout !== "splitEdit") {
      return;
    }

    const scrollElement = getEditorScrollElement();
    if (!scrollElement) {
      return;
    }

    const onScroll = () => {
      if (editorScrollSyncFrame) {
        window.cancelAnimationFrame(editorScrollSyncFrame);
      }
      editorScrollSyncFrame = window.requestAnimationFrame(() => {
        editorScrollSyncFrame = 0;
        syncPreviewScrollFromEditor(scrollElement);
      });
    };

    scrollElement.addEventListener("scroll", onScroll, { passive: true });
    unbindEditorScrollSync = () => {
      scrollElement.removeEventListener("scroll", onScroll);
      if (editorScrollSyncFrame) {
        window.cancelAnimationFrame(editorScrollSyncFrame);
        editorScrollSyncFrame = 0;
      }
    };
  }

  function getEditorScrollElement() {
    const mode = vditor && vditor.vditor ? vditor.vditor.currentMode : currentMode;
    if (mode === "sv") {
      return editorElement.querySelector(".vditor-sv") || editorElement.querySelector("textarea");
    }
    if (mode === "ir") {
      return editorElement.querySelector(".vditor-ir") || editorElement.querySelector("textarea");
    }
    if (mode === "wysiwyg") {
      return editorElement.querySelector(".vditor-wysiwyg") || editorElement.querySelector("textarea");
    }
    return editorElement.querySelector(".vditor-sv") || editorElement.querySelector(".vditor-ir") || editorElement.querySelector(".vditor-wysiwyg") || editorElement.querySelector("textarea");
  }

  function syncPreviewScrollFromEditor(scrollElement) {
    const editorMax = scrollElement.scrollHeight - scrollElement.clientHeight;
    const previewMax = previewElement.scrollHeight - previewElement.clientHeight;
    if (editorMax <= 0 || previewMax <= 0) {
      return;
    }

    const ratio = Math.max(0, Math.min(1, scrollElement.scrollTop / editorMax));
    previewElement.scrollTop = Math.round(previewMax * ratio);
  }

  async function renderPreview(markdown) {
    if (hasPreviewState(markdown) && previewState.html) {
      setPreviewHtml(previewState.html);
      return;
    }

    try {
      if (typeof Vditor !== "undefined" && Vditor.md2html) {
        const html = await Vditor.md2html(markdown, {
          cdn: payload.cdn,
          mode: "light",
          hljs: { enable: true },
          markdown: { toc: true, mark: true, footnotes: true }
        });
        setPreviewHtml(html);
      } else {
        setPreviewHtml(`<pre class="static-preview-source">${escapeHtml(markdown)}</pre>`);
      }
    } catch (error) {
      setPreviewHtml(`<pre class="static-preview-source">${escapeHtml(markdown)}</pre>`);
    }
  }

  function renderOutline(markdown) {
    const headings = hasPreviewState(markdown)
      ? previewState.headings
      : markdown
          .split(/\r?\n/)
          .map((line, index) => {
            const match = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
            return match ? { level: match[1].length, text: cleanHeading(match[2]), line: index, slug: "" } : null;
          })
          .filter(Boolean);

    if (!headings.length) {
      outlineElement.innerHTML = `<div class="outline-empty">${escapeHtml(translations.noHeadings || "No headings")}</div>`;
      return;
    }

    outlineElement.innerHTML = headings
      .map(function (heading, index) {
        const padding = (heading.level - 1) * 12;
        const slug = heading.slug ? ` data-slug="${escapeHtml(heading.slug)}"` : "";
        return `<a href="#" style="padding-left:${padding}px" data-line="${heading.line}" data-heading-index="${index}" data-heading-level="${heading.level}" data-heading-text="${escapeHtml(heading.text)}"${slug}>H${heading.level} ${escapeHtml(heading.text)}</a>`;
      })
      .join("");
  }

  function renderSidePanels(markdown) {
    renderOutline(markdown);
    void renderPreview(markdown);
  }

  function cleanHeading(value) {
    return value
      .replace(/!\[([^\]]*)]\([^)]+\)/g, "$1")
      .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
      .replace(/<[^>]+>/g, "")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/[*_~]/g, "")
      .trim();
  }

  function uploadImages(files) {
    const images = Array.from(files || []).filter((file) => file.type && file.type.startsWith("image/"));
    if (!images.length) {
      return;
    }
    const requestId = String(Date.now());
    Promise.all(
      images.map(
        (file, index) =>
          new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve({ id: `${requestId}-${index}`, name: file.name, dataUrl: reader.result });
            reader.onerror = reject;
            reader.readAsDataURL(file);
          })
      )
    )
      .then((items) => post("uploadImages", { requestId, images: items }))
      .catch((error) => post("error", { message: String(error && error.message ? error.message : error) }));
  }

  function scrollPreviewToElement(element) {
    if (!element) {
      return false;
    }
    if (previewElement.contains(element)) {
      const previewRect = previewElement.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();
      previewElement.scrollTo({
        top: previewElement.scrollTop + elementRect.top - previewRect.top - 12,
        behavior: "smooth"
      });
    } else {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    markActiveSourceLine(previewElement, element);
    return true;
  }

  function scrollPreviewToLine(line) {
    const entries = Array.from(previewElement.querySelectorAll("[data-source-line]"))
      .map((element) => ({ element, line: Number(element.getAttribute("data-source-line")) }))
      .filter((entry) => Number.isFinite(entry.line))
      .sort((a, b) => a.line - b.line);
    if (!entries.length) {
      return false;
    }
    const exact = entries.find((entry) => entry.line === line);
    if (exact) {
      return scrollPreviewToElement(exact.element);
    }
    let closest = entries[0];
    for (const entry of entries) {
      if (entry.line > line) {
        break;
      }
      closest = entry;
    }
    return scrollPreviewToElement(closest.element);
  }

  function scrollPreviewToSlug(slug) {
    const element = typeof slug === "string" ? document.getElementById(slug) : null;
    return Boolean(element && previewElement.contains(element) && scrollPreviewToElement(element));
  }

  function scrollEditorToHeading(target) {
    const headings = getEditorHeadingElements();
    if (!headings.length) {
      return false;
    }

    const index = Number(target.dataset.headingIndex);
    if (Number.isFinite(index) && headings[index]) {
      return scrollEditorToElement(headings[index]);
    }

    const level = Number(target.dataset.headingLevel);
    const text = normalizeHeadingText(target.dataset.headingText || target.textContent?.replace(/^H[1-6]\s+/, "") || "");
    const matched = headings.find((heading) => {
      const levelMatches = !Number.isFinite(level) || heading.tagName.toLowerCase() === `h${level}`;
      return levelMatches && normalizeHeadingText(heading.textContent || "") === text;
    });
    return scrollEditorToElement(matched);
  }

  function scrollEditorToLine(line) {
    if (!Number.isFinite(line)) {
      return false;
    }

    const scrollElement = getEditorScrollElement();
    if (!scrollElement) {
      return false;
    }

    const maxScroll = scrollElement.scrollHeight - scrollElement.clientHeight;
    if (maxScroll <= 0) {
      return false;
    }

    const lineCount = Math.max(1, currentMarkdown.split(/\r?\n/).length - 1);
    const ratio = Math.max(0, Math.min(1, line / lineCount));
    scrollElement.scrollTo({
      top: Math.round(maxScroll * ratio),
      behavior: "smooth"
    });
    return true;
  }

  function scrollEditorToElement(element) {
    const scrollElement = getEditorScrollElement();
    if (!scrollElement || !element || !scrollElement.contains(element)) {
      return false;
    }

    const scrollRect = scrollElement.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();
    scrollElement.scrollTo({
      top: scrollElement.scrollTop + elementRect.top - scrollRect.top - 12,
      behavior: "smooth"
    });
    markActiveSourceLine(editorElement, element);
    return true;
  }

  function getEditorContentElement() {
    const internal = vditor && vditor.vditor;
    if (internal) {
      const modeState = internal[internal.currentMode || currentMode];
      if (modeState && modeState.element) {
        return modeState.element;
      }
    }
    return fallbackEditor || getEditorScrollElement();
  }

  function getEditorHeadingElements() {
    const contentElement = getEditorContentElement();
    if (!contentElement || typeof contentElement.querySelectorAll !== "function") {
      return [];
    }
    return Array.from(contentElement.querySelectorAll("h1,h2,h3,h4,h5,h6"));
  }

  function normalizeHeadingText(value) {
    return String(value).replace(/\u200b/g, "").replace(/\s+/g, " ").trim();
  }

  function markActiveSourceLine(container, element) {
    container.querySelectorAll(".source-line-active").forEach((item) => item.classList.remove("source-line-active"));
    element.classList.add("source-line-active");
  }

  function scrollToNavigationTarget(target) {
    const line = Number(target.dataset.line);
    const hasLine = Number.isFinite(line);
    const slug = target.dataset.slug;

    if (currentLayout === "previewOnly") {
      if (!(slug && scrollPreviewToSlug(slug)) && hasLine) {
        scrollPreviewToLine(line);
      }
      return;
    }

    let scrolled = false;
    if (outlineElement.contains(target)) {
      scrolled = scrollEditorToHeading(target);
    }
    if (!scrolled && hasLine) {
      scrolled = scrollEditorToLine(line);
    }
    if (currentLayout === "splitEdit" && hasLine) {
      if (!(slug && scrollPreviewToSlug(slug))) {
        scrollPreviewToLine(line);
      }
    }
    if (!scrolled) {
      if (!(slug && scrollPreviewToSlug(slug)) && hasLine) {
        scrollPreviewToLine(line);
      }
    }
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  document.addEventListener("click", function (event) {
    const sidePanelToggle = event.target.closest("#side-panel-toggle");
    if (sidePanelToggle) {
      event.preventDefault();
      setSidePanelOpen(!sidePanelOpen);
      return;
    }
    if (shouldAutoCloseSidePanel() && sidePanelOpen && sidePanelElement && !sidePanelElement.contains(event.target)) {
      setSidePanelOpen(false);
    }

    const target = event.target.closest("[data-line], [data-slug]");
    if (!target) {
      return;
    }
    if (target.dataset.line) {
      event.preventDefault();
      scrollToNavigationTarget(target);
      if (shouldAutoCloseSidePanel()) {
        setSidePanelOpen(false);
      }
    } else if (target.dataset.slug) {
      event.preventDefault();
      scrollPreviewToSlug(target.dataset.slug);
      if (shouldAutoCloseSidePanel()) {
        setSidePanelOpen(false);
      }
    }
  });

  document.addEventListener("keydown", function (event) {
    if (shouldAutoCloseSidePanel() && event.key === "Escape" && sidePanelOpen) {
      setSidePanelOpen(false);
    }
  });

  searchElement.addEventListener("input", function () {
    const query = searchElement.value.trim().toLowerCase();
    outlineElement.querySelectorAll("a").forEach((link) => {
      link.hidden = query.length > 0 && !link.textContent.toLowerCase().includes(query);
    });
  });

  window.addEventListener("message", function (event) {
    const message = event.data || {};
    if (message.type === "setMarkdown" && typeof message.text === "string" && message.text !== currentMarkdown) {
      currentMarkdown = message.text;
      previewState = normalizePreviewState(message.preview);
      applyingHostUpdate = true;
      setEditorValue(currentMarkdown);
      applyingHostUpdate = false;
      renderSidePanels(currentMarkdown);
    } else if (message.type === "setMarkdown" && typeof message.text === "string") {
      previewState = normalizePreviewState(message.preview);
      renderSidePanels(currentMarkdown);
    } else if (message.type === "uploadImagesResult") {
      if (message.error) {
        post("error", { message: message.error });
        return;
      }
      if (vditor && Array.isArray(message.images)) {
        const insertion = message.images.map((image) => image.markdown).join("\n");
        vditor.insertValue(insertion);
      }
    } else if (message.type === "setEditorState") {
      if (typeof message.layout === "string") {
        applyLayout(message.layout);
      }
      if (typeof message.mode === "string") {
        switchMode(message.mode);
      }
      if (currentLayout !== "previewOnly" && !vditor && !fallbackEditor) {
        initVditor(currentMode);
      }
    }
  });

  if (payload.customCss) {
    const style = document.createElement("style");
    style.textContent = payload.customCss;
    document.head.appendChild(style);
  }

  applyLayout(currentLayout);
  renderSidePanels(currentMarkdown);
  if (currentLayout !== "previewOnly") {
    initVditor(currentMode);
  }
  post("ready");
})();
