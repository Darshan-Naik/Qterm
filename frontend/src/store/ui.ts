export type {
  AnimateState,
  AppMode,
  HookIntent,
  ProjectInfo,
  SessionInfo,
  SettingsPage,
  SplitLeaf,
  SplitNode,
  ThemeMode,
  UIState,
} from "./types";

export {
  SIDEBAR_DEFAULT,
  SIDEBAR_MAX,
  SIDEBAR_MIN,
  closeSettings,
  openSettings,
  uiStore,
  useUI,
} from "./store";

export { applyTheme } from "./theme";
export { hydrateUIPrefs, persistUIPrefs, toggleProjectCollapsed } from "./prefs";
export {
  collectSessionIds,
  findFirstLeaf,
  findLeafBySession,
  leaf,
  listLeaves,
  removePane,
  replaceLeafSession,
  setSplitSize,
  splitPane,
} from "./splits";
