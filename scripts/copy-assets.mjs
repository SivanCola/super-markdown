import { cp, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const assets = [
  {
    from: "node_modules/mermaid/dist/mermaid.min.js",
    to: "media/vendor/mermaid/mermaid.min.js"
  },
  {
    from: "node_modules/katex/dist/katex.min.css",
    to: "media/vendor/katex/katex.min.css"
  },
  {
    from: "node_modules/katex/dist/katex.min.js",
    to: "media/vendor/katex/katex.min.js"
  },
  {
    from: "node_modules/katex/dist/fonts",
    to: "media/vendor/katex/fonts"
  },
  {
    from: "node_modules/@vscode/codicons/dist/codicon.css",
    to: "media/vendor/codicons/codicon.css"
  },
  {
    from: "node_modules/@vscode/codicons/dist/codicon.ttf",
    to: "media/vendor/codicons/codicon.ttf"
  }
];

for (const asset of assets) {
  const source = resolve(root, asset.from);
  const target = resolve(root, asset.to);
  await mkdir(dirname(target), { recursive: true });
  await cp(source, target, { recursive: true, force: true });
}
