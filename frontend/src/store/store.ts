import { createStore, createUseStore } from "qortex-store-react";
import type { SettingsPage, UIState } from "./types";
import {
  DEFAULT_SCOPE,
  FONT_SIZE_DEFAULT,
  SIDEBAR_DEFAULT,
  UI_ZOOM_DEFAULT,
} from "./defaults";

export {
  DEFAULT_SCOPE,
  FONT_SIZE_DEFAULT,
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  SIDEBAR_DEFAULT,
  SIDEBAR_MAX,
  SIDEBAR_MIN,
  UI_ZOOM_DEFAULT,
  UI_ZOOM_MAX,
  UI_ZOOM_MIN,
  UI_ZOOM_STEP,
  clampFontSize,
  clampSidebarWidth,
  clampUiZoom,
} from "./defaults";

export const uiStore = createStore<UIState>({
  sidebarOpen: true,
  sidebarWidth: SIDEBAR_DEFAULT,
  activeScope: DEFAULT_SCOPE,
  focusedPaneId: null,
  focusedSessionId: null,
  theme: "dark",
  fontSize: FONT_SIZE_DEFAULT,
  uiZoom: UI_ZOOM_DEFAULT,
  shell: "",
  paletteOpen: false,
  quickOpen: false,
  terminalFindOpen: false,
  agentSessionsOpen: false,
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
  uiStore.set({
    appMode: "settings",
    settingsPage: page,
    paletteOpen: false,
    quickOpen: false,
    terminalFindOpen: false,
    agentSessionsOpen: false,
  });
}

export function closeSettings() {
  uiStore.set({ appMode: "workspace" });
}
