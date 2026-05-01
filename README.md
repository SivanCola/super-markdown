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

Markdown files now open in the Super Markdown Editor by default: a self-hosted Markdown workbench with outline navigation, source editing, block-based visual editing, and live preview. You can still use `Reopen With...` or `Super Markdown: Open Native Editor` whenever you need VS Code's native text editor.

Super Markdown keeps its own Markdown parser, renderer, source-line mapping, formatter, preview, and export pipeline. WYSIWYG mode uses Milkdown / ProseMirror as the visual editing engine for selection, history, tables, lists, and document-style editing, then syncs the result back into the same Markdown document pipeline.

## Screenshots

![Split edit mode with source, preview, and floating outline](images/screenshots/split-edit-mode.png)

![Document health checks and organize Markdown diff preview](images/screenshots/document-health.png)

## What's New

- The default Markdown experience is now the self-hosted Super Markdown Editor, with source, split preview, preview-only, and WYSIWYG modes sharing one document pipeline.
- Super Markdown now owns the core Markdown parser and renderer for headings, links, lists, tables, footnotes, safe inline HTML, code blocks, KaTeX math, Mermaid diagrams, source-line mapping, formatting, document health, and export.
- WYSIWYG mode has been rebuilt on Milkdown / ProseMirror with richer toolbar actions, editable tables/lists/math/code blocks, local image insertion, undo/redo, outline navigation, and Mermaid diagram previews that stay aligned with split preview rendering.
- Mermaid rendering is bundled locally and now runs through a shared serialized render path, so multiple diagrams render consistently in split preview, WYSIWYG, HTML export, PDF export, and image export.
- Export has a dedicated renderer and Chromium/CDP bridge for HTML, PDF, PNG, JPEG, and all-format output, with shared styles and bundled KaTeX/Mermaid assets.
- The built-in syntax guide moved under `docs/super-markdown/`, old grammar/snippet assets were removed, packaged assets are verified, and CI/release workflows now validate the built extension contents.
- Developer tooling now includes a richer dev host generator, Playwright webview toolbar coverage, VSIX content verification, and focused tests for parser, renderer, formatting, resources, export, WYSIWYG assets, and table tools.

## Highlights

- Open `.md`, `.markdown`, `.mdown`, and `.mkdn` files in the Super Markdown Editor by default.
- Use a self-hosted workbench with outline navigation, source editing, visual block editing, and live preview.
- Switch between source, split edit, preview, and WYSIWYG modes.
- Use Milkdown / ProseMirror-powered WYSIWYG editing while keeping Super Markdown's own Markdown parser, preview, formatter, and export output.
- Format Markdown through VS Code `Format Document` with Super Markdown as the default formatter.
- Export Markdown to HTML, PDF, PNG, JPEG, or all formats.
- Use Super Markdown's own parser, renderer, source-map output, and code highlighter for common Markdown workflows.
- Open a built-in Super Markdown syntax guide and convert Markdown tables to JSON or JSON arrays to Markdown tables.
- Navigate long documents with a floating H1-H6 outline, heading search, active tracking, and adjustable height.
- Click preview content to reveal the matching source line; move the source cursor to scroll the preview.
- Render code blocks with built-in syntax highlighting.
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
| `Super Markdown Editor` | Default Markdown workbench | Opens outline navigation, self-hosted editing, and live preview together. |
| `Split Edit Mode` | Writing and reviewing | Switches the Super Markdown Editor to source plus live preview. |
| `Preview Mode` | Reading | Switches the Super Markdown Editor to a focused rendered preview. |
| `WYSIWYG Mode` | Document-style writing | Switches the Super Markdown Editor to Milkdown / ProseMirror-powered block-based visual editing while syncing back to Markdown. |

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

Export supports headings, tables, task checkboxes, footnotes, code highlighting, Mermaid, and KaTeX. PDF and image export use your configured Chrome/Edge/Chromium path first, then a system Chrome/Edge/Chromium installation through a lightweight CDP bridge.

Export does not use the WYSIWYG editor DOM as its source. It renders from the current Markdown text through Super Markdown's own renderer, so source, preview, and export stay aligned.

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
| `superMarkdown.editor.defaultMode` | Default Super Markdown Editor mode: `source`, `split`, `preview`, or `wysiwyg`. |
| `superMarkdown.format.*` | Configure formatter behavior for punctuation, tables, lists, code, and time headers. |
| `superMarkdown.wysiwyg.*` | Deprecated compatibility settings for visual editor mode, image directory, custom CSS, and editor theme. |
| `superMarkdown.export.*` | Configure export type, output directory, styles, Chromium, PDF, image, and Mermaid. |
| `superMarkdown.syntaxTools.showMessages` | Show success and failure messages for syntax tools. |
| `superMarkdown.mermaid.enabled` | Render Mermaid fenced code blocks in the preview. |
| `superMarkdown.katex.enabled` | Render KaTeX math in the preview. |
| `superMarkdown.displayLanguage` | Super Markdown UI language: `auto`, `zh-CN`, or `en`. |

## Current Limits

- Super Markdown is focused on Markdown files.
- Preview link checks are limited to local links and images that can be resolved from the current document.
- Cleanup is intentionally conservative and opens a diff before changing your document.
- PDF, PNG, and JPEG export need a usable Chrome, Edge, or Chromium executable.
- WYSIWYG mode is powered by Milkdown / ProseMirror, so its Markdown serialization may differ in harmless formatting details from source-mode snippets, while preserving Markdown semantics.

## Privacy

Super Markdown processes Markdown content locally in the editor and does not send your documents to a remote service by default.

## Bug Reports

Report issues here: <https://github.com/SivanCola/super-markdown/issues>

## License

Super Markdown is licensed under the Apache License, Version 2.0. See [LICENSE](LICENSE).

---

<a id="简体中文"></a>

## 简体中文

Super Markdown 是一个面向 VS Code 的 Markdown 写作、阅读、整理和发布扩展，适合接口文档、产品说明、需求文档、知识库页面、项目文档和使用指南。

Markdown 文件现在会默认打开 `Super Markdown Editor`：它使用自研 Markdown 工作台，提供大纲导航、源码编辑、块级所见即所得编辑和实时预览。需要原生编辑器时，可以使用 `Reopen With...` 或 `Super Markdown：打开原生编辑器`。

Super Markdown 保留自研 Markdown 解析器、渲染器、源码行映射、格式化、预览和导出链路。所见即所得模式使用 Milkdown / ProseMirror 作为可视化编辑内核，负责选区、历史记录、表格、列表和文档式编辑，再把结果同步回同一份 Markdown 文档管线。

## 最新版亮点

- Markdown 默认体验已经切换到自研 Super Markdown Editor，源码、分屏预览、纯预览和所见即所得模式共用同一条文档管线。
- Super Markdown 现在自研核心 Markdown 解析和渲染能力，覆盖标题、链接、列表、表格、脚注、安全行内 HTML、代码块、KaTeX 数学公式、Mermaid 图表、源码行映射、格式化、文档健康检查和导出。
- 所见即所得模式基于 Milkdown / ProseMirror 重建，支持更完整的工具栏、可编辑表格/列表/数学公式/代码块、本地图片插入、撤销重做、大纲导航，并能像分屏预览一样渲染 Mermaid 图表。
- Mermaid 使用本地打包资源，并通过共享的串行渲染链路处理，多张图在分屏预览、所见即所得、HTML 导出、PDF 导出和图片导出中都能稳定渲染。
- 导出链路改为独立渲染器和 Chromium/CDP 桥接，支持 HTML、PDF、PNG、JPEG 和全部格式导出，并复用统一样式与本地 KaTeX/Mermaid 资源。
- 内置语法速查迁移到 `docs/super-markdown/`，旧语法高亮/片段资产已移除，打包内容会被脚本校验，CI 和发布流程也会验证扩展产物。
- 开发工具补充了更完整的 dev host 生成器、Playwright Webview 工具栏覆盖、VSIX 内容校验，以及解析器、渲染器、格式化、资源、导出、所见即所得资产和表格工具的专项测试。

## 功能亮点

- `.md`、`.markdown`、`.mdown`、`.mkdn` 默认使用 Super Markdown Editor 打开。
- 工作台同时提供大纲导航、源码编辑、块级可视化编辑和实时预览。
- 支持源码、分屏、预览和所见即所得模式。
- 所见即所得编辑由 Milkdown / ProseMirror 提供，同时继续使用 Super Markdown 自研 Markdown 解析、预览、格式化和导出结果。
- VS Code `Format Document` 默认使用 Super Markdown 格式化器。
- 支持导出 HTML、PDF、PNG、JPEG 或全部格式。
- 使用 Super Markdown 自研解析器、渲染器、源码行映射和代码高亮。
- 内置 Super Markdown 语法速查，并提供 Markdown 表格与 JSON 互转工具。
- 用 H1-H6 悬浮大纲管理长文档，支持标题搜索、当前标题高亮和高度调整。
- 点击预览内容可定位到源码行，移动源码光标也会同步滚动预览。
- 代码块支持内置语法高亮。
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
| `Super Markdown Editor` | 默认 Markdown 工作台 | 同时打开大纲导航、自研编辑器和实时预览。 |
| `分屏编辑模式` | 编写和审阅 | 将 Super Markdown Editor 切换为源码加实时预览。 |
| `预览模式` | 专注阅读 | 将 Super Markdown Editor 切换为专注渲染预览。 |
| `所见即所得模式` | 文档式写作 | 将 Super Markdown Editor 切换为基于 Milkdown / ProseMirror 的块级可视化编辑，并同步回 Markdown。 |

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

导出支持标题、表格、任务复选框、脚注、代码高亮、Mermaid 和 KaTeX。PDF 和图片导出优先使用你配置的 Chrome/Edge/Chromium 路径，其次查找系统 Chrome/Edge/Chromium，并通过轻量 CDP 通道完成打印和截图。

导出不会直接使用所见即所得编辑器 DOM，而是从当前 Markdown 文本经过 Super Markdown 自研渲染器生成，因此源码、预览和导出结果保持一致。

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
| `superMarkdown.editor.defaultMode` | Super Markdown Editor 默认模式：`source`、`split`、`preview` 或 `wysiwyg`。 |
| `superMarkdown.format.*` | 配置标点、表格、列表、代码和时间头等格式化行为。 |
| `superMarkdown.wysiwyg.*` | 为兼容保留的可视化编辑器模式、图片目录、自定义 CSS 和主题配置。 |
| `superMarkdown.export.*` | 配置导出类型、输出目录、样式、Chromium、PDF、图片和 Mermaid。 |
| `superMarkdown.syntaxTools.showMessages` | 显示语法工具成功和失败提示。 |
| `superMarkdown.mermaid.enabled` | 在预览中渲染 Mermaid 代码块。 |
| `superMarkdown.katex.enabled` | 在预览中渲染 KaTeX 数学公式。 |
| `superMarkdown.displayLanguage` | Super Markdown 界面语言：`auto`、`zh-CN` 或 `en`。 |

## 当前限制

- Super Markdown 专注于 Markdown 文件。
- 预览链接检查仅覆盖能从当前文档解析到的本地链接和图片。
- 整理功能保持保守，会先打开 diff，再修改你的文档。
- PDF、PNG 和 JPEG 导出需要可用的 Chrome、Edge 或 Chromium。
- 所见即所得模式基于 Milkdown / ProseMirror，其 Markdown 序列化在无害格式细节上可能与源码模式插入片段不同，但会保持 Markdown 语义。

## 隐私

Super Markdown 默认在编辑器本地处理 Markdown 内容，不会把你的文档发送到远程服务。

## Bug 反馈

- 提交地址：<https://github.com/SivanCola/super-markdown/issues>

## 许可证

Super Markdown 使用 Apache License, Version 2.0 授权。详见 [LICENSE](LICENSE)。
