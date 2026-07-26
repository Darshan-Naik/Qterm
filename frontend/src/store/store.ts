import { createStore, createUseStore } from "qortex-store-react";
import type { SettingsPage, UIState } from "./types";

export const SIDEBAR_MIN = 180;
export const SIDEBAR_MAX = 480;
export const SIDEBAR_DEFAULT = 240;

export const uiStore = createStore<UIState>({
  sidebarOpen: true,
  sidebarWidth: SIDEBAR_DEFAULT,
  activeScope: "_default",
  focusedPaneId: null,
  focusedSessionId: null,
  theme: "dark",
  fontSize: 13,
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
