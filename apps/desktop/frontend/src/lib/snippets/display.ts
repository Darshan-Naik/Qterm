export function snippetCardTitle(s: { name: string; body: string }): string {
  const name = s.name.trim();
  if (name) return name;
  const line = s.body.trim().split("\n")[0]?.trim() ?? "";
  return line || "Untitled snippet";
}

export function snippetCardPreview(s: { name: string; body: string }): string {
  const preview = s.body.trim().replace(/\s+/g, " ");
  if (!preview || preview === snippetCardTitle(s)) return "";
  return preview;
}
