import { Editor, defaultValueCtx, editorViewCtx, nodeViewCtx, rootCtx } from "@milkdown/kit/core";
import type { Node as ProseNode } from "@milkdown/kit/prose/model";
import type { NodeView } from "@milkdown/kit/prose/view";
import remarkMath from "remark-math";
import {
  commonmark,
  createCodeBlockCommand,
  insertHrCommand,
  toggleEmphasisCommand,
  toggleInlineCodeCommand,
  toggleLinkCommand,
  toggleStrongCommand,
  wrapInBlockquoteCommand,
  wrapInBulletListCommand,
  wrapInHeadingCommand,
  wrapInOrderedListCommand
} from "@milkdown/kit/preset/commonmark";
import { gfm, insertTableCommand, toggleStrikethroughCommand } from "@milkdown/kit/preset/gfm";
import { listener, listenerCtx } from "@milkdown/kit/plugin/listener";
import { clipboard } from "@milkdown/kit/plugin/clipboard";
import { history } from "@milkdown/kit/plugin/history";
import { trailing } from "@milkdown/kit/plugin/trailing";
import { upload, uploadConfig } from "@milkdown/kit/plugin/upload";
import { $nodeSchema, $remark, callCommand, getMarkdown, insert, replaceAll, replaceRange } from "@milkdown/kit/utils";
import {
  CODE_BLOCK_CLASSES,
  codeBlockToneLabel,
  nextCodeBlockTone,
  normalizeCodeBlockTone,
  type BlockToneLabels,
  type CodeCopyLabels
} from "../../src/markdown/codeBlockActions";
import {
  detectBlockquoteAdmonition,
  isSafeInlineHtmlTag,
  renderInertInlineHtml,
  renderKatexHtml,
  resolveFootnoteReference,
  type SafeInlineHtmlTag
} from "../../src/markdown/features";
import { highlightCodeBlockHtml, normalizeCodeLanguage } from "./highlight-runtime";
import { HEADING_MENU_ACTIONS, MORE_MENU_ACTIONS, renderToolbarIcon, SUPER_MARKDOWN_ISSUES_URL, TOOLBAR_GROUPS } from "../../src/wysiwyg/toolbar";
import type { ImageResource } from "../../src/wysiwyg/protocol";

declare const acquireVsCodeApi: () => {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
};

type PreviewState = {
  markdown: string;
  html: string;
  headings: Array<{ level: number; text: string; slug?: string; line: number }>;
};

type Payload = {
  text?: string;
  mode?: string;
  layout?: string;
  mermaidScript?: string;
  preview?: PreviewState;
  imageResources?: ImageResource[];
  katexEnabled?: boolean;
  translations?: {
    toolbar?: Record<string, string>;
    noHeadings?: string;
    outlineRevealCurrent?: string;
    outlineCollapse?: string;
    copiedCode?: string;
    copyCode?: string;
    codeTheme?: string;
    codeThemeAuto?: string;
    codeThemeLight?: string;
    codeThemeDark?: string;
    editLanguage?: string;
    mathEdit?: string;
    mathDone?: string;
    rawHtmlEscaped?: string;
    footnote?: string;
  };
};

const vscode = acquireVsCodeApi();
const payloadElement = document.getElementById("payload") as HTMLElement | null;
const templatePayload = payloadElement instanceof HTMLTemplateElement ? payloadElement.content.textContent : undefined;
const payloadText = payloadElement ? templatePayload || payloadElement.textContent || "{}" : "{}";
const payload = JSON.parse(payloadText) as Payload;
const translations = payload.translations || {};
const toolbarText = translations.toolbar || {};
const codeCopyLabels: CodeCopyLabels = {
  copyLabel: translations.copyCode || "Copy code",
  copiedLabel: translations.copiedCode || "Copied"
};

type MermaidRuntime = {
  initialize(options: { startOnLoad: boolean; securityLevel: string }): void;
  run(options: { nodes: NodeListOf<HTMLElement> }): Promise<void> | void;
};

declare global {
  interface Window {
    mermaid?: MermaidRuntime;
  }
}
const codeToneLabels: BlockToneLabels = {
  toneLabel: translations.codeTheme || "Block colors",
  autoLabel: translations.codeThemeAuto || "Auto",
  lightLabel: translations.codeThemeLight || "Light",
  darkLabel: translations.codeThemeDark || "Dark"
};
const visualLabels = {
  editLanguage: translations.editLanguage || "Edit language",
  mathEdit: translations.mathEdit || "Edit",
  mathDone: translations.mathDone || "Done",
  rawHtmlEscaped: translations.rawHtmlEscaped || "Raw HTML escaped",
  footnote: translations.footnote || "Footnote"
};
const mathRenderOptions = { katexEnabled: payload.katexEnabled !== false };
const sourceEditor = mustElement<HTMLTextAreaElement>("source-editor");
const visualEditor = mustElement<HTMLElement>("visual-editor");
const previewElement = mustElement<HTMLElement>("preview");
const toolbarElement = mustElement<HTMLElement>("editor-toolbar-slot");
const sidePanelElement = mustElement<HTMLElement>("side-panel");
const sidePanelToggleElement = mustElement<HTMLButtonElement>("side-panel-toggle");
const sidePanelCollapseElement = document.getElementById("side-panel-collapse") as HTMLButtonElement | null;
const outlineCurrentElement = document.getElementById("outline-current") as HTMLButtonElement | null;
const outlineElement = mustElement<HTMLElement>("outline");
const searchElement = mustElement<HTMLInputElement>("outline-search");
const editorPanelElement = document.querySelector(".editor-panel") as HTMLElement | null;
const previewPanelElement = document.querySelector(".preview-panel") as HTMLElement | null;
const splitResizerElement = document.getElementById("split-resizer") as HTMLElement | null;
const initialRuntimeState = readRuntimeState();
const DEFAULT_SPLIT_RATIO = 0.5;
const SPLIT_KEYBOARD_STEP = 0.03;
const SPLIT_MIN_PANE_WIDTH = 240;

let currentMarkdown = payload.text || "";
let currentMode = normalizeMode(payload.mode || "source");
let currentLayout = normalizeLayout(payload.layout || "workbench");
let splitRatio = normalizeSplitRatio(initialRuntimeState.splitRatio);
let previewState = normalizePreviewState(payload.preview);
let imageResources = normalizeImageResources(payload.imageResources);
let milkdownEditor: Editor | null = null;
let milkdownReady = false;
let milkdownReadyPromise: Promise<void> | null = null;
let visualImageObserver: MutationObserver | null = null;
let mermaidRuntimePromise: Promise<MermaidRuntime> | null = null;
let mermaidRenderQueue: Promise<void> = Promise.resolve();
let applyingHostUpdate = false;
let applyingMilkdownUpdate = false;
let scrollSyncSuppressTarget = "";
let editorScrollFrame = 0;
let scrollSyncReleaseTimer = 0;
let activeSourceSelection = { start: 0, end: 0 };
let sidePanelOpen = false;
let currentOutlineHeadings: PreviewState["headings"] = [];
let activeOutlineId = "";
let hoverTooltipTimer: number | undefined;
let hoverTooltipElement: HTMLElement | null = null;
let hoverTooltipTarget: HTMLElement | null = null;
let splitResizePointerId: number | null = null;
const HOVER_TOOLTIP_TARGET_SELECTOR = [
  "[data-hover-tooltip]",
  ".toolbar-button",
  ".toolbar-menu-button",
  ".side-panel-toggle",
  ".outline-tool",
  ".outline-item",
  ".visual-math-inline",
  ".visual-footnote-reference",
  ".visual-html-source",
  ".mermaid-render-error",
  `.${CODE_BLOCK_CLASSES.language}`,
  `.${CODE_BLOCK_CLASSES.toneButton}`,
  `.${CODE_BLOCK_CLASSES.copyButton}`
].join(",");

type UploadedMarkdownImage = { id?: string; name?: string; markdown: string };
const pendingImageUploads = new Map<string, {
  resolve: (images: UploadedMarkdownImage[]) => void;
  reject: (error: unknown) => void;
}>();

async function boot(): Promise<void> {
  try {
    renderToolbar();
    sourceEditor.value = currentMarkdown;
    renderPreview();
    renderSidePanels(currentMarkdown);
    bindEvents();
    applySplitRatio(false);
    applyLayout();
    setScriptState("runtime-ready", "ready");
    post("ready");
  } catch (error) {
    setScriptError(error);
    post("error", { message: getErrorMessage(error) });
  }
}

function mustElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing webview element: ${id}`);
  }
  return element as T;
}

function post(type: string, body?: Record<string, unknown>): void {
  vscode.postMessage(Object.assign({ type }, body || {}));
}

function debounce<T extends (...args: never[]) => void>(fn: T, delay: number): T {
  let timer: number | undefined;
  return function (this: unknown, ...args: never[]) {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => fn.apply(this, args), delay);
  } as T;
}

const syncToHost = debounce(function () {
  if (applyingHostUpdate) {
    return;
  }
  previewState = null;
  post("edit", { text: currentMarkdown });
}, 180);

function normalizeMode(mode: string): string {
  if (mode === "wysiwyg" || mode === "ir") {
    return "wysiwyg";
  }
  if (mode === "preview") {
    return "preview";
  }
  if (mode === "split") {
    return "split";
  }
  return "source";
}

function normalizeLayout(layout: string): string {
  return ["workbench", "editorOnly", "splitEdit", "previewOnly"].includes(layout) ? layout : "workbench";
}

function readRuntimeState(): Record<string, unknown> {
  const state = vscode.getState();
  return state && typeof state === "object" ? state as Record<string, unknown> : {};
}

function saveRuntimeState(update: Record<string, unknown>): void {
  vscode.setState({ ...readRuntimeState(), ...update });
}

function normalizeSplitRatio(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? clamp(value, 0.2, 0.8)
    : DEFAULT_SPLIT_RATIO;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function normalizePreviewState(value: unknown): PreviewState | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const candidate = value as Partial<PreviewState>;
  return {
    markdown: typeof candidate.markdown === "string" ? candidate.markdown : currentMarkdown,
    html: typeof candidate.html === "string" ? candidate.html : "",
    headings: Array.isArray(candidate.headings) ? candidate.headings : []
  };
}

function normalizeImageResources(value: unknown): ImageResource[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is ImageResource => {
      const candidate = item as Partial<ImageResource>;
      return typeof candidate.source === "string" && typeof candidate.resolved === "string";
    })
    .map((item) => ({ source: item.source, resolved: item.resolved }));
}

function setScriptState(state: string, diag: string): void {
  document.body.dataset.scriptState = state;
  document.body.dataset.scriptDiag = diag;
  toolbarElement.dataset.scriptDiag = diag;
}

function setScriptError(error: unknown): void {
  const message = getErrorMessage(error);
  document.body.dataset.scriptState = "error";
  document.body.dataset.scriptError = message;
  toolbarElement.dataset.scriptError = message;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.name && error.name !== "Error" ? `${error.name}: ${error.message}` : error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  if (error && typeof error === "object") {
    const candidate = error as { message?: unknown; name?: unknown; error?: unknown; stack?: unknown };
    const parts = [
      typeof candidate.name === "string" ? candidate.name : "",
      typeof candidate.message === "string" ? candidate.message : "",
      typeof candidate.error === "string" ? candidate.error : "",
      typeof candidate.stack === "string" ? candidate.stack.split(/\r?\n/)[0] : ""
    ].filter(Boolean);
    if (parts.length > 0) {
      return Array.from(new Set(parts)).join(": ");
    }
    try {
      return JSON.stringify(error);
    } catch {
      return Object.prototype.toString.call(error);
    }
  }
  return String(error || "Unknown error");
}

function label(name: string, fallback: string): string {
  return typeof toolbarText[name] === "string" ? toolbarText[name] : fallback;
}

function escapeHtml(value: unknown): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttribute(value: unknown): string {
  return escapeHtml(value).replace(/'/g, "&#39;");
}

function closestElement(target: EventTarget | null, selector: string): HTMLElement | null {
  const element = target && target instanceof Element ? target : (target as Node | null)?.parentElement;
  return element?.closest?.(selector) as HTMLElement | null;
}

function renderToolbar(): void {
  toolbarElement.innerHTML = TOOLBAR_GROUPS
    .map((group) => `<div class="toolbar-group toolbar-group-${group.name}">${group.actions.map(renderToolbarItem).join("")}</div>`)
    .join("");
}

function renderToolbarItem(action: string): string {
  if (action === "heading") {
    return toolbarMenu(action, toolbarTitle(action), toolbarIcon(action), HEADING_MENU_ACTIONS, "toolbar-heading-menu");
  }
  if (action === "more") {
    return toolbarMenu(action, toolbarTitle(action), toolbarIcon(action), MORE_MENU_ACTIONS, "toolbar-more-menu");
  }
  return toolbarButton(action, toolbarTitle(action), toolbarIcon(action));
}

function toolbarButton(action: string, title: string, icon: string): string {
  return `<button type="button" class="toolbar-button" data-action="${action}" data-hover-tooltip="${escapeAttribute(title)}" aria-label="${escapeAttribute(title)}"><span class="toolbar-icon" aria-hidden="true">${icon}</span></button>`;
}

function toolbarMenu(action: string, title: string, icon: string, menuActions: string[], className: string): string {
  return `<div class="toolbar-menu-wrapper ${className}">
    <button type="button" class="toolbar-button toolbar-menu-toggle" data-menu-toggle="${action}" data-hover-tooltip="${escapeAttribute(title)}" aria-label="${escapeAttribute(title)}" aria-expanded="false">
      <span class="toolbar-icon" aria-hidden="true">${icon}</span>
      <span class="toolbar-caret codicon codicon-arrow-small-down" aria-hidden="true"></span>
    </button>
    <div class="toolbar-menu" data-menu="${action}" hidden>
      ${menuActions.map(toolbarMenuButton).join("")}
    </div>
  </div>`;
}

function toolbarMenuButton(action: string): string {
  const title = toolbarTitle(action);
  return `<button type="button" class="toolbar-menu-button" data-action="${action}" data-hover-tooltip="${escapeAttribute(title)}" aria-label="${escapeAttribute(title)}">
    <span class="toolbar-menu-icon" aria-hidden="true">${toolbarIcon(action)}</span>
    <span class="toolbar-menu-label">${escapeHtml(title)}</span>
  </button>`;
}

function toolbarIcon(action: string): string {
  return renderToolbarIcon(action);
}

function toolbarTitle(action: string): string {
  const heading = action.match(/^heading-([1-6])$/);
  if (heading) {
    return `${label("heading", "Heading")} ${heading[1]}`;
  }
  const titles: Record<string, string> = {
    bold: label("bold", "Bold"),
    italic: label("italic", "Italic"),
    underline: label("underline", "Underline"),
    highlight: label("highlight", "Highlight"),
    strike: label("strike", "Strike"),
    heading: label("heading", "Heading"),
    hr: label("hr", "Rule"),
    quote: label("quote", "Quote"),
    list: label("list", "List"),
    "ordered-list": label("orderedList", "Ordered list"),
    task: label("task", "Task"),
    "task-checked": label("taskChecked", "Checked task"),
    link: label("link", "Link"),
    image: label("image", "Image"),
    "inline-code": label("inlineCode", "Inline code"),
    code: label("code", "Code block"),
    table: label("table", "Table"),
    math: label("math", "Math"),
    mermaid: label("mermaid", "Mermaid"),
    toc: label("toc", "Table of contents"),
    more: label("more", "More"),
    organizeMarkdown: label("organizeMarkdown", "Organize Markdown"),
    switchBackgroundTheme: label("switchBackgroundTheme", "Switch Reading Theme"),
    switchDisplayLanguage: label("switchDisplayLanguage", "Switch display language"),
    help: label("help", "Help"),
    "export-html": `${label("export", "Export")} HTML`,
    "export-pdf": `${label("export", "Export")} PDF`,
    "export-all": `${label("export", "Export")} ${label("all", "All")}`
  };
  return titles[action] || action;
}

function bindEvents(): void {
  sourceEditor.addEventListener("input", () => {
    rememberSourceSelection();
    currentMarkdown = sourceEditor.value;
    renderSidePanels(currentMarkdown);
    syncMilkdownFromMarkdown(currentMarkdown);
    syncToHost();
  });
  sourceEditor.addEventListener("paste", (event) => {
    void handleSourceImagePaste(event);
  });
  sourceEditor.addEventListener("dragover", handleSourceImageDragOver);
  sourceEditor.addEventListener("drop", (event) => {
    void handleSourceImageDrop(event);
  });
  for (const eventName of ["focus", "select", "click", "keyup", "mouseup"]) {
    sourceEditor.addEventListener(eventName, rememberSourceSelection);
  }
  toolbarElement.addEventListener("mousedown", (event) => {
    if (closestElement(event.target, ".toolbar-button, .toolbar-menu-button")) {
      event.preventDefault();
    }
  });
  toolbarElement.addEventListener("click", (event) => {
    const menuToggle = closestElement(event.target, "[data-menu-toggle]");
    if (menuToggle) {
      event.preventDefault();
      toggleToolbarMenu(menuToggle.dataset.menuToggle || "");
      return;
    }
    const buttonElement = closestElement(event.target, "[data-action]");
    if (buttonElement) {
      event.preventDefault();
      closeToolbarMenus();
      void handleToolbarAction(buttonElement.dataset.action || "");
    }
  });
  previewElement.addEventListener("click", handleCodeBlockActionClick);
  visualEditor.addEventListener("click", handleCodeBlockActionClick);
  visualEditor.addEventListener("paste", (event) => {
    void handleVisualImagePaste(event);
  });
  visualEditor.addEventListener("dragover", handleVisualImageDragOver);
  visualEditor.addEventListener("drop", (event) => {
    void handleVisualImageDrop(event);
  });
  sidePanelToggleElement.addEventListener("click", toggleSidePanelFromEvent);
  sidePanelCollapseElement?.addEventListener("click", () => setSidePanelOpen(false));
  outlineCurrentElement?.addEventListener("click", revealActiveOutlineItem);
  searchElement.addEventListener("input", () => renderSidePanels(currentMarkdown));
  outlineElement.addEventListener("click", handleOutlineClick);
  bindHoverTooltips();
  bindSplitResizer();
  document.addEventListener("click", (event) => {
    if (!toolbarElement.contains(event.target as Node)) {
      closeToolbarMenus();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeToolbarMenus();
    }
  });
  window.addEventListener("message", handleHostMessage);
}

function bindHoverTooltips(): void {
  document.addEventListener("mouseover", (event) => {
    const target = getHoverTooltipTarget(event.target);
    if (!target || target.contains(event.relatedTarget as Node | null)) {
      return;
    }
    scheduleHoverTooltip(target);
  });
  document.addEventListener("mouseout", (event) => {
    const target = getHoverTooltipTarget(event.target);
    if (!target || target.contains(event.relatedTarget as Node | null)) {
      return;
    }
    hideHoverTooltip();
  });
  document.addEventListener("focusin", (event) => {
    const target = getHoverTooltipTarget(event.target);
    if (target) {
      scheduleHoverTooltip(target);
    }
  });
  document.addEventListener("focusout", hideHoverTooltip);
  document.addEventListener("click", (event) => {
    if (getHoverTooltipTarget(event.target)) {
      hideHoverTooltip();
    }
  });
  window.addEventListener("scroll", hideHoverTooltip, true);
  window.addEventListener("resize", hideHoverTooltip);
}

function getHoverTooltipTarget(target: EventTarget | null): HTMLElement | null {
  return closestElement(target, HOVER_TOOLTIP_TARGET_SELECTOR);
}

function scheduleHoverTooltip(target: HTMLElement): void {
  const title = target.getAttribute("title") || "";
  const text = target.dataset.hoverTooltip || title || target.getAttribute("aria-label") || "";
  if (!text.trim()) {
    return;
  }
  if (!target.dataset.hoverTooltip) {
    target.dataset.hoverTooltip = text;
  }
  if (title) {
    target.removeAttribute("title");
  }
  hideHoverTooltip();
  hoverTooltipTarget = target;
  hoverTooltipTimer = window.setTimeout(() => showHoverTooltip(target, text), 500);
}

function showHoverTooltip(target: HTMLElement, text: string): void {
  const tooltip = ensureHoverTooltip();
  tooltip.textContent = text;
  tooltip.style.visibility = "hidden";
  tooltip.classList.add("is-visible");
  target.setAttribute("aria-describedby", tooltip.id);

  const targetRect = target.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();
  const gap = 8;
  const viewportPadding = 8;
  const maxLeft = Math.max(viewportPadding, window.innerWidth - tooltipRect.width - viewportPadding);
  const left = Math.min(
    Math.max(viewportPadding, targetRect.left + targetRect.width / 2 - tooltipRect.width / 2),
    maxLeft
  );
  const bottomTop = targetRect.bottom + gap;
  const top = bottomTop + tooltipRect.height <= window.innerHeight - viewportPadding
    ? bottomTop
    : Math.max(viewportPadding, targetRect.top - tooltipRect.height - gap);

  tooltip.style.left = `${Math.round(left)}px`;
  tooltip.style.top = `${Math.round(top)}px`;
  tooltip.style.visibility = "";
}

function ensureHoverTooltip(): HTMLElement {
  if (hoverTooltipElement) {
    return hoverTooltipElement;
  }
  hoverTooltipElement = document.createElement("div");
  hoverTooltipElement.id = "hover-tooltip";
  hoverTooltipElement.className = "hover-tooltip";
  hoverTooltipElement.setAttribute("role", "tooltip");
  document.body.appendChild(hoverTooltipElement);
  return hoverTooltipElement;
}

function hideHoverTooltip(): void {
  window.clearTimeout(hoverTooltipTimer);
  hoverTooltipTimer = undefined;
  hoverTooltipTarget?.removeAttribute("aria-describedby");
  hoverTooltipTarget = null;
  if (hoverTooltipElement) {
    hoverTooltipElement.classList.remove("is-visible");
    hoverTooltipElement.removeAttribute("style");
  }
}

function bindSplitResizer(): void {
  if (!splitResizerElement) {
    return;
  }
  splitResizerElement.addEventListener("pointerdown", beginSplitResize);
  splitResizerElement.addEventListener("pointermove", handleSplitResizePointerMove);
  splitResizerElement.addEventListener("pointerup", endSplitResize);
  splitResizerElement.addEventListener("pointercancel", endSplitResize);
  splitResizerElement.addEventListener("lostpointercapture", endSplitResize);
  splitResizerElement.addEventListener("dblclick", () => setSplitRatio(DEFAULT_SPLIT_RATIO, true));
  splitResizerElement.addEventListener("keydown", handleSplitResizeKeydown);
  window.addEventListener("resize", () => applySplitRatio(false));
}

function beginSplitResize(event: PointerEvent): void {
  if (!isSplitResizeAvailable() || event.button !== 0 || !splitResizerElement) {
    return;
  }
  event.preventDefault();
  hideHoverTooltip();
  splitResizePointerId = event.pointerId;
  splitResizerElement.setPointerCapture(event.pointerId);
  document.body.classList.add("is-resizing-split");
  updateSplitRatioFromClientX(event.clientX);
}

function handleSplitResizePointerMove(event: PointerEvent): void {
  if (splitResizePointerId !== event.pointerId) {
    return;
  }
  event.preventDefault();
  updateSplitRatioFromClientX(event.clientX);
}

function endSplitResize(event?: PointerEvent): void {
  if (splitResizePointerId === null) {
    return;
  }
  if (event && event.pointerId !== splitResizePointerId) {
    return;
  }
  if (event && splitResizerElement?.hasPointerCapture(event.pointerId)) {
    splitResizerElement.releasePointerCapture(event.pointerId);
  }
  splitResizePointerId = null;
  document.body.classList.remove("is-resizing-split");
}

function handleSplitResizeKeydown(event: KeyboardEvent): void {
  if (!isSplitResizeAvailable()) {
    return;
  }
  if (event.key === "ArrowLeft") {
    event.preventDefault();
    setSplitRatio(splitRatio - SPLIT_KEYBOARD_STEP, true);
  } else if (event.key === "ArrowRight") {
    event.preventDefault();
    setSplitRatio(splitRatio + SPLIT_KEYBOARD_STEP, true);
  } else if (event.key === "Home") {
    event.preventDefault();
    setSplitRatio(0.2, true);
  } else if (event.key === "End") {
    event.preventDefault();
    setSplitRatio(0.8, true);
  } else if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    setSplitRatio(DEFAULT_SPLIT_RATIO, true);
  }
}

function updateSplitRatioFromClientX(clientX: number): void {
  const bounds = getSplitResizeBounds();
  if (!bounds) {
    return;
  }
  setSplitRatio((clientX - bounds.left) / bounds.width, true, bounds.width);
}

function getSplitResizeBounds(): { left: number; width: number } | null {
  if (!editorPanelElement || !previewPanelElement) {
    return null;
  }
  const editorRect = editorPanelElement.getBoundingClientRect();
  const previewRect = previewPanelElement.getBoundingClientRect();
  const left = editorRect.left;
  const right = previewRect.right;
  const width = right - left;
  return width > 0 ? { left, width } : null;
}

function setSplitRatio(nextRatio: number, persist: boolean, availableWidth?: number): void {
  const bounds = availableWidth === undefined ? getSplitResizeBounds() : { width: availableWidth };
  splitRatio = clampSplitRatio(nextRatio, bounds?.width);
  applySplitRatio(persist);
}

function applySplitRatio(persist: boolean): void {
  const editorSize = Math.round(splitRatio * 1000) / 1000;
  const previewSize = Math.round((1 - splitRatio) * 1000) / 1000;
  document.body.style.setProperty("--sm-split-editor-size", `${editorSize}fr`);
  document.body.style.setProperty("--sm-split-preview-size", `${previewSize}fr`);
  if (splitResizerElement) {
    const percentage = Math.round(splitRatio * 100);
    splitResizerElement.setAttribute("aria-valuenow", String(percentage));
    splitResizerElement.setAttribute("aria-valuetext", `${percentage}%`);
    splitResizerElement.setAttribute("aria-hidden", isSplitResizeAvailable() ? "false" : "true");
  }
  if (persist) {
    saveRuntimeState({ splitRatio });
  }
}

function clampSplitRatio(nextRatio: number, availableWidth?: number): number {
  if (!Number.isFinite(nextRatio)) {
    return splitRatio;
  }
  if (!availableWidth || availableWidth <= 0) {
    return clamp(nextRatio, 0.2, 0.8);
  }
  const minimumRatio = Math.min(0.45, SPLIT_MIN_PANE_WIDTH / availableWidth);
  return clamp(nextRatio, minimumRatio, 1 - minimumRatio);
}

function isSplitResizeAvailable(): boolean {
  return Boolean(splitResizerElement && (currentMode === "split" || currentLayout === "splitEdit") && window.innerWidth > 820);
}

function handleHostMessage(event: MessageEvent): void {
  const message = event.data || {};
  if (message.type === "setMarkdown" && typeof message.text === "string") {
    applyingHostUpdate = true;
    setMarkdown(message.text, message.preview, message.imageResources);
    applyingHostUpdate = false;
  } else if (message.type === "setEditorState") {
    if (typeof message.layout === "string") {
      currentLayout = normalizeLayout(message.layout);
    }
    if (typeof message.mode === "string") {
      currentMode = normalizeMode(message.mode);
    }
    applyLayout();
  } else if (message.type === "uploadImagesResult") {
    handleUploadImagesResult(message);
  }
}

function handleUploadImagesResult(message: { requestId?: unknown; images?: unknown; error?: unknown }): void {
  const requestId = typeof message.requestId === "string" ? message.requestId : "";
  const pending = requestId ? pendingImageUploads.get(requestId) : undefined;
  if (pending) {
    pendingImageUploads.delete(requestId);
    if (Array.isArray(message.images)) {
      pending.resolve(normalizeUploadedMarkdownImages(message.images));
    } else {
      pending.reject(message.error === undefined ? new Error("Image upload failed") : message.error);
    }
    return;
  }

  if (Array.isArray(message.images)) {
    insertMarkdown(markdownFromUploadedImages(normalizeUploadedMarkdownImages(message.images)));
  } else if (message.error !== undefined) {
    post("error", { message: getErrorMessage(message.error) });
  }
}

function normalizeUploadedMarkdownImages(images: unknown[]): UploadedMarkdownImage[] {
  return images
    .map((image) => {
      const candidate = image as Partial<UploadedMarkdownImage>;
      if (typeof candidate.markdown !== "string" || !candidate.markdown.trim()) {
        return null;
      }
      return {
        id: typeof candidate.id === "string" ? candidate.id : undefined,
        name: typeof candidate.name === "string" ? candidate.name : undefined,
        markdown: candidate.markdown
      };
    })
    .filter((image): image is UploadedMarkdownImage => Boolean(image));
}

function markdownFromUploadedImages(images: UploadedMarkdownImage[]): string {
  return images.map((image) => image.markdown).filter(Boolean).join("\n");
}

function createImageNodeFromMarkdown(markdown: string, imageNode: { createAndFill(attrs: Record<string, string>): ProseNode | null }): ProseNode | null {
  const parsed = parseUploadedImageMarkdown(markdown);
  if (!parsed) {
    return null;
  }
  return imageNode.createAndFill({ src: parsed.src, alt: parsed.alt });
}

function parseUploadedImageMarkdown(markdown: string): { alt: string; src: string } | null {
  const match = markdown.match(/^!\[((?:\\.|[^\]])*)\]\(([^)]+)\)$/);
  if (!match) {
    return null;
  }
  return {
    alt: match[1].replace(/\\([[\\\]])/g, "$1"),
    src: match[2].trim()
  };
}

async function uploadImageFiles(files: File[]): Promise<UploadedMarkdownImage[]> {
  const images = files.filter(isImageFile);
  if (!images.length) {
    return [];
  }
  const requestId = createUploadRequestId();
  const payloadImages = await Promise.all(images.map(readImageFileData));
  const result = new Promise<UploadedMarkdownImage[]>((resolve, reject) => {
    pendingImageUploads.set(requestId, { resolve, reject });
  });
  post("uploadImages", { requestId, images: payloadImages });
  return result;
}

function createUploadRequestId(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isImageFile(file: File): boolean {
  return file.type.startsWith("image/");
}

function getImageFilesFromTransfer(dataTransfer: DataTransfer | null | undefined): File[] {
  if (!dataTransfer) {
    return [];
  }
  const files: File[] = [];
  const seen = new Set<string>();
  const addFile = (file: File | null) => {
    if (!file || !isImageFile(file)) {
      return;
    }
    const key = `${file.name}:${file.size}:${file.lastModified}`;
    if (!seen.has(key)) {
      seen.add(key);
      files.push(file);
    }
  };

  Array.from(dataTransfer.files || []).forEach(addFile);
  Array.from(dataTransfer.items || []).forEach((item) => {
    if (item.kind === "file" && item.type.startsWith("image/")) {
      addFile(item.getAsFile());
    }
  });
  return files;
}

async function handleSourceImagePaste(event: ClipboardEvent): Promise<void> {
  const files = getImageFilesFromTransfer(event.clipboardData);
  if (!files.length) {
    return;
  }
  event.preventDefault();
  await uploadAndInsertSourceImages(files);
}

function handleSourceImageDragOver(event: DragEvent): void {
  const files = getImageFilesFromTransfer(event.dataTransfer);
  if (!files.length) {
    return;
  }
  event.preventDefault();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = "copy";
  }
}

async function handleSourceImageDrop(event: DragEvent): Promise<void> {
  const files = getImageFilesFromTransfer(event.dataTransfer);
  if (!files.length) {
    return;
  }
  event.preventDefault();
  sourceEditor.focus();
  await uploadAndInsertSourceImages(files);
}

async function uploadAndInsertSourceImages(files: File[]): Promise<void> {
  try {
    const uploaded = await uploadImageFiles(files);
    const markdown = markdownFromUploadedImages(uploaded);
    if (markdown) {
      insertSourceBlockSnippet(markdown);
    }
  } catch (error) {
    post("error", { message: getErrorMessage(error) });
  }
}

async function handleVisualImagePaste(event: ClipboardEvent): Promise<void> {
  if (event.defaultPrevented) {
    return;
  }
  const files = getImageFilesFromTransfer(event.clipboardData);
  if (!files.length) {
    return;
  }
  event.preventDefault();
  await uploadAndInsertVisualImages(files);
}

function handleVisualImageDragOver(event: DragEvent): void {
  const files = getImageFilesFromTransfer(event.dataTransfer);
  if (!files.length) {
    return;
  }
  event.preventDefault();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = "copy";
  }
}

async function handleVisualImageDrop(event: DragEvent): Promise<void> {
  if (event.defaultPrevented) {
    return;
  }
  const files = getImageFilesFromTransfer(event.dataTransfer);
  if (!files.length) {
    return;
  }
  event.preventDefault();
  await uploadAndInsertVisualImages(files);
}

async function uploadAndInsertVisualImages(files: File[]): Promise<void> {
  try {
    const uploaded = await uploadImageFiles(files);
    insertMarkdown(markdownFromUploadedImages(uploaded));
  } catch (error) {
    post("error", { message: getErrorMessage(error) });
  }
}

function setMarkdown(markdown: string, preview: unknown, nextImageResources?: unknown): void {
  currentMarkdown = markdown;
  previewState = normalizePreviewState(preview);
  imageResources = normalizeImageResources(nextImageResources);
  if (sourceEditor.value !== markdown) {
    sourceEditor.value = markdown;
  }
  renderPreview();
  renderSidePanels(markdown);
  syncMilkdownFromMarkdown(markdown);
  resolveVisualImagesSoon();
}

function renderPreview(): void {
  if (previewState && previewState.markdown === currentMarkdown && previewState.html) {
    previewElement.innerHTML = `<article class="markdown-body">${previewState.html}</article>`;
  } else {
    previewElement.innerHTML = `<article class="markdown-body"><pre class="static-preview-source">${escapeHtml(currentMarkdown)}</pre></article>`;
  }
  void runMermaid();
  bindEditorScrollSync();
}

function resolveVisualImagesSoon(): void {
  if (!imageResources.length) {
    return;
  }
  window.requestAnimationFrame(resolveVisualImages);
  window.setTimeout(resolveVisualImages, 50);
  window.setTimeout(resolveVisualImages, 250);
}

function resolveVisualImages(): void {
  if (!imageResources.length) {
    return;
  }
  const resources = new Map<string, string>();
  for (const resource of imageResources) {
    for (const key of imageSourceKeys(resource.source)) {
      resources.set(key, resource.resolved);
    }
  }
  visualEditor.querySelectorAll<HTMLImageElement>("img").forEach((image) => {
    const rawSource = image.getAttribute("src") || "";
    const resolved = resolveImageResource(rawSource, resources);
    if (resolved && image.src !== resolved) {
      image.dataset.superMarkdownSource = rawSource;
      image.setAttribute("src", resolved);
      image.src = resolved;
    }
  });
}

function resolveImageResource(source: string, resources: Map<string, string>): string | undefined {
  const candidates = imageSourceKeys(source);
  for (const candidate of candidates) {
    const resolved = resources.get(candidate);
    if (resolved) {
      return resolved;
    }
  }
  return undefined;
}

function imageSourceKeys(source: string): string[] {
  const normalized = stripHashAndQuery(String(source || "").trim());
  const decoded = decodeUriSafe(normalized);
  const componentDecoded = decodeUriComponentSafe(normalized);
  const encoded = encodeURI(decoded);
  const withoutDot = decoded.replace(/^\.\//, "");
  return Array.from(new Set([
    source,
    normalized,
    decoded,
    componentDecoded,
    encoded,
    `./${decoded}`,
    `./${componentDecoded}`,
    `./${encoded}`,
    withoutDot,
    componentDecoded.replace(/^\.\//, ""),
    encodeURI(withoutDot)
  ].filter(Boolean)));
}

function decodeUriSafe(value: string): string {
  try {
    return decodeURI(value);
  } catch {
    return value;
  }
}

function decodeUriComponentSafe(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function stripHashAndQuery(value: string): string {
  return value.split("#")[0].split("?")[0];
}

function startVisualImageObserver(): void {
  if (visualImageObserver) {
    return;
  }
  visualImageObserver = new MutationObserver((mutations) => {
    if (!imageResources.length) {
      return;
    }
    const changedImages = mutations.some((mutation) => {
      if (mutation.type === "attributes") {
        return mutation.target instanceof HTMLImageElement && mutation.attributeName === "src";
      }
      return Array.from(mutation.addedNodes).some((node) => {
        if (node instanceof HTMLImageElement) {
          return true;
        }
        return node instanceof Element && Boolean(node.querySelector("img"));
      });
    });
    if (changedImages) {
      resolveVisualImagesSoon();
    }
  });
  visualImageObserver.observe(visualEditor, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["src"]
  });
}

function createCodeBlockCopyButton(): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = CODE_BLOCK_CLASSES.copyButton;
  button.dataset.copyLabel = codeCopyLabels.copyLabel;
  button.dataset.copiedLabel = codeCopyLabels.copiedLabel;
  button.dataset.hoverTooltip = codeCopyLabels.copyLabel;
  button.setAttribute("aria-label", codeCopyLabels.copyLabel);
  button.textContent = codeCopyLabels.copyLabel;
  return button;
}

function createCodeBlockToneButton(tone: string | undefined): HTMLButtonElement {
  const normalizedTone = normalizeCodeBlockTone(tone);
  const button = document.createElement("button");
  button.type = "button";
  button.className = CODE_BLOCK_CLASSES.toneButton;
  button.dataset.blockTone = normalizedTone;
  button.dataset.toneLabel = codeToneLabels.toneLabel;
  button.dataset.toneAutoLabel = codeToneLabels.autoLabel;
  button.dataset.toneLightLabel = codeToneLabels.lightLabel;
  button.dataset.toneDarkLabel = codeToneLabels.darkLabel;
  button.textContent = codeBlockToneLabel(normalizedTone, codeToneLabels);
  updateToneButtonTitle(button, normalizedTone);
  return button;
}

function createCodeBlockNodeView(node: ProseNode, view: unknown, getPos: (() => number) | boolean): NodeView {
  let currentNode = node;
  let highlightVersion = 0;
  let mermaidVersion = 0;
  const dom = document.createElement("figure");
  dom.className = `${CODE_BLOCK_CLASSES.block} visual-code-node-view`;
  dom.dataset.renderBlockTone = "auto";

  const caption = document.createElement("figcaption");
  caption.contentEditable = "false";

  const languageField = document.createElement("span");
  languageField.className = "visual-code-language-field";
  languageField.contentEditable = "false";

  const language = document.createElement("button");
  language.type = "button";
  language.className = `${CODE_BLOCK_CLASSES.language} visual-code-language-button`;
  language.dataset.hoverTooltip = visualLabels.editLanguage;
  language.setAttribute("aria-label", visualLabels.editLanguage);

  const languageInput = document.createElement("input");
  languageInput.className = "visual-code-language-input";
  languageInput.hidden = true;
  languageInput.spellcheck = false;
  languageInput.setAttribute("aria-label", visualLabels.editLanguage);
  languageField.append(language, languageInput);

  const actions = document.createElement("span");
  actions.className = CODE_BLOCK_CLASSES.actionGroup;
  actions.contentEditable = "false";
  const copyButton = createCodeBlockCopyButton();
  const toneButton = createCodeBlockToneButton(dom.dataset.renderBlockTone);
  bindCodeBlockActionButton(copyButton, copyCodeFromButton);
  bindCodeBlockActionButton(toneButton, cycleCodeBlockTone);
  actions.append(copyButton, toneButton);

  const pre = document.createElement("pre");
  pre.className = "visual-code-editor";
  const code = document.createElement("code");
  code.spellcheck = false;
  pre.append(code);
  const highlightPre = document.createElement("pre");
  highlightPre.className = "visual-code-highlight";
  highlightPre.setAttribute("aria-hidden", "true");
  highlightPre.contentEditable = "false";
  const highlightCode = document.createElement("code");
  highlightPre.append(highlightCode);
  const codeFrame = document.createElement("div");
  codeFrame.className = "visual-code-frame";
  codeFrame.append(highlightPre, pre);
  const mermaidPreview = document.createElement("div");
  mermaidPreview.className = "visual-mermaid-preview";
  mermaidPreview.contentEditable = "false";
  mermaidPreview.tabIndex = 0;
  const mermaidSource = document.createElement("pre");
  mermaidSource.className = "mermaid";
  mermaidSource.contentEditable = "false";
  mermaidPreview.append(mermaidSource);
  caption.append(languageField, actions);
  dom.append(caption, mermaidPreview, codeFrame);

  const updateLanguage = (nextNode: ProseNode) => {
    const rawLanguage = getCodeBlockLanguage(nextNode);
    const isMermaid = isMermaidCodeBlock(nextNode);
    const nextLanguage = isMermaid ? "mermaid" : normalizeCodeLanguage(rawLanguage);
    const displayLanguage = rawLanguage || nextLanguage;
    language.textContent = displayLanguage;
    languageInput.value = rawLanguage || nextLanguage;
    pre.dataset.language = nextLanguage;
    dom.classList.toggle("visual-mermaid-node-view", isMermaid);
    dom.classList.toggle(CODE_BLOCK_CLASSES.diagramBlock, isMermaid);
    code.className = `language-${toLanguageClassName(nextLanguage)}`;
    highlightCode.className = `shiki shiki-themes light-plus dark-plus language-${toLanguageClassName(nextLanguage)}`;
  };

  const updateHighlight = () => {
    if (isMermaidCodeBlock(currentNode)) {
      highlightVersion += 1;
      highlightCode.textContent = "";
      dom.classList.remove("is-highlight-ready");
      return;
    }
    const version = ++highlightVersion;
    const codeText = currentNode.textContent;
    const codeLanguage = normalizeCodeLanguage(getCodeBlockLanguage(currentNode));
    void highlightCodeBlockHtml(codeText, codeLanguage).then((html) => {
      if (version !== highlightVersion) {
        return;
      }
      highlightCode.innerHTML = html || "<span class=\"line\"></span>";
      dom.classList.add("is-highlight-ready");
    });
  };

  const updateMermaidPreview = () => {
    const version = ++mermaidVersion;
    if (!isMermaidCodeBlock(currentNode)) {
      mermaidSource.textContent = "";
      return;
    }
    resetMermaidElement(mermaidSource, currentNode.textContent);
    void queueMermaidElementRender(mermaidSource).then(() => {
      if (version !== mermaidVersion) {
        resetMermaidElement(mermaidSource, currentNode.textContent);
        void queueMermaidElementRender(mermaidSource);
      }
    });
  };

  const openMermaidSource = () => {
    if (!isMermaidCodeBlock(currentNode)) {
      return;
    }
    dom.classList.add("is-editing");
  };

  const closeLanguageEditor = (commit: boolean) => {
    languageInput.hidden = true;
    language.hidden = false;
    if (commit) {
      updateNodeAttrs(view, getPos, { language: languageInput.value.trim() || "text" });
      syncCurrentMarkdownFromMilkdownSoon();
    } else {
      languageInput.value = getCodeBlockLanguage(currentNode);
    }
    language.focus();
  };

  language.addEventListener("pointerdown", stopCodeBlockActionEvent);
  language.addEventListener("mousedown", stopCodeBlockActionEvent);
  language.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    language.hidden = true;
    languageInput.hidden = false;
    languageInput.value = getCodeBlockLanguage(currentNode);
    languageInput.focus();
    languageInput.select();
  });
  languageInput.addEventListener("pointerdown", stopCodeBlockActionEvent);
  languageInput.addEventListener("mousedown", stopCodeBlockActionEvent);
  languageInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      closeLanguageEditor(true);
    } else if (event.key === "Escape") {
      event.preventDefault();
      closeLanguageEditor(false);
    }
  });
  languageInput.addEventListener("blur", () => {
    if (!languageInput.hidden) {
      closeLanguageEditor(true);
    }
  });
  mermaidPreview.addEventListener("dblclick", (event) => {
    event.preventDefault();
    event.stopPropagation();
    openMermaidSource();
  });
  mermaidPreview.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      openMermaidSource();
    }
  });
  codeFrame.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && isMermaidCodeBlock(currentNode)) {
      dom.classList.remove("is-editing");
      mermaidPreview.focus();
    }
  });
  updateLanguage(currentNode);
  updateHighlight();
  updateMermaidPreview();

  return {
    dom,
    contentDOM: code,
    update(nextNode) {
      if (nextNode.type !== currentNode.type) {
        return false;
      }
      currentNode = nextNode;
      updateLanguage(nextNode);
      updateHighlight();
      updateMermaidPreview();
      return true;
    },
    stopEvent(event) {
      return Boolean(
        closestElement(event.target, `.${CODE_BLOCK_CLASSES.actionGroup}`) ||
        languageField.contains(event.target as Node) ||
        mermaidPreview.contains(event.target as Node)
      );
    },
    ignoreMutation(mutation) {
      return mutation.target instanceof Node && (
        mutation.target === dom ||
        caption.contains(mutation.target) ||
        mermaidPreview.contains(mutation.target) ||
        highlightPre.contains(mutation.target)
      );
    }
  };
}

function isMermaidCodeBlock(node: ProseNode): boolean {
  return getCodeBlockLanguage(node).toLowerCase() === "mermaid";
}

function getCodeBlockLanguage(node: ProseNode): string {
  const rawLanguage = String(node.attrs.language || node.attrs.lang || "");
  return rawLanguage.trim().split(/\s+/)[0] || "";
}

function toLanguageClassName(language: string): string {
  return language.replace(/[^\w+-]/g, "-");
}

function bindCodeBlockActionButton(buttonElement: HTMLElement, handler: (buttonElement: HTMLElement) => void): void {
  buttonElement.addEventListener("pointerdown", stopCodeBlockActionEvent);
  buttonElement.addEventListener("mousedown", stopCodeBlockActionEvent);
  buttonElement.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    handler(buttonElement);
  });
}

function stopCodeBlockActionEvent(event: Event): void {
  event.stopPropagation();
}

type MarkdownAstNode = {
  type?: string;
  value?: string;
  tag?: string;
  label?: string;
  children?: MarkdownAstNode[];
  [key: string]: unknown;
};

const remarkMathPlugin = $remark("superMarkdownMath", () => remarkMath);

const remarkSafeInlineHtmlPlugin = $remark("superMarkdownSafeInlineHtml", () => () => (tree: MarkdownAstNode) => {
  transformSafeInlineHtmlTree(tree);
});

const mathInlineSchema = $nodeSchema("math_inline", () => ({
  group: "inline",
  inline: true,
  atom: true,
  attrs: {
    value: {
      default: "",
      validate: "string"
    }
  },
  parseDOM: [{
    tag: 'span[data-type="math_inline"]',
    getAttrs: (dom: HTMLElement) => ({ value: dom.dataset.value || dom.textContent || "" })
  }],
  toDOM: (node: ProseNode) => [
    "span",
    {
      "data-type": "math_inline",
      "data-value": node.attrs.value
    },
    node.attrs.value
  ],
  parseMarkdown: {
    match: (node: MarkdownAstNode) => node.type === "inlineMath",
    runner: (state, node: MarkdownAstNode, type) => {
      state.addNode(type, { value: String(node.value || "") });
    }
  },
  toMarkdown: {
    match: (node: ProseNode) => node.type.name === "math_inline",
    runner: (state, node: ProseNode) => {
      state.addNode("inlineMath", undefined, String(node.attrs.value || ""));
    }
  }
}));

const mathBlockSchema = $nodeSchema("math_block", () => ({
  group: "block",
  atom: true,
  attrs: {
    value: {
      default: "",
      validate: "string"
    }
  },
  parseDOM: [{
    tag: 'figure[data-type="math_block"]',
    getAttrs: (dom: HTMLElement) => ({ value: dom.dataset.value || dom.textContent || "" })
  }],
  toDOM: (node: ProseNode) => [
    "figure",
    {
      "data-type": "math_block",
      "data-value": node.attrs.value
    },
    node.attrs.value
  ],
  parseMarkdown: {
    match: (node: MarkdownAstNode) => node.type === "math",
    runner: (state, node: MarkdownAstNode, type) => {
      state.addNode(type, { value: String(node.value || "") });
    }
  },
  toMarkdown: {
    match: (node: ProseNode) => node.type.name === "math_block",
    runner: (state, node: ProseNode) => {
      state.addNode("math", undefined, String(node.attrs.value || ""));
    }
  }
}));

const safeHtmlInlineSchema = $nodeSchema("safe_html_inline", () => ({
  group: "inline",
  inline: true,
  content: "inline*",
  attrs: {
    tag: {
      default: "kbd",
      validate: "string"
    }
  },
  parseDOM: [
    "u",
    "mark",
    "kbd"
  ].map((tag) => ({
    tag,
    getAttrs: () => ({ tag })
  })),
  toDOM: (node: ProseNode) => {
    const tag = normalizeSafeHtmlTag(node.attrs.tag);
    return [tag, { "data-type": "safe_html_inline", "data-tag": tag }, 0];
  },
  parseMarkdown: {
    match: (node: MarkdownAstNode) => node.type === "safeHtmlInline",
    runner: (state, node: MarkdownAstNode, type) => {
      state.openNode(type, { tag: normalizeSafeHtmlTag(node.tag) }).next(node.children).closeNode();
    }
  },
  toMarkdown: {
    match: (node: ProseNode) => node.type.name === "safe_html_inline",
    runner: (state, node: ProseNode) => {
      const tag = normalizeSafeHtmlTag(node.attrs.tag);
      state.addNode("html", undefined, `<${tag}>`);
      state.next(node.content);
      state.addNode("html", undefined, `</${tag}>`);
    }
  }
}));

function transformSafeInlineHtmlTree(node: MarkdownAstNode): void {
  if (!Array.isArray(node.children)) {
    return;
  }
  node.children = transformSafeInlineHtmlChildren(node.children);
  node.children.forEach(transformSafeInlineHtmlTree);
}

function transformSafeInlineHtmlChildren(children: MarkdownAstNode[]): MarkdownAstNode[] {
  const next: MarkdownAstNode[] = [];
  for (let index = 0; index < children.length; index += 1) {
    const child = children[index];
    const tag = getOpeningSafeHtmlTag(child);
    if (!tag) {
      next.push(child);
      continue;
    }
    const closeIndex = findClosingSafeHtmlTag(children, index + 1, tag);
    if (closeIndex < 0) {
      next.push(child);
      continue;
    }
    next.push({
      type: "safeHtmlInline",
      tag,
      children: children.slice(index + 1, closeIndex)
    });
    index = closeIndex;
  }
  return next;
}

function getOpeningSafeHtmlTag(node: MarkdownAstNode): SafeInlineHtmlTag | null {
  if (node.type !== "html" || typeof node.value !== "string") {
    return null;
  }
  const match = node.value.trim().match(/^<([a-z][a-z0-9-]*)>$/i);
  if (!match) {
    return null;
  }
  const tag = match[1].toLowerCase();
  return isSafeInlineHtmlTag(tag) ? tag : null;
}

function findClosingSafeHtmlTag(children: MarkdownAstNode[], startIndex: number, tag: SafeInlineHtmlTag): number {
  let depth = 0;
  const openPattern = new RegExp(`^<${tag}>$`, "i");
  const closePattern = new RegExp(`^</${tag}>$`, "i");
  for (let index = startIndex; index < children.length; index += 1) {
    const child = children[index];
    if (child.type !== "html" || typeof child.value !== "string") {
      continue;
    }
    const value = child.value.trim();
    if (openPattern.test(value)) {
      depth += 1;
    } else if (closePattern.test(value)) {
      if (depth === 0) {
        return index;
      }
      depth -= 1;
    }
  }
  return -1;
}

function normalizeSafeHtmlTag(value: unknown): SafeInlineHtmlTag {
  const tag = String(value || "").toLowerCase();
  return isSafeInlineHtmlTag(tag) ? tag : "kbd";
}

function createMathInlineNodeView(node: ProseNode, view: unknown, getPos: (() => number) | boolean): NodeView {
  let currentNode = node;
  const dom = document.createElement("span");
  dom.className = "visual-math-inline-node";
  dom.contentEditable = "false";
  dom.tabIndex = 0;
  const preview = document.createElement("span");
  preview.className = "visual-math-inline-preview";
  const input = document.createElement("input");
  input.className = "visual-math-inline-input";
  input.hidden = true;
  input.spellcheck = false;
  input.setAttribute("aria-label", visualLabels.mathEdit);
  dom.append(preview, input);

  const setEditing = (editing: boolean) => {
    dom.classList.toggle("is-editing", editing);
    preview.hidden = editing;
    input.hidden = !editing;
    if (editing) {
      input.value = getNodeTextAttribute(currentNode, "value");
      window.setTimeout(() => {
        input.focus();
        input.select();
      }, 0);
    }
  };

  const commitInlineMath = () => {
    const value = input.value;
    setEditing(false);
    updateNodeAttrs(view, getPos, { value });
    syncCurrentMarkdownFromMilkdownSoon();
    dom.focus();
  };

  dom.addEventListener("dblclick", (event) => {
    event.preventDefault();
    event.stopPropagation();
    setEditing(true);
  });
  dom.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      setEditing(true);
    }
  });
  const handleInlineMathKey = (event: KeyboardEvent) => {
    if (input.hidden) {
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      commitInlineMath();
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setEditing(false);
      dom.focus();
    }
  };
  input.addEventListener("keydown", handleInlineMathKey);
  input.addEventListener("keyup", handleInlineMathKey);
  input.addEventListener("blur", () => {
    if (!input.hidden) {
      commitInlineMath();
    }
  });

  const update = (nextNode: ProseNode) => {
    currentNode = nextNode;
    const value = getNodeTextAttribute(nextNode, "value");
    dom.dataset.value = value;
    dom.dataset.hoverTooltip = value;
    preview.innerHTML = renderKatexHtml(value, false, mathRenderOptions);
    if (!dom.classList.contains("is-editing")) {
      input.value = value;
    }
  };
  update(currentNode);

  return {
    dom,
    update(nextNode) {
      if (nextNode.type !== currentNode.type) {
        return false;
      }
      update(nextNode);
      return true;
    },
    stopEvent() {
      return true;
    },
    ignoreMutation() {
      return true;
    }
  };
}

function createMathBlockNodeView(node: ProseNode, view: unknown, getPos: (() => number) | boolean): NodeView {
  let currentNode = node;
  let updateTimer: number | undefined;
  const dom = document.createElement("figure");
  dom.className = "visual-math-node-view";
  dom.contentEditable = "false";
  dom.tabIndex = 0;

  const preview = document.createElement("div");
  preview.className = "visual-math-preview";

  const controls = document.createElement("div");
  controls.className = "visual-math-controls";
  controls.contentEditable = "false";
  const editButton = document.createElement("button");
  editButton.type = "button";
  editButton.className = "visual-math-edit";
  editButton.textContent = visualLabels.mathEdit;
  editButton.setAttribute("aria-label", visualLabels.mathEdit);
  const doneButton = document.createElement("button");
  doneButton.type = "button";
  doneButton.className = "visual-math-done";
  doneButton.textContent = visualLabels.mathDone;
  doneButton.setAttribute("aria-label", visualLabels.mathDone);
  controls.append(editButton, doneButton);

  const source = document.createElement("textarea");
  source.className = "visual-math-source";
  source.spellcheck = false;
  source.rows = 3;
  source.addEventListener("input", () => {
    window.clearTimeout(updateTimer);
    updateTimer = window.setTimeout(() => {
      updateNodeAttrs(view, getPos, { value: source.value });
    }, 160);
    preview.innerHTML = renderKatexHtml(source.value, true, mathRenderOptions);
  });

  const setEditing = (editing: boolean) => {
    dom.classList.toggle("is-editing", editing);
    source.hidden = !editing;
    editButton.hidden = editing;
    doneButton.hidden = !editing;
    if (editing) {
      window.setTimeout(() => source.focus(), 0);
    }
  };

  const showEditor = (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
    setEditing(true);
  };

  const hideEditor = (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
    setEditing(false);
    dom.focus();
  };

  preview.addEventListener("dblclick", showEditor);
  dom.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !dom.classList.contains("is-editing")) {
      event.preventDefault();
      setEditing(true);
    } else if (event.key === "Escape" && dom.classList.contains("is-editing")) {
      event.preventDefault();
      setEditing(false);
      dom.focus();
    }
  });
  source.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      setEditing(false);
      dom.focus();
    }
  });
  editButton.addEventListener("pointerdown", stopCodeBlockActionEvent);
  editButton.addEventListener("mousedown", stopCodeBlockActionEvent);
  editButton.addEventListener("click", showEditor);
  doneButton.addEventListener("pointerdown", stopCodeBlockActionEvent);
  doneButton.addEventListener("mousedown", stopCodeBlockActionEvent);
  doneButton.addEventListener("click", hideEditor);

  dom.append(controls, preview, source);
  setEditing(false);

  const update = (nextNode: ProseNode) => {
    currentNode = nextNode;
    const value = getNodeTextAttribute(nextNode, "value");
    dom.dataset.value = value;
    if (source.value !== value) {
      source.value = value;
    }
    preview.innerHTML = renderKatexHtml(value, true, mathRenderOptions);
  };
  update(currentNode);

  return {
    dom,
    update(nextNode) {
      if (nextNode.type !== currentNode.type) {
        return false;
      }
      update(nextNode);
      return true;
    },
    stopEvent(event) {
      return source.contains(event.target as Node) || controls.contains(event.target as Node);
    },
    ignoreMutation() {
      return true;
    },
    destroy() {
      window.clearTimeout(updateTimer);
    }
  };
}

function createFootnoteReferenceNodeView(node: ProseNode): NodeView {
  let currentNode = node;
  const dom = document.createElement("sup");
  dom.className = "visual-footnote-reference";
  dom.contentEditable = "false";

  const update = (nextNode: ProseNode) => {
    currentNode = nextNode;
    const model = resolveFootnoteReference(getNodeTextAttribute(nextNode, "label"));
    dom.id = model.referenceId;
    dom.dataset.label = model.label;
    dom.textContent = model.label;
    dom.dataset.hoverTooltip = `${visualLabels.footnote} ${model.label}`;
  };
  update(currentNode);

  return {
    dom,
    update(nextNode) {
      if (nextNode.type !== currentNode.type) {
        return false;
      }
      update(nextNode);
      return true;
    },
    stopEvent() {
      return true;
    },
    ignoreMutation() {
      return true;
    }
  };
}

function createFootnoteDefinitionNodeView(node: ProseNode): NodeView {
  let currentNode = node;
  const dom = document.createElement("dl");
  dom.className = "visual-footnote-definition";
  const label = document.createElement("dt");
  label.contentEditable = "false";
  const content = document.createElement("dd");
  dom.append(label, content);

  const update = (nextNode: ProseNode) => {
    currentNode = nextNode;
    const model = resolveFootnoteReference(getNodeTextAttribute(nextNode, "label"));
    dom.id = model.definitionId;
    dom.dataset.label = model.label;
    label.textContent = model.label;
  };
  update(currentNode);

  return {
    dom,
    contentDOM: content,
    update(nextNode) {
      if (nextNode.type !== currentNode.type) {
        return false;
      }
      update(nextNode);
      return true;
    },
    ignoreMutation(mutation) {
      return mutation.target instanceof Node && label.contains(mutation.target);
    }
  };
}

function createHtmlNodeView(node: ProseNode): NodeView {
  let currentNode = node;
  const dom = document.createElement("span");
  dom.className = "visual-html-source";
  dom.contentEditable = "false";
  const label = document.createElement("span");
  label.className = "visual-html-label";
  label.textContent = visualLabels.rawHtmlEscaped;
  const source = document.createElement("span");
  source.className = "visual-html-code";
  dom.append(label, source);

  const update = (nextNode: ProseNode) => {
    currentNode = nextNode;
    const value = getNodeTextAttribute(nextNode, "value");
    dom.dataset.value = value;
    dom.dataset.hoverTooltip = `${visualLabels.rawHtmlEscaped}: ${value}`;
    source.innerHTML = renderInertInlineHtml(value);
  };
  update(currentNode);

  return {
    dom,
    update(nextNode) {
      if (nextNode.type !== currentNode.type) {
        return false;
      }
      update(nextNode);
      return true;
    },
    stopEvent() {
      return true;
    },
    ignoreMutation() {
      return true;
    }
  };
}

function createSafeHtmlInlineNodeView(node: ProseNode): NodeView {
  let currentNode = node;
  let tag = normalizeSafeHtmlTag(node.attrs.tag);
  let dom = document.createElement(tag);
  dom.className = `visual-safe-html-inline visual-safe-html-${tag}`;
  dom.dataset.tag = tag;

  return {
    dom,
    contentDOM: dom,
    update(nextNode) {
      const nextTag = normalizeSafeHtmlTag(nextNode.attrs.tag);
      if (nextNode.type !== currentNode.type || nextTag !== tag) {
        return false;
      }
      currentNode = nextNode;
      tag = nextTag;
      dom.dataset.tag = tag;
      return true;
    }
  };
}

function createBlockquoteNodeView(node: ProseNode): NodeView {
  let currentNode = node;
  const dom = document.createElement("blockquote");
  dom.className = "visual-blockquote-node-view";
  const title = document.createElement("p");
  title.className = "visual-admonition-title";
  title.contentEditable = "false";
  title.hidden = true;
  const renderedBody = document.createElement("div");
  renderedBody.className = "visual-admonition-body";
  renderedBody.contentEditable = "false";
  renderedBody.hidden = true;
  const content = document.createElement("div");
  content.className = "visual-blockquote-content";
  dom.append(title, renderedBody, content);

  const renderAdmonitionBody = (body: string) => {
    renderedBody.replaceChildren();
    const paragraph = document.createElement("p");
    paragraph.textContent = body || "";
    renderedBody.append(paragraph);
  };

  const update = (nextNode: ProseNode) => {
    currentNode = nextNode;
    const admonition = detectBlockquoteAdmonition(nextNode.textContent || "");
    dom.className = "visual-blockquote-node-view";
    title.hidden = true;
    title.textContent = "";
    renderedBody.hidden = true;
    renderedBody.replaceChildren();
    content.classList.remove("visual-admonition-source");
    delete dom.dataset.admonition;
    if (admonition) {
      dom.classList.add("admonition", `admonition-${admonition.type}`);
      dom.dataset.admonition = admonition.type;
      title.hidden = false;
      title.textContent = admonition.label;
      renderedBody.hidden = false;
      renderAdmonitionBody(admonition.body);
      content.classList.add("visual-admonition-source");
    }
  };
  update(currentNode);

  return {
    dom,
    contentDOM: content,
    update(nextNode) {
      if (nextNode.type !== currentNode.type) {
        return false;
      }
      update(nextNode);
      return true;
    }
  };
}

function getNodeTextAttribute(node: ProseNode, name: string): string {
  return String(node.attrs[name] || "");
}

function updateNodeAttrs(view: unknown, getPos: (() => number) | boolean, attrs: Record<string, unknown>): void {
  if (typeof getPos !== "function") {
    return;
  }
  const candidate = view as {
    state?: {
      doc?: {
        nodeAt(pos: number): ProseNode | null;
      };
      tr?: {
        setNodeMarkup(pos: number, type: unknown, attrs: Record<string, unknown>): unknown;
      };
    };
    dispatch?: (transaction: unknown) => void;
  };
  let pos = 0;
  try {
    pos = getPos();
  } catch {
    return;
  }
  const node = candidate.state?.doc?.nodeAt(pos);
  const transaction = node && candidate.state?.tr?.setNodeMarkup(pos, undefined, { ...node.attrs, ...attrs });
  if (transaction) {
    candidate.dispatch?.(transaction);
  }
}

function registerVisualNodeViews(
  views: Array<[string, (node: ProseNode, view: unknown, getPos: (() => number) | boolean) => NodeView]>
): Array<[string, (node: ProseNode, view: unknown, getPos: (() => number) | boolean) => NodeView]> {
  const visualNodeViews: Array<[string, (node: ProseNode, view: unknown, getPos: (() => number) | boolean) => NodeView]> = [
    ["code_block", createCodeBlockNodeView],
    ["math_inline", createMathInlineNodeView],
    ["math_block", createMathBlockNodeView],
    ["footnote_reference", createFootnoteReferenceNodeView],
    ["footnote_definition", createFootnoteDefinitionNodeView],
    ["html", createHtmlNodeView],
    ["safe_html_inline", createSafeHtmlInlineNodeView],
    ["blockquote", createBlockquoteNodeView]
  ];
  const ids = new Set(visualNodeViews.map(([id]) => id));
  return [
    ...views.filter(([nodeId]) => !ids.has(nodeId)),
    ...visualNodeViews
  ];
}

setScriptState("runtime-loading", "bundle-started");
void boot();

async function runMermaid(): Promise<void> {
  const nodes = Array.from(previewElement.querySelectorAll<HTMLElement>(".mermaid"));
  if (!nodes.length) {
    return;
  }
  for (const node of nodes) {
    resetMermaidElement(node, node.textContent || "");
    await queueMermaidElementRender(node);
  }
}

function queueMermaidElementRender(node: HTMLElement): Promise<void> {
  const render = mermaidRenderQueue.catch(() => undefined).then(async () => {
    let mermaid: MermaidRuntime;
    try {
      mermaid = await loadMermaid();
      mermaid.initialize({ startOnLoad: false, securityLevel: "strict" });
    } catch (error) {
      markMermaidRenderError(node, error);
      return;
    }
    await renderMermaidNode(mermaid, node);
  });
  mermaidRenderQueue = render;
  return render;
}

async function renderMermaidNode(mermaid: MermaidRuntime, node: HTMLElement): Promise<void> {
  if (node.dataset.superMarkdownMermaidError) {
    return;
  }
  const source = node.dataset.superMarkdownMermaidSource || node.textContent || "";
  node.dataset.superMarkdownMermaidSource = source;
  try {
    await mermaid.run({ nodes: [node] as unknown as NodeListOf<HTMLElement> });
  } catch (error) {
    markMermaidRenderError(node, error, source);
  }
}

function markMermaidRenderError(node: HTMLElement, error: unknown, source = node.dataset.superMarkdownMermaidSource || node.textContent || ""): void {
  const message = getErrorMessage(error);
  node.dataset.superMarkdownMermaidError = message;
  node.dataset.hoverTooltip = message;
  node.classList.add("mermaid-render-error");
  node.textContent = source ? `${message}\n\n${source}` : message;
}

function resetMermaidElement(node: HTMLElement, source: string): void {
  node.classList.remove("mermaid-render-error");
  node.removeAttribute("data-processed");
  delete node.dataset.superMarkdownMermaidError;
  delete node.dataset.superMarkdownMermaidSource;
  delete node.dataset.hoverTooltip;
  node.textContent = source;
}

async function loadMermaid(): Promise<MermaidRuntime> {
  if (window.mermaid) {
    return window.mermaid;
  }
  if (mermaidRuntimePromise) {
    return mermaidRuntimePromise;
  }
  const src = payload.mermaidScript;
  if (!src) {
    throw new Error("Missing Mermaid runtime URI");
  }
  mermaidRuntimePromise = new Promise<MermaidRuntime>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.superMarkdownMermaid = "true";
    script.addEventListener("load", () => {
      if (window.mermaid) {
        resolve(window.mermaid);
      } else {
        reject(new Error("Mermaid runtime did not initialize"));
      }
    }, { once: true });
    script.addEventListener("error", () => {
      reject(new Error("Failed to load Mermaid runtime"));
    }, { once: true });
    document.head.append(script);
  }).catch((error) => {
    mermaidRuntimePromise = null;
    throw error;
  });
  return mermaidRuntimePromise;
}

function applyLayout(): void {
  document.body.classList.remove("layout-workbench", "layout-editorOnly", "layout-splitEdit", "layout-previewOnly");
  document.body.classList.add(`layout-${currentLayout}`);
  if (currentLayout === "previewOnly") {
    setMode("preview", false);
  } else if (currentLayout === "splitEdit") {
    setMode("split", false);
  } else if (currentMode === "preview" || currentMode === "split") {
    setMode("source", false);
  } else {
    applyMode();
  }
}

function setMode(mode: string, notify: boolean): void {
  currentMode = normalizeMode(mode);
  if (currentMode === "split") {
    currentLayout = "splitEdit";
  }
  if (currentMode === "preview") {
    currentLayout = "previewOnly";
  }
  applyMode();
  if (notify) {
    post("setMode", { mode: currentMode });
  }
}

function applyMode(): void {
  document.body.classList.remove("mode-source", "mode-wysiwyg", "mode-preview", "mode-split");
  document.body.classList.add(`mode-${currentMode}`);
  applySplitRatio(false);
  if (currentMode === "wysiwyg") {
    void ensureMilkdown().catch(() => undefined);
  }
  bindEditorScrollSync();
}

async function ensureMilkdown(): Promise<void> {
  if (milkdownReady) {
    return;
  }
  if (milkdownReadyPromise) {
    return milkdownReadyPromise;
  }
  visualEditor.innerHTML = "";
  milkdownReadyPromise = (async () => {
    milkdownEditor = Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, visualEditor);
        ctx.set(defaultValueCtx, currentMarkdown);
        ctx.get(listenerCtx).markdownUpdated((_ctx, markdown) => {
          if (applyingMilkdownUpdate) {
            return;
          }
          currentMarkdown = markdown;
          sourceEditor.value = markdown;
          renderSidePanels(markdown);
          syncToHost();
        });
        ctx.update(nodeViewCtx, registerVisualNodeViews);
        ctx.update(uploadConfig.key, (config) => ({
          ...config,
          enableHtmlFileUploader: false,
          uploader: async (files, schema) => {
            let uploaded: UploadedMarkdownImage[];
            try {
              uploaded = await uploadImageFiles(Array.from(files || []));
            } catch (error) {
              post("error", { message: getErrorMessage(error) });
              throw error;
            }
            const imageNode = schema.nodes.image;
            if (!imageNode) {
              throw new Error("Missing image node schema");
            }
            return uploaded
              .map((image) => createImageNodeFromMarkdown(image.markdown, imageNode))
              .filter((node): node is ProseNode => Boolean(node));
          }
        }));
      })
      .use(commonmark)
      .use(gfm)
      .use(remarkMathPlugin)
      .use(remarkSafeInlineHtmlPlugin)
      .use(mathInlineSchema)
      .use(mathBlockSchema)
      .use(safeHtmlInlineSchema)
      .use(listener)
      .use(clipboard)
      .use(upload)
      .use(history)
      .use(trailing);
    await milkdownEditor.create();
    milkdownReady = true;
    startVisualImageObserver();
    resolveVisualImagesSoon();
  })().catch((error) => {
    milkdownEditor = null;
    milkdownReady = false;
    milkdownReadyPromise = null;
    setScriptError(error);
    post("error", { message: getErrorMessage(error) });
    throw error;
  });
  return milkdownReadyPromise;
}

function syncMilkdownFromMarkdown(markdown: string): void {
  if (!milkdownEditor || !milkdownReady) {
    return;
  }
  applyingMilkdownUpdate = true;
  try {
    milkdownEditor.action(replaceAll(markdown, true));
  } finally {
    window.setTimeout(() => {
      applyingMilkdownUpdate = false;
      resolveVisualImagesSoon();
    }, 0);
  }
}

async function handleToolbarAction(action: string): Promise<void> {
  if (action === "organizeMarkdown") {
    post("runHostCommand", { command: "organizeMarkdown" });
    return;
  }
  if (action === "help") {
    post("openLink", { href: SUPER_MARKDOWN_ISSUES_URL });
    return;
  }
  if (action === "toc") {
    post("toolbarCommand", { action });
    return;
  }
  if (action === "switchBackgroundTheme") {
    post("toolbarCommand", { action });
    return;
  }
  if (action === "switchDisplayLanguage") {
    post("toolbarCommand", { action });
    return;
  }
  if (action.startsWith("export-")) {
    post("export", { format: action.replace("export-", "") });
    return;
  }
  if (action === "image") {
    await chooseImagesForInsert();
    return;
  }
  if (currentMode !== "wysiwyg") {
    applySourceToolbarAction(action);
    return;
  }
  await ensureMilkdown();
  applyMilkdownToolbarAction(action);
}

function applyMilkdownToolbarAction(action: string): void {
  if (!milkdownEditor) {
    return;
  }
  const heading = action.match(/^heading-([1-6])$/);
  if (heading) {
    milkdownEditor.action(callCommand(wrapInHeadingCommand.key, Number(heading[1])));
    return;
  }
  const commands: Record<string, () => void> = {
    bold: () => milkdownEditor?.action(callCommand(toggleStrongCommand.key)),
    italic: () => milkdownEditor?.action(callCommand(toggleEmphasisCommand.key)),
    strike: () => milkdownEditor?.action(callCommand(toggleStrikethroughCommand.key)),
    "inline-code": () => milkdownEditor?.action(callCommand(toggleInlineCodeCommand.key)),
    link: () => milkdownEditor?.action(callCommand(toggleLinkCommand.key, { href: "https://example.com" })),
    hr: () => milkdownEditor?.action(callCommand(insertHrCommand.key)),
    quote: () => milkdownEditor?.action(callCommand(wrapInBlockquoteCommand.key)),
    list: () => milkdownEditor?.action(callCommand(wrapInBulletListCommand.key)),
    "ordered-list": () => milkdownEditor?.action(callCommand(wrapInOrderedListCommand.key)),
    code: () => milkdownEditor?.action(callCommand(createCodeBlockCommand.key)),
    table: () => milkdownEditor?.action(callCommand(insertTableCommand.key, { row: 3, col: 3 }))
  };
  if (commands[action]) {
    commands[action]();
    return;
  }
  if (action === "underline") {
    surroundMilkdownSelection("<u>", "</u>", "text");
  } else if (action === "highlight") {
    surroundMilkdownSelection("==", "==", "text");
  } else if (action === "task") {
    insertMarkdown("* [ ] Task");
  } else if (action === "task-checked") {
    insertMarkdown("* [x] Task");
  } else if (action === "math") {
    insertMarkdown("$$\nx = y\n$$");
  } else if (action === "mermaid") {
    insertMarkdown("```mermaid\ngraph TD\n  A --> B\n```");
  }
}

function surroundMilkdownSelection(prefix: string, suffix: string, fallback: string): void {
  if (!milkdownEditor) {
    return;
  }
  const domSelection = window.getSelection()?.toString().trim() || "";
  if (domSelection && replaceMarkdownTextSelection(domSelection, prefix, suffix)) {
    return;
  }
  try {
    milkdownEditor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const { from, to, empty } = view.state.selection;
      const selected = empty ? fallback : milkdownEditor!.action(getMarkdown({ from, to })).trim() || fallback;
      milkdownEditor!.action(replaceRange(`${prefix}${selected}${suffix}`, { from, to }));
      syncCurrentMarkdownFromMilkdownSoon();
    });
  } catch {
    insertMarkdown(`${prefix}${fallback}${suffix}`);
  }
}

function insertMarkdown(markdown: string): void {
  if (!markdown) {
    return;
  }
  if (currentMode === "wysiwyg" && milkdownEditor) {
    insertMarkdownSnippetFromVisualSelection(markdown);
  } else {
    insertSourceSnippet(markdown);
  }
}

function replaceMarkdownTextSelection(selected: string, prefix: string, suffix: string): boolean {
  const index = currentMarkdown.indexOf(selected);
  if (index < 0) {
    return false;
  }
  currentMarkdown = `${currentMarkdown.slice(0, index)}${prefix}${selected}${suffix}${currentMarkdown.slice(index + selected.length)}`;
  sourceEditor.value = currentMarkdown;
  syncMilkdownFromMarkdown(currentMarkdown);
  renderSidePanels(currentMarkdown);
  syncToHost();
  return true;
}

function insertMarkdownSnippetFromVisualSelection(snippet: string): void {
  const selected = window.getSelection()?.toString().trim() || "";
  const selectedIndex = selected ? currentMarkdown.indexOf(selected) : -1;
  if (selectedIndex >= 0) {
    currentMarkdown = `${currentMarkdown.slice(0, selectedIndex)}${snippet}${currentMarkdown.slice(selectedIndex + selected.length)}`;
  } else {
    const trimmed = currentMarkdown.replace(/\s+$/u, "");
    const prefix = trimmed ? "\n\n" : "";
    currentMarkdown = `${trimmed}${prefix}${snippet}`;
  }
  sourceEditor.value = currentMarkdown;
  syncMilkdownFromMarkdown(currentMarkdown);
  renderSidePanels(currentMarkdown);
  syncToHost();
}

function syncCurrentMarkdownFromMilkdownSoon(): void {
  window.setTimeout(() => {
    if (!milkdownEditor || applyingMilkdownUpdate) {
      return;
    }
    try {
      const markdown = milkdownEditor.action(getMarkdown());
      currentMarkdown = markdown;
      sourceEditor.value = markdown;
      renderSidePanels(markdown);
      syncToHost();
    } catch {
      // The listener path is still the primary sync mechanism.
    }
  }, 0);
}

function applySourceToolbarAction(action: string): void {
  const heading = action.match(/^heading-([1-6])$/);
  if (heading) {
    replaceSourceSelection(`${"#".repeat(Number(heading[1]))} `, "", "Heading");
    return;
  }
  const wrappers: Record<string, [string, string, string]> = {
    bold: ["**", "**", "text"],
    italic: ["*", "*", "text"],
    underline: ["<u>", "</u>", "text"],
    strike: ["~~", "~~", "text"],
    highlight: ["==", "==", "text"],
    "inline-code": ["`", "`", "code"],
    link: ["[", "](https://example.com)", "link text"]
  };
  if (wrappers[action]) {
    replaceSourceSelection(...wrappers[action]);
    return;
  }
  const snippets: Record<string, string> = {
    hr: "---",
    quote: "> Quote",
    list: "- List item",
    "ordered-list": "1. List item",
    task: "- [ ] Task",
    "task-checked": "- [x] Task",
    code: "```text\ncode\n```",
    table: "| Column | Value |\n| --- | --- |\n| Item | Value |",
    math: "$$\nx = y\n$$",
    mermaid: "```mermaid\ngraph TD\n  A --> B\n```"
  };
  if (snippets[action]) {
    insertSourceSnippet(snippets[action]);
  }
}

function replaceSourceSelection(prefix: string, suffix: string, fallback: string): void {
  const selection = getSourceSelection();
  const selected = sourceEditor.value.slice(selection.start, selection.end) || fallback;
  const insertion = `${prefix}${selected}${suffix}`;
  sourceEditor.setRangeText(insertion, selection.start, selection.end, "end");
  currentMarkdown = sourceEditor.value;
  rememberSourceSelection();
  syncMilkdownFromMarkdown(currentMarkdown);
  syncToHost();
}

function insertSourceSnippet(snippet: string): void {
  const selection = getSourceSelection();
  const selected = sourceEditor.value.slice(selection.start, selection.end);
  const insertion = selected ? snippet.replace(/text|code|Task|Quote|List item/, selected) : snippet;
  const prefix = needsBlockPadding(selection.start) ? "\n\n" : "";
  sourceEditor.setRangeText(`${prefix}${insertion}`, selection.start, selection.end, "end");
  currentMarkdown = sourceEditor.value;
  rememberSourceSelection();
  syncMilkdownFromMarkdown(currentMarkdown);
  syncToHost();
}

function insertSourceBlockSnippet(snippet: string): void {
  if (!snippet) {
    return;
  }
  const selection = getSourceSelection();
  const prefix = getBlockInsertionPrefix(selection.start);
  const suffix = selection.end < sourceEditor.value.length && !sourceEditor.value.slice(selection.end).startsWith("\n")
    ? "\n\n"
    : "";
  sourceEditor.setRangeText(`${prefix}${snippet}${suffix}`, selection.start, selection.end, "end");
  currentMarkdown = sourceEditor.value;
  rememberSourceSelection();
  syncMilkdownFromMarkdown(currentMarkdown);
  syncToHost();
}

function getBlockInsertionPrefix(position: number): string {
  const before = sourceEditor.value.slice(0, position);
  if (!before || before.endsWith("\n\n")) {
    return "";
  }
  return before.endsWith("\n") ? "\n" : "\n\n";
}

function needsBlockPadding(position: number): boolean {
  return position > 0 && !sourceEditor.value.slice(0, position).endsWith("\n\n");
}

function rememberSourceSelection(): void {
  activeSourceSelection = {
    start: sourceEditor.selectionStart || 0,
    end: sourceEditor.selectionEnd || sourceEditor.selectionStart || 0
  };
}

function getSourceSelection(): { start: number; end: number } {
  if (document.activeElement === sourceEditor) {
    rememberSourceSelection();
  }
  const max = sourceEditor.value.length;
  return {
    start: Math.max(0, Math.min(activeSourceSelection.start, max)),
    end: Math.max(0, Math.min(activeSourceSelection.end, max))
  };
}

async function chooseImagesForInsert(): Promise<void> {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.multiple = true;
  input.style.position = "fixed";
  input.style.left = "-9999px";
  input.style.top = "0";
  input.onchange = async () => {
    try {
      const files = Array.from(input.files || []);
      if (!files.length) {
        return;
      }
      const uploaded = await uploadImageFiles(files);
      const markdown = markdownFromUploadedImages(uploaded);
      if (currentMode === "wysiwyg" && milkdownEditor) {
        insertMarkdown(markdown);
      } else {
        insertSourceBlockSnippet(markdown);
      }
    } catch (error) {
      post("error", { message: getErrorMessage(error) });
    } finally {
      input.remove();
    }
  };
  document.body.append(input);
  input.click();
}

function readImageFileData(file: File): Promise<{ id: string; name: string; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error("Failed to read image"));
    reader.onload = () => resolve({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: file.name,
      dataUrl: String(reader.result || "")
    });
    reader.readAsDataURL(file);
  });
}

function toggleToolbarMenu(name: string): void {
  const wrapper = toolbarElement.querySelector(`[data-menu-toggle="${name}"]`)?.closest(".toolbar-menu-wrapper") as HTMLElement | null;
  if (!wrapper) {
    return;
  }
  const open = !wrapper.classList.contains("is-open");
  closeToolbarMenus();
  wrapper.classList.toggle("is-open", open);
  const menu = wrapper.querySelector(".toolbar-menu") as HTMLElement | null;
  const toggle = wrapper.querySelector(".toolbar-menu-toggle") as HTMLElement | null;
  if (menu) {
    menu.hidden = !open;
  }
  toggle?.setAttribute("aria-expanded", String(open));
  if (open) {
    positionToolbarMenu(wrapper);
  }
}

function positionToolbarMenu(wrapper: HTMLElement): void {
  const toggle = wrapper.querySelector(".toolbar-menu-toggle");
  const menu = wrapper.querySelector(".toolbar-menu") as HTMLElement | null;
  if (!toggle || !menu) {
    return;
  }
  const rect = toggle.getBoundingClientRect();
  const menuWidth = menu.offsetWidth || 170;
  const alignedLeft = wrapper.classList.contains("toolbar-more-menu") ? rect.right - menuWidth : rect.left;
  const left = Math.min(Math.max(8, alignedLeft), Math.max(8, window.innerWidth - menuWidth - 8));
  menu.style.top = `${Math.round(rect.bottom + 6)}px`;
  menu.style.left = `${Math.round(left)}px`;
}

function closeToolbarMenus(): void {
  toolbarElement.querySelectorAll(".toolbar-menu-wrapper.is-open").forEach((wrapper) => {
    const menu = wrapper.querySelector(".toolbar-menu") as HTMLElement | null;
    wrapper.classList.remove("is-open");
    if (menu) {
      menu.hidden = true;
      menu.removeAttribute("style");
    }
    wrapper.querySelector(".toolbar-menu-toggle")?.setAttribute("aria-expanded", "false");
  });
}

function renderSidePanels(markdown: string): void {
  const headings = previewState && previewState.markdown === markdown ? previewState.headings : extractHeadings(markdown);
  currentOutlineHeadings = headings;
  renderOutline(headings);
}

function extractHeadings(markdown: string): PreviewState["headings"] {
  const headings: PreviewState["headings"] = [];
  let inFence = false;
  markdown.split(/\r?\n/).forEach((line, index) => {
    if (/^```/.test(line.trim())) {
      inFence = !inFence;
      return;
    }
    if (inFence) {
      return;
    }
    const match = line.match(/^(#{1,6})\s+(.+?)\s*#*$/);
    if (!match) {
      return;
    }
    const text = match[2].replace(/[`*_~[\]()]/g, "").trim();
    headings.push({ level: match[1].length, text, slug: baseSlug(text), line: index });
  });
  return headings;
}

function baseSlug(text: string): string {
  return text.toLowerCase().trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-") || "heading";
}

function renderOutline(headings: PreviewState["headings"]): void {
  const query = (searchElement.value || "").trim().toLowerCase();
  const filtered = headings.filter((heading) => !query || heading.text.toLowerCase().includes(query));
  outlineElement.innerHTML = filtered.length
    ? filtered.map((heading) => {
      const id = getOutlineId(heading);
      return `<div class="outline-node level-${heading.level}">
        <div class="outline-row">
          <span class="outline-disclosure-placeholder" aria-hidden="true"></span>
          <button type="button" class="outline-item${id === activeOutlineId ? " is-active" : ""}" data-outline-id="${escapeAttribute(id)}" data-line="${heading.line}" data-slug="${escapeAttribute(heading.slug || "")}" data-hover-tooltip="${escapeAttribute(heading.text)}" aria-label="${escapeAttribute(heading.text)}">${escapeHtml(heading.text)}</button>
        </div>
      </div>`;
    }).join("")
    : `<div class="outline-empty">${escapeHtml(translations.noHeadings || "No headings")}</div>`;
  updateActiveOutlineFromScroll();
}

function getOutlineId(heading: { slug?: string; line: number }): string {
  return `${heading.slug || "heading"}:${heading.line}`;
}

function handleOutlineClick(event: MouseEvent): void {
  const target = closestElement(event.target, "[data-line]");
  if (!target) {
    return;
  }
  const line = Number(target.dataset.line || 0);
  if (currentMode === "wysiwyg") {
    scrollVisualEditorToHeading(line);
  } else if (currentMode === "preview" || currentLayout === "previewOnly") {
    const previewTarget = findPreviewElementForLine(line);
    if (previewTarget) {
      scrollElementIntoContainer(previewElement, previewTarget);
    }
  } else {
    scrollToLine(line);
  }
  setActiveOutlineId(target.dataset.outlineId || "");
}

function updateActiveOutlineFromScroll(origin?: string | Event): void {
  if (!currentOutlineHeadings.length) {
    setActiveOutlineId("");
    return;
  }
  const source = typeof origin === "string"
    ? origin
    : origin?.currentTarget === previewElement
      ? "preview"
      : origin?.currentTarget === visualEditor
        ? "visual"
        : "source";
  const line = source === "preview"
    ? getFirstVisiblePreviewSourceLine()
    : source === "visual"
      ? getFirstVisibleVisualHeadingLine()
      : getFirstVisibleSourceLine();
  if (line === null) {
    return;
  }
  let active = currentOutlineHeadings[0];
  for (const heading of currentOutlineHeadings) {
    if (heading.line <= line) {
      active = heading;
    } else {
      break;
    }
  }
  setActiveOutlineId(getOutlineId(active));
}

function setActiveOutlineId(id: string): void {
  activeOutlineId = id;
  outlineElement.querySelectorAll(".outline-item").forEach((item) => {
    item.classList.toggle("is-active", (item as HTMLElement).dataset.outlineId === id);
  });
}

function revealActiveOutlineItem(): void {
  updateActiveOutlineFromScroll(currentMode === "wysiwyg" ? "visual" : currentMode === "preview" ? "preview" : "source");
  const active = activeOutlineId ? outlineElement.querySelector(`.outline-item[data-outline-id="${cssEscape(activeOutlineId)}"]`) : null;
  active?.scrollIntoView({ block: "nearest" });
}

function cssEscape(value: string): string {
  return typeof CSS !== "undefined" && CSS.escape ? CSS.escape(value) : value.replace(/["\\]/g, "\\$&");
}

function toggleSidePanelFromEvent(event: Event): void {
  event.preventDefault();
  setSidePanelOpen(!sidePanelOpen);
}

function setSidePanelOpen(open: boolean): void {
  sidePanelOpen = open;
  document.body.classList.toggle("side-panel-open", open);
  sidePanelToggleElement.setAttribute("aria-expanded", String(open));
  sidePanelElement.setAttribute("aria-hidden", String(!open));
}

function scrollToLine(line: number): void {
  const safeLine = clampSourceLine(line);
  const lines = sourceEditor.value.split(/\r?\n/);
  const position = lines.slice(0, safeLine).join("\n").length + (safeLine > 0 ? 1 : 0);
  sourceEditor.focus();
  sourceEditor.setSelectionRange(position, position);
  scrollSourceEditorToLine(safeLine);
}

function isSplitSyncMode(): boolean {
  return currentMode === "split" || currentLayout === "splitEdit" || (currentMode === "source" && currentLayout === "workbench");
}

function bindEditorScrollSync(): void {
  sourceEditor.onscroll = null;
  previewElement.onscroll = null;
  visualEditor.onscroll = null;
  cancelAnimationFrame(editorScrollFrame);
  if (currentMode === "wysiwyg") {
    visualEditor.onscroll = () => updateActiveOutlineFromScroll("visual");
    return;
  }
  if (!isSplitSyncMode()) {
    return;
  }
  sourceEditor.onscroll = () => {
    if (scrollSyncSuppressTarget === "source") {
      return;
    }
    updateActiveOutlineFromScroll("source");
    scheduleScrollSync(() => syncPreviewToSourceLine(getFirstVisibleSourceLine()));
  };
  previewElement.onscroll = () => {
    if (scrollSyncSuppressTarget === "preview") {
      return;
    }
    updateActiveOutlineFromScroll("preview");
    scheduleScrollSync(() => {
      const line = getFirstVisiblePreviewSourceLine();
      if (line !== null) {
        syncSourceToPreviewLine(line);
      }
    });
  };
}

function scheduleScrollSync(callback: () => void): void {
  cancelAnimationFrame(editorScrollFrame);
  editorScrollFrame = requestAnimationFrame(callback);
}

function runSyncedScroll(target: string, callback: () => void): void {
  scrollSyncSuppressTarget = target;
  callback();
  clearTimeout(scrollSyncReleaseTimer);
  scrollSyncReleaseTimer = window.setTimeout(() => {
    if (scrollSyncSuppressTarget === target) {
      scrollSyncSuppressTarget = "";
    }
  }, 80);
}

function syncPreviewToSourceLine(line: number): void {
  const target = findPreviewElementForLine(line);
  if (!target) {
    return;
  }
  const previewRect = previewElement.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const nextTop = previewElement.scrollTop + targetRect.top - previewRect.top;
  runSyncedScroll("preview", () => {
    previewElement.scrollTop = Math.max(0, Math.round(nextTop));
  });
}

function syncSourceToPreviewLine(line: number): void {
  runSyncedScroll("source", () => scrollSourceEditorToLine(line));
}

function scrollVisualEditorToHeading(line: number): void {
  if (!milkdownReady) {
    void ensureMilkdown().then(() => scrollVisualEditorToHeading(line));
    return;
  }
  const target = findVisualHeadingForLine(line);
  if (target) {
    scrollElementIntoContainer(visualEditor, target);
  }
}

function findVisualHeadingForLine(line: number): HTMLElement | null {
  const headingIndex = currentOutlineHeadings.findIndex((heading) => heading.line === line);
  const headings = Array.from(visualEditor.querySelectorAll<HTMLElement>(".ProseMirror h1, .ProseMirror h2, .ProseMirror h3, .ProseMirror h4, .ProseMirror h5, .ProseMirror h6"));
  if (headingIndex >= 0 && headingIndex < headings.length) {
    return headings[headingIndex];
  }
  const outlineHeading = currentOutlineHeadings.find((heading) => heading.line === line);
  if (!outlineHeading) {
    return null;
  }
  const tagName = `H${outlineHeading.level}`;
  return headings.find((heading) => heading.tagName === tagName && heading.textContent?.trim() === outlineHeading.text) || null;
}

function scrollElementIntoContainer(container: HTMLElement, target: HTMLElement): void {
  const containerRect = container.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  container.scrollTop = Math.max(0, Math.round(container.scrollTop + targetRect.top - containerRect.top));
}

function findPreviewElementForLine(line: number): HTMLElement | null {
  const safeLine = clampSourceLine(line);
  const elements = Array.from(previewElement.querySelectorAll<HTMLElement>("[data-source-line]"));
  let fallback: HTMLElement | null = null;
  for (const element of elements) {
    const elementLine = getPreviewSourceLine(element);
    if (elementLine === null) {
      continue;
    }
    fallback = element;
    if (elementLine >= safeLine) {
      return element;
    }
  }
  return fallback;
}

function getFirstVisiblePreviewSourceLine(): number | null {
  const previewRect = previewElement.getBoundingClientRect();
  const elements = Array.from(previewElement.querySelectorAll<HTMLElement>("[data-source-line]"));
  let bestLine: number | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const element of elements) {
    const line = getPreviewSourceLine(element);
    if (line === null) {
      continue;
    }
    const rect = element.getBoundingClientRect();
    if (rect.bottom < previewRect.top || rect.top > previewRect.bottom) {
      continue;
    }
    const distance = Math.abs(Math.max(rect.top, previewRect.top) - previewRect.top);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestLine = line;
    }
  }
  return bestLine;
}

function getFirstVisibleVisualHeadingLine(): number | null {
  const visualRect = visualEditor.getBoundingClientRect();
  const headings = Array.from(visualEditor.querySelectorAll<HTMLElement>(".ProseMirror h1, .ProseMirror h2, .ProseMirror h3, .ProseMirror h4, .ProseMirror h5, .ProseMirror h6"));
  let bestIndex = -1;
  let bestDistance = Number.POSITIVE_INFINITY;
  headings.forEach((heading, index) => {
    const rect = heading.getBoundingClientRect();
    if (rect.bottom < visualRect.top || rect.top > visualRect.bottom) {
      return;
    }
    const distance = Math.abs(Math.max(rect.top, visualRect.top) - visualRect.top);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });
  return bestIndex >= 0 ? currentOutlineHeadings[bestIndex]?.line ?? null : null;
}

function getPreviewSourceLine(element: HTMLElement): number | null {
  const line = Number(element.dataset.sourceLine);
  return Number.isFinite(line) ? line : null;
}

function getFirstVisibleSourceLine(): number {
  const lineHeight = getSourceLineHeight();
  return clampSourceLine(Math.floor(sourceEditor.scrollTop / Math.max(1, lineHeight)));
}

function scrollSourceEditorToLine(line: number): void {
  const maxScrollTop = Math.max(0, sourceEditor.scrollHeight - sourceEditor.clientHeight);
  sourceEditor.scrollTop = Math.min(maxScrollTop, Math.max(0, Math.round(clampSourceLine(line) * getSourceLineHeight())));
}

function getSourceLineHeight(): number {
  const style = getComputedStyle(sourceEditor);
  const fontSize = Number.parseFloat(style.fontSize) || 14;
  const lineHeight = Number.parseFloat(style.lineHeight);
  return Number.isFinite(lineHeight) ? lineHeight : fontSize * 1.65;
}

function clampSourceLine(line: number): number {
  const lines = sourceEditor.value.split(/\r?\n/);
  return Math.max(0, Math.min(Math.floor(Number(line) || 0), Math.max(0, lines.length - 1)));
}

function handleCodeBlockActionClick(event: MouseEvent): void {
  const toneButton = closestElement(event.target, `.${CODE_BLOCK_CLASSES.toneButton}`);
  if (toneButton) {
    event.preventDefault();
    cycleCodeBlockTone(toneButton);
    return;
  }
  const copyButton = closestElement(event.target, `.${CODE_BLOCK_CLASSES.copyButton}`);
  if (copyButton) {
    event.preventDefault();
    copyCodeFromButton(copyButton);
  }
}

function cycleCodeBlockTone(buttonElement: HTMLElement): void {
  const block = buttonElement.closest(`.${CODE_BLOCK_CLASSES.block}, .${CODE_BLOCK_CLASSES.diagramBlock}, .${CODE_BLOCK_CLASSES.mathBlock}`) as HTMLElement | null;
  if (!block) {
    return;
  }
  const nextTone = nextCodeBlockTone(buttonElement.dataset.blockTone || block.dataset.renderBlockTone);
  block.classList.toggle("render-block-tone-light", nextTone === "light");
  block.classList.toggle("render-block-tone-dark", nextTone === "dark");
  block.dataset.renderBlockTone = nextTone;
  buttonElement.dataset.blockTone = nextTone;
  buttonElement.textContent = codeBlockToneLabel(nextTone, codeToneLabels);
  updateToneButtonTitle(buttonElement, nextTone);
}

function updateToneButtonTitle(buttonElement: HTMLElement, tone: string): void {
  const title = `${codeToneLabels.toneLabel}: ${codeBlockToneLabel(normalizeCodeBlockTone(tone), codeToneLabels)}`;
  buttonElement.dataset.hoverTooltip = title;
  buttonElement.setAttribute("aria-label", title);
}

function copyCodeFromButton(buttonElement: HTMLElement): void {
  const renderedBlock = buttonElement.closest(`.${CODE_BLOCK_CLASSES.block}, .${CODE_BLOCK_CLASSES.diagramBlock}`) as HTMLElement | null;
  const text = getCodeBlockText(renderedBlock, buttonElement);
  post("copyCode", { text });
  buttonElement.textContent = buttonElement.dataset.copiedLabel || codeCopyLabels.copiedLabel;
  window.setTimeout(() => {
    buttonElement.textContent = buttonElement.dataset.copyLabel || codeCopyLabels.copyLabel;
  }, 1200);
}

function getCodeBlockText(block: HTMLElement | null, buttonElement: HTMLElement): string {
  if (!block) {
    return buttonElement.dataset.copyText || "";
  }
  const copySource = block.querySelector(`.${CODE_BLOCK_CLASSES.copySource}`) as HTMLTemplateElement | HTMLElement | null;
  if (copySource) {
    return "content" in copySource
      ? copySource.content.textContent || ""
      : copySource.textContent || "";
  }
  const code = block.querySelector("pre.visual-code-editor code, pre code, code");
  if (code) {
    return code.textContent || "";
  }
  const clone = block.cloneNode(true) as HTMLElement;
  clone.querySelector("figcaption")?.remove();
  clone.querySelector(`.${CODE_BLOCK_CLASSES.actionGroup}`)?.remove();
  return clone.textContent || "";
}
