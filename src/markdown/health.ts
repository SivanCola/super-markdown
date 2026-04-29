import { DocumentIssue } from "../types";
import { extractHeadings } from "./outline";
import { baseSlug } from "./slug";
import { isTocStale } from "./toc";

export interface HealthOptions {
  levels: Set<number>;
  fileExists?: (target: string) => Promise<boolean>;
}

export async function analyzeMarkdownHealth(text: string, options: HealthOptions): Promise<DocumentIssue[]> {
  const issues: DocumentIssue[] = [];
  const headings = extractHeadings(text, { levels: new Set([1, 2, 3, 4, 5, 6]) });
  const h1Headings = headings.filter((heading) => heading.level === 1);

  if (h1Headings.length === 0) {
    issues.push({
      severity: "warning",
      code: "missing-h1",
      message: "Document has no H1 heading."
    });
  }

  for (let index = 1; index < headings.length; index += 1) {
    const previous = headings[index - 1];
    const current = headings[index];
    if (current.level > previous.level + 1) {
      issues.push({
        severity: "warning",
        code: "skipped-heading-level",
        message: `Heading jumps from H${previous.level} to H${current.level}.`,
        line: current.line
      });
    }
  }

  const slugCounts = new Map<string, number[]>();
  for (const heading of headings) {
    const base = baseSlug(heading.text);
    slugCounts.set(base, [...(slugCounts.get(base) ?? []), heading.line]);
  }

  for (const [slug, lines] of slugCounts) {
    if (lines.length > 1) {
      issues.push({
        severity: "warning",
        code: "duplicate-anchor",
        message: `Duplicate heading anchor base "${slug}" appears ${lines.length} times.`,
        line: lines[1],
        target: slug
      });
    }
  }

  if (isTocStale(text, options.levels)) {
    issues.push({
      severity: "warning",
      code: "stale-toc",
      message: "Table of contents is out of date."
    });
  }

  const uncheckedTasks = countUncheckedTasks(text);
  if (uncheckedTasks > 0) {
    issues.push({
      severity: "info",
      code: "unchecked-tasks",
      message: `${uncheckedTasks} unchecked task${uncheckedTasks === 1 ? "" : "s"} found.`
    });
  }

  if (options.fileExists) {
    const linkIssues = await findBrokenLocalTargets(text, options.fileExists);
    issues.push(...linkIssues);
  }

  return issues;
}

export function countUncheckedTasks(text: string): number {
  return text.split(/\r?\n/).filter((line) => /^\s*[-*+]\s+\[\s\]\s+/.test(line)).length;
}

export function formatIssuesMarkdown(issues: DocumentIssue[], title: string): string {
  if (issues.length === 0) {
    return `# ${title}\n\nNo document health issues found.\n`;
  }

  const lines = [`# ${title}`, ""];
  for (const issue of issues) {
    const lineLabel = issue.line === undefined ? "" : ` on line ${issue.line + 1}`;
    lines.push(`- **${issue.severity.toUpperCase()}** ${issue.code}${lineLabel}: ${issue.message}`);
  }
  lines.push("");
  return lines.join("\n");
}

async function findBrokenLocalTargets(
  text: string,
  fileExists: (target: string) => Promise<boolean>
): Promise<DocumentIssue[]> {
  const issues: DocumentIssue[] = [];
  const lines = text.split(/\r?\n/);
  const linkPattern = /(!?)\[([^\]]*)\]\(([^)\s]+)(?:\s+["'][^"']+["'])?\)/g;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    let match: RegExpExecArray | null;
    while ((match = linkPattern.exec(line)) !== null) {
      const isImage = match[1] === "!";
      const target = normalizeTarget(match[3]);
      if (!target || shouldSkipTarget(target)) {
        continue;
      }

      const exists = await fileExists(stripHashAndQuery(target));
      if (!exists) {
        issues.push({
          severity: "error",
          code: isImage ? "broken-image" : "broken-link",
          message: `${isImage ? "Image" : "Link"} target not found: ${target}`,
          line: lineIndex,
          target
        });
      }
    }
  }

  return issues;
}

function normalizeTarget(target: string): string {
  return target.trim().replace(/^</, "").replace(/>$/, "");
}

function shouldSkipTarget(target: string): boolean {
  return (
    target.startsWith("#") ||
    target.startsWith("data:") ||
    /^[a-z][a-z\d+.-]*:/i.test(target)
  );
}

function stripHashAndQuery(target: string): string {
  return target.split("#")[0].split("?")[0];
}
