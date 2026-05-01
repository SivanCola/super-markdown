# Super Markdown 语法指南

Super Markdown 使用自研 Markdown 核心完成编辑、预览和导出。

## 常用块

- 标题：`# H1` 到 `###### H6`
- 段落和引用：`> quoted text`
- 列表：`- item`、`1. item`，以及 `- [ ] task` 任务列表
- 使用管道行和分隔行编写表格
- 带语言标记的围栏代码块
- 使用 `---` 编写分割线
- 使用 `[^id]` 和 `[^id]: note` 编写脚注

## 富内容块

Mermaid 图表使用 `mermaid` 围栏代码块。KaTeX 数学公式支持 `$...$` 行内公式和 `$$` 块级公式。

## 导出

HTML、PDF、PNG 和 JPEG 导出与预览使用同一套 Super Markdown 渲染器。Mermaid 和 KaTeX 是当前保留的专用渲染引擎。
