/** Shared shortcut chords for terminal + project menus (react-hotkeys-hook + labels). */
import { shortcutLabel } from "@/lib/shortcutLabel";

export const TerminalShortcuts = {
  rename: {
    hotkey: "meta+shift+r, ctrl+shift+r",
    label: shortcutLabel("mod", "shift", "R"),
  },
  close: {
    hotkey: "meta+shift+w, ctrl+shift+w",
    label: shortcutLabel("mod", "shift", "W"),
  },
  delete: {
    hotkey: "meta+shift+backspace, ctrl+shift+backspace",
    label: shortcutLabel("mod", "shift", "backspace"),
  },
  splitRight: {
    hotkey: "meta+shift+l, ctrl+shift+l",
    label: shortcutLabel("mod", "shift", "L"),
  },
  splitDown: {
    hotkey: "meta+shift+j, ctrl+shift+j",
    label: shortcutLabel("mod", "shift", "J"),
  },
  next: {
    hotkey: "meta+shift+], ctrl+tab",
    label: shortcutLabel("mod", "shift", "]"),
  },
  prev: {
    hotkey: "meta+shift+[, ctrl+shift+tab",
    label: shortcutLabel("mod", "shift", "["),
  },
} as const;

export const ProjectShortcuts = {
  newTerminal: {
    hotkey: "meta+shift+t, ctrl+shift+t",
    label: shortcutLabel("mod", "shift", "T"),
  },
  rename: {
    hotkey: "meta+shift+e, ctrl+shift+e",
    label: shortcutLabel("mod", "shift", "E"),
  },
  reveal: {
    hotkey: "meta+shift+o, ctrl+shift+o",
    label: shortcutLabel("mod", "shift", "O"),
  },
  remove: {
    hotkey: "meta+alt+shift+backspace, ctrl+alt+shift+backspace",
    label: shortcutLabel("mod", "alt", "shift", "backspace"),
  },
} as const;
