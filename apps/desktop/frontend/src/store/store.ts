import { createStore, createUseStore } from "qortex-store-react";
import type { SettingsPage, UIState } from "./types";
import {
  DEFAULT_SCOPE,
  FONT_SIZE_DEFAULT,
  DEFAULT_IDE,
  SIDEBAR_DEFAULT,
  SIDEBAR_FOOTER_DEFAULT,
  UI_ZOOM_DEFAULT,
  NOTIFY_COMMAND_MIN_DEFAULT,
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
  NOTIFY_COMMAND_MIN_DEFAULT,
  NOTIFY_COMMAND_MIN_MIN,
  NOTIFY_COMMAND_MIN_MAX,
  clampFontSize,
  clampSidebarWidth,
  clampUiZoom,
  clampNotifyCommandMinSec,
  sanitizeSidebarFooter,
} from "./defaults";

export const uiStore = createStore<UIState>({
  uiReady: false,
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
  snippetsOpen: false,
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
  snippets: [],
  notifyAgent: true,
  notifyCommand: true,
  notifyCommandMinSec: NOTIFY_COMMAND_MIN_DEFAULT,
  globalHotkey: null,
  sidebarFooter: [...SIDEBAR_FOOTER_DEFAULT],
  gitPanel: null,
  appUpdate: null,
});

export const useUI = createUseStore(uiStore);

export function openSettings(page: SettingsPage = "appearance") {
  if (uiStore.get().appMode === "setup") return;
  uiStore.set({
    appMode: "settings",
    settingsPage: page,
    paletteOpen: false,
    quickOpen: false,
    terminalFindOpen: false,
    agentSessionsOpen: false,
    snippetsOpen: false,
    gitPanel: null,
  });
}

export function closeSettings() {
  if (uiStore.get().appMode === "setup") return;
  uiStore.set({ appMode: "workspace" });
}

export function openAbout() {
  uiStore.set({ aboutOpen: true });
}

export function closeAbout() {
  uiStore.set({ aboutOpen: false });
}
