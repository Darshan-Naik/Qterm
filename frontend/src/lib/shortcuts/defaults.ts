import type { KeyChord, ShortcutId, ShortcutMeta } from "./types";

export const SHORTCUT_META: ShortcutMeta[] = [
  {
    id: "commandPalette",
    label: "Command palette",
    group: "General",
    whenSettings: "allow",
  },
  {
    id: "quickOpen",
    label: "Quick open",
    description: "Jump to a terminal (name, path, or output text)",
    group: "General",
    whenSettings: "block",
  },
  {
    id: "agentSessions",
    label: "Agent sessions",
    description: "Resume a Claude / Codex / Gemini / Cursor session from disk",
    group: "General",
    whenSettings: "block",
  },
  {
    id: "findInTerminal",
    label: "Find in terminal",
    description: "Search within the focused terminal",
    group: "Terminal",
    whenSettings: "block",
  },
  {
    id: "openSettings",
    label: "Open settings",
    group: "General",
    whenSettings: "allow",
  },
  {
    id: "toggleTheme",
    label: "Toggle light / dark",
    group: "General",
    whenSettings: "allow",
  },
  {
    id: "zoomIn",
    label: "Zoom in",
    group: "View",
    whenSettings: "allow",
  },
  {
    id: "zoomOut",
    label: "Zoom out",
    group: "View",
    whenSettings: "allow",
  },
  {
    id: "zoomReset",
    label: "Reset zoom",
    group: "View",
    whenSettings: "allow",
  },
  {
    id: "toggleSidebar",
    label: "Toggle sidebar",
    group: "View",
    whenSettings: "block",
  },
  {
    id: "newTerminal",
    label: "New terminal",
    group: "Terminal",
    whenSettings: "block",
  },
  {
    id: "cyclePaneNext",
    label: "Next pane",
    group: "Terminal",
    whenSettings: "block",
  },
  {
    id: "cyclePanePrev",
    label: "Previous pane",
    group: "Terminal",
    whenSettings: "block",
  },
  {
    id: "cycleTerminalNext",
    label: "Next terminal",
    group: "Terminal",
    whenSettings: "block",
  },
  {
    id: "cycleTerminalPrev",
    label: "Previous terminal",
    group: "Terminal",
    whenSettings: "block",
  },
  {
    id: "splitRight",
    label: "Split right",
    group: "Terminal",
    whenSettings: "block",
  },
  {
    id: "splitDown",
    label: "Split down",
    group: "Terminal",
    whenSettings: "block",
  },
  {
    id: "closePane",
    label: "Close pane",
    group: "Terminal",
    whenSettings: "block",
  },
  {
    id: "renameTerminal",
    label: "Rename terminal",
    group: "Terminal",
    whenSettings: "block",
  },
  {
    id: "deleteTerminal",
    label: "Delete terminal",
    group: "Terminal",
    whenSettings: "block",
  },
  {
    id: "newTerminalInProject",
    label: "New terminal in project",
    group: "Project",
    whenSettings: "block",
  },
  {
    id: "renameProject",
    label: "Rename project",
    group: "Project",
    whenSettings: "block",
  },
  {
    id: "revealProject",
    label: "Reveal in Finder",
    group: "Project",
    whenSettings: "block",
  },
  {
    id: "removeProject",
    label: "Remove project",
    group: "Project",
    whenSettings: "block",
  },
  {
    id: "gitToolkit",
    label: "Git toolkit",
    description: "Pull, push, stage, commit, and switch branches",
    group: "Project",
    whenSettings: "block",
  },
];

const mod = (key: string, extra?: Partial<KeyChord>): KeyChord => ({
  key,
  metaOrCtrl: true,
  ...extra,
});

const modShift = (key: string, extra?: Partial<KeyChord>): KeyChord =>
  mod(key, { shift: true, ...extra });

export const DEFAULT_BINDINGS: Record<ShortcutId, KeyChord[]> = {
  commandPalette: [mod("k")],
  quickOpen: [mod("p")],
  agentSessions: [modShift("a")],
  findInTerminal: [mod("f")],
  openSettings: [mod(",", { codes: ["Comma"] })],
  toggleTheme: [modShift("d")],
  zoomIn: [mod("=", { codes: ["Equal", "NumpadAdd"] })],
  zoomOut: [mod("-", { codes: ["Minus", "NumpadSubtract"] })],
  zoomReset: [mod("0", { codes: ["Digit0", "Numpad0"] })],
  toggleSidebar: [mod("b")],
  newTerminal: [mod("t")],
  cyclePaneNext: [mod("]", { codes: ["BracketRight"] })],
  cyclePanePrev: [mod("[", { codes: ["BracketLeft"] })],
  cycleTerminalNext: [
    modShift("]", { codes: ["BracketRight"] }),
    { key: "Tab", codes: ["Tab"], ctrlOnly: true },
  ],
  cycleTerminalPrev: [
    modShift("[", { codes: ["BracketLeft"] }),
    { key: "Tab", codes: ["Tab"], ctrlOnly: true, shift: true },
  ],
  splitRight: [modShift("l")],
  splitDown: [modShift("j")],
  closePane: [modShift("w")],
  renameTerminal: [modShift("r")],
  deleteTerminal: [modShift("Backspace", { codes: ["Backspace"] })],
  newTerminalInProject: [modShift("t")],
  renameProject: [modShift("e")],
  revealProject: [modShift("o")],
  removeProject: [modShift("Backspace", { codes: ["Backspace"], alt: true })],
  gitToolkit: [modShift("g")],
};

export const SHORTCUT_GROUPS: Array<ShortcutMeta["group"]> = ["General", "View", "Terminal", "Project"];

export function metaFor(id: ShortcutId): ShortcutMeta {
  const m = SHORTCUT_META.find((s) => s.id === id);
  if (!m) throw new Error(`Unknown shortcut: ${id}`);
  return m;
}
