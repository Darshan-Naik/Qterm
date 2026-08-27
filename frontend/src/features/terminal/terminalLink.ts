export type TerminalLink =
  | { kind: "url"; href: string }
  | { kind: "file"; path: string };

/** Parse a terminal hyperlink into something Qterm can open safely. */
export function resolveTerminalLink(uri: string): TerminalLink | null {
  const trimmed = uri.trim();
  if (!trimmed) return null;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }
  switch (parsed.protocol) {
    case "http:":
    case "https:":
    case "mailto:":
      return { kind: "url", href: parsed.href };
    case "file:": {
      const path = fileURLToPath(parsed);
      return path ? { kind: "file", path } : null;
    }
    default:
      return null;
  }
}

function fileURLToPath(url: URL): string {
  if (url.protocol !== "file:") return "";
  const path = decodeURIComponent(url.pathname);
  // file:///Users/foo → /Users/foo; file://localhost/Users/foo → same
  if (url.hostname && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    return "";
  }
  return path;
}
