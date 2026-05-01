import { SuperMarkdownEditorLayout, WysiwygMode } from "../types";

export function resolveWysiwygDefaultMode(editorMode: string | undefined, configuredWysiwygMode?: string): WysiwygMode {
  if (isWysiwygMode(configuredWysiwygMode)) {
    return normalizeEditorMode(configuredWysiwygMode);
  }
  if (editorMode === "source") {
    return "source";
  }
  if (isWysiwygMode(editorMode)) {
    return normalizeEditorMode(editorMode);
  }
  return "source";
}

export function isWysiwygMode(value: string | undefined): value is WysiwygMode {
  return value === "sv" || value === "ir" || value === "source" || value === "split" || value === "preview" || value === "wysiwyg";
}

export function normalizeEditorMode(value: unknown): WysiwygMode {
  if (value === "wysiwyg" || value === "ir") {
    return "wysiwyg";
  }
  if (value === "preview") {
    return "preview";
  }
  if (value === "split") {
    return "split";
  }
  return "source";
}

export function normalizeEditorLayout(value: unknown): SuperMarkdownEditorLayout {
  return value === "workbench" || value === "editorOnly" || value === "splitEdit" || value === "previewOnly"
    ? value
    : "workbench";
}
