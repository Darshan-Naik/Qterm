import { useEffect, useMemo, useState } from "react";
import { Command } from "cmdk";
import {
  uiStore,
  useUI,
  applyTheme,
  leaf,
  splitPane,
  listLeaves,
  persistUIPrefs,
  openSettings,
} from "@/store/ui";
import { createTerminal, createDefaultTerminal, DEFAULT_SCOPE } from "@/lib/sessions";
import { randomTerminalName } from "@/lib/terminalNames";
import { closePane, deleteSession } from "@/lib/panes";
import {
  CreateSession,
  SaveLayout,
  SaveTheme,
} from "../../../wailsjs/go/main/App";
import { Dialog, DialogContent } from "@/components/ui/dialog";

export function CommandPalette() {
  const open = useUI((s) => s.paletteOpen);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!open) setQ("");
  }, [open]);

  const actions = useMemo(
    () => [
      {
        id: "new-term",
        label: "New terminal",
        run: async () => {
          await createDefaultTerminal();
        },
      },
      {
        id: "new-term-scope",
        label: "New terminal in current project",
        run: async () => {
          const scope = uiStore.get().activeScope || DEFAULT_SCOPE;
          if (scope === DEFAULT_SCOPE) await createDefaultTerminal();
          else await createTerminal(scope);
        },
      },
      {
        id: "split-right",
        label: "Split right",
        run: async () => splitCurrent("horizontal"),
      },
      {
        id: "split-down",
        label: "Split down",
        run: async () => splitCurrent("vertical"),
      },
      {
        id: "toggle-sidebar",
        label: "Toggle sidebar",
        run: async () => {
          uiStore.set({ sidebarOpen: !uiStore.get().sidebarOpen });
          await persistUIPrefs();
        },
      },
      {
        id: "settings",
        label: "Settings",
        run: async () => openSettings("appearance"),
      },
      {
        id: "theme-dark",
        label: "Theme: Dark",
        run: async () => {
          uiStore.set({ theme: "dark" });
          applyTheme("dark");
          await SaveTheme("dark");
          await persistUIPrefs();
        },
      },
      {
        id: "theme-light",
        label: "Theme: Light",
        run: async () => {
          uiStore.set({ theme: "light" });
          applyTheme("light");
          await SaveTheme("light");
          await persistUIPrefs();
        },
      },
      {
        id: "theme-system",
        label: "Theme: System",
        run: async () => {
          uiStore.set({ theme: "system" });
          applyTheme("system");
          await SaveTheme("system");
          await persistUIPrefs();
        },
      },
      {
        id: "close-pane",
        label: "Close focused pane",
        run: async () => {
          const { focusedPaneId, splitTree } = uiStore.get();
          if (!focusedPaneId || !splitTree) return;
          await closePane(focusedPaneId);
        },
      },
      {
        id: "delete-session",
        label: "Delete focused terminal",
        run: async () => {
          const { focusedSessionId } = uiStore.get();
          if (!focusedSessionId) return;
          await deleteSession(focusedSessionId);
        },
      },
    ],
    []
  );

  return (
    <Dialog open={open} onOpenChange={(v) => uiStore.set({ paletteOpen: v })}>
      <DialogContent className="max-w-lg overflow-hidden rounded-lg p-0 shadow-xl">
        <Command className="bg-popover" label="Command palette">
          <Command.Input
            value={q}
            onValueChange={setQ}
            placeholder="Type a command…"
            className="h-10 w-full bg-transparent px-4 text-[13px] outline-none placeholder:text-muted-foreground"
          />
          <div className="mx-3 h-px bg-secondary" />
          <Command.List className="max-h-72 overflow-auto p-2">
            <Command.Empty className="px-2 py-4 text-[13px] text-muted-foreground">No results.</Command.Empty>
            {actions.map((a) => (
              <Command.Item
                key={a.id}
                value={a.label}
                onSelect={() => {
                  uiStore.set({ paletteOpen: false });
                  void a.run();
                }}
                className="cursor-pointer rounded-md px-2.5 py-2 text-[13px] aria-selected:bg-accent"
              >
                {a.label}
              </Command.Item>
            ))}
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

async function splitCurrent(direction: "horizontal" | "vertical") {
  const state = uiStore.get();
  const paneId = state.focusedPaneId || listLeaves(state.splitTree)[0]?.id;
  const scope = state.activeScope || DEFAULT_SCOPE;
  if (!paneId) {
    await createDefaultTerminal();
    return;
  }
  const projectId = scope === DEFAULT_SCOPE ? "" : scope;
  const name = randomTerminalName(state.sessions.map((s) => s.name));
  const sess = await CreateSession(projectId, name, "");
  const tree = state.splitTree || leaf(sess.id);
  const next = state.splitTree ? splitPane(tree, paneId, direction, sess.id) : leaf(sess.id);
  uiStore.set({
    sessions: [
      ...state.sessions,
      { id: sess.id, name: sess.name, projectId: sess.projectId || "", cwd: sess.cwd },
    ],
    splitTree: next,
    focusedSessionId: sess.id,
  });
  await SaveLayout(scope, next as any);
}
