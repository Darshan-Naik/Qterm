import { createStore, createUseStore } from "qortex-store-react";
import type { SettingsPage, UIState } from "./types";
import {
  DEFAULT_SCOPE,
  FONT_SIZE_DEFAULT,
  DEFAULT_IDE,
  SIDEBAR_DEFAULT,
  SIDEBAR_FOOTER_DEFAULT,
  UI_ZOOM_DEFAULT,
} from "./defaults";

export {
  DEFAULT_SCOPE,
  FONT_SIZE_DEFAULT,
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  DEFAULT_IDE,
  SIDEBAR_DEFAULT,
  SIDEBAR_FOOTER_DEFAULT,
  SIDEBAR_FOOTER_IDS,
  SIDEBAR_MAX,
  SIDEBAR_MIN,
  UI_ZOOM_DEFAULT,
  UI_ZOOM_MAX,
  UI_ZOOM_MIN,
  UI_ZOOM_STEP,
  clampFontSize,
  clampSidebarWidth,
  clampUiZoom,
  sanitizeSidebarFooter,
} from "./defaults";

export const uiStore = createStore<UIState>({
  sidebarOpen: true,
  sidebarWidth: SIDEBAR_DEFAULT,
  activeScope: DEFAULT_SCOPE,
  focusedPaneId: null,
  focusedSessionId: null,
  theme: "dark",
  fontSize: FONT_SIZE_DEFAULT,
  defaultIDE: DEFAULT_IDE,
  uiZoom: UI_ZOOM_DEFAULT,
  shell: "",
  paletteOpen: false,
  quickOpen: false,
  terminalFindOpen: false,
  agentSessionsOpen: false,
  aboutOpen: false,
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
  sidebarFooter: [...SIDEBAR_FOOTER_DEFAULT],
  gitPanel: null,
  appUpdate: null,
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
    gitPanel: null,
  });
}

export function closeSettings() {
  uiStore.set({ appMode: "workspace" });
}

export function openAbout() {
  uiStore.set({ aboutOpen: true });
}

export function closeAbout() {
  uiStore.set({ aboutOpen: false });
}
