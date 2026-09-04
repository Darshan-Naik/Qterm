import { toast } from "sonner";
import { createDefaultTerminal, currentScope, DEFAULT_SCOPE, focusSession } from "@/lib/sessions";
import { randomTerminalName } from "@/lib/terminalNames";
import { closePane } from "@/lib/panes";
import { leaf, listLeaves, splitPane, uiStore } from "@/store/ui";
import { CreateSession, SaveLayout } from "../../wailsjs/go/main/App";

export function cycleFocus(dir: number) {
  const leaves = listLeaves(uiStore.get().splitTree);
  if (!leaves.length) return;
  const idx = Math.max(0, leaves.findIndex((l) => l.id === uiStore.get().focusedPaneId));
  const next = leaves[(idx + dir + leaves.length) % leaves.length];
  uiStore.set({ focusedPaneId: next.id, focusedSessionId: next.sessionId });
}

/** Next/previous terminal across all projects (sidebar order). */
export async function cycleTerminal(dir: number) {
  const state = uiStore.get();
  const sessions = state.sessions;
  if (!sessions.length) return;
  if (sessions.length === 1) {
    await focusSession(sessions[0].id);
    return;
  }

  let idx = sessions.findIndex((s) => s.id === state.focusedSessionId);
  if (idx < 0) idx = 0;
  const next = sessions[(idx + dir + sessions.length) % sessions.length];
  await focusSession(next.id);
}

export async function splitFocused(direction: "horizontal" | "vertical") {
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
  const base = state.splitTree || leaf(sess.id);
  const next = state.splitTree ? splitPane(base, paneId, direction, sess.id) : leaf(sess.id);
  uiStore.set({
    sessions: [
      ...state.sessions,
      { id: sess.id, name: sess.name, projectId: sess.projectId || "", cwd: sess.cwd },
    ],
    splitTree: next,
    focusedSessionId: sess.id,
  });
  await SaveLayout(scope, next as any);
  toast.message(direction === "horizontal" ? "Split right" : "Split down");
}

export async function closeFocused() {
  const { focusedPaneId, splitTree } = uiStore.get();
  if (!focusedPaneId || !splitTree) return;
  await closePane(focusedPaneId);
}
