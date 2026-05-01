import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const vsixPath = resolve(process.argv[2] || "dist/super-markdown.vsix");

if (!existsSync(vsixPath)) {
  console.error(`VSIX not found: ${vsixPath}`);
  console.error("Run `npm run package:vsix` before verifying packaged contents.");
  process.exit(1);
}

const listing = execFileSync("unzip", ["-l", vsixPath], { encoding: "utf8" });
const entries = listing
  .split(/\r?\n/)
  .map((line) => line.trim().split(/\s+/).slice(3).join(" "))
  .filter((entry) => entry.startsWith("extension/"));

const forbiddenPatterns = [
  /^extension\/test\//,
  /^extension\/playwright\.webview\.config\.ts$/,
  /^extension\/\.dev\//,
  /^extension\/media\/.*\.map$/,
  /^extension\/media\/.*\.ts$/,
  /^extension\/out\/.*\.map$/,
  /^extension\/node_modules\/(?:@playwright|playwright|playwright-core)\//
];

const forbiddenEntries = entries.filter((entry) => forbiddenPatterns.some((pattern) => pattern.test(entry)));

const packagedManifest = execFileSync("unzip", ["-p", vsixPath, "extension/package.json"], { encoding: "utf8" });
const manifest = JSON.parse(packagedManifest);
const runtimeDeps = manifest.dependencies || {};

if (runtimeDeps["@playwright/test"] || runtimeDeps.playwright || runtimeDeps["playwright-core"]) {
  forbiddenEntries.push("extension/package.json runtime dependencies include Playwright");
}

const requiredEntries = [
  "extension/media/vendor/codicons/codicon.css",
  "extension/media/vendor/codicons/codicon.ttf"
];
const missingEntries = requiredEntries.filter((entry) => !entries.includes(entry));

if (forbiddenEntries.length > 0) {
  console.error("VSIX content check failed. Development-only test assets were packaged:");
  for (const entry of forbiddenEntries) {
    console.error(`- ${entry}`);
  }
  process.exit(1);
}

if (missingEntries.length > 0) {
  console.error("VSIX content check failed. Required runtime assets were not packaged:");
  for (const entry of missingEntries) {
    console.error(`- ${entry}`);
  }
  process.exit(1);
}

console.log("VSIX content check passed: runtime assets are present and no development tests, Playwright runtime code, sourcemaps, or media TypeScript sources were packaged.");
