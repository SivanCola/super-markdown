import { escapeAttribute, escapeHtml } from "../utils/html";
import {
  CODE_BLOCK_CLASSES,
  CODE_BLOCK_TONES,
  type BlockToneLabels,
  type CodeCopyLabels
} from "./codeBlockActions";

export type { BlockToneLabels, CodeCopyLabels } from "./codeBlockActions";

export interface CodeActionsOptions {
  copyLabels?: CodeCopyLabels;
  toneLabels?: BlockToneLabels;
  copyText?: string;
}

export function renderCodeCopyButton(labels: CodeCopyLabels, copyText?: string): string {
  const copyTextAttribute = copyText === undefined ? "" : ` data-copy-text="${escapeAttribute(copyText)}"`;
  return `<button type="button" class="${CODE_BLOCK_CLASSES.copyButton}" data-copy-label="${escapeAttribute(labels.copyLabel)}" data-copied-label="${escapeAttribute(labels.copiedLabel)}" data-hover-tooltip="${escapeAttribute(labels.copyLabel)}" aria-label="${escapeAttribute(labels.copyLabel)}"${copyTextAttribute}>${escapeHtml(labels.copyLabel)}</button>`;
}

export function renderBlockToneToggleButton(labels: BlockToneLabels): string {
  return `<button type="button" class="${CODE_BLOCK_CLASSES.toneButton}" data-block-tone="auto" data-tone-label="${escapeAttribute(labels.toneLabel)}" data-tone-auto-label="${escapeAttribute(labels.autoLabel)}" data-tone-light-label="${escapeAttribute(labels.lightLabel)}" data-tone-dark-label="${escapeAttribute(labels.darkLabel)}" data-hover-tooltip="${escapeAttribute(labels.toneLabel)}" aria-label="${escapeAttribute(labels.toneLabel)}">${escapeHtml(labels.autoLabel)}</button>`;
}

export function renderCodeActions(options: CodeActionsOptions): string {
  const buttons = [
    options.copyLabels ? renderCodeCopyButton(options.copyLabels, options.copyText) : "",
    options.toneLabels ? renderBlockToneToggleButton(options.toneLabels) : ""
  ].filter(Boolean).join("");
  return buttons ? `<span class="${CODE_BLOCK_CLASSES.actionGroup}">${buttons}</span>` : "";
}

export function buildCodeCopyScript(failedLabel = "Copy failed"): string {
  return `<script>
const renderBlockTones = ["auto", "light", "dark"];
function setRenderBlockTone(block, button, tone) {
  block.classList.toggle("render-block-tone-light", tone === "light");
  block.classList.toggle("render-block-tone-dark", tone === "dark");
  block.dataset.renderBlockTone = tone;
  if (!button) return;
  button.dataset.blockTone = tone;
  const label = ${JSON.stringify(CODE_BLOCK_TONES)}.includes(tone) ? ({
    auto: button.getAttribute("data-tone-auto-label"),
    light: button.getAttribute("data-tone-light-label"),
    dark: button.getAttribute("data-tone-dark-label")
  })[tone] : button.getAttribute("data-tone-auto-label");
  button.textContent = label || tone;
  const title = button.getAttribute("data-tone-label") || "Colors";
  button.setAttribute("data-hover-tooltip", title + ": " + button.textContent);
  button.setAttribute("aria-label", title + ": " + button.textContent);
}
document.addEventListener("click", async function (event) {
  const toneButton = event.target.closest && event.target.closest(".code-color-toggle");
  if (toneButton) {
    const block = toneButton.closest(".code-block, .diagram-block, .math-block");
    if (!block) return;
    const current = toneButton.getAttribute("data-block-tone") || block.dataset.renderBlockTone || "auto";
    const next = ${JSON.stringify(CODE_BLOCK_TONES)}[(${JSON.stringify(CODE_BLOCK_TONES)}.indexOf(current) + 1) % ${CODE_BLOCK_TONES.length}] || "auto";
    setRenderBlockTone(block, toneButton, next);
    return;
  }
  const button = event.target.closest && event.target.closest(".copy-code");
  if (!button) return;
  const block = button.closest(".code-block, .diagram-block");
  const source = block && block.querySelector(".code-copy-source");
  const code = block && (block.querySelector("pre code") || block.querySelector("pre"));
  const text = source
    ? (source.content ? source.content.textContent : source.textContent) || ""
    : button.getAttribute("data-copy-text") || (code ? code.innerText : "");
  try {
    await navigator.clipboard.writeText(text);
    const label = button.getAttribute("data-copy-label") || "Copy";
    button.textContent = button.getAttribute("data-copied-label") || "Copied";
    setTimeout(function () { button.textContent = label; }, 1200);
  } catch {
    button.textContent = ${JSON.stringify(failedLabel)};
  }
});
</script>`;
}
