import { useHotkeys } from "react-hotkeys-hook";
import { createDefaultTerminal } from "@/lib/sessions";
import {
  applyTheme,
  closeSettings,
  openSettings,
  persistUIPrefs,
  uiStore,
} from "@/store/ui";
import { SaveTheme } from "../../wailsjs/go/main/App";
import { closeFocused, cycleFocus, splitFocused } from "./splitActions";

export function useAppHotkeys() {
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
