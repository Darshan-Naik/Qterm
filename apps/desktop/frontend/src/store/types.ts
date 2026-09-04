import type { KeybindingOverrides } from "@/lib/shortcuts/types";

export type ThemeMode = "system" | "dark" | "light";
export type AnimateState = "none" | "idle" | "action_required" | "task_complete" | "thinking";
export type SettingsPage = "appearance" | "terminal" | "agent" | "shortcuts";
export type AppMode = "workspace" | "settings";
export type SidebarFooterId = "palette" | "agent" | "theme" | "settings";

export type { KeybindingOverrides };

export type SplitNode =
  | { type: "leaf"; id: string; sessionId: string }
  | {
      type: "split";
      id: string;
      direction: "horizontal" | "vertical";
      size: number;
      children: [SplitNode, SplitNode];
    };

export type SplitLeaf = Extract<SplitNode, { type: "leaf" }>;

export type SessionInfo = {
  id: string;
  name: string;
  projectId: string;
  cwd: string;
  pinned?: boolean;
  /** ISO start time — sidebar sorts oldest → newest. */
  createdAt?: string;
};

export type ProjectInfo = {
  id: string;
  name: string;
  path: string;
  /** ISO — sidebar sorts oldest → newest by when added. */
  addedAt?: string;
};

export type HookIntent = {
  id: string;
  hookId: string;
  sessionId: string;
  type: string;
  payload: Record<string, unknown>;
};

export type UIState = {
  sidebarOpen: boolean;
  sidebarWidth: number;
  activeScope: string;
  focusedPaneId: string | null;
  focusedSessionId: string | null;
  theme: ThemeMode;
  fontSize: number;
  /** Empty = macOS default app for source files. */
  defaultIDE: string;
  /** Whole-app UI zoom percent (80–150). */
  uiZoom: number;
  shell: string;
  paletteOpen: boolean;
  /** ⌘P project/terminal quick switcher */
  quickOpen: boolean;
  /** ⌘F find-in-terminal bar on the focused session */
  terminalFindOpen: boolean;
  /** ⌘⇧A agent session history palette */
  agentSessionsOpen: boolean;
  /** App menu → About */
  aboutOpen: boolean;
  appMode: AppMode;
  settingsPage: SettingsPage;
  splitTree: SplitNode | null;
  sessions: SessionInfo[];
  projects: ProjectInfo[];
  paneAnimations: Record<string, AnimateState>;
  /** sessionId → agent CLI source (claude/codex/…) while hooks are active */
  sessionAgents: Record<string, string>;
  pendingIntent: HookIntent | null;
  suggestText: string | null;
  collapsedProjects: Record<string, boolean>;
  /** Custom keybinding overrides (defaults live in shortcut catalog). */
  keybindings: KeybindingOverrides;
  /** Enabled sidebar footer icons. Empty hides the footer. */
  sidebarFooter: SidebarFooterId[];
  /** Which git chip should show the toolkit popover. */
  gitPanel: GitPanelTarget | null;
};

export type GitPanelView = "main" | "branches" | "stashes" | "worktrees";

export type GitPanelTarget = {
  projectId: string;
  /** Title-bar pane id, or a list host (`project:`, `open-project:`, `session:`, `open-session:`). */
  paneId: string | null;
  view: GitPanelView;
};
