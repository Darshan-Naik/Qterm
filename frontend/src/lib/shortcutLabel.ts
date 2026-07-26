/** Display strings for menu shortcut hints (Mac-first app). */
export function shortcutLabel(...keys: string[]): string {
  const isMac =
    typeof navigator !== "undefined" &&
    (/Mac|iPhone|iPad/.test(navigator.platform) || navigator.userAgent.includes("Mac"));
  return keys
    .map((k) => {
      switch (k.toLowerCase()) {
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
          return k.length === 1 ? k.toUpperCase() : k;
      }
    })
    .join(isMac ? "" : "+");
}
