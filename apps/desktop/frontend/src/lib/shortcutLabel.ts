function isMacPlatform(): boolean {
  return (
    typeof navigator !== "undefined" &&
    (/Mac|iPhone|iPad/.test(navigator.platform) || navigator.userAgent.includes("Mac"))
  );
}

/** Single-key glyph/label for keycaps and compact shortcut strings. */
export function formatShortcutKey(key: string): string {
  const isMac = isMacPlatform();
  switch (key.toLowerCase()) {
    case "mod":
    case "meta":
    case "cmd":
      return isMac ? "⌘" : "Ctrl";
    case "ctrl":
      return isMac ? "⌃" : "Ctrl";
    case "alt":
    case "opt":
      return isMac ? "⌥" : "Alt";
    case "shift":
      return isMac ? "⇧" : "Shift";
    case "backspace":
    case "delete":
      return "⌫";
    case "enter":
      return "⏎";
    default:
      return key.length === 1 ? key.toUpperCase() : key;
  }
}

/** Display strings for menu shortcut hints (Mac-first app). */
export function shortcutLabel(...keys: string[]): string {
  return keys.map(formatShortcutKey).join(isMacPlatform() ? "" : "+");
}
