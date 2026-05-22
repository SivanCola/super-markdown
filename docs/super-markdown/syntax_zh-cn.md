# Super Markdown 语法指南

Super Markdown 使用自研 Markdown 核心连接源码编辑、分屏预览、所见即所得、文档整理和导出。下列语法会优先保持在预览、HTML、PDF、PNG 和 JPEG 导出中的一致表现。

## 支持范围速查

| 类型 | 语法 | 说明 |
| --- | --- | --- |
| 标题 | `#` 到 `######` | 自动生成 GitHub 风格锚点，并进入大纲和目录。 |
| 段落 | 普通文本 | 空行分隔段落；导出可用 `superMarkdown.export.breaks` 将换行转为 `<br>`。 |
| 引用 | `> quoted text` | 支持嵌套渲染，也支持 GitHub 风格提醒块。 |
| 列表 | `-`、`+`、`*`、`1.`、`1)` | 缩进形成嵌套列表，连续缩进行会并入上一项。 |
| 任务列表 | `- [ ] task`、`- [x] done` | 预览和导出显示为禁用复选框，文档健康检查会统计未完成任务。 |
| 表格 | 管道表格 | 支持左、中、右对齐，格式化器会按中英文宽度整理列宽。 |
| 代码 | ```` ```ts ````、`~~~sh` | 支持本地 Shiki 高亮、复制按钮和代码块颜色切换。 |
| 图表 | ```` ```mermaid ```` | 使用扩展内置 Mermaid 资源渲染。 |
| 数学公式 | `$...$`、`$$ ... $$` | 使用扩展内置 KaTeX 资源渲染。 |
| 脚注 | `[^id]`、`[^id]: note` | 引用会链接到文末脚注区；未定义脚注保持原文。 |
| 分割线 | `---`、`***`、`___` | 同一字符至少 3 个，可带最多 3 个前导空格。 |
| 图片和链接 | `[text](url)`、`![alt](path)` | 本地图片会按当前文档路径解析；危险协议会被拦截。 |

## 标题和目录

标题使用 ATX 写法：

```markdown
# 文档标题
## 章节
### 小节
```

标题文本会生成锚点，用于大纲、预览跳转和目录链接。重复标题会得到稳定的递增锚点；文档健康检查会提示重复锚点基名。

如需让某个标题不进入大纲和生成目录，在标题行加入：

```markdown
## 临时记录 <!-- omit from toc -->
```

`Super Markdown：整理 Markdown` 可以插入或更新由以下标记包裹的目录：

```markdown
<!-- super-markdown-toc -->
## Table of Contents

- [文档标题](#文档标题)
<!-- /super-markdown-toc -->
```

目录包含的标题级别由 `superMarkdown.toc.levels` 控制，例如 `1..6`、`2..4` 或 `2`。

## 段落、引用和提醒块

普通段落用空行分隔。引用块会继续按 Markdown 渲染内部内容：

```markdown
> 这里是引用。
> 可以包含 **强调**、链接和列表。
```

Super Markdown 支持 GitHub 风格提醒块：

```markdown
> [!NOTE]
> 适合补充说明。

> [!TIP]
> 适合操作建议。

> [!IMPORTANT]
> 适合必须注意的信息。

> [!WARNING]
> 适合潜在风险。

> [!CAUTION]
> 适合高风险或破坏性操作。
```

支持的类型是 `NOTE`、`TIP`、`IMPORTANT`、`WARNING` 和 `CAUTION`。

## 列表和任务

无序列表支持 `-`、`+`、`*`，有序列表支持 `1.` 和 `1)`：

```markdown
- 一级项目
  - 二级项目
    continuation line
1. 第一步
2. 第二步
```

任务列表使用 `[ ]` 和 `[x]`：

```markdown
- [ ] 待处理
- [x] 已完成
```

格式化器可以规范列表标记、任务列表空格和有序列表编号宽度；整理命令会先展示 diff，再应用修改。

## 表格

使用管道行和分隔行创建表格：

```markdown
| 名称 | 数量 | 状态 |
| :--- | ---: | :---: |
| 苹果 | 12 | ok |
| 梨 | 3 | check |
```

对齐规则：

| 写法 | 对齐 |
| --- | --- |
| `---` | 默认 |
| `:---` | 左对齐 |
| `---:` | 右对齐 |
| `:---:` | 居中 |

表格单元格中的 `\|` 会被识别为普通竖线，行内代码中的 `|` 不会拆分列。`Super Markdown：复制 Markdown 表格为 JSON` 和 `Super Markdown：复制 JSON 为 Markdown 表格` 可以在选区内做表格和 JSON 数组互转。

## 代码块

围栏代码块支持反引号和波浪线：

````markdown
```ts
const value = 1;
```

~~~sh
echo "hello"
~~~
````

当前高亮语言包括 `css`、`go`、`html`、`js`、`jsx`、`json`、`md`、`python`、`sh`、`sql`、`text`、`tsx`、`ts` 和 `yaml`。常用别名会自动归一化，例如 `typescript` -> `ts`、`javascript` -> `js`、`shell`/`bash`/`zsh` -> `sh`、`markdown` -> `md`、`yml` -> `yaml`。未知语言会按 `text` 安全渲染。

预览和 HTML 导出中的代码块提供复制按钮；预览中还可以切换代码块的自动、浅色和深色配色。

## Mermaid 图表

Mermaid 图表使用 `mermaid` 围栏代码块：

````markdown
```mermaid
flowchart LR
  A[Write] --> B[Preview]
  B --> C[Export]
```
````

`superMarkdown.mermaid.enabled` 控制预览渲染；`superMarkdown.export.mermaid.enabled` 控制导出渲染。禁用时，Mermaid 内容会作为普通代码块显示，源码不会丢失。

## KaTeX 数学公式

行内公式使用 `$...$`：

```markdown
质能关系是 $E = mc^2$。
```

块级公式使用单独成行的 `$$` 包裹：

```markdown
$$
\int_0^1 x^2 dx = \frac{1}{3}
$$
```

`superMarkdown.katex.enabled` 控制预览渲染。导出会使用 KaTeX 样式和渲染结果，保证 PDF 和图片中的公式可读。

## 行内格式

| 语法 | 效果 |
| --- | --- |
| `` `code` `` | 行内代码 |
| `**bold**`、`__bold__` | 加粗 |
| `*em*`、`_em_` | 斜体 |
| `~~deleted~~` | 删除线 |
| `$x + y$` | 行内数学公式 |
| `[label](https://example.com "title")` | 链接 |
| `![alt](./images/demo.png "title")` | 图片 |
| `<u>text</u>` | 安全下划线 |
| `<mark>text</mark>` | 安全高亮 |
| `<kbd>Cmd</kbd>` | 键盘样式 |

链接和图片标题支持双引号、单引号和括号写法；路径中有空格时可使用尖括号：

```markdown
![本地图片](<./assets/local image.png> "图片标题")
[API 文档](./api.md '内部链接')
[参考](https://example.com/path(foo) (参考标题))
```

反斜杠可转义常见 Markdown 符号，例如 `\*`、`\[`、`\|`。

## 链接、图片和安全策略

相对路径、锚点、`http`、`https` 和 `mailto` 链接会正常保留。`javascript:`、`data:`、`file:`、`command:`、`vscode:` 等可执行或高风险协议会被替换为 `#`，避免预览和导出中执行不可信内容。

本地图片会以当前 Markdown 文件所在目录为基准解析。导出 HTML 时，本地图片路径会改写为相对导出文件的位置；导出 PDF、PNG 和 JPEG 时会转为文件 URL 供 Chromium 渲染。

## 脚注

脚注引用和定义写法如下：

```markdown
Super Markdown 支持脚注[^render]。

[^render]: 脚注内容可以包含 **行内 Markdown**。
```

当前脚注定义按单行解析。引用找不到定义时会保留 `[^id]` 原文，避免生成失效链接。

## Front Matter 和导出

导出器会识别文档开头的简单 YAML Front Matter。`title` 会作为 HTML 标题和导出页面标题：

```markdown
---
title: API 使用说明
---

# API 使用说明
```

Front Matter 仅支持简单的 `key: value` 记录，值可以是字符串、数字或布尔值。渲染正文时会移除这段元数据。

## 整理、格式化和健康检查

`Super Markdown：整理 Markdown` 会先生成 diff，确认后再修改文档。它可以：

- 插入或更新 Super Markdown 目录。
- 规范列表、任务列表和表格排版。
- 在启用后更新 H2-H6 章节编号。
- 运行与 VS Code `Format Document` 一致的格式化管线。
- 输出文档健康报告。

文档健康检查会关注缺少 H1、标题层级跳跃、目录过期、重复锚点、本地链接或图片失效，以及未完成任务数量。

## 当前限制

- Super Markdown 语法核心专注于 Markdown 文件，不执行任意 HTML 或脚本。
- 安全内联 HTML 仅保留 `<u>`、`<mark>` 和 `<kbd>`；其它 HTML 会作为惰性源码显示或被转义。
- 脚注定义当前按单行处理。
- 代码高亮使用内置语言集合；未知语言按纯文本处理。
- PDF、PNG 和 JPEG 导出需要可用的 Chrome、Edge 或 Chromium。
