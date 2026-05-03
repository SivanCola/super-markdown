# Changelog

## 0.1.2

- Added a Webview toolbar entry for switching Markdown reading themes from the editor.
- Expanded reading themes with Solarized, Rose, Lavender, Graphite, Forest, and Terminal options.
- Updated README theme documentation and added manifest/theme consistency coverage.

## 0.1.1

- Refined the README for extension users by removing development-focused notes from the main Marketplace page.
- Replaced README screenshots with fresh captures from a temporary VS Code Extension Development Host window.
- Kept the 0.1 editor release documentation focused on installation, editing modes, export, privacy, settings, and current limits.

## 0.1.0

- Promoted the Super Markdown Editor overhaul from `dev` to `main`.
- Rebuilt the default Markdown workbench around source, split preview, preview-only, and WYSIWYG modes sharing one document pipeline.
- Added the self-hosted Markdown parser and renderer for headings, links, lists, tables, footnotes, safe inline HTML, code blocks, KaTeX math, Mermaid diagrams, source-line mapping, formatting, document health, and export.
- Rebuilt WYSIWYG editing on Milkdown / ProseMirror with toolbar actions, editable tables/lists/math/code blocks, local image insertion, undo/redo, outline navigation, and Mermaid diagram previews.
- Added serialized Mermaid rendering across split preview, WYSIWYG, HTML export, PDF export, and image export.
- Added the Chromium/CDP export bridge, bundled runtime assets, VSIX content verification, and Playwright Webview toolbar regression coverage.

## 0.0.9

- Documented the Milkdown / ProseMirror boundary: WYSIWYG editing uses Milkdown / ProseMirror, while parsing, preview, formatting, and export continue to use Super Markdown's own Markdown pipeline.
- Added Playwright Webview toolbar coverage to CI for split and WYSIWYG modes.
- Added packaged VSIX content verification to keep development-only tests and Playwright runtime code out of the extension package.
- Expanded WYSIWYG automation coverage for richer editing scenarios.
- Updated the Marketplace icon with transparent corners and sharper small-size rendering.
- Removed unused screenshot SVG source files from packaged resources.

## 0.0.8

- Removed development and local VSIX packaging instructions from the user-facing README.
- Removed duplicate screenshots from the Chinese README section.

## 0.0.7

- Reworked the README into a single bilingual Marketplace-friendly page.
- Removed the separate Chinese README to avoid duplicated documentation.
- Standardized local VSIX packaging under `dist/` with `npm run package:vsix`.

## 0.0.6

- Fixed Marketplace and Open VSX README navigation links for the Chinese README and changelog.

## 0.0.5

- Changed the extension publisher namespace to `SivanLiu` for consistent Marketplace and Open VSX identity.

## 0.0.4

- Split the Chinese README into `README.zh-CN.md` so the default marketplace page opens in English.

## 0.0.3

- Refined the README for extension users and marketplace presentation.

## 0.0.2

- Added Open VSX CLI scripts, token verification, and release workflow publishing configuration.

## 0.0.1

- Initial Super Markdown extension scaffold.
- Added Markdown preview, split edit mode, and optional preview custom editor.
- Added floating outline navigation with heading search, active tracking, source-line sync, and resizable height.
- Added Markdown organize workflow with diff-before-apply behavior.
- Added document health checks.
- Added English and Simplified Chinese runtime UI switching.
- Added bundled local assets for syntax highlighting, Mermaid, and KaTeX rendering.
- Added Marketplace icon and Apache-2.0 licensing.
