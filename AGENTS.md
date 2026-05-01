## 语言偏好

请尽量使用中文回复用户的问题和请求。除非用户明确要求英文，否则回复、解释和代码注释优先使用中文。

## 隐私保护

- 不要在代码、注释、文档或对话中透露用户的个人隐私信息（如真实姓名、邮箱、电话、地址等）。
- 项目公开标识 `SivanLiu`（VS Code 发布者）和 `SivanCola`（GitHub 用户名）是被允许的。
- 使用相对路径代替包含用户名的绝对路径。

## 验证和打包节奏

- 小范围代码或样式改动优先运行最小必要验证，例如 `node --check`、`npm run lint`、相关单元测试或 `npm test`。
- Webview / UI 改动需要至少运行 lint 和相关测试；需要确认真实交互时再启动 Extension Development Host 手测。
- 不要每次代码变动都生成新的 VSIX 包。
- 只有改动涉及 `package.json`、依赖、资产复制、VSIX 文件白名单、发布内容，或用户明确需要可安装包/最终交付时，才运行 `npm run build` 和 `npm run package:vsix`。

## Webview 样式命名约定

- 外层类型类名只做标识，不承载具体组件样式；例如 WYSIWYG 块外层使用 `visual-block-type-*`。
- 内层组件类名必须使用更具体的语义后缀，例如 `*-box`、`*-editor`、`*-input`、`*-preview`，避免与外层类型类名碰撞。

## Markdown 渲染模式一致性

- 如果预览模式、分屏模式、所见即所得模式中任何一个涉及 Markdown 渲染显示的变动，其它模式都要同步检查并适配，避免三种模式表现不一致。
