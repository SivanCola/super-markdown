(function () {
  const vscode = acquireVsCodeApi();
  const payloadElement = document.getElementById("payload");
  const payloadText = payloadElement ? payloadElement.content?.textContent || payloadElement.textContent || "{}" : "{}";
  const payload = JSON.parse(payloadText);
  const headings = Array.isArray(payload.headings) ? payload.headings : [];
  const translations = payload.translations || {};
  const activeLanguage = String(payload.activeLanguage || document.documentElement.lang || "en").toLowerCase();
  const mode = String(payload.mode || "preview");
  const appShell = document.querySelector(".app-shell");
  const sidebar = document.getElementById("sidebar");
  const sidebarToggle = document.querySelector("[data-toggle-sidebar]");
  const sidebarResizeHandle = document.querySelector("[data-resize-sidebar]");
  const minOutlineHeight = 178;
  let webviewState = vscode.getState() || {};
  let activeIndex = 0;

  function updateWebviewState(patch) {
    webviewState = {
      ...(vscode.getState() || webviewState || {}),
      ...patch
    };
    vscode.setState(webviewState);
  }

  function maxOutlineHeight() {
    if (!sidebar) {
      return window.innerHeight;
    }
    const top = sidebar.getBoundingClientRect().top;
    return Math.max(minOutlineHeight, window.innerHeight - top - 16);
  }

  function applyOutlineHeight(height, persist) {
    if (!sidebar || !Number.isFinite(height)) {
      return;
    }
    const nextHeight = Math.round(Math.max(minOutlineHeight, Math.min(height, maxOutlineHeight())));
    sidebar.style.setProperty("--sm-outline-height", `${nextHeight}px`);
    if (persist) {
      updateWebviewState({ outlineHeight: nextHeight });
    }
  }

  function restoreOutlineHeight() {
    const outlineHeight = Number(webviewState.outlineHeight);
    if (Number.isFinite(outlineHeight)) {
      applyOutlineHeight(outlineHeight, false);
    }
  }

  function updateSidebarToggle() {
    if (!appShell || !sidebarToggle) {
      return;
    }
    const collapsed = appShell.classList.contains("sidebar-collapsed");
    sidebarToggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
    sidebarToggle.textContent = collapsed
      ? localizedToggleText("showOutline", "Show outline", "显示大纲")
      : localizedToggleText("hideOutline", "Hide outline", "隐藏大纲");
  }

  function localizedToggleText(key, english, chinese) {
    const value = typeof translations[key] === "string" ? translations[key] : "";
    if (activeLanguage.startsWith("zh")) {
      return value && value !== english ? value : chinese;
    }
    return value || english;
  }

  function bySlug(slug) {
    return document.getElementById(slug);
  }

  function eventTargetElement(event) {
    const target = event.target;
    if (target instanceof Element) {
      return target;
    }
    return target?.parentElement || null;
  }

  function setActive(slug) {
    document.querySelectorAll("[data-toc-link].active").forEach((element) => {
      element.classList.remove("active");
    });
    const link = document.querySelector(`[data-toc-link][data-slug="${cssEscape(slug)}"]`);
    if (!link) {
      return;
    }
    link.classList.add("active");
    link.scrollIntoView({ block: "nearest" });
    const index = headings.findIndex((heading) => heading.slug === slug);
    if (index !== -1) {
      activeIndex = index;
      updateWebviewState({ activeSlug: slug });
    }
  }

  function revealHeading(index, syncSource) {
    if (headings.length === 0) {
      return;
    }
    activeIndex = Math.max(0, Math.min(index, headings.length - 1));
    const heading = headings[activeIndex];
    const element = bySlug(heading.slug) || findSourceLineElement(heading.line);
    if (element) {
      scrollPreviewToElement(element, "start");
      element.focus({ preventScroll: true });
      setActive(heading.slug);
    }
    if (syncSource && mode === "splitEdit") {
      vscode.postMessage({ type: "revealLine", line: heading.line });
    }
  }

  function revealHeadingTarget(slug, line, syncSource) {
    const bySlugIndex = slug ? headings.findIndex((heading) => heading.slug === slug) : -1;
    const byLineIndex =
      bySlugIndex === -1 && Number.isFinite(line) ? headings.findIndex((heading) => heading.line === line) : -1;
    const index = bySlugIndex === -1 ? byLineIndex : bySlugIndex;

    if (index !== -1) {
      revealHeading(index, syncSource);
      return;
    }

    const target = slug ? bySlug(slug) : null;
    const fallback = target || (Number.isFinite(line) ? findSourceLineElement(line) : null);
    if (fallback) {
      scrollPreviewToElement(fallback, "start");
      fallback.focus({ preventScroll: true });
    }
    if (syncSource && mode === "splitEdit" && Number.isFinite(line)) {
      vscode.postMessage({ type: "revealLine", line });
    }
  }

  function revealLine(line) {
    vscode.postMessage({ type: "revealLine", line });
  }

  function revealPreviewLine(line) {
    const target = findSourceLineElement(line);
    if (!target) {
      return;
    }

    scrollPreviewToElement(target, "center");
    document.querySelectorAll(".source-line-active").forEach((element) => {
      element.classList.remove("source-line-active");
    });
    target.classList.add("source-line-active");

    const heading = findHeadingForLine(line);
    if (heading) {
      setActive(heading.slug);
    }
  }

  function findSourceLineElement(line) {
    const elements = Array.from(document.querySelectorAll("[data-source-line]"))
      .map((element) => ({ element, line: Number(element.getAttribute("data-source-line")) }))
      .filter((entry) => Number.isFinite(entry.line))
      .sort((a, b) => a.line - b.line);

    if (elements.length === 0) {
      return null;
    }

    const exact = elements.find((entry) => entry.line === line);
    if (exact) {
      return exact.element;
    }

    let closest = elements[0];
    for (const entry of elements) {
      if (entry.line > line) {
        break;
      }
      closest = entry;
    }
    return closest.element;
  }

  function scrollPreviewToElement(element, block) {
    const preview = document.querySelector(".preview");
    if (!preview || !preview.contains(element)) {
      element.scrollIntoView({ behavior: "smooth", block });
      return;
    }

    const previewRect = preview.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();
    const offset =
      block === "center"
        ? elementRect.top - previewRect.top - (preview.clientHeight - elementRect.height) / 2
        : elementRect.top - previewRect.top - 18;
    preview.scrollTo({
      top: preview.scrollTop + offset,
      behavior: "smooth"
    });
  }

  function findHeadingForLine(line) {
    let candidate = headings[0];
    for (const heading of headings) {
      if (heading.line > line) {
        break;
      }
      candidate = heading;
    }
    return candidate;
  }

  window.addEventListener("message", (event) => {
    const message = event.data || {};
    if (message.type === "revealPreviewLine" && Number.isFinite(message.line)) {
      revealPreviewLine(message.line);
    }
  });

  document.addEventListener("click", (event) => {
    const target = eventTargetElement(event);
    if (!target) {
      return;
    }

    const toggleSidebar = target.closest("[data-toggle-sidebar]");
    if (toggleSidebar && appShell) {
      event.preventDefault();
      appShell.classList.toggle("sidebar-collapsed");
      updateSidebarToggle();
      return;
    }

    const languageButton = target.closest("[data-switch-language]");
    if (languageButton) {
      event.preventDefault();
      vscode.postMessage({ type: "switchDisplayLanguage" });
      return;
    }

    const copyButton = target.closest(".copy-code");
    if (copyButton) {
      const code = copyButton.closest(".code-block")?.querySelector("code");
      if (code) {
        vscode.postMessage({ type: "copyText", text: code.textContent || "" });
        const previous = copyButton.textContent;
        copyButton.textContent = translations.copied || "Copied";
        window.setTimeout(() => {
          copyButton.textContent = previous;
        }, 1200);
      }
      return;
    }

    const tocLink = target.closest("[data-toc-link]");
    if (tocLink) {
      event.preventDefault();
      const slug = tocLink.getAttribute("data-slug");
      const line = Number(tocLink.getAttribute("data-line"));
      revealHeadingTarget(slug, line, true);
      return;
    }

    const issueTarget = target.closest("[data-issue-line]");
    if (issueTarget) {
      const line = Number(issueTarget.getAttribute("data-issue-line"));
      if (Number.isFinite(line)) {
        revealLine(line);
      }
      return;
    }

    const anchor = target.closest("a[href]");
    if (anchor) {
      const href = anchor.getAttribute("href");
      if (!href) {
        return;
      }
      if (href.startsWith("#")) {
        event.preventDefault();
        const slug = decodeURIComponent(href.slice(1));
        revealHeadingTarget(slug, NaN, true);
        return;
      }
      event.preventDefault();
      vscode.postMessage({ type: "openLink", href });
    }
  });

  const search = document.getElementById("toc-search");
  if (search) {
    search.addEventListener("input", () => {
      const query = search.value.trim().toLowerCase();
      document.querySelectorAll(".toc-item").forEach((item) => {
        const text = item.textContent.toLowerCase();
        item.hidden = query.length > 0 && !text.includes(query);
      });
    });
  }

  if (sidebarResizeHandle && sidebar) {
    sidebarResizeHandle.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      const pointerId = event.pointerId;
      const startY = event.clientY;
      const startHeight = sidebar.getBoundingClientRect().height;

      sidebarResizeHandle.setPointerCapture(pointerId);
      document.body.classList.add("is-resizing-sidebar");

      function onPointerMove(moveEvent) {
        if (moveEvent.pointerId !== pointerId) {
          return;
        }
        applyOutlineHeight(startHeight + moveEvent.clientY - startY, false);
      }

      function stopResizing(endEvent) {
        if (endEvent.pointerId !== pointerId) {
          return;
        }
        sidebarResizeHandle.releasePointerCapture(pointerId);
        document.body.classList.remove("is-resizing-sidebar");
        applyOutlineHeight(sidebar.getBoundingClientRect().height, true);
        sidebarResizeHandle.removeEventListener("pointermove", onPointerMove);
        sidebarResizeHandle.removeEventListener("pointerup", stopResizing);
        sidebarResizeHandle.removeEventListener("pointercancel", stopResizing);
      }

      sidebarResizeHandle.addEventListener("pointermove", onPointerMove);
      sidebarResizeHandle.addEventListener("pointerup", stopResizing);
      sidebarResizeHandle.addEventListener("pointercancel", stopResizing);
    });

    sidebarResizeHandle.addEventListener("keydown", (event) => {
      const currentHeight = sidebar.getBoundingClientRect().height;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        applyOutlineHeight(currentHeight + 24, true);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        applyOutlineHeight(currentHeight - 24, true);
      } else if (event.key === "PageDown") {
        event.preventDefault();
        applyOutlineHeight(currentHeight + 96, true);
      } else if (event.key === "PageUp") {
        event.preventDefault();
        applyOutlineHeight(currentHeight - 96, true);
      } else if (event.key === "Home") {
        event.preventDefault();
        applyOutlineHeight(minOutlineHeight, true);
      } else if (event.key === "End") {
        event.preventDefault();
        applyOutlineHeight(maxOutlineHeight(), true);
      }
    });
  }

  document.addEventListener("keydown", (event) => {
    const target = event.target;
    if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) {
      return;
    }

    if (event.key === "j") {
      event.preventDefault();
      revealHeading(activeIndex + 1, true);
    } else if (event.key === "k") {
      event.preventDefault();
      revealHeading(activeIndex - 1, true);
    } else if (event.key === "]") {
      event.preventDefault();
      revealSameLevel(1);
    } else if (event.key === "[") {
      event.preventDefault();
      revealSameLevel(-1);
    } else if (event.key === "G") {
      event.preventDefault();
      revealHeading(headings.length - 1, true);
    } else if (event.key === "g") {
      const previous = window.__superMarkdownLastG || 0;
      const now = Date.now();
      window.__superMarkdownLastG = now;
      if (now - previous < 500) {
        event.preventDefault();
        revealHeading(0, true);
      }
    }
  });

  function revealSameLevel(direction) {
    if (headings.length === 0) {
      return;
    }
    const level = headings[activeIndex].level;
    let index = activeIndex + direction;
    while (index >= 0 && index < headings.length) {
      if (headings[index].level === level) {
        revealHeading(index, true);
        return;
      }
      index += direction;
    }
  }

  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (visible && visible.target.id) {
        setActive(visible.target.id);
      }
    },
    { root: document.querySelector(".preview"), rootMargin: "0px 0px -70% 0px", threshold: [0, 1] }
  );

  headings.forEach((heading) => {
    const element = bySlug(heading.slug);
    if (element) {
      observer.observe(element);
    }
  });

  const previousState = vscode.getState();
  webviewState = previousState || webviewState;
  restoreOutlineHeight();
  if (previousState && previousState.activeSlug) {
    setActive(previousState.activeSlug);
  } else if (headings[0]) {
    setActive(headings[0].slug);
  }

  updateSidebarToggle();
  window.addEventListener("resize", () => {
    const outlineHeight = Number((vscode.getState() || {}).outlineHeight);
    if (Number.isFinite(outlineHeight)) {
      applyOutlineHeight(outlineHeight, true);
    }
  });

  if (payload.mermaidEnabled && window.mermaid) {
    window.mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: document.body.classList.contains("vscode-dark") ? "dark" : "default"
    });
    window.mermaid.run({ nodes: document.querySelectorAll(".mermaid") }).catch((error) => {
      vscode.postMessage({ type: "previewError", message: String(error) });
    });
  }

  function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === "function") {
      return window.CSS.escape(value);
    }
    return String(value).replace(/"/g, '\\"');
  }
})();
