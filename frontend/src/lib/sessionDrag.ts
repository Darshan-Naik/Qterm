import { DEFAULT_SCOPE, scopeKey } from "@/lib/sessions";
import {
  findLeafBySession,
  leaf,
  listLeaves,
  removePane,
  replaceLeafSession,
  splitPane,
  uiStore,
  type SplitNode,
} from "@/store/ui";
import { SaveActiveScope, SaveLayout, SetFocusedSession } from "../../wailsjs/go/main/App";

export const SESSION_DRAG_MIME = "application/x-qterm-session";

export type DropEdge = "left" | "right" | "top" | "bottom" | "center";

export function isSessionDrag(e: { dataTransfer: DataTransfer | null }): boolean {
  return Array.from(e.dataTransfer?.types || []).includes(SESSION_DRAG_MIME);
}

export function readDraggedSessionId(e: { dataTransfer: DataTransfer | null }): string {
  return (
    e.dataTransfer?.getData(SESSION_DRAG_MIME) ||
    e.dataTransfer?.getData("text/plain") ||
    ""
  ).trim();
}

/** Edge zone from pointer position inside a pane (outer 28% = split side). */
export function dropEdgeFromPoint(rect: DOMRect, clientX: number, clientY: number): DropEdge {
  const x = (clientX - rect.left) / Math.max(1, rect.width);
  const y = (clientY - rect.top) / Math.max(1, rect.height);
  const m = 0.28;
  const distLeft = x;
  const distRight = 1 - x;
  const distTop = y;
  const distBottom = 1 - y;
  const min = Math.min(distLeft, distRight, distTop, distBottom);
  if (min > m) return "center";
  if (min === distLeft) return "left";
  if (min === distRight) return "right";
  if (min === distTop) return "top";
  return "bottom";
}

async function persist(scope: string, tree: SplitNode | null) {
  await SaveLayout(scope, (tree || { type: "" }) as any);
}

/** Show a session as the sole pane (empty workspace drop). */
export async function dropSessionOnEmpty(sessionId: string) {
  const state = uiStore.get();
  const session = state.sessions.find((s) => s.id === sessionId);
  if (!session) return;

  const scope = scopeKey(session.projectId);
  const n = leaf(sessionId);
  uiStore.set({
    activeScope: scope,
    splitTree: n,
    focusedPaneId: n.id,
    focusedSessionId: sessionId,
  });
  void SetFocusedSession(sessionId);
  void SaveActiveScope(scope);
  await persist(scope, n);
}

/**
 * Drop a sidebar terminal onto a pane.
 * - Edges → split (left/right horizontal, top/bottom vertical)
 * - Center → replace this pane's session
 * If the session is already open elsewhere, those panes are closed first (move).
 */
export async function dropSessionOnPane(sessionId: string, targetPaneId: string, edge: DropEdge) {
  const state = uiStore.get();
  const session = state.sessions.find((s) => s.id === sessionId);
  if (!session) return;

  let tree = state.splitTree;
  if (!tree) {
    await dropSessionOnEmpty(sessionId);
    return;
  }

  const target = listLeaves(tree).find((l) => l.id === targetPaneId);
  if (!target) return;

  // Already only this pane → focus.
  if (target.sessionId === sessionId && edge === "center") {
    uiStore.set({ focusedPaneId: targetPaneId, focusedSessionId: sessionId });
    void SetFocusedSession(sessionId);
    return;
  }
  if (target.sessionId === sessionId && edge !== "center") {
    // Splitting a pane with itself is a no-op.
    return;
  }

  // Move: detach other panes showing this session so xterm isn't dual-mounted.
  for (const l of listLeaves(tree)) {
    if (l.sessionId === sessionId && l.id !== targetPaneId) {
      const next = removePane(tree, l.id);
      if (!next) {
        // Tree emptied somehow — open as sole leaf.
        await dropSessionOnEmpty(sessionId);
        return;
      }
      tree = next;
    }
  }

  // Target may have been removed if it was the only other occurrence — re-check.
  if (!listLeaves(tree).some((l) => l.id === targetPaneId)) {
    await dropSessionOnEmpty(sessionId);
    return;
  }

  const scope = state.activeScope || DEFAULT_SCOPE;
  let focusedPaneId = targetPaneId;

  if (edge === "center") {
    tree = replaceLeafSession(tree, targetPaneId, sessionId);
  } else {
    const direction = edge === "left" || edge === "right" ? "horizontal" : "vertical";
    const place = edge === "left" || edge === "top" ? "before" : "after";
    tree = splitPane(tree, targetPaneId, direction, sessionId, place);
    const shown = findLeafBySession(tree, sessionId);
    if (shown) focusedPaneId = shown.id;
  }

  uiStore.set({
    splitTree: tree,
    focusedPaneId,
    focusedSessionId: sessionId,
  });
  void SetFocusedSession(sessionId);
  await persist(scope, tree);
}
