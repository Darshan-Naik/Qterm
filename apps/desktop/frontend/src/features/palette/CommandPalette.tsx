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
import { createTerminal, createDefaultTerminal, currentScope, DEFAULT_SCOPE } from "@/lib/sessions";
import { randomTerminalName } from "@/lib/terminalNames";
import { closePane, requestDeleteSession } from "@/lib/panes";
import { GitWorktreePicker, openGitToolkit, runScopedGit } from "@/features/git";
import { asStatus } from "@/features/git/types";
import { toast } from "sonner";
import {
  CreateSession,
  GetGitStatus,
  SaveLayout,
  SaveTheme,
} from "../../../wailsjs/go/main/App";
import { Dialog, DialogContent } from "@/components/ui/dialog";

export function CommandPalette() {
  const open = useUI((s) => s.paletteOpen);
  const [q, setQ] = useState("");
  const [worktreePick, setWorktreePick] = useState<{
    id: string;
    path: string;
  } | null>(null);

  useEffect(() => {
    if (!open) setQ("");
  }, [open]);

  const actions = useMemo(
    () => [
      {
        id: "quick-open",
        label: "Quick open terminals",
        run: async () => {
          uiStore.set({ quickOpen: true, paletteOpen: false, agentSessionsOpen: false });
        },
      },
      {
        id: "agent-sessions",
        label: "Resume agent session",
        run: async () => {
          uiStore.set({ agentSessionsOpen: true, paletteOpen: false, quickOpen: false });
        },
      },
      {
        id: "git-open",
        label: "Git: Open toolkit",
        run: async () => {
          await openGitToolkit();
        },
      },
      {
        id: "git-switch",
        label: "Git: Switch branch",
        run: async () => {
          await openGitToolkit("branches");
        },
      },
      {
        id: "git-fetch",
        label: "Git: Fetch",
        run: async () => {
          await runScopedGit("fetch");
        },
      },
      {
        id: "git-pull",
        label: "Git: Pull",
        run: async () => {
          await runScopedGit("pull");
        },
      },
      {
        id: "git-push",
        label: "Git: Push",
        run: async () => {
          await runScopedGit("push");
        },
      },
      {
        id: "git-stash",
        label: "Git: Stash",
        run: async () => {
          await runScopedGit("stash");
        },
      },
      {
        id: "git-stash-pop",
        label: "Git: Pop stash",
        run: async () => {
          await runScopedGit("stash-pop");
        },
      },
      {
        id: "git-stashes",
        label: "Git: Stashes",
        run: async () => {
          await openGitToolkit("stashes");
        },
      },
      {
        id: "git-worktrees",
        label: "Git: Worktrees",
        run: async () => {
          await openGitToolkit("worktrees");
        },
      },
      {
        id: "git-commit",
        label: "Git: Commit",
        run: async () => {
          await openGitToolkit();
        },
      },
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
          const scope = currentScope();
          if (scope === DEFAULT_SCOPE) await createDefaultTerminal();
          else await createTerminal(scope);
        },
      },
      {
        id: "new-worktree-term",
        label: "New worktree terminal",
        run: async () => {
          const scope = currentScope();
          const project = uiStore.get().projects.find((p) => p.id === scope);
          if (!project) {
            toast.error("Open a project first");
            return;
          }
          const st = asStatus(await GetGitStatus(project.path));
          if (!st?.isRepo) {
            toast.error("Not a git repository");
            return;
          }
          setWorktreePick({ id: project.id, path: project.path });
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
        id: "next-terminal",
        label: "Next terminal",
        run: async () => {
          const { cycleTerminal } = await import("@/app/splitActions");
          await cycleTerminal(1);
        },
      },
      {
        id: "prev-terminal",
        label: "Previous terminal",
        run: async () => {
          const { cycleTerminal } = await import("@/app/splitActions");
          await cycleTerminal(-1);
        },
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
        id: "reload-window",
        label: "Reload Window",
        run: async () => {
          const { WindowReloadApp } = await import("../../../wailsjs/runtime/runtime");
          WindowReloadApp();
        },
      },
      {
        id: "theme-dark",
        label: "Theme: Dark",
        run: async () => {
          uiStore.set({ theme: "dark" });
          applyTheme("dark");
          await SaveTheme("dark");
        },
      },
      {
        id: "theme-light",
        label: "Theme: Light",
        run: async () => {
          uiStore.set({ theme: "light" });
          applyTheme("light");
          await SaveTheme("light");
        },
      },
      {
        id: "theme-system",
        label: "Theme: System",
        run: async () => {
          uiStore.set({ theme: "system" });
          applyTheme("system");
          await SaveTheme("system");
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
          await requestDeleteSession(focusedSessionId);
        },
      },
    ],
    []
  );

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => uiStore.set({ paletteOpen: v, quickOpen: v ? false : uiStore.get().quickOpen })}>
        <DialogContent
          position="top"
          showClose={false}
          className="flex max-w-2xl flex-col overflow-hidden rounded-lg p-0 shadow-xl"
          aria-describedby={undefined}
        >
          <Command className="flex min-h-0 max-h-full flex-col overflow-hidden bg-popover" label="Command palette">
            <Command.Input
              value={q}
              onValueChange={setQ}
              placeholder="Type a command…"
              className="h-11 w-full shrink-0 bg-transparent px-4 text-[13px] outline-none placeholder:text-muted-foreground"
            />
            <div className="mx-3 h-px shrink-0 bg-secondary" />
            <Command.List className="min-h-0 flex-1 overflow-auto p-2">
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
      {worktreePick ? (
        <GitWorktreePicker
          open
          onOpenChange={(next) => {
            if (!next) setWorktreePick(null);
          }}
          projectId={worktreePick.id}
          path={worktreePick.path}
        />
      ) : null}
    </>
  );
}

async function splitCurrent(direction: "horizontal" | "vertical") {
  const state = uiStore.get();
  const paneId = state.focusedPaneId || listLeaves(state.splitTree)[0]?.id;
  const scope = currentScope();
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
