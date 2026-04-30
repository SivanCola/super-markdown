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

export interface FormatSettings {
  enable: boolean;
  punctuationWidth: "auto" | "half" | "preserve";
  punctuationSpacing: "half" | "full" | "all" | "none";
  table: {
    enabled: boolean;
    cjkCharWidth: number;
  };
  list: {
    markerStyle: "preserve" | "cycle";
    markerCycle: string[];
    padOrderedNumbers: boolean;
  };
  code: {
    enabled: boolean;
    indentedCodeToFenceLanguage: string;
    beautifyOptions: Record<string, unknown>;
  };
  timeHeader: {
    enabled: boolean;
  };
  specialTextSpacing: boolean;
}

export type ExportType = "html" | "pdf" | "png" | "jpeg";

export interface ExportSettings {
  defaultType: ExportType | ExportType[];
  convertOnSave: boolean;
  exclude: string[];
  outputDirectory: string;
  outputDirectoryRelativePathFile: boolean;
  includeDefaultStyles: boolean;
  styles: string[];
  highlight: boolean;
  highlightStyle: string;
  emoji: boolean;
  breaks: boolean;
  chromiumExecutablePath: string;
  include: {
    enabled: boolean;
  };
  mermaid: {
    enabled: boolean;
  };
  plantuml: {
    enabled: boolean;
    server: string;
    openMarker: string;
    closeMarker: string;
  };
  pdf: {
    format: string;
    landscape: boolean;
    printBackground: boolean;
    displayHeaderFooter: boolean;
    headerTemplate: string;
    footerTemplate: string;
    margin: {
      top: string;
      right: string;
      bottom: string;
      left: string;
    };
  };
  image: {
    quality: number;
    fullPage: boolean;
    omitBackground: boolean;
    clip?: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  };
}

export type WysiwygMode = "wysiwyg" | "ir" | "sv";
export type WysiwygTheme = "classic" | "dark";
export type SuperMarkdownEditorLayout = "workbench" | "editorOnly" | "splitEdit" | "previewOnly";

export interface WysiwygSettings {
  defaultMode: WysiwygMode;
  layout: SuperMarkdownEditorLayout;
  imageDirectory: string;
  useVsCodeThemeColors: boolean;
  customCss: string;
  theme: WysiwygTheme;
}

export interface SyntaxToolsSettings {
  showMessages: boolean;
}

export type PreviewTheme =
  | "system"
  | "light"
  | "dark"
  | "sage"
  | "paper"
  | "ink"
  | "ocean"
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
  format: FormatSettings;
}
