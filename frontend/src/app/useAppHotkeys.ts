import { useEffect } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { createDefaultTerminal } from "@/lib/sessions";
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
import { closeFocused, cycleFocus, splitFocused } from "./splitActions";

/**
 * App UI zoom via capture-phase keydown.
 * react-hotkeys-hook maps codes like Equal→"equal" but hotkey strings used "=" / "+",
 * so ⌘+ never matched. ⌘0 is also often swallowed by WebKit page-zoom unless we
 * preventDefault in capture before the browser handles it.
 */
function useUiZoomHotkeys() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
      // Ignore IME composition
      if (e.isComposing) return;

      const { code } = e;
      if (code === "Equal" || code === "NumpadAdd") {
        e.preventDefault();
        e.stopPropagation();
        void adjustUiZoom(1);
        return;
      }
      if (code === "Minus" || code === "NumpadSubtract") {
        e.preventDefault();
        e.stopPropagation();
        void adjustUiZoom(-1);
        return;
      }
      if (code === "Digit0" || code === "Numpad0") {
        e.preventDefault();
        e.stopPropagation();
        void setUiZoom(UI_ZOOM_DEFAULT);
      }
    };

    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, []);
}

export function useAppHotkeys() {
  useUiZoomHotkeys();

  useHotkeys("meta+k, ctrl+k", (e) => {
    e.preventDefault();
    uiStore.set({ paletteOpen: true });
  });
  useHotkeys("meta+comma, ctrl+comma", (e) => {
    e.preventDefault();
    openSettings();
  });
  useHotkeys(
    "escape",
    (e) => {
      if (uiStore.get().appMode !== "settings") return;
      e.preventDefault();
      closeSettings();
    },
    { enableOnFormTags: true }
  );
  useHotkeys("meta+t, ctrl+t", (e) => {
    if (uiStore.get().appMode === "settings") return;
    e.preventDefault();
    void createDefaultTerminal();
  });
  useHotkeys("meta+b, ctrl+b", (e) => {
    if (uiStore.get().appMode === "settings") return;
    e.preventDefault();
    uiStore.set({ sidebarOpen: !uiStore.get().sidebarOpen });
    void persistUIPrefs();
  });
  useHotkeys("meta+shift+l, ctrl+shift+l", (e) => {
    if (uiStore.get().appMode === "settings") return;
    e.preventDefault();
    void splitFocused("horizontal");
  });
  useHotkeys("meta+shift+j, ctrl+shift+j", (e) => {
    if (uiStore.get().appMode === "settings") return;
    e.preventDefault();
    void splitFocused("vertical");
  });
  useHotkeys("meta+shift+w, ctrl+shift+w", (e) => {
    if (uiStore.get().appMode === "settings") return;
    e.preventDefault();
    void closeFocused();
  });
  useHotkeys("meta+], ctrl+]", (e) => {
    if (uiStore.get().appMode === "settings") return;
    e.preventDefault();
    cycleFocus(1);
  });
  useHotkeys("meta+[, ctrl+[", (e) => {
    if (uiStore.get().appMode === "settings") return;
    e.preventDefault();
    cycleFocus(-1);
  });
  useHotkeys("meta+shift+d, ctrl+shift+d", (e) => {
    e.preventDefault();
    const next = uiStore.get().theme === "dark" ? "light" : "dark";
    uiStore.set({ theme: next });
    applyTheme(next);
    void SaveTheme(next);
    void persistUIPrefs();
  });
}
