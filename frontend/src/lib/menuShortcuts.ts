/** Menu shortcut labels — always reflect current (possibly rebound) bindings. */
import { shortcutLabelFor, type ShortcutId } from "@/lib/shortcuts";
import { uiStore } from "@/store/ui";

function label(id: ShortcutId): string {
  return shortcutLabelFor(id, uiStore.get().keybindings);
}

export const TerminalShortcuts = {
  get rename() {
    return { label: label("renameTerminal") };
  },
  get close() {
    return { label: label("closePane") };
  },
  get delete() {
    return { label: label("deleteTerminal") };
  },
  get splitRight() {
    return { label: label("splitRight") };
  },
  get splitDown() {
    return { label: label("splitDown") };
  },
  get next() {
    return { label: label("cycleTerminalNext") };
  },
  get prev() {
    return { label: label("cycleTerminalPrev") };
  },
};

export const ProjectShortcuts = {
  get newTerminal() {
    return { label: label("newTerminalInProject") };
  },
  get rename() {
    return { label: label("renameProject") };
  },
  get reveal() {
    return { label: label("revealProject") };
  },
  get openInIDE() {
    return { label: label("openInIDE") };
  },
  get remove() {
    return { label: label("removeProject") };
  },
  get gitToolkit() {
    return { label: label("gitToolkit") };
  },
};
