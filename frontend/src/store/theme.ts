import { SaveTheme } from "../../wailsjs/go/main/App";
import { uiStore } from "./store";
import type { ThemeMode } from "./types";

export function applyTheme(theme: ThemeMode) {
  const root = document.documentElement;
  const preferDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = theme === "dark" || (theme === "system" && preferDark);
  root.classList.toggle("dark", dark);
  // Native form controls (number spinners, <select> arrows) follow color-scheme.
  root.style.colorScheme = dark ? "dark" : "light";
}

/** Apply, persist, and keep the store in sync. */
export function setThemeMode(theme: ThemeMode) {
  uiStore.set({ theme });
  applyTheme(theme);
  void SaveTheme(theme);
}
