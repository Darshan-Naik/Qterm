import { createDefaultTerminal } from "@/lib/sessions";
import {
  deleteFocusedTerminal,
  newTerminalInActiveProject,
  removeActiveProject,
  renameActiveProject,
  renameFocusedTerminal,
  revealActiveProject,
} from "@/lib/menuActions";
import { matchShortcut, metaFor, type ShortcutId } from "@/lib/shortcuts";
import { isKeybindingCapturing } from "@/lib/shortcuts/capture";
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
import { closeFocused, cycleFocus, cycleTerminal, splitFocused } from "@/app/splitActions";

const HANDLERS: Record<ShortcutId, () => void | Promise<void>> = {
  commandPalette: () => {
    uiStore.set({ paletteOpen: true, quickOpen: false, terminalFindOpen: false });
  },
  quickOpen: () => {
    uiStore.set({ quickOpen: true, paletteOpen: false, terminalFindOpen: false });
  },
  findInTerminal: () => {
    const { focusedSessionId, appMode } = uiStore.get();
    if (appMode !== "workspace" || !focusedSessionId) return;
    uiStore.set({ terminalFindOpen: true, paletteOpen: false, quickOpen: false });
  },
  openSettings: () => openSettings(),
  toggleTheme: () => {
    const next = uiStore.get().theme === "dark" ? "light" : "dark";
    uiStore.set({ theme: next });
    applyTheme(next);
    void SaveTheme(next);
  },
  zoomIn: () => void adjustUiZoom(1),
  zoomOut: () => void adjustUiZoom(-1),
  zoomReset: () => void setUiZoom(UI_ZOOM_DEFAULT),
  toggleSidebar: () => {
    uiStore.set({ sidebarOpen: !uiStore.get().sidebarOpen });
    void persistUIPrefs();
  },
  newTerminal: () => void createDefaultTerminal(),
  cyclePaneNext: () => cycleFocus(1),
  cyclePanePrev: () => cycleFocus(-1),
  cycleTerminalNext: () => void cycleTerminal(1),
  cycleTerminalPrev: () => void cycleTerminal(-1),
  splitRight: () => void splitFocused("horizontal"),
  splitDown: () => void splitFocused("vertical"),
  closePane: () => void closeFocused(),
  renameTerminal: () => renameFocusedTerminal(),
  deleteTerminal: () => void deleteFocusedTerminal(),
  newTerminalInProject: () => void newTerminalInActiveProject(),
  renameProject: () => void renameActiveProject(),
  revealProject: () => void revealActiveProject(),
  removeProject: () => void removeActiveProject(),
};

/**
 * Handle an app shortcut. Returns true if the event was consumed.
 * Safe to call from capture-phase window listeners and xterm custom key handlers.
 */
export function handleAppShortcut(e: KeyboardEvent): boolean {
  if (e.isComposing) return false;
  // Settings rebinding UI owns the event.
  if (isKeybindingCapturing()) return false;

  const settings = uiStore.get().appMode === "settings";

  if (e.key === "Escape") {
    if (uiStore.get().terminalFindOpen) {
      e.preventDefault();
      e.stopPropagation();
      uiStore.set({ terminalFindOpen: false });
      const id = uiStore.get().focusedSessionId;
      if (id) {
        void import("@/features/terminal/sessionTerminals").then((m) => {
          m.clearSessionFind(id);
          m.focusTerminal(id);
        });
      }
      return true;
    }
    if (!settings) return false;
    e.preventDefault();
    e.stopPropagation();
    closeSettings();
    return true;
  }

  const id = matchShortcut(e, uiStore.get().keybindings);
  if (!id) return false;

  if (settings && metaFor(id).whenSettings === "block") return false;

  e.preventDefault();
  e.stopPropagation();
  void HANDLERS[id]();
  return true;
}

/** True when this key should be owned by the app (not the PTY / xterm). */
export function isAppShortcut(e: KeyboardEvent): boolean {
  if (e.isComposing) return false;
  if (isKeybindingCapturing()) return true;
  if (e.key === "Escape" && (uiStore.get().appMode === "settings" || uiStore.get().terminalFindOpen)) {
    return true;
  }
  return matchShortcut(e, uiStore.get().keybindings) !== null;
}
