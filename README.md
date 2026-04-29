<div align="center">

# Super Markdown

### A cleaner Markdown reading and editing experience for VS Code

[![version](https://img.shields.io/visual-studio-marketplace/v/SivanLiu.super-markdown?label=version&color=2389d7)](https://marketplace.visualstudio.com/items?itemName=SivanLiu.super-markdown)
[![open vsx](https://img.shields.io/open-vsx/v/SivanLiu/super-markdown?label=open%20vsx&color=8a63d2)](https://open-vsx.org/extension/SivanLiu/super-markdown)
![platform](https://img.shields.io/badge/platform-VS%20Code%20%7C%20Cursor-8a8a8a)
![built with](https://img.shields.io/badge/built%20with-TypeScript-3178c6)
[![downloads](https://img.shields.io/visual-studio-marketplace/d/SivanLiu.super-markdown?label=downloads&color=39b91f)](https://marketplace.visualstudio.com/items?itemName=SivanLiu.super-markdown)
[![license](https://img.shields.io/badge/license-Apache--2.0-orange)](LICENSE)

English | [简体中文](#简体中文)

</div>

---

## English

Super Markdown is a VS Code extension for people who read and maintain longer Markdown files: API docs, product notes, specs, guides, knowledge-base pages, and project documentation.

It keeps your normal Markdown editor available, then adds a polished preview, split editing, floating outline navigation, document health checks, and safe cleanup tools when you need more structure.

## Screenshots

![Split edit mode with source, preview, and floating outline](images/screenshots/split-edit-mode.png)

![Document health checks and organize Markdown diff preview](images/screenshots/document-health.png)

## What's New

- Marketplace and Open VSX README navigation now uses in-page language switching instead of cross-file README links.
- The default marketplace page opens in English while keeping Simplified Chinese documentation directly available.
- Version badges now read from the live VS Code Marketplace and Open VSX listings.

## Highlights

- Open a polished Markdown preview without forcing Super Markdown to become your default Markdown editor.
- Use split edit mode with source on the left and rendered preview on the right.
- Navigate long documents with a floating H1-H6 outline, heading search, active tracking, and adjustable height.
- Click preview content to reveal the matching source line; move the source cursor to scroll the preview.
- Render code blocks with syntax highlighting and copy buttons.
- Render Mermaid diagrams and KaTeX math from bundled local assets.
- Switch the extension UI between English, Simplified Chinese, and VS Code auto mode.
- Choose from multiple reading background themes.
- Review safe cleanup changes in a diff before applying them.

## Quick Start

1. Install `Super Markdown` from the VS Code Marketplace or Open VSX.
2. Open a Markdown file in VS Code, Cursor, or another VS Code-compatible editor.
3. Click `Super Markdown` in the editor title bar, or right-click the Markdown file in Explorer.
4. Choose `Split Edit Mode` when writing, or `Preview Mode` when reading.
5. Use the floating outline on the right to search and jump between headings.

Split Edit Mode shortcut:

- macOS: `Cmd+Alt+M`
- Windows/Linux: `Ctrl+Alt+M`

## Modes

| Mode | Best for | What it does |
| --- | --- | --- |
| `Split Edit Mode` | Writing and reviewing | Opens source on the left and rendered preview on the right, with bidirectional line sync. |
| `Preview Mode` | Reading | Opens a focused rendered preview with floating outline navigation. |
| `Preview Editor` | Optional custom editor | Opens Markdown through VS Code `Open With...` without replacing the default editor unless you choose it. |

## Document Health

Run `Super Markdown: Show Document Health` before sharing or publishing a document.

It checks for:

- Missing H1 heading.
- Skipped heading levels.
- Stale generated table of contents.
- Duplicate heading anchors.
- Broken local links or images.
- Unchecked task count.

## Safe Cleanup

Run `Super Markdown: Organize Markdown` when you want the extension to prepare cleanup edits. Super Markdown opens a diff first, so you can review every change before applying it.

It can help with:

- Creating or updating a generated table of contents.
- Normalizing list and task-list spacing.
- Formatting simple Markdown tables.
- Adding or updating H2-H6 section numbering when enabled.

## Common Commands

| Command | Use it for |
| --- | --- |
| `Super Markdown: Split Edit Mode` | Edit source and preview side by side. |
| `Super Markdown: Preview Mode` | Open a rendered reading view. |
| `Super Markdown: Open Preview Editor` | Open the file with the optional custom preview editor. |
| `Super Markdown: Show Document Health` | Inspect structure, links, anchors, TOC, and tasks. |
| `Super Markdown: Organize Markdown` | Review and apply safe cleanup changes. |
| `Super Markdown: Switch Background Theme` | Change the preview reading theme. |
| `Super Markdown: Switch Display Language` | Switch Super Markdown UI language. |

## Settings

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

## Current Limits

- Super Markdown is focused on Markdown files.
- Preview link checks are limited to local links and images that can be resolved from the current document.
- Cleanup is intentionally conservative and opens a diff before changing your document.

## Privacy

Super Markdown processes Markdown content locally in the editor and does not send your documents to a remote service.

## Bug Reports

Report issues here: <https://github.com/SivanCola/super-markdown/issues>

## License

Super Markdown is licensed under the Apache License, Version 2.0. See [LICENSE](LICENSE).

---

<a id="简体中文"></a>

## 简体中文

Super Markdown 是一个面向 VS Code 的 Markdown 阅读和整理扩展，适合阅读和维护较长的 Markdown 文件：接口文档、产品说明、需求文档、知识库页面、项目文档和使用指南。

它不会强制替换 VS Code 默认 Markdown 编辑器，而是在你需要更好的阅读、分屏编辑、大纲导航、文档检查和安全整理时，提供一套更完整的体验。

## 最新版亮点

- Marketplace 和 Open VSX 的 README 导航改为页内语言切换，不再使用跨文件 README 链接。
- 默认市场页面仍以英文打开，同时可以直接跳到简体中文说明。
- 版本徽章改为读取 VS Code Marketplace 和 Open VSX 的实时版本。

## 功能亮点

- 打开更精致的 Markdown 预览，但不会强制把 Super Markdown 设为默认 Markdown 编辑器。
- 使用分屏编辑模式：左侧源码，右侧渲染预览。
- 用 H1-H6 悬浮大纲管理长文档，支持标题搜索、当前标题高亮和高度调整。
- 点击预览内容可定位到源码行，移动源码光标也会同步滚动预览。
- 代码块支持语法高亮和一键复制。
- Mermaid 图表和 KaTeX 数学公式使用本地打包资源渲染。
- 扩展界面支持英文、简体中文和跟随 VS Code 自动切换。
- 提供多种阅读背景主题。
- 整理 Markdown 前先展示 diff，确认后再应用修改。

## 快速开始

1. 从 VS Code Marketplace 或 Open VSX 安装 `Super Markdown`。
2. 在 VS Code、Cursor 或其他兼容 VS Code 的编辑器中打开 Markdown 文件。
3. 点击编辑器标题栏中的 `Super Markdown`，或在资源管理器中右键 Markdown 文件。
4. 写文档时选择 `分屏编辑模式`，阅读文档时选择 `预览模式`。
5. 使用右侧悬浮大纲搜索标题并快速跳转。

分屏编辑模式快捷键：

- macOS：`Cmd+Alt+M`
- Windows/Linux：`Ctrl+Alt+M`

## 三种模式

| 模式 | 适合场景 | 作用 |
| --- | --- | --- |
| `分屏编辑模式` | 编写和审阅 | 左侧源码，右侧预览，支持源码和预览双向同步。 |
| `预览模式` | 专注阅读 | 打开渲染后的阅读视图，并带右侧悬浮大纲。 |
| `预览编辑器` | 可选自定义编辑器 | 通过 VS Code 的 `Open With...` 打开，不会主动替换默认 Markdown 编辑器。 |

## 文档健康检查

分享或发布文档前，可以运行 `Super Markdown：显示文档健康检查`。

它会检查：

- 缺少 H1 标题。
- 标题层级跳跃。
- 生成目录已过期。
- 标题锚点重复。
- 本地链接或图片失效。
- 未完成任务数量。

## 安全整理

运行 `Super Markdown：整理 Markdown` 后，扩展会先生成整理结果并打开 diff。你可以检查每一处变化，再决定是否应用。

它可以帮助处理：

- 创建或更新生成目录。
- 规范列表和任务列表空格。
- 格式化简单 Markdown 表格。
- 在启用设置后添加或更新 H2-H6 章节编号。

## 常用命令

| 命令 | 用途 |
| --- | --- |
| `Super Markdown：分屏编辑模式` | 左侧编辑源码，右侧同步预览。 |
| `Super Markdown：预览模式` | 打开渲染后的阅读视图。 |
| `Super Markdown：使用预览编辑器打开` | 使用可选的自定义预览编辑器打开文件。 |
| `Super Markdown：显示文档健康检查` | 检查结构、链接、锚点、目录和任务。 |
| `Super Markdown：整理 Markdown` | 预览并应用安全整理改动。 |
| `Super Markdown：切换背景主题` | 切换预览阅读主题。 |
| `Super Markdown：切换界面语言` | 切换 Super Markdown 界面语言。 |

## 设置

打开 VS Code 设置，搜索 `superMarkdown`。

| 设置 | 说明 |
| --- | --- |
| `superMarkdown.preview.theme` | 预览主题：`auto`、`light`、`dark`、`eye-care-green`、`warm-paper`、`ink-black`、`coastal-blue` 或 `high-contrast`。 |
| `superMarkdown.preview.fontSize` | 预览基础字号，单位为像素。 |
| `superMarkdown.preview.maxWidth` | 预览正文最大宽度，单位为像素。 |
| `superMarkdown.toc.levels` | 大纲和生成目录包含的标题级别，例如 `1..6` 或 `2..4`。 |
| `superMarkdown.organize.updateTocOnSave` | 保存 Markdown 文件时更新生成目录。 |
| `superMarkdown.organize.numberHeadings` | 整理 Markdown 时添加或更新 H2-H6 章节编号。 |
| `superMarkdown.mermaid.enabled` | 在预览中渲染 Mermaid 代码块。 |
| `superMarkdown.katex.enabled` | 在预览中渲染 KaTeX 数学公式。 |
| `superMarkdown.displayLanguage` | Super Markdown 界面语言：`auto`、`zh-CN` 或 `en`。 |

## 当前限制

- Super Markdown 专注于 Markdown 文件。
- 预览链接检查仅覆盖能从当前文档解析到的本地链接和图片。
- 整理功能保持保守，会先打开 diff，再修改你的文档。

## 隐私

Super Markdown 会在编辑器本地处理 Markdown 内容，不会把你的文档发送到远程服务。

## Bug 反馈

- 提交地址：<https://github.com/SivanCola/super-markdown/issues>

## 许可证

Super Markdown 使用 Apache License, Version 2.0 授权。详见 [LICENSE](LICENSE)。
