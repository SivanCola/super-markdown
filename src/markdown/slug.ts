export function baseSlug(text: string): string {
  const withoutMarkup = text
    .replace(/<[^>]+>/g, "")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[`*_~]/g, "")
    .trim()
    .toLowerCase();

  const slug = withoutMarkup
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return slug || "section";
}

export class GithubSlugger {
  private readonly counts = new Map<string, number>();

  slug(text: string): string {
    const base = baseSlug(text);
    const previous = this.counts.get(base) ?? 0;
    this.counts.set(base, previous + 1);
    return previous === 0 ? base : `${base}-${previous}`;
  }
}

export function slugifyHeadings(texts: string[]): string[] {
  const slugger = new GithubSlugger();
  return texts.map((text) => slugger.slug(text));
}
