import { WysiwygMode } from "../types";

export function resolveWysiwygDefaultMode(editorMode: string | undefined, configuredWysiwygMode?: string): WysiwygMode {
  if (isWysiwygMode(configuredWysiwygMode)) {
    return configuredWysiwygMode;
  }
  if (editorMode === "source") {
    return "sv";
  }
  if (isWysiwygMode(editorMode)) {
    return editorMode;
  }
  return "sv";
}

function isWysiwygMode(value: string | undefined): value is WysiwygMode {
  return value === "sv" || value === "ir" || value === "wysiwyg";
}
