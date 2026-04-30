import * as fs from "node:fs";
import * as path from "node:path";
import * as puppeteerBrowsers from "@puppeteer/browsers";
import puppeteer from "puppeteer-core";

export function findChromiumFromUserSetting(executablePath: string): string | undefined {
  if (!executablePath) {
    return undefined;
  }
  return fs.existsSync(executablePath) ? executablePath : undefined;
}

export function findChromiumFromSystem(): string | undefined {
  try {
    return puppeteerBrowsers.computeSystemExecutablePath({
      browser: puppeteerBrowsers.Browser.CHROME,
      channel: puppeteerBrowsers.ChromeReleaseChannel.STABLE,
      platform: puppeteerBrowsers.detectBrowserPlatform()
    });
  } catch {
    // Fall through to manual candidates.
  }

  return getChromiumCandidates().find((candidate) => fs.existsSync(candidate));
}

export function getChromiumCandidates(): string[] {
  if (process.platform === "darwin") {
    return [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"
    ];
  }
  if (process.platform === "win32") {
    const roots = [
      process.env.LOCALAPPDATA,
      process.env.PROGRAMFILES,
      process.env["PROGRAMFILES(X86)"],
      "C:\\Program Files",
      "C:\\Program Files (x86)"
    ].filter(Boolean) as string[];
    return roots.flatMap((root) => [
      path.win32.join(root, "Google", "Chrome", "Application", "chrome.exe"),
      path.win32.join(root, "Microsoft", "Edge", "Application", "msedge.exe")
    ]);
  }
  if (process.platform === "linux") {
    return [
      "/usr/bin/google-chrome",
      "/usr/bin/google-chrome-stable",
      "/usr/bin/chromium",
      "/usr/bin/chromium-browser",
      "/usr/bin/microsoft-edge",
      "/usr/bin/microsoft-edge-stable"
    ];
  }
  return [];
}

export async function resolveChromiumPath(
  userExecutablePath: string,
  cacheDir: string,
  onProgress?: (downloadedBytes: number, totalBytes: number) => void
): Promise<string | undefined> {
  const configured = findChromiumFromUserSetting(userExecutablePath);
  if (configured) {
    return configured;
  }

  const system = findChromiumFromSystem();
  if (system) {
    return system;
  }

  const buildId = (puppeteer as unknown as { PUPPETEER_REVISIONS: { chrome: string } }).PUPPETEER_REVISIONS.chrome;
  const platform = puppeteerBrowsers.detectBrowserPlatform();
  if (!platform) {
    return undefined;
  }

  try {
    const executablePath = puppeteerBrowsers.computeExecutablePath({
      browser: puppeteerBrowsers.Browser.CHROME,
      buildId,
      cacheDir,
      platform
    });
    if (fs.existsSync(executablePath)) {
      return executablePath;
    }
  } catch {
    // Download below.
  }

  fs.mkdirSync(cacheDir, { recursive: true });
  const browser = await puppeteerBrowsers.install({
    browser: puppeteerBrowsers.Browser.CHROME,
    buildId,
    cacheDir,
    platform,
    downloadProgressCallback: onProgress
  });
  return browser.executablePath;
}
