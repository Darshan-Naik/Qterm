export type ThemeMode = "system" | "dark" | "light";
export type AnimateState = "none" | "action_required" | "task_complete" | "thinking";
export type SettingsPage = "appearance" | "terminal" | "plugins";
export type AppMode = "workspace" | "settings";

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
};

export type ProjectInfo = {
  id: string;
  name: string;
  path: string;
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
  shell: string;
  paletteOpen: boolean;
  appMode: AppMode;
  settingsPage: SettingsPage;
  splitTree: SplitNode | null;
  sessions: SessionInfo[];
  projects: ProjectInfo[];
  paneAnimations: Record<string, AnimateState>;
  pendingIntent: HookIntent | null;
  suggestText: string | null;
  collapsedProjects: Record<string, boolean>;
};
