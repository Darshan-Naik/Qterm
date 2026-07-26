import { createStore, createUseStore } from "qortex-store-react";
import type { SettingsPage, UIState } from "./types";

export const SIDEBAR_MIN = 180;
export const SIDEBAR_MAX = 480;
export const SIDEBAR_DEFAULT = 240;

/** Terminal font size (px). Keep in sync with `config.DefaultFontSize` in Go. */
export const FONT_SIZE_MIN = 10;
export const FONT_SIZE_MAX = 24;
export const FONT_SIZE_DEFAULT = 12;

export function clampFontSize(n: number) {
  const v = Math.round(Number(n) || FONT_SIZE_DEFAULT);
  return Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, v));
}

export const uiStore = createStore<UIState>({
  sidebarOpen: true,
  sidebarWidth: SIDEBAR_DEFAULT,
  activeScope: "_default",
  focusedPaneId: null,
  focusedSessionId: null,
  theme: "dark",
  fontSize: FONT_SIZE_DEFAULT,
  uiZoom: 100,
  shell: "",
  paletteOpen: false,
  quickOpen: false,
  appMode: "workspace",
  settingsPage: "appearance",
  splitTree: null,
  sessions: [],
  projects: [],
  paneAnimations: {},
  sessionAgents: {},
  pendingIntent: null,
  suggestText: null,
  collapsedProjects: {},
  keybindings: {},
});

export const useUI = createUseStore(uiStore);

export function openSettings(page: SettingsPage = "appearance") {
  uiStore.set({ appMode: "settings", settingsPage: page, paletteOpen: false, quickOpen: false });
}

export function closeSettings() {
  uiStore.set({ appMode: "workspace" });
}
