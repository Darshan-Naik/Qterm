import { DEFAULT_SCOPE } from "@/lib/sessions";
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
  const { splitTree, activeScope } = uiStore.get();
  if (!splitTree) return;
  const next = removePane(splitTree, paneId);
  const nextLeaves = listLeaves(next);
  uiStore.set({
    splitTree: next,
    focusedPaneId: nextLeaves[0]?.id || null,
    focusedSessionId: nextLeaves[0]?.sessionId || null,
  });
  await persistLayout(activeScope || DEFAULT_SCOPE, next);
}

/** Close every pane showing this session in the current layout (UI only). */
export async function closeSessionPanes(sessionId: string) {
  const { splitTree, activeScope } = uiStore.get();
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
  await persistLayout(activeScope || DEFAULT_SCOPE, next);
}

/** Delete session: kill PTY, erase history, remove from sidebar and layouts. */
export async function deleteSession(sessionId: string) {
  const { splitTree, activeScope, sessions } = uiStore.get();
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
  await persistLayout(activeScope || DEFAULT_SCOPE, next);
}

async function persistLayout(scope: string, next: SplitNode | null) {
  await SaveLayout(scope, (next || { type: "" }) as any);
}
