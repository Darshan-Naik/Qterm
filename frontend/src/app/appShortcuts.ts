import { createDefaultTerminal } from "@/lib/sessions";
import {
  deleteFocusedTerminal,
  newTerminalInActiveProject,
  removeActiveProject,
  renameActiveProject,
  renameFocusedTerminal,
  revealActiveProject,
} from "@/lib/menuActions";
import {
  adjustUiZoom,
  applyTheme,
  closeSettings,
  openSettings,
  persistUIPrefs,
  setUiZoom,
  UI_ZOOM_DEFAULT,
  uiStore,
} from "@/store/ui";
import { SaveTheme } from "../../wailsjs/go/main/App";
import { closeFocused, cycleFocus, splitFocused } from "@/app/splitActions";

function mod(e: KeyboardEvent) {
  return e.metaKey || e.ctrlKey;
}

function noShift(e: KeyboardEvent) {
  return !e.shiftKey;
}

function withShift(e: KeyboardEvent) {
  return e.shiftKey;
}

/** True when this key should be owned by the app (not the PTY / xterm). */
export function isAppShortcut(e: KeyboardEvent): boolean {
  if (e.isComposing) return false;
  if (!mod(e)) {
    // Escape closes settings only — still an app chord when settings is open.
    return e.key === "Escape" && uiStore.get().appMode === "settings";
  }

  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  const code = e.code;

  // Zoom: ⌘/Ctrl + = / - / 0
  if (noShift(e) && !e.altKey && (code === "Equal" || code === "NumpadAdd")) return true;
  if (noShift(e) && !e.altKey && (code === "Minus" || code === "NumpadSubtract")) return true;
  if (noShift(e) && !e.altKey && (code === "Digit0" || code === "Numpad0")) return true;

  if (noShift(e) && !e.altKey && (key === "k" || key === "p" || key === "," || key === "t" || key === "b")) {
    return true;
  }
  if (noShift(e) && !e.altKey && (key === "]" || key === "[" || code === "BracketRight" || code === "BracketLeft")) {
    return true;
  }

  // Shift chords
  if (withShift(e) && !e.altKey) {
    if (key === "l" || key === "j" || key === "w" || key === "r" || key === "t" || key === "e" || key === "o" || key === "d") {
      return true;
    }
    if (key === "Backspace" || code === "Backspace") return true;
  }

  // Project remove: ⌘⌥⇧⌫
  if (withShift(e) && e.altKey && (key === "Backspace" || code === "Backspace")) return true;

  return false;
}

/**
 * Handle an app shortcut. Returns true if the event was consumed.
 * Safe to call from capture-phase window listeners and xterm custom key handlers.
 */
export function handleAppShortcut(e: KeyboardEvent): boolean {
  if (!isAppShortcut(e)) return false;

  const settings = uiStore.get().appMode === "settings";
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  const code = e.code;

  // Escape → leave settings
  if (key === "Escape") {
    if (!settings) return false;
    e.preventDefault();
    e.stopPropagation();
    closeSettings();
    return true;
  }

  if (!mod(e)) return false;

  // Zoom
  if (noShift(e) && !e.altKey && (code === "Equal" || code === "NumpadAdd")) {
    e.preventDefault();
    e.stopPropagation();
    void adjustUiZoom(1);
    return true;
  }
  if (noShift(e) && !e.altKey && (code === "Minus" || code === "NumpadSubtract")) {
    e.preventDefault();
    e.stopPropagation();
    void adjustUiZoom(-1);
    return true;
  }
  if (noShift(e) && !e.altKey && (code === "Digit0" || code === "Numpad0")) {
    e.preventDefault();
    e.stopPropagation();
    void setUiZoom(UI_ZOOM_DEFAULT);
    return true;
  }

  // ⌘K command palette
  if (noShift(e) && !e.altKey && key === "k") {
    e.preventDefault();
    e.stopPropagation();
    uiStore.set({ paletteOpen: true, quickOpen: false });
    return true;
  }

  // ⌘P quick open
  if (noShift(e) && !e.altKey && key === "p") {
    if (settings) return false;
    e.preventDefault();
    e.stopPropagation();
    uiStore.set({ quickOpen: true, paletteOpen: false });
    return true;
  }

  // ⌘,
  if (noShift(e) && !e.altKey && key === ",") {
    e.preventDefault();
    e.stopPropagation();
    openSettings();
    return true;
  }

  // ⌘T new terminal
  if (noShift(e) && !e.altKey && key === "t") {
    if (settings) return false;
    e.preventDefault();
    e.stopPropagation();
    void createDefaultTerminal();
    return true;
  }

  // ⌘B sidebar
  if (noShift(e) && !e.altKey && key === "b") {
    if (settings) return false;
    e.preventDefault();
    e.stopPropagation();
    uiStore.set({ sidebarOpen: !uiStore.get().sidebarOpen });
    void persistUIPrefs();
    return true;
  }

  // ⌘] / ⌘[
  if (noShift(e) && !e.altKey && (key === "]" || code === "BracketRight")) {
    if (settings) return false;
    e.preventDefault();
    e.stopPropagation();
    cycleFocus(1);
    return true;
  }
  if (noShift(e) && !e.altKey && (key === "[" || code === "BracketLeft")) {
    if (settings) return false;
    e.preventDefault();
    e.stopPropagation();
    cycleFocus(-1);
    return true;
  }

  // Shift family
  if (withShift(e) && !e.altKey && key === "l") {
    if (settings) return false;
    e.preventDefault();
    e.stopPropagation();
    void splitFocused("horizontal");
    return true;
  }
  if (withShift(e) && !e.altKey && key === "j") {
    if (settings) return false;
    e.preventDefault();
    e.stopPropagation();
    void splitFocused("vertical");
    return true;
  }
  if (withShift(e) && !e.altKey && key === "w") {
    if (settings) return false;
    e.preventDefault();
    e.stopPropagation();
    void closeFocused();
    return true;
  }
  if (withShift(e) && !e.altKey && key === "r") {
    if (settings) return false;
    e.preventDefault();
    e.stopPropagation();
    renameFocusedTerminal();
    return true;
  }
  if (withShift(e) && !e.altKey && (key === "Backspace" || code === "Backspace")) {
    if (settings) return false;
    e.preventDefault();
    e.stopPropagation();
    void deleteFocusedTerminal();
    return true;
  }
  if (withShift(e) && !e.altKey && key === "t") {
    if (settings) return false;
    e.preventDefault();
    e.stopPropagation();
    void newTerminalInActiveProject();
    return true;
  }
  if (withShift(e) && !e.altKey && key === "e") {
    if (settings) return false;
    e.preventDefault();
    e.stopPropagation();
    void renameActiveProject();
    return true;
  }
  if (withShift(e) && !e.altKey && key === "o") {
    if (settings) return false;
    e.preventDefault();
    e.stopPropagation();
    void revealActiveProject();
    return true;
  }
  if (withShift(e) && !e.altKey && key === "d") {
    e.preventDefault();
    e.stopPropagation();
    const next = uiStore.get().theme === "dark" ? "light" : "dark";
    uiStore.set({ theme: next });
    applyTheme(next);
    void SaveTheme(next);
    void persistUIPrefs();
    return true;
  }

  if (withShift(e) && e.altKey && (key === "Backspace" || code === "Backspace")) {
    if (settings) return false;
    e.preventDefault();
    e.stopPropagation();
    void removeActiveProject();
    return true;
  }

  return false;
}
