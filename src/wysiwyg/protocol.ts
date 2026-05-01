import type { Heading } from "../types";

export interface WebviewPreviewState {
  html: string;
  markdown: string;
  headings: Array<Pick<Heading, "level" | "text" | "slug" | "line">>;
}

export interface ImageResource {
  source: string;
  resolved: string;
}
