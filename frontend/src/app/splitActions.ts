import { toast } from "sonner";
import { createDefaultTerminal, DEFAULT_SCOPE } from "@/lib/sessions";
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

export async function splitFocused(direction: "horizontal" | "vertical") {
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
