# Super Markdown 核心优势目标

本文记录 Super Markdown 重构后的优势目标。项目以自研 Markdown 核心统一预览、导出、格式化和源码编辑体验，同时在所见即所得模式中引入 Milkdown / ProseMirror，复用成熟编辑器内核来提升可视化编辑稳定性。

## 1. 统一 Markdown 工作台

- 默认打开 Markdown 文件时进入 `Super Markdown Editor`。
- 工作台支持源码编辑、分屏编辑、预览阅读和所见即所得编辑。
- 源码、分屏、预览和所见即所得模式共享同一份 Markdown 文本，避免不同模式之间的状态漂移。
- 所见即所得模式由 Milkdown / ProseMirror 承担文档编辑、选区、撤销重做、表格和列表等复杂交互，项目负责 VS Code Webview 容器、工具栏、消息协议和资源同步。

## 2. 自研 Markdown 核心

- Markdown 解析、AST、序列化、HTML 渲染、源码行映射和基础代码高亮由项目内实现。
- 首版覆盖标题、段落、引用、列表、任务列表、表格、代码块、脚注、分割线、Mermaid 块和 KaTeX 公式块。
- Mermaid 和 KaTeX 作为专用语言渲染引擎保留，其他预览、导出和文档组织逻辑不依赖外部 Markdown 渲染插件。
- Milkdown / ProseMirror 只作为所见即所得编辑内核使用，不替代项目自研 Markdown 预览、导出和格式化核心。

## 3. 所见即所得编辑能力

- Milkdown / ProseMirror 提供接近文档编辑器的块级编辑体验，降低手写复杂富文本编辑器的维护成本。
- 所见即所得模式通过 Markdown 更新消息同步回 VS Code 文档，再由自研核心重新生成预览、大纲、源码行映射和导出内容。
- 图片资源、代码块操作、标题定位和滚动同步由项目侧桥接，保证可视化编辑和宿主预览使用一致的资源解析规则。
- 旧的 `ir`、`sv` 等可视化配置继续做兼容映射，统一落到当前 `source` / `split` / `preview` / `wysiwyg` 模式。

## 4. 完整导出链路

- HTML 导出使用自研渲染器。
- PDF、PNG、JPEG 导出调用用户本机 Chrome、Edge 或 Chromium，并通过轻量 CDP 通道完成打印和截图。
- 导出、预览和编辑器渲染使用同一套 Markdown 输出规则，减少样式、锚点和源码行映射差异。

## 5. 强工具栏

- 工具栏覆盖标题、粗体、斜体、删除线、行内代码、引用、列表、任务、链接、图片、表格、代码块、数学公式、Mermaid、分割线、目录、整理、帮助和导出。
- 分屏和源码模式下，工具栏直接插入      m'm或包裹 Markdown 片段。
- 所见即所得模式下，工具栏优先调用 Milkdown / ProseMirror 命令；对下划线、高亮、任务、数学公式、Mermaid 等能力使用项目侧 Markdown 插入补齐。
- 工具栏优先服务 Markdown 写作本身，不暴露第三方编辑器默认工具栏。

## 6. 主题和阅读体验

- 继续支持 `system`、`light`、`dark`、`sage`、`paper`、`ocean`、`ink`、`high-contrast` 阅读主题。
- 预览和导出保持清晰排版、表格样式、引用块、代码块和富内容块样式。
- 所见即所得区域使用项目 Webview 样式约束 Milkdown / ProseMirror DOM，尽量和预览阅读体验保持一致。

## 7. 自动化验证目标

- Markdown AST round-trip 保持稳定。
- 预览、分屏、所见即所得和导出使用一致的 heading slug、资源解析和源码行映射。
- 工具栏插入或生成的 Markdown 能被 自研核心正确解析和渲染。
- `npm run test:webview-toolbar` 覆盖双屏模式和所见即所得模式下每个工具栏按钮的可观察效果。
- Webview runtime、Milkdown bundle、KaTeX、Mermaid 和静态资源随扩展正确打包，但测试工具不进入 VSIX 运行时代码。

## 8. 后续建设检查清单

- Milkdown / ProseMirror 版本升级后，工具栏命令、Markdown 序列化和选区行为是否仍符合预期。
- 所见即所得生成的 Markdown 是否和源码模式工具栏插入结果保持语义一致。
- 预览、大纲、导出和所见即所得滚动定位是否继续共享稳定的源码行映射。
- 缺少系统浏览器时，PDF 和图片导出是否给出清晰提示。
- Mermaid、KaTeX、Milkdown runtime 和字体资源是否随扩展正确打包。
- README、配置文案、CHANGELOG、`development.md` 和测试是否同步描述自研核心与 Milkdown / ProseMirror 的职责边界。

