# Super Markdown 开发命令速查

这份文档只面向本地开发和 CI 维护，不是用户使用说明。插件市场发布内容以 `package.json` 里的 `files` 白名单为准，测试目录、Playwright 配置和本地开发产物不会作为运行时代码打进 VSIX。

## 常用命令

| 命令 | 作用 | 主要产物 / 备注 |
| --- | --- | --- |
| `npm install` | 安装项目依赖。首次克隆仓库或依赖变化后运行。 | 写入 `node_modules/`。 |
| `npm run compile` | 用 TypeScript 编译 `src/**`。 | 写入 `out/**`，用于 Mocha 单测和 extension host 运行。 |
| `npm run watch` | 持续运行 TypeScript 编译监听。 | 适合边改边看类型错误。 |
| `npm run lint` | 运行 ESLint。 | 小改动优先跑这个，能发现未使用变量、风格和 TypeScript lint 问题。 |
| `npm test` | 运行现有 Node/Mocha 单元测试。 | 会先执行 `npm run compile`，再跑 `out/test/**/*.test.js`。 |
| `npm run test:webview-toolbar` | 自动测试 Webview 工具栏按钮。 | 会先执行 `npm run bundle:webview`，再用 Playwright 在 Chromium 中测试双屏模式和所见即所得模式。 |

## 构建命令

| 命令 | 作用 | 主要产物 / 备注 |
| --- | --- | --- |
| `npm run bundle:extension` | 单独打包 VS Code extension host 入口。 | 写入 `out/extension.js` 和 sourcemap。 |
| `npm run bundle:webview` | 单独打包 Webview 运行时代码。 | 把 `media/wysiwyg/editor-runtime.ts` 打包成 `media/wysiwyg/editor.js` 和 sourcemap。改工具栏、双屏、所见即所得、Webview 交互后通常要跑。 |
| `npm run bundle` | 同时打包 extension host 和 Webview。 | 等价于 `bundle:extension + bundle:webview`。 |
| `npm run copy-assets` | 复制第三方静态资源到 `media/vendor/**`。 | 复制 Mermaid、KaTeX CSS/JS/字体等资源。依赖或资源路径变化后需要跑。 |
| `npm run build` | 完整开发构建。 | 依次执行 `compile`、`bundle`、`copy-assets`。 |
| `npm run vscode:prepublish` | VS Code 打包前预构建钩子。 | 当前等价于 `npm run build`，`vsce package` 会自动执行。 |

## 本地调试和打包

| 命令 | 作用 | 主要产物 / 备注 |
| --- | --- | --- |
| `npm run dev:host` | 启动 VS Code Extension Development Host。 | 会先运行 `npm run build`，生成 `.dev/super-markdown-test.md` 测试文档，并打开一个隔离的 VS Code 开发窗口。 |
| `npm run package:vsix` | 生成本地可安装 VSIX。 | 写入 `dist/super-markdown.vsix`。只有涉及 `package.json`、依赖、资产复制、VSIX 白名单、发布内容，或需要最终交付包时再跑。 |
| `npm run package` | `package:vsix` 的别名。 | 方便习惯性使用 `npm run package`。 |

## 发布相关命令

| 命令 | 作用 | 备注 |
| --- | --- | --- |
| `npm run openvsx:create-namespace` | 在 Open VSX 创建 publisher namespace。 | 通常只需要初始化时执行。 |
| `npm run openvsx:verify-token` | 验证 Open VSX token。 | 发布前检查凭据是否可用。 |
| `npm run openvsx:publish` | 发布到 Open VSX。 | 使用 `--skip-duplicate`，重复版本会跳过。 |

## 推荐验证节奏

- 改纯 TypeScript 逻辑：优先跑 `npm run lint` 和相关 `npm test`。
- 改 Markdown 解析、渲染、导出：跑 `npm run lint`、`npm test`，必要时跑 `npm run build`。
- 改 Webview、工具栏、双屏、所见即所得：跑 `npm run lint`、`npm test`、`npm run test:webview-toolbar`。
- 需要真实 VS Code 交互确认时：跑 `npm run dev:host`。
- 需要确认最终安装包内容时：跑 `npm run package:vsix`，不要每次普通代码改动都打包。

## Playwright 工具栏测试说明

`npm run test:webview-toolbar` 是开发测试工具，主要验证：

- 双屏模式下，点击工具栏按钮后 `textarea` 中的 Markdown 是否变化。
- 所见即所得模式下，Milkdown 编辑器是否产生正确的 Markdown 更新消息。
- 目录、整理、帮助、导出等按钮是否发出正确的 host message。
- 图片按钮是否能触发文件选择器。
- 新增工具栏 action 后，如果测试矩阵没有补期望结果，会直接失败，防止漏测。

首次在新机器或 CI 环境运行 Playwright 前，可能需要先安装浏览器：

```bash
npx playwright install chromium
```

Playwright 浏览器安装在用户级缓存中，不属于仓库文件，也不会进入 VSIX。

## 产物和发布边界

- `out/**`：TypeScript 编译和 extension host bundle 产物。
- `media/wysiwyg/editor.js`：Webview bundle，插件运行需要。
- `media/vendor/**`：复制后的 Mermaid、KaTeX 等静态资源，插件运行需要。
- `.dev/**`：本地调试和 Playwright 输出目录，不应提交为发布内容。
- `dist/super-markdown.vsix`：本地打包产物，不应作为普通源码改动的一部分频繁生成。
- `test/**`、`playwright.webview.config.ts`：开发测试资产，保留在仓库中，但不进入插件市场运行时代码。
