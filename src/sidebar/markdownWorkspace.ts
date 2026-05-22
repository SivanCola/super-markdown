import * as path from "node:path";
import { DocumentIssue } from "../types";
import { countUncheckedTasks } from "../markdown/health";
import { extractInlineLinks } from "../markdown/inline";
import { extractHeadings } from "../markdown/outline";

export const MARKDOWN_WORKSPACE_EXTENSIONS = [".md", ".markdown", ".mdown", ".mkdn"] as const;
export const MARKDOWN_WORKSPACE_EXCLUDED_DIRECTORIES = [".git", "node_modules", "out", "dist"] as const;

export interface MarkdownWorkspaceFileStats {
  headingCount: number;
  issueCount: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  uncheckedTaskCount: number;
  imageCount: number;
  linkCount: number;
  brokenImageCount: number;
  brokenLinkCount: number;
  staleToc: boolean;
}

export interface MarkdownWorkspaceFile {
  uriString: string;
  workspaceFolderName: string;
  relativePath: string;
  filename: string;
  title: string;
  stats: MarkdownWorkspaceFileStats;
  issues: DocumentIssue[];
  updatedAt: number;
}

export interface MarkdownWorkspaceSummary {
  fileCount: number;
  issueCount: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  uncheckedTaskCount: number;
  imageCount: number;
  linkCount: number;
  brokenImageCount: number;
  brokenLinkCount: number;
  staleTocFileCount: number;
}

export type MarkdownWorkspaceTreeNode =
  | {
      type: "workspace" | "directory";
      id: string;
      name: string;
      children: MarkdownWorkspaceTreeNode[];
    }
  | {
      type: "file";
      id: string;
      name: string;
      file: MarkdownWorkspaceFile;
      children: [];
    };

export function isMarkdownWorkspacePath(filename: string): boolean {
  return MARKDOWN_WORKSPACE_EXTENSIONS.includes(path.extname(filename).toLowerCase() as typeof MARKDOWN_WORKSPACE_EXTENSIONS[number]);
}

export function isExcludedMarkdownWorkspacePath(relativePath: string): boolean {
  const segments = normalizeRelativePath(relativePath).split("/").filter(Boolean);
  return segments.some((segment) => MARKDOWN_WORKSPACE_EXCLUDED_DIRECTORIES.includes(segment as typeof MARKDOWN_WORKSPACE_EXCLUDED_DIRECTORIES[number]));
}

export function analyzeMarkdownWorkspaceText(
  text: string,
  fallbackTitle: string,
  issues: readonly DocumentIssue[]
): { title: string; stats: MarkdownWorkspaceFileStats } {
  const headings = extractHeadings(text, { levels: new Set([1, 2, 3, 4, 5, 6]) });
  const h1 = headings.find((heading) => heading.level === 1);
  const firstHeading = h1 ?? headings[0];
  const resources = countMarkdownResources(text);
  const issueCounts = countIssues(issues);

  return {
    title: firstHeading?.text || fallbackTitle,
    stats: {
      headingCount: headings.length,
      issueCount: issues.length,
      ...issueCounts,
      uncheckedTaskCount: countUncheckedTasks(text),
      imageCount: resources.imageCount,
      linkCount: resources.linkCount,
      brokenImageCount: issues.filter((issue) => issue.code === "broken-image").length,
      brokenLinkCount: issues.filter((issue) => issue.code === "broken-link").length,
      staleToc: issues.some((issue) => issue.code === "stale-toc")
    }
  };
}

export function aggregateMarkdownWorkspaceSummary(files: readonly MarkdownWorkspaceFile[]): MarkdownWorkspaceSummary {
  return files.reduce<MarkdownWorkspaceSummary>(
    (summary, file) => ({
      fileCount: summary.fileCount + 1,
      issueCount: summary.issueCount + file.stats.issueCount,
      errorCount: summary.errorCount + file.stats.errorCount,
      warningCount: summary.warningCount + file.stats.warningCount,
      infoCount: summary.infoCount + file.stats.infoCount,
      uncheckedTaskCount: summary.uncheckedTaskCount + file.stats.uncheckedTaskCount,
      imageCount: summary.imageCount + file.stats.imageCount,
      linkCount: summary.linkCount + file.stats.linkCount,
      brokenImageCount: summary.brokenImageCount + file.stats.brokenImageCount,
      brokenLinkCount: summary.brokenLinkCount + file.stats.brokenLinkCount,
      staleTocFileCount: summary.staleTocFileCount + (file.stats.staleToc ? 1 : 0)
    }),
    {
      fileCount: 0,
      issueCount: 0,
      errorCount: 0,
      warningCount: 0,
      infoCount: 0,
      uncheckedTaskCount: 0,
      imageCount: 0,
      linkCount: 0,
      brokenImageCount: 0,
      brokenLinkCount: 0,
      staleTocFileCount: 0
    }
  );
}

export function buildMarkdownWorkspaceTree(
  files: readonly MarkdownWorkspaceFile[],
  options: { multiRoot: boolean }
): MarkdownWorkspaceTreeNode[] {
  const roots = new Map<string, MarkdownWorkspaceTreeNode>();

  for (const file of files) {
    const rootKey = options.multiRoot ? file.workspaceFolderName : "";
    const root = getOrCreateNode(roots, `workspace:${rootKey}`, rootKey, "workspace");
    let children = options.multiRoot ? root.children : getVirtualSingleRoot(roots).children;
    const segments = normalizeRelativePath(file.relativePath).split("/").filter(Boolean);

    for (const segment of segments.slice(0, -1)) {
      const id = `${root.id}/${segment}`;
      const directory = getOrCreateDirectoryNode(children, id, segment);
      children = directory.children;
    }

    const filename = segments[segments.length - 1] || file.filename;
    children.push({
      type: "file",
      id: `${root.id}/${file.relativePath}`,
      name: filename,
      file,
      children: []
    });
  }

  const nodes = options.multiRoot
    ? Array.from(roots.values())
    : getVirtualSingleRoot(roots).children;
  return sortTreeNodes(nodes);
}

export function normalizeRelativePath(value: string): string {
  return value.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+$/, "");
}

function countMarkdownResources(text: string): { imageCount: number; linkCount: number } {
  const links = text.split(/\r?\n/).flatMap((line) => extractInlineLinks(line));
  return {
    imageCount: links.filter((link) => link.image).length,
    linkCount: links.filter((link) => !link.image).length
  };
}

function countIssues(issues: readonly DocumentIssue[]): Pick<MarkdownWorkspaceFileStats, "errorCount" | "warningCount" | "infoCount"> {
  return {
    errorCount: issues.filter((issue) => issue.severity === "error").length,
    warningCount: issues.filter((issue) => issue.severity === "warning").length,
    infoCount: issues.filter((issue) => issue.severity === "info").length
  };
}

function getVirtualSingleRoot(roots: Map<string, MarkdownWorkspaceTreeNode>): MarkdownWorkspaceTreeNode {
  return getOrCreateNode(roots, "workspace:", "", "workspace");
}

function getOrCreateNode(
  nodes: Map<string, MarkdownWorkspaceTreeNode>,
  id: string,
  name: string,
  type: "workspace" | "directory"
): Extract<MarkdownWorkspaceTreeNode, { type: "workspace" | "directory" }> {
  const existing = nodes.get(id);
  if (existing && existing.type !== "file") {
    return existing;
  }

  const node: Extract<MarkdownWorkspaceTreeNode, { type: "workspace" | "directory" }> = {
    type,
    id,
    name,
    children: []
  };
  nodes.set(id, node);
  return node;
}

function getOrCreateDirectoryNode(
  children: MarkdownWorkspaceTreeNode[],
  id: string,
  name: string
): Extract<MarkdownWorkspaceTreeNode, { type: "workspace" | "directory" }> {
  const existing = children.find((child) => child.id === id);
  if (existing && existing.type !== "file") {
    return existing;
  }

  const node: Extract<MarkdownWorkspaceTreeNode, { type: "workspace" | "directory" }> = {
    type: "directory",
    id,
    name,
    children: []
  };
  children.push(node);
  return node;
}

function sortTreeNodes(nodes: MarkdownWorkspaceTreeNode[]): MarkdownWorkspaceTreeNode[] {
  return nodes
    .map((node) => node.type === "file" ? node : { ...node, children: sortTreeNodes(node.children) })
    .sort((a, b) => {
      if (a.type === "file" && b.type !== "file") {
        return 1;
      }
      if (a.type !== "file" && b.type === "file") {
        return -1;
      }
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });
}
