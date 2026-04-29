export interface Heading {
  level: number;
  text: string;
  slug: string;
  line: number;
  children: Heading[];
}

export type DocumentIssueSeverity = "info" | "warning" | "error";

export interface DocumentIssue {
  severity: DocumentIssueSeverity;
  code: string;
  message: string;
  line?: number;
  target?: string;
}

export interface OrganizeEdit {
  label: string;
  range: {
    start: number;
    end: number;
  };
  replacement: string;
}

export interface OrganizeResult {
  text: string;
  edits: OrganizeEdit[];
  warnings: string[];
}

export type PreviewTheme =
  | "auto"
  | "light"
  | "dark"
  | "eye-care-green"
  | "warm-paper"
  | "ink-black"
  | "coastal-blue"
  | "high-contrast";

export interface PreviewSettings {
  theme: PreviewTheme;
  fontSize: number;
  maxWidth: number;
  tocLevels: Set<number>;
  displayLanguage: "auto" | "zh-CN" | "en";
  activeLanguage: "zh-CN" | "en";
  mermaidEnabled: boolean;
  katexEnabled: boolean;
  numberHeadings: boolean;
  updateTocOnSave: boolean;
}
