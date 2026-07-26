import type { ThemeMode } from "./types";

export function applyTheme(theme: ThemeMode) {
  const root = document.documentElement;
  const preferDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = theme === "dark" || (theme === "system" && preferDark);
  root.classList.toggle("dark", dark);
  // Native form controls (number spinners, <select> arrows) follow color-scheme.
  root.style.colorScheme = dark ? "dark" : "light";
}
