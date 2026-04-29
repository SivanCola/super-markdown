<p align="center">
  <img src="images/icon.png" width="96" height="96" alt="Super Markdown logo">
</p>

<h1 align="center">Super Markdown</h1>

<p align="center">
  <strong>A cleaner Markdown reading and editing experience for VS Code.</strong>
</p>

<p align="center">
  <img alt="version" src="https://img.shields.io/badge/version-0.0.4-2f80d0">
  <img alt="platform" src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-8b8b8b">
  <img alt="VS Code" src="https://img.shields.io/badge/VS%20Code-%5E1.85.0-007acc">
  <img alt="license" src="https://img.shields.io/badge/license-Apache--2.0-35a853">
</p>

<p align="center">
  <a href="#english">English</a> |
  <a href="README.zh-CN.md">中文</a> |
  <a href="CHANGELOG.md">Changelog</a>
</p>

---

## English

Super Markdown is a VS Code extension for people who read and maintain longer Markdown files: API docs, product notes, specs, guides, knowledge-base pages, and project documentation.

It keeps your normal Markdown editor available, then adds a polished preview, split editing, floating outline navigation, document health checks, and safe cleanup tools when you need more structure.

### Install

Install Super Markdown from your VS Code extension marketplace. After installation, open any Markdown file and use the `Super Markdown` menu in the editor title bar.

If you have a `.vsix` file, run `Extensions: Install from VSIX...` from the Command Palette.

### Quick Start

1. Open a Markdown file.
2. Click `Super Markdown` in the editor title bar, or right-click the Markdown file in Explorer.
3. Choose `Split Edit Mode` when writing, or `Preview Mode` when reading.
4. Use the floating outline on the right to search and jump between headings.

Split Edit Mode shortcut:

- macOS: `Cmd+Alt+M`
- Windows/Linux: `Ctrl+Alt+M`

### Screenshots

**Split editing with a floating outline**

![Split edit mode with source, preview, and floating outline](images/screenshots/split-edit-mode.png)

**Document health checks and safe cleanup**

![Document health checks and organize Markdown diff preview](images/screenshots/document-health.png)

### Modes

| Mode | Best for | What it does |
| --- | --- | --- |
| `Split Edit Mode` | Writing and reviewing | Opens source on the left and rendered preview on the right, with bidirectional line sync. |
| `Preview Mode` | Reading | Opens a focused rendered preview with floating outline navigation. |
| `Preview Editor` | Optional custom editor | Opens Markdown through VS Code `Open With...` without replacing the default editor unless you choose it. |

### Highlights

- Floating Notion-style H1-H6 outline with heading search, active tracking, and adjustable height.
- Click preview content to reveal the source line; move the source cursor to scroll the preview.
- Code blocks with syntax highlighting and copy buttons.
- Mermaid diagrams and KaTeX math rendered from bundled local assets.
- Runtime language switching between English, Simplified Chinese, and VS Code auto mode.
- Multiple reading background themes.
- Safe cleanup with a diff preview before any Markdown changes are applied.

### Document Health

Run `Super Markdown: Show Document Health` to catch common problems before sharing or publishing a document:

- Missing H1 heading.
- Skipped heading levels.
- Stale generated table of contents.
- Duplicate heading anchors.
- Broken local links or images.
- Unchecked task count.

### Safe Cleanup

Run `Super Markdown: Organize Markdown` when you want the extension to prepare cleanup edits. Super Markdown opens a diff first, so you can review every change before applying it.

It can help with:

- Creating or updating a generated table of contents.
- Normalizing list and task-list spacing.
- Formatting simple Markdown tables.
- Adding or updating H2-H6 section numbering when enabled.

### Common Commands

| Command | Use it for |
| --- | --- |
| `Super Markdown: Split Edit Mode` | Edit source and preview side by side. |
| `Super Markdown: Preview Mode` | Open a rendered reading view. |
| `Super Markdown: Open Preview Editor` | Open the file with the optional custom preview editor. |
| `Super Markdown: Show Document Health` | Inspect structure, links, anchors, TOC, and tasks. |
| `Super Markdown: Organize Markdown` | Review and apply safe cleanup changes. |
| `Super Markdown: Switch Background Theme` | Change the preview reading theme. |
| `Super Markdown: Switch Display Language` | Switch Super Markdown UI language. |

### Settings

Open VS Code Settings and search for `superMarkdown`.

| Setting | Description |
| --- | --- |
| `superMarkdown.preview.theme` | Preview theme: `auto`, `light`, `dark`, `eye-care-green`, `warm-paper`, `ink-black`, `coastal-blue`, or `high-contrast`. |
| `superMarkdown.preview.fontSize` | Base preview font size in pixels. |
| `superMarkdown.preview.maxWidth` | Maximum content width in pixels. |
| `superMarkdown.toc.levels` | Heading levels included in the outline and generated table of contents, for example `1..6` or `2..4`. |
| `superMarkdown.organize.updateTocOnSave` | Update the generated table of contents when saving Markdown files. |
| `superMarkdown.organize.numberHeadings` | Add or update H2-H6 section numbering when organizing Markdown. |
| `superMarkdown.mermaid.enabled` | Render Mermaid fenced code blocks in the preview. |
| `superMarkdown.katex.enabled` | Render KaTeX math in the preview. |
| `superMarkdown.displayLanguage` | Super Markdown UI language: `auto`, `zh-CN`, or `en`. |

### Tips

- Super Markdown does not force itself to become your default Markdown editor.
- If you use other Markdown extensions, use the `Super Markdown` title-bar menu, Explorer context menu, or `Open With...` to choose this preview explicitly.
- The floating outline can be hidden when you want more reading space.
- Cleanup commands are designed to show a diff before changing your document.

### License

Super Markdown is licensed under the [Apache License 2.0](LICENSE).
