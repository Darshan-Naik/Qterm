/** Quote a path for shell / CLI stdin — matches Go core.ShellQuote. */
export function shellQuote(s: string): string {
  if (!s) return "''";
  if (/^[-_./a-zA-Z0-9]+$/.test(s)) return s;
  return `'${s.replace(/'/g, `'\"'\"'`)}'`;
}

/** Space-joined quoted paths with a trailing space (standard terminal drop). */
export function formatDroppedPaths(paths: string[]): string {
  const parts = paths.map((p) => shellQuote(String(p || "").trim())).filter(Boolean);
  if (!parts.length) return "";
  return parts.join(" ") + " ";
}
