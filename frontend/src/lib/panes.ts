import { currentScope } from "@/lib/sessions";
import { confirm } from "@/lib/confirm";
import { disposeSession } from "@/features/terminal";
import {
  collectSessionIds,
  listLeaves,
  removePane,
  uiStore,
  type SplitNode,
} from "@/store/ui";
import { KillSession, SaveLayout } from "../../wailsjs/go/main/App";

/** Close a pane in the UI only — session, PTY, and history stay. */
export async function closePane(paneId: string) {
  const { splitTree } = uiStore.get();
  if (!splitTree) return;
  const next = removePane(splitTree, paneId);
  const nextLeaves = listLeaves(next);
  uiStore.set({
    splitTree: next,
    focusedPaneId: nextLeaves[0]?.id || null,
    focusedSessionId: nextLeaves[0]?.sessionId || null,
  });
  await persistLayout(currentScope(), next);
}

/** Close every pane showing this session in the current layout (UI only). */
export async function closeSessionPanes(sessionId: string) {
  const { splitTree } = uiStore.get();
  if (!splitTree) return;
  const paneIds = listLeaves(splitTree)
    .filter((l) => l.sessionId === sessionId)
    .map((l) => l.id);
  if (!paneIds.length) return;
  let next: SplitNode | null = splitTree;
  for (const id of paneIds) {
    if (next) next = removePane(next, id);
  }
  const nextLeaves = listLeaves(next);
  uiStore.set({
    splitTree: next,
    focusedPaneId: nextLeaves[0]?.id || null,
    focusedSessionId: nextLeaves[0]?.sessionId || null,
  });
  await persistLayout(currentScope(), next);
}

/** Ask to delete a session, then kill PTY / erase history if confirmed. */
export async function requestDeleteSession(sessionId: string) {
  const name = uiStore.get().sessions.find((s) => s.id === sessionId)?.name || "Terminal";
  const ok = await confirm({
    title: "Delete terminal?",
    description: `“${name}” will be removed permanently. This cannot be undone.`,
    confirmLabel: "Delete",
    destructive: true,
  });
  if (!ok) return;
  await deleteSession(sessionId);
}

/** Delete session: kill PTY, erase history, remove from sidebar and layouts. */
export async function deleteSession(sessionId: string) {
  const { splitTree, sessions } = uiStore.get();
  let next = splitTree;
  if (next && collectSessionIds(next).includes(sessionId)) {
    const paneIds = listLeaves(next)
      .filter((l) => l.sessionId === sessionId)
      .map((l) => l.id);
    for (const id of paneIds) {
      if (next) next = removePane(next, id);
    }
  }
  const nextLeaves = listLeaves(next);
  uiStore.set({
    splitTree: next,
    sessions: sessions.filter((s) => s.id !== sessionId),
    focusedPaneId: nextLeaves[0]?.id || null,
    focusedSessionId: nextLeaves[0]?.sessionId || null,
  });
  await KillSession(sessionId);
  disposeSession(sessionId);
  await persistLayout(currentScope(), next);
}

async function persistLayout(scope: string, next: SplitNode | null) {
  await SaveLayout(scope, (next || { type: "" }) as any);
}
