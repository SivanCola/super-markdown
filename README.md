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

Super Markdown is a VS Code extension for people who write, read, maintain, and publish Markdown: API docs, product notes, specs, guides, knowledge-base pages, and project documentation.

Markdown files now open in the Super Markdown Editor by default: a three-column workbench with outline and health checks on the left, Vditor-powered editing in the center, and live preview on the right. You can still use `Reopen With...` or `Super Markdown: Open Native Editor` whenever you need VS Code's native text editor.

## Screenshots

![Split edit mode with source, preview, and floating outline](images/screenshots/split-edit-mode.png)

![Document health checks and organize Markdown diff preview](images/screenshots/document-health.png)

## What's New

- Marketplace and Open VSX README navigation now uses in-page language switching instead of cross-file README links.
- The default marketplace page opens in English while keeping Simplified Chinese documentation directly available.
- Version badges now read from the live VS Code Marketplace and Open VSX listings.

## Highlights

- Open `.md`, `.markdown`, `.mdown`, and `.mkdn` files in the Super Markdown Editor by default.
- Use a three-column workbench with outline, document health, Vditor editing, and live preview.
- Switch between Source/SV, IR, and WYSIWYG editing.
- Format Markdown through VS Code `Format Document` with Super Markdown as the default formatter.
- Export Markdown to HTML, PDF, PNG, JPEG, or all formats.
- Use Pandoc-aware highlighting for citations, fenced divs, bracketed spans, and extended Markdown syntax.
- Open a built-in Markdown syntax guide and convert Markdown tables to JSON or JSON arrays to Markdown tables.
- Navigate long documents with a floating H1-H6 outline, heading search, active tracking, and adjustable height.
- Click preview content to reveal the matching source line; move the source cursor to scroll the preview.
- Render code blocks with syntax highlighting and copy buttons.
- Render Mermaid diagrams and KaTeX math from bundled local assets.
- Switch the extension UI between English, Simplified Chinese, and VS Code auto mode.
- Choose from multiple reading themes.
- Review safe cleanup changes in a diff before applying them.

## Quick Start

1. Install `Super Markdown` from the VS Code Marketplace or Open VSX.
2. Open a Markdown file in VS Code, Cursor, or another VS Code-compatible editor.
3. The file opens in `Super Markdown Editor` by default.
4. Use the center editor to write, the left panel to navigate and inspect health, and the right panel to preview.
5. Use `Reopen With...` or `Super Markdown: Open Native Editor` if you need VS Code's native editor.

Split Edit Mode shortcut:

- macOS: `Cmd+Alt+M`
- Windows/Linux: `Ctrl+Alt+M`

## Modes

| Mode | Best for | What it does |
| --- | --- | --- |
| `Super Markdown Editor` | Default Markdown workbench | Opens outline, health checks, Vditor editing, and live preview together. |
| `Split Edit Mode` | Writing and reviewing | Switches the Super Markdown Editor to source plus live preview. |
| `Preview Mode` | Reading | Switches the Super Markdown Editor to a focused rendered preview. |
| `WYSIWYG Mode` | Document-style writing | Switches the Super Markdown Editor to Vditor WYSIWYG editing. |

## Document Health

Document health checks are included in the Super Markdown Editor side panel and in `Super Markdown: Organize Markdown` before sharing or publishing a document.

It checks for:

- Missing H1 heading.
- Skipped heading levels.
- Stale generated table of contents.
- Duplicate heading anchors.
- Broken local links or images.
- Unchecked task count.

## Safe Cleanup

Run `Super Markdown: Organize Markdown` when you want the extension to prepare cleanup edits and a document health report. Super Markdown opens a diff first, so you can review every change before applying it.

It can help with:

- Creating or updating a generated table of contents.
- Normalizing list and task-list spacing.
- Formatting simple Markdown tables.
- Adding or updating H2-H6 section numbering when enabled.
- Running the same formatter used by VS Code `Format Document`.

## Export

Run `Super Markdown: Export PDF`, `Export HTML`, `Export PNG`, `Export JPEG`, `Export All`, or `Export (Settings)`.

Export supports code highlighting, emoji, task checkboxes, container blocks, include fragments, Mermaid, and optional PlantUML. PDF and image export use Chrome/Chromium through `puppeteer-core`: Super Markdown tries your configured executable path first, then system Chrome/Edge/Chromium, then downloads a managed Chromium into extension global storage.

PlantUML is disabled by default. If you enable a remote PlantUML server, diagram content is sent to that configured server.

## Common Commands

| Command | Use it for |
| --- | --- |
| `Super Markdown: Open Editor` | Open the default three-column Markdown workbench. |
| `Super Markdown: Open Native Editor` | Reopen the file with VS Code's native text editor. |
| `Super Markdown: Split Edit Mode` | Edit source and preview side by side. |
| `Super Markdown: Preview Mode` | Open a rendered reading view. |
| `Super Markdown: WYSIWYG Mode` | Edit in the Super Markdown Editor's WYSIWYG mode. |
| `Super Markdown: Organize Markdown` | Review cleanup changes and document health. |
| `Super Markdown: Export PDF/HTML/PNG/JPEG/All` | Export the current Markdown document. |
| `Super Markdown: Open Syntax Guide` | Open the built-in Markdown syntax guide. |
| `Super Markdown: Copy Markdown Table as JSON` | Convert the selected Markdown table to JSON. |
| `Super Markdown: Copy JSON as Markdown Table` | Convert the selected JSON array to a Markdown table. |
| `Super Markdown: Switch Reading Theme` | Change the preview reading theme. |
| `Super Markdown: Switch Display Language` | Switch Super Markdown UI language. |

## Settings

Open VS Code Settings and search for `superMarkdown`.

| Setting | Description |
| --- | --- |
| `superMarkdown.preview.theme` | Preview theme: `system`, `light`, `dark`, `sage`, `paper`, `ocean`, `ink`, or `high-contrast`. Legacy values are migrated automatically. |
| `superMarkdown.preview.fontSize` | Base preview font size in pixels. |
| `superMarkdown.preview.maxWidth` | Maximum content width in pixels. |
| `superMarkdown.toc.levels` | Heading levels included in the outline and generated table of contents, for example `1..6` or `2..4`. |
| `superMarkdown.organize.updateTocOnSave` | Update the generated table of contents when saving Markdown files. |
| `superMarkdown.organize.numberHeadings` | Add or update H2-H6 section numbering when organizing Markdown. |
| `superMarkdown.editor.defaultMode` | Default Super Markdown Editor mode: `source`, `ir`, or `wysiwyg`. |
| `superMarkdown.format.*` | Configure formatter behavior for punctuation, tables, lists, code, and time headers. |
| `superMarkdown.wysiwyg.*` | Configure Vditor mode, image directory, custom CSS, and editor theme. |
| `superMarkdown.export.*` | Configure export type, output directory, styles, Chromium, PDF, image, include, Mermaid, and PlantUML. |
| `superMarkdown.syntaxTools.showMessages` | Show success and failure messages for syntax tools. |
| `superMarkdown.mermaid.enabled` | Render Mermaid fenced code blocks in the preview. |
| `superMarkdown.katex.enabled` | Render KaTeX math in the preview. |
| `superMarkdown.displayLanguage` | Super Markdown UI language: `auto`, `zh-CN`, or `en`. |

## Current Limits

- Super Markdown is focused on Markdown files.
- Preview link checks are limited to local links and images that can be resolved from the current document.
- Cleanup is intentionally conservative and opens a diff before changing your document.
- PDF, PNG, and JPEG export need a usable Chrome/Chromium executable or a managed Chromium download.

## Privacy

Super Markdown processes Markdown content locally in the editor and does not send your documents to a remote service by default. Enabling a remote PlantUML server sends PlantUML diagram content to that configured server.

## Bug Reports

Report issues here: <https://github.com/SivanCola/super-markdown/issues>

## License

Super Markdown is licensed under the Apache License, Version 2.0. See [LICENSE](LICENSE). Third-party MIT notices are listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

---

<a id="简体中文"></a>

## 简体中文

Super Markdown 是一个面向 VS Code 的 Markdown 写作、阅读、整理和发布扩展，适合接口文档、产品说明、需求文档、知识库页面、项目文档和使用指南。

Markdown 文件现在会默认打开 `Super Markdown Editor`：左侧是大纲和文档健康检查，中间是 Vditor 编辑器，右侧是实时预览。需要原生编辑器时，可以使用 `Reopen With...` 或 `Super Markdown：打开原生编辑器`。

## 最新版亮点

- Marketplace 和 Open VSX 的 README 导航改为页内语言切换，不再使用跨文件 README 链接。
- 默认市场页面仍以英文打开，同时可以直接跳到简体中文说明。
- 版本徽章改为读取 VS Code Marketplace 和 Open VSX 的实时版本。

## 功能亮点

- `.md`、`.markdown`、`.mdown`、`.mkdn` 默认使用 Super Markdown Editor 打开。
- 三栏工作台同时提供大纲、健康检查、Vditor 编辑和实时预览。
- 支持 Source/SV、IR、WYSIWYG 三种编辑模式。
- VS Code `Format Document` 默认使用 Super Markdown 格式化器。
- 支持导出 HTML、PDF、PNG、JPEG 或全部格式。
- 为 citations、fenced divs、bracketed spans 等 Pandoc Markdown 语法增强高亮。
- 内置 Markdown 语法速查，并提供 Markdown 表格与 JSON 互转工具。
- 用 H1-H6 悬浮大纲管理长文档，支持标题搜索、当前标题高亮和高度调整。
- 点击预览内容可定位到源码行，移动源码光标也会同步滚动预览。
- 代码块支持语法高亮和一键复制。
- Mermaid 图表和 KaTeX 数学公式使用本地打包资源渲染。
- 扩展界面支持英文、简体中文和跟随 VS Code 自动切换。
- 提供多种阅读主题。
- 整理 Markdown 前先展示 diff，确认后再应用修改。

## 快速开始

1. 从 VS Code Marketplace 或 Open VSX 安装 `Super Markdown`。
2. 在 VS Code、Cursor 或其他兼容 VS Code 的编辑器中打开 Markdown 文件。
3. 文件会默认打开 `Super Markdown Editor`。
4. 在中间编辑，在左侧导航和检查文档健康，在右侧实时预览。
5. 如需 VS Code 原生编辑器，使用 `Reopen With...` 或 `Super Markdown：打开原生编辑器`。

分屏编辑模式快捷键：

- macOS：`Cmd+Alt+M`
- Windows/Linux：`Ctrl+Alt+M`

## 三种模式

| 模式 | 适合场景 | 作用 |
| --- | --- | --- |
| `Super Markdown Editor` | 默认 Markdown 工作台 | 同时打开大纲、健康检查、Vditor 编辑和实时预览。 |
| `分屏编辑模式` | 编写和审阅 | 将 Super Markdown Editor 切换为源码加实时预览。 |
| `预览模式` | 专注阅读 | 将 Super Markdown Editor 切换为专注渲染预览。 |
| `所见即所得模式` | 文档式写作 | 将 Super Markdown Editor 切换为 Vditor 所见即所得编辑。 |

## 文档健康检查

文档健康检查已经合并到 Super Markdown Editor 侧边面板和 `Super Markdown：整理 Markdown`。分享或发布文档前，运行整理命令即可同时看到健康报告。

它会检查：

- 缺少 H1 标题。
- 标题层级跳跃。
- 生成目录已过期。
- 标题锚点重复。
- 本地链接或图片失效。
- 未完成任务数量。

## 安全整理

运行 `Super Markdown：整理 Markdown` 后，扩展会先生成整理结果和文档健康报告，并打开 diff。你可以检查每一处变化，再决定是否应用。

它可以帮助处理：

- 创建或更新生成目录。
- 规范列表和任务列表空格。
- 格式化简单 Markdown 表格。
- 在启用设置后添加或更新 H2-H6 章节编号。
- 复用 VS Code `Format Document` 的同一套格式化管线。

## 导出

可以运行 `Super Markdown：导出 PDF`、`导出 HTML`、`导出 PNG`、`导出 JPEG`、`导出全部格式` 或 `按设置导出`。

导出支持代码高亮、emoji、任务复选框、container blocks、include fragments、Mermaid 和可选 PlantUML。PDF 和图片导出通过 `puppeteer-core` 使用 Chrome/Chromium：优先使用你配置的路径，其次查找系统 Chrome/Edge/Chromium，最后下载托管 Chromium 到扩展 global storage。

PlantUML 默认关闭。启用远程 PlantUML server 后，图表内容会发送到你配置的服务。

## 常用命令

| 命令 | 用途 |
| --- | --- |
| `Super Markdown：打开编辑器` | 打开默认三栏 Markdown 工作台。 |
| `Super Markdown：打开原生编辑器` | 用 VS Code 原生编辑器重新打开文件。 |
| `Super Markdown：分屏编辑模式` | 左侧编辑源码，右侧同步预览。 |
| `Super Markdown：预览模式` | 打开渲染后的阅读视图。 |
| `Super Markdown：所见即所得模式` | 在 Super Markdown Editor 内使用所见即所得模式编辑。 |
| `Super Markdown：整理 Markdown` | 预览整理改动并查看文档健康报告。 |
| `Super Markdown：导出 PDF/HTML/PNG/JPEG/全部格式` | 导出当前 Markdown 文档。 |
| `Super Markdown：打开语法速查` | 打开内置 Markdown 语法速查。 |
| `Super Markdown：复制 Markdown 表格为 JSON` | 将选中的 Markdown 表格转换为 JSON。 |
| `Super Markdown：复制 JSON 为 Markdown 表格` | 将选中的 JSON 数组转换为 Markdown 表格。 |
| `Super Markdown：切换阅读主题` | 切换预览阅读主题。 |
| `Super Markdown：切换界面语言` | 切换 Super Markdown 界面语言。 |

## 设置

打开 VS Code 设置，搜索 `superMarkdown`。

| 设置 | 说明 |
| --- | --- |
| `superMarkdown.preview.theme` | 预览主题：`system`、`light`、`dark`、`sage`、`paper`、`ocean`、`ink` 或 `high-contrast`。旧主题值会自动迁移。 |
| `superMarkdown.preview.fontSize` | 预览基础字号，单位为像素。 |
| `superMarkdown.preview.maxWidth` | 预览正文最大宽度，单位为像素。 |
| `superMarkdown.toc.levels` | 大纲和生成目录包含的标题级别，例如 `1..6` 或 `2..4`。 |
| `superMarkdown.organize.updateTocOnSave` | 保存 Markdown 文件时更新生成目录。 |
| `superMarkdown.organize.numberHeadings` | 整理 Markdown 时添加或更新 H2-H6 章节编号。 |
| `superMarkdown.editor.defaultMode` | Super Markdown Editor 默认模式：`source`、`ir` 或 `wysiwyg`。 |
| `superMarkdown.format.*` | 配置标点、表格、列表、代码和时间头等格式化行为。 |
| `superMarkdown.wysiwyg.*` | 配置 Vditor 模式、图片目录、自定义 CSS 和编辑器主题。 |
| `superMarkdown.export.*` | 配置导出类型、输出目录、样式、Chromium、PDF、图片、include、Mermaid 和 PlantUML。 |
| `superMarkdown.syntaxTools.showMessages` | 显示语法工具成功和失败提示。 |
| `superMarkdown.mermaid.enabled` | 在预览中渲染 Mermaid 代码块。 |
| `superMarkdown.katex.enabled` | 在预览中渲染 KaTeX 数学公式。 |
| `superMarkdown.displayLanguage` | Super Markdown 界面语言：`auto`、`zh-CN` 或 `en`。 |

## 当前限制

- Super Markdown 专注于 Markdown 文件。
- 预览链接检查仅覆盖能从当前文档解析到的本地链接和图片。
- 整理功能保持保守，会先打开 diff，再修改你的文档。
- PDF、PNG 和 JPEG 导出需要可用的 Chrome/Chromium，或下载托管 Chromium。

## 隐私

Super Markdown 默认在编辑器本地处理 Markdown 内容，不会把你的文档发送到远程服务。启用远程 PlantUML server 后，PlantUML 图表内容会发送到你配置的服务。

## Bug 反馈

- 提交地址：<https://github.com/SivanCola/super-markdown/issues>

## 许可证

Super Markdown 使用 Apache License, Version 2.0 授权。详见 [LICENSE](LICENSE)。第三方 MIT 来源说明见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
