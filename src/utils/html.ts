export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/'/g, "&#39;");
}

export function escapeJsonForScript(json: string): string {
  return json.replace(/[<>&\u2028\u2029]/g, (character) => {
    switch (character) {
      case "<":
        return "\\u003c";
      case ">":
        return "\\u003e";
      case "&":
        return "\\u0026";
      case "\u2028":
        return "\\u2028";
      case "\u2029":
        return "\\u2029";
      default:
        return character;
    }
  });
}

export function safeInlineUrl(value: string): string {
  const url = String(value || "").trim();
  const scheme = extractUrlScheme(url);
  if (!scheme) {
    return url;
  }
  return ["http", "https", "mailto"].includes(scheme) ? url : "#";
}

function extractUrlScheme(url: string): string | undefined {
  const colonIndex = url.indexOf(":");
  if (colonIndex <= 0) {
    return undefined;
  }
  const rawScheme = url.slice(0, colonIndex);
  const normalized = Array.from(rawScheme)
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code > 0x20 && code !== 0x7f;
    })
    .join("")
    .toLowerCase();
  return /^[a-z][a-z0-9+.-]*$/.test(normalized) ? normalized : undefined;
}
