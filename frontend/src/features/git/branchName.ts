export function sanitizeBranchInput(name: string): string {
  let s = name.replace(/[\s\u0000-\u001f\u007f~^:?*[\\]/g, "-");
  s = s.replace(/\.\./g, "-").replace(/@\{/g, "-");
  while (s.includes("--")) s = s.replaceAll("--", "-");
  while (s.includes("//")) s = s.replaceAll("//", "/");
  return s.replace(/^[-/.]+/, "");
}

export function normalizeBranchName(name: string): string {
  let s = name.trim();
  if (!s) return "";
  s = s.replace(/[\s\u0000-\u001f\u007f~^:?*[\\]/g, "-");
  s = s.replace(/\.\./g, "-").replace(/@\{/g, "-");
  while (s.includes("--")) s = s.replaceAll("--", "-");
  while (s.includes("//")) s = s.replaceAll("//", "/");
  s = s.replace(/^[-/.]+|[-/.]+$/g, "");
  if (s.toLowerCase().endsWith(".lock")) {
    s = s.slice(0, -5).replace(/^[-/.]+|[-/.]+$/g, "");
  }
  return s;
}

export function validBranchName(name: string): boolean {
  if (!name || name === "@") return false;
  if (name.includes("..") || name.includes("@{") || name.includes("\\")) return false;
  if (name.startsWith("/") || name.endsWith("/") || name.includes("//")) return false;
  if (name.startsWith(".") || name.endsWith(".")) return false;
  if (name.toLowerCase().endsWith(".lock")) return false;
  for (const part of name.split("/")) {
    if (!part || part.startsWith(".") || part.toLowerCase().endsWith(".lock")) return false;
  }
  return !/[\u0000-\u0020\u007f~^:?*[]/.test(name);
}
