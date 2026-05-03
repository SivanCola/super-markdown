export interface ToolbarGroup {
  name: string;
  actions: string[];
}

export const TOOLBAR_GROUPS: ToolbarGroup[] = [
  { name: "text", actions: ["bold", "italic", "underline", "strike", "highlight"] },
  { name: "structure", actions: ["heading", "hr", "quote", "list", "ordered-list", "task", "task-checked"] },
  { name: "insert", actions: ["link", "image", "inline-code", "code", "table"] },
  { name: "advanced", actions: ["math", "mermaid", "toc", "organizeMarkdown", "more"] },
  { name: "help", actions: ["switchBackgroundTheme", "help"] }
];

export const HEADING_MENU_ACTIONS = ["heading-1", "heading-2", "heading-3", "heading-4", "heading-5", "heading-6"];

export const MORE_MENU_ACTIONS = ["export-html", "export-pdf", "export-all"];

export const HOST_TOOLBAR_ACTIONS = new Set([
  "toc",
  "organizeMarkdown",
  "switchBackgroundTheme",
  "help",
  "export-html",
  "export-pdf",
  "export-all"
]);

export const SUPER_MARKDOWN_ISSUES_URL = "https://github.com/SivanCola/super-markdown/issues";

const TOOLBAR_CODICON_ACTIONS: Record<string, string> = {
  bold: "bold",
  italic: "italic",
  strike: "strikethrough",
  heading: "text-size",
  "heading-1": "text-size",
  "heading-2": "text-size",
  "heading-3": "text-size",
  "heading-4": "text-size",
  "heading-5": "text-size",
  "heading-6": "text-size",
  hr: "horizontal-rule",
  quote: "quote",
  list: "list-unordered",
  "ordered-list": "list-ordered",
  task: "tasklist",
  "task-checked": "check-all",
  link: "link",
  image: "file-media",
  "inline-code": "code",
  code: "file-code",
  table: "table",
  toc: "list-tree",
  organizeMarkdown: "tools",
  switchBackgroundTheme: "color-mode",
  help: "question",
  more: "more",
  "export-html": "export",
  "export-pdf": "export",
  "export-all": "export"
};

const TOOLBAR_CUSTOM_ICONS: Record<string, string> = {
  underline: customSvg('<path d="M7 4v5a5 5 0 0 0 10 0V4"/><path d="M5 20h14"/>'),
  highlight: customSvg('<path d="m5 15 8.8-8.8 2 2L7 17H5v-2Z"/><path d="m12.5 7.5 2 2"/><path d="M4 20h16"/>'),
  math: customSvg('<path d="M17 5H7l5 7-5 7h10"/>'),
  mermaid: customSvg('<path d="M12 4v5"/><path d="M6 15v2a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><rect x="3" y="11" width="6" height="4" rx="1"/><rect x="15" y="11" width="6" height="4" rx="1"/><path d="M12 9H6v2"/><path d="M12 9h6v2"/>')
};

export function renderToolbarIcon(action: string): string {
  const customIcon = TOOLBAR_CUSTOM_ICONS[action];
  if (customIcon) {
    return customIcon;
  }
  const codicon = TOOLBAR_CODICON_ACTIONS[action] || "question";
  return `<span class="codicon codicon-${codicon}"></span>`;
}

function customSvg(content: string): string {
  return `<svg class="toolbar-custom-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${content}</svg>`;
}
