import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as http from "node:http";
import * as net from "node:net";
import * as os from "node:os";
import * as path from "node:path";
import { spawn, ChildProcess } from "node:child_process";
import { ExportSettings, ExportType } from "../types";
import { pathToFileUrl } from "./utils";

interface DevToolsTarget {
  type: string;
  webSocketDebuggerUrl?: string;
}

interface CdpMessage {
  id?: number;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { message?: string };
}

interface PdfPrintOptions extends Record<string, unknown> {
  printBackground: boolean;
  landscape: boolean;
  displayHeaderFooter: boolean;
  headerTemplate: string;
  footerTemplate: string;
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  marginLeft: number;
  paperWidth?: number;
  paperHeight?: number;
}

interface SpawnedBrowser {
  child: ChildProcess;
  output(): string;
}

const PDF_PAPER_SIZES_INCHES: Record<string, { paperWidth: number; paperHeight: number }> = {
  a0: { paperWidth: 33.11, paperHeight: 46.81 },
  a1: { paperWidth: 23.39, paperHeight: 33.11 },
  a2: { paperWidth: 16.54, paperHeight: 23.39 },
  a3: { paperWidth: 11.69, paperHeight: 16.54 },
  a4: { paperWidth: 8.27, paperHeight: 11.69 },
  a5: { paperWidth: 5.83, paperHeight: 8.27 },
  a6: { paperWidth: 4.13, paperHeight: 5.83 },
  letter: { paperWidth: 8.5, paperHeight: 11 },
  legal: { paperWidth: 8.5, paperHeight: 14 },
  tabloid: { paperWidth: 11, paperHeight: 17 },
  ledger: { paperWidth: 17, paperHeight: 11 }
};

export function findChromiumFromUserSetting(executablePath: string): string | undefined {
  if (!executablePath) {
    return undefined;
  }
  return fs.existsSync(executablePath) ? executablePath : undefined;
}

export function findChromiumFromSystem(): string | undefined {
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

export function resolveChromiumPath(userExecutablePath: string): string | undefined {
  return findChromiumFromUserSetting(userExecutablePath) ?? findChromiumFromSystem();
}

export async function exportHtmlWithChromium(
  executablePath: string,
  html: string,
  output: string,
  type: Exclude<ExportType, "html">,
  settings: ExportSettings
): Promise<void> {
  const tempRoot = await fsp.mkdtemp(path.join(os.tmpdir(), "super-markdown-export-"));
  const htmlPath = path.join(tempRoot, "document.html");
  const profilePath = path.join(tempRoot, "profile");
  await fsp.mkdir(profilePath, { recursive: true });
  await fsp.writeFile(htmlPath, html, "utf8");

  const port = await getAvailableLocalPort();
  const browser = spawnBrowser(executablePath, profilePath, port);
  try {
    await waitForDevTools(port, browser);
    const target = await getPageTarget(port);
    if (!target.webSocketDebuggerUrl) {
      throw new Error("Chrome DevTools target unavailable.");
    }
    const client = await CdpClient.connect(target.webSocketDebuggerUrl);
    try {
      await client.send("Page.enable");
      await client.send("Runtime.enable");
      const load = client.waitForEvent("Page.loadEventFired", 15000);
      await client.send("Page.navigate", { url: pathToFileUrl(htmlPath) });
      await load.catch(() => undefined);
      await client.send("Runtime.evaluate", {
        expression: "document.fonts && document.fonts.ready",
        awaitPromise: true
      }).catch(() => undefined);

      if (type === "pdf") {
        const result = await client.send("Page.printToPDF", buildPdfPrintOptions(settings)) as { data?: string };
        await fsp.writeFile(output, Buffer.from(result.data ?? "", "base64"));
      } else {
        const result = await client.send("Page.captureScreenshot", {
          format: type === "jpeg" ? "jpeg" : "png",
          quality: type === "jpeg" ? settings.image.quality : undefined,
          captureBeyondViewport: settings.image.fullPage,
          omitBackground: settings.image.omitBackground,
          clip: settings.image.clip
        }) as { data?: string };
        await fsp.writeFile(output, Buffer.from(result.data ?? "", "base64"));
      }
    } finally {
      client.dispose();
    }
  } finally {
    browser.child.kill();
    await fsp.rm(tempRoot, { recursive: true, force: true });
  }
}

export function buildChromeLaunchArgs(profilePath: string, port: number): string[] {
  return [
    "--headless=new",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--no-first-run",
    "--no-default-browser-check",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profilePath}`,
    "about:blank"
  ];
}

function spawnBrowser(executablePath: string, profilePath: string, port: number): SpawnedBrowser {
  const chunks: Buffer[] = [];
  const child = spawn(executablePath, buildChromeLaunchArgs(profilePath, port), { stdio: ["ignore", "pipe", "pipe"] });
  child.stderr?.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
  child.stdout?.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
  return {
    child,
    output: () => Buffer.concat(chunks).toString("utf8").trim()
  };
}

async function getAvailableLocalPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => {
        if (typeof address === "object" && address) {
          resolve(address.port);
        } else {
          reject(new Error("Unable to allocate Chrome DevTools port."));
        }
      });
    });
  });
}

async function waitForDevTools(port: number, browser: SpawnedBrowser): Promise<void> {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    if (browser.child.exitCode !== null) {
      const output = browser.output();
      throw new Error(output ? `Chrome exited before DevTools was ready: ${output}` : "Chrome exited before DevTools was ready.");
    }
    try {
      await httpJson<unknown>(`http://127.0.0.1:${port}/json/version`);
      return;
    } catch {
      // Browser is still starting.
    }
    await delay(100);
  }
  const output = browser.output();
  throw new Error(output ? `Timed out waiting for Chrome DevTools: ${output}` : "Timed out waiting for Chrome DevTools.");
}

async function getPageTarget(port: number): Promise<DevToolsTarget> {
  const targets = await httpJson<DevToolsTarget[]>(`http://127.0.0.1:${port}/json/list`);
  const page = targets.find((target) => target.type === "page");
  if (!page) {
    throw new Error("No Chrome page target found.");
  }
  return page;
}

function httpJson<T>(url: string): Promise<T> {
  return new Promise((resolve, reject) => {
    http.get(url, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      response.on("end", () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")) as T);
        } catch (error) {
          reject(error);
        }
      });
    }).on("error", reject);
  });
}

class CdpClient {
  private nextId = 1;
  private readonly pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
  private readonly eventWaiters = new Map<string, Array<(message: CdpMessage) => void>>();
  private buffer = Buffer.alloc(0);

  private constructor(private readonly socket: net.Socket) {
    socket.on("data", (chunk) => this.readFrames(Buffer.from(chunk)));
    socket.on("error", (error) => {
      for (const waiter of this.pending.values()) {
        waiter.reject(error);
      }
      this.pending.clear();
    });
  }

  static async connect(wsUrl: string): Promise<CdpClient> {
    const url = new URL(wsUrl);
    const socket = net.connect(Number(url.port), url.hostname);
    await new Promise<void>((resolve, reject) => {
      socket.once("error", reject);
      socket.once("connect", resolve);
    });

    const key = crypto.randomBytes(16).toString("base64");
    const request = [
      `GET ${url.pathname}${url.search} HTTP/1.1`,
      `Host: ${url.host}`,
      "Upgrade: websocket",
      "Connection: Upgrade",
      `Sec-WebSocket-Key: ${key}`,
      "Sec-WebSocket-Version: 13",
      "",
      ""
    ].join("\r\n");
    socket.write(request);

    await new Promise<void>((resolve, reject) => {
      const chunks: Buffer[] = [];
      const onData = (chunk: Buffer) => {
        chunks.push(chunk);
        const data = Buffer.concat(chunks);
        const end = data.indexOf("\r\n\r\n");
        if (end === -1) {
          return;
        }
        socket.off("data", onData);
        const header = data.slice(0, end).toString("utf8");
        if (!/^HTTP\/1\.1 101/i.test(header)) {
          reject(new Error("Chrome DevTools WebSocket upgrade failed."));
          return;
        }
        const leftover = data.slice(end + 4);
        if (leftover.length > 0) {
          socket.unshift(leftover);
        }
        resolve();
      };
      socket.on("data", onData);
      socket.once("error", reject);
    });

    return new CdpClient(socket);
  }

  send(method: string, params?: Record<string, unknown>): Promise<unknown> {
    const id = this.nextId++;
    const message = JSON.stringify({ id, method, params });
    this.socket.write(encodeClientFrame(message));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
  }

  waitForEvent(method: string, timeoutMs: number): Promise<CdpMessage> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(`Timed out waiting for ${method}.`)), timeoutMs);
      const waiters = this.eventWaiters.get(method) ?? [];
      waiters.push((message) => {
        clearTimeout(timeout);
        resolve(message);
      });
      this.eventWaiters.set(method, waiters);
    });
  }

  dispose(): void {
    this.socket.end();
  }

  private readFrames(chunk: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (this.buffer.length >= 2) {
      const frame = decodeServerFrame(this.buffer);
      if (!frame) {
        return;
      }
      this.buffer = this.buffer.slice(frame.bytes);
      if (frame.opcode === 1) {
        this.handleMessage(frame.payload.toString("utf8"));
      }
    }
  }

  private handleMessage(raw: string): void {
    const message = JSON.parse(raw) as CdpMessage;
    if (message.id !== undefined) {
      const waiter = this.pending.get(message.id);
      if (!waiter) {
        return;
      }
      this.pending.delete(message.id);
      if (message.error) {
        waiter.reject(new Error(message.error.message ?? "Chrome DevTools command failed."));
      } else {
        waiter.resolve(message.result);
      }
      return;
    }
    if (message.method) {
      const waiters = this.eventWaiters.get(message.method) ?? [];
      this.eventWaiters.delete(message.method);
      waiters.forEach((waiter) => waiter(message));
    }
  }
}

function encodeClientFrame(value: string): Buffer {
  const payload = Buffer.from(value, "utf8");
  const mask = crypto.randomBytes(4);
  const header: number[] = [0x81];
  if (payload.length < 126) {
    header.push(0x80 | payload.length);
  } else if (payload.length < 65536) {
    header.push(0x80 | 126, (payload.length >> 8) & 0xff, payload.length & 0xff);
  } else {
    header.push(0x80 | 127, 0, 0, 0, 0, (payload.length >> 24) & 0xff, (payload.length >> 16) & 0xff, (payload.length >> 8) & 0xff, payload.length & 0xff);
  }
  const masked = Buffer.alloc(payload.length);
  for (let index = 0; index < payload.length; index += 1) {
    masked[index] = payload[index] ^ mask[index % 4];
  }
  return Buffer.concat([Buffer.from(header), mask, masked]);
}

function decodeServerFrame(buffer: Buffer): { opcode: number; payload: Buffer; bytes: number } | undefined {
  const first = buffer[0];
  const second = buffer[1];
  let offset = 2;
  let length = second & 0x7f;
  if (length === 126) {
    if (buffer.length < offset + 2) {
      return undefined;
    }
    length = buffer.readUInt16BE(offset);
    offset += 2;
  } else if (length === 127) {
    if (buffer.length < offset + 8) {
      return undefined;
    }
    const high = buffer.readUInt32BE(offset);
    const low = buffer.readUInt32BE(offset + 4);
    length = high * 2 ** 32 + low;
    offset += 8;
  }
  const masked = Boolean(second & 0x80);
  const maskLength = masked ? 4 : 0;
  if (buffer.length < offset + maskLength + length) {
    return undefined;
  }
  let payload = buffer.slice(offset + maskLength, offset + maskLength + length);
  if (masked) {
    const mask = buffer.slice(offset, offset + 4);
    payload = Buffer.from(payload.map((byte, index) => byte ^ mask[index % 4]));
  }
  return { opcode: first & 0x0f, payload, bytes: offset + maskLength + length };
}

export function buildPdfPrintOptions(settings: ExportSettings): PdfPrintOptions {
  return {
    printBackground: settings.pdf.printBackground,
    landscape: settings.pdf.landscape,
    displayHeaderFooter: settings.pdf.displayHeaderFooter,
    headerTemplate: settings.pdf.headerTemplate,
    footerTemplate: settings.pdf.footerTemplate,
    marginTop: cssLengthToInches(settings.pdf.margin.top),
    marginRight: cssLengthToInches(settings.pdf.margin.right),
    marginBottom: cssLengthToInches(settings.pdf.margin.bottom),
    marginLeft: cssLengthToInches(settings.pdf.margin.left),
    ...resolvePdfPaperSizeInches(settings.pdf.format)
  };
}

function cssLengthToInches(value: string): number {
  const match = value.trim().match(/^(\d+(?:\.\d+)?)(px|in|cm|mm)?$/);
  if (!match) {
    return 0.4;
  }
  const amount = Number(match[1]);
  const unit = match[2] ?? "px";
  if (unit === "in") {
    return amount;
  }
  if (unit === "cm") {
    return amount / 2.54;
  }
  if (unit === "mm") {
    return amount / 25.4;
  }
  return amount / 96;
}

function resolvePdfPaperSizeInches(format: string): { paperWidth?: number; paperHeight?: number } {
  const key = format.trim().toLowerCase().replace(/[\s_-]+/g, "");
  return PDF_PAPER_SIZES_INCHES[key] ?? PDF_PAPER_SIZES_INCHES.a4;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
