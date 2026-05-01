export const CODE_BLOCK_TONES = ["auto", "light", "dark"] as const;

export type CodeBlockTone = typeof CODE_BLOCK_TONES[number];

export interface CodeCopyLabels {
  copyLabel: string;
  copiedLabel: string;
}

export interface BlockToneLabels {
  toneLabel: string;
  autoLabel: string;
  lightLabel: string;
  darkLabel: string;
}

export const CODE_BLOCK_CLASSES = {
  actionGroup: "code-actions",
  block: "code-block",
  copyButton: "copy-code",
  copySource: "code-copy-source",
  diagramBlock: "diagram-block",
  language: "code-language",
  mathBlock: "math-block",
  toneButton: "code-color-toggle"
} as const;

export function normalizeCodeBlockTone(value: string | undefined): CodeBlockTone {
  return CODE_BLOCK_TONES.includes(value as CodeBlockTone) ? value as CodeBlockTone : "auto";
}

export function nextCodeBlockTone(value: string | undefined): CodeBlockTone {
  const current = normalizeCodeBlockTone(value);
  const index = CODE_BLOCK_TONES.indexOf(current);
  return CODE_BLOCK_TONES[(index + 1) % CODE_BLOCK_TONES.length];
}

export function codeBlockToneLabel(tone: CodeBlockTone, labels: BlockToneLabels): string {
  if (tone === "light") {
    return labels.lightLabel;
  }
  if (tone === "dark") {
    return labels.darkLabel;
  }
  return labels.autoLabel;
}
