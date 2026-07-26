/** Stable ids for rebindable app shortcuts. */
export type ShortcutId =
  | "commandPalette"
  | "quickOpen"
  | "openSettings"
  | "newTerminal"
  | "toggleSidebar"
  | "cyclePaneNext"
  | "cyclePanePrev"
  | "cycleTerminalNext"
  | "cycleTerminalPrev"
  | "splitRight"
  | "splitDown"
  | "closePane"
  | "renameTerminal"
  | "deleteTerminal"
  | "newTerminalInProject"
  | "renameProject"
  | "revealProject"
  | "removeProject"
  | "toggleTheme"
  | "zoomIn"
  | "zoomOut"
  | "zoomReset";

export type ShortcutGroup = "General" | "View" | "Terminal" | "Project";

/** A single key chord (modifiers + key). */
export type KeyChord = {
  /** Normalized key: lowercase letter, or special like "Tab", "Backspace", ",", "[", "]". */
  key: string;
  /** Optional KeyboardEvent.code alternatives (e.g. Equal + NumpadAdd). */
  codes?: string[];
  /** ⌘ (Mac) or Ctrl (Win/Linux). */
  metaOrCtrl?: boolean;
  /** Ctrl without Meta — e.g. Ctrl+Tab. */
  ctrlOnly?: boolean;
  shift?: boolean;
  alt?: boolean;
};

export type ShortcutMeta = {
  id: ShortcutId;
  label: string;
  description?: string;
  group: ShortcutGroup;
  /** When settings is open: allow (default for global) or block. */
  whenSettings: "allow" | "block";
};

/** User overrides — only customized ids are stored. */
export type KeybindingOverrides = Partial<Record<ShortcutId, KeyChord[]>>;
