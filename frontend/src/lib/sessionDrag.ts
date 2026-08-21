import { scopeKey } from "@/lib/sessions";
import {
  findLeafBySession,
  leaf,
  listLeaves,
  removePane,
  splitPane,
  uiStore,
  type SplitNode,
} from "@/store/ui";
import { SaveActiveScope, SaveLayout, SetFocusedSession } from "../../wailsjs/go/main/App";

export const SESSION_DRAG_MIME = "application/x-qterm-session";

export type DropEdge = "left" | "right" | "top" | "bottom" | "center";

/**
 * Same-window drag state. WKWebView often never fires HTML5 `drop` (only
 * dragover + dragend) when DisableWebViewDrop is on — we synthesize on dragend.
 */
let activeSessionDragId: string | null = null;
let lastSessionDragId: string | null = null;
let clearLastTimer = 0;
let dropHandled = false;
let lastPointer = { x: 0, y: 0 };
const dragListeners = new Set<() => void>();

function notifyDragListeners() {
  for (const fn of dragListeners) fn();
}

export function beginSessionDrag(sessionId: string) {
  window.clearTimeout(clearLastTimer);
  activeSessionDragId = sessionId;
  lastSessionDragId = sessionId;
  dropHandled = false;
  notifyDragListeners();
}

/** Track pointer during dragover so dragend can hit-test when `drop` never fires. */
export function trackSessionDragPoint(clientX: number, clientY: number) {
  lastPointer = { x: clientX, y: clientY };
}

export function markSessionDropHandled() {
  dropHandled = true;
}

/**
 * Called from dragend. If WKWebView skipped the `drop` event, open/split from
 * the last pointer position.
 */
export function finishSessionDragFromPoint(sessionId: string) {
  if (dropHandled) {
    endSessionDrag();
    return;
  }

  const { x, y } = lastPointer;
  const overlays = document.querySelectorAll<HTMLElement>("[data-session-drag-overlay]");
  overlays.forEach((el) => {
    el.style.pointerEvents = "none";
  });
  const el = document.elementFromPoint(x, y) as HTMLElement | null;
  overlays.forEach((node) => {
    node.style.pointerEvents = "";
  });

  const pane = el?.closest?.("[data-pane-id]") as HTMLElement | null;
  const empty = el?.closest?.("[data-drop-empty]") as HTMLElement | null;

  if (pane?.dataset?.paneId) {
    const rect = pane.getBoundingClientRect();
    const edge = splitEdgeFromPoint(rect, x, y);
    dropHandled = true;
    void dropSessionOnPane(sessionId, pane.dataset.paneId, edge);
  } else if (empty) {
    dropHandled = true;
    void dropSessionOnEmpty(sessionId);
  }

  endSessionDrag();
}

export function endSessionDrag() {
  activeSessionDragId = null;
  notifyDragListeners();
  window.clearTimeout(clearLastTimer);
  clearLastTimer = window.setTimeout(() => {
    lastSessionDragId = null;
    notifyDragListeners();
  }, 100);
}

export function getActiveSessionDragId(): string | null {
  return activeSessionDragId ?? lastSessionDragId;
}

export function isSessionDragActive(): boolean {
  return activeSessionDragId != null;
}

export function subscribeSessionDrag(listener: () => void): () => void {
  dragListeners.add(listener);
  return () => {
    dragListeners.delete(listener);
  };
}

export function isSessionDrag(e: { dataTransfer: DataTransfer | null }): boolean {
  if (activeSessionDragId || lastSessionDragId) return true;
  const types = Array.from(e.dataTransfer?.types || []);
  if (types.includes(SESSION_DRAG_MIME)) return true;
  if (types.includes("text/plain")) {
    const plain = e.dataTransfer?.getData("text/plain") || "";
    if (plain.startsWith("qterm-session:")) return true;
  }
  return false;
}

export function readDraggedSessionId(e: { dataTransfer: DataTransfer | null }): string {
  if (activeSessionDragId) return activeSessionDragId;
  if (lastSessionDragId) return lastSessionDragId;
  const custom = e.dataTransfer?.getData(SESSION_DRAG_MIME)?.trim();
  if (custom) return custom;
  const plain = e.dataTransfer?.getData("text/plain")?.trim() || "";
  if (plain.startsWith("qterm-session:")) return plain.slice("qterm-session:".length).trim();
  return "";
}

export function dropEdgeFromPoint(rect: DOMRect, clientX: number, clientY: number): DropEdge {
  const x = (clientX - rect.left) / Math.max(1, rect.width);
  const y = (clientY - rect.top) / Math.max(1, rect.height);
  const m = 0.35;
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

export function splitEdgeFromPoint(rect: DOMRect, clientX: number, clientY: number): Exclude<DropEdge, "center"> {
  const edge = dropEdgeFromPoint(rect, clientX, clientY);
  if (edge !== "center") return edge;
  const x = (clientX - rect.left) / Math.max(1, rect.width);
  return x < 0.5 ? "left" : "right";
}

async function persist(scope: string, tree: SplitNode | null) {
  await SaveLayout(scope, (tree || { type: "" }) as any);
}

export async function dropSessionOnEmpty(sessionId: string) {
  const state = uiStore.get();
  const session = state.sessions.find((s) => s.id === sessionId);
  if (!session) return;

  // Persist current project layout before switching away.
  if (state.splitTree && state.activeScope) {
    await persist(state.activeScope, state.splitTree);
  }

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
 * Drop a sidebar terminal onto a pane → always split into the current layout
 * (sessions from any project can share one window).
 */
export async function dropSessionOnPane(
  sessionId: string,
  targetPaneId: string,
  edge: Exclude<DropEdge, "center">
) {
  const state = uiStore.get();
  const session = state.sessions.find((s) => s.id === sessionId);
  if (!session) return;

  const layoutScope = state.activeScope || scopeKey(session.projectId);

  let tree = state.splitTree;
  if (!tree) {
    await dropSessionOnEmpty(sessionId);
    return;
  }

  const target = listLeaves(tree).find((l) => l.id === targetPaneId);
  if (!target) return;

  if (target.sessionId === sessionId && listLeaves(tree).length === 1) {
    uiStore.set({ focusedPaneId: targetPaneId, focusedSessionId: sessionId });
    void SetFocusedSession(sessionId);
    return;
  }

  for (const l of listLeaves(tree)) {
    if (l.sessionId === sessionId && l.id !== targetPaneId) {
      const next = removePane(tree, l.id);
      if (!next) {
        await dropSessionOnEmpty(sessionId);
        return;
      }
      tree = next;
    }
  }

  if (!listLeaves(tree).some((l) => l.id === targetPaneId)) {
    await dropSessionOnEmpty(sessionId);
    return;
  }

  const targetAfter = listLeaves(tree).find((l) => l.id === targetPaneId);
  if (targetAfter?.sessionId === sessionId) {
    uiStore.set({ focusedPaneId: targetPaneId, focusedSessionId: sessionId });
    void SetFocusedSession(sessionId);
    await persist(layoutScope, tree);
    return;
  }

  const direction = edge === "left" || edge === "right" ? "horizontal" : "vertical";
  const place = edge === "left" || edge === "top" ? "before" : "after";
  tree = splitPane(tree, targetPaneId, direction, sessionId, place);
  const shown = findLeafBySession(tree, sessionId);

  uiStore.set({
    splitTree: tree,
    focusedPaneId: shown?.id ?? targetPaneId,
    focusedSessionId: sessionId,
  });
  void SetFocusedSession(sessionId);
  await persist(layoutScope, tree);
}
