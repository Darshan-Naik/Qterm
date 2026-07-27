import { findLeafBySession, uiStore } from "@/store/ui";
import { focusTerminal } from "@/features/terminal/sessionTerminals";
import { formatDroppedPaths } from "@/lib/shellQuote";
import { SetFocusedSession, WriteSession } from "../../wailsjs/go/main/App";
import { OnFileDrop, OnFileDropOff } from "../../wailsjs/runtime/runtime";

function sessionIdAtPoint(x: number, y: number): string {
  const el = document.elementFromPoint(x, y) as HTMLElement | null;
  const host = el?.closest?.("[data-session-id]") as HTMLElement | null;
  return String(host?.dataset?.sessionId || "").trim();
}

/**
 * OS file/folder drop → shell-quoted paths into the pane under the cursor
 * (fallback: focused session), same as iTerm / Ghostty / VS Code.
 */
export function subscribeFileDrop(): () => void {
  OnFileDrop((x, y, paths) => {
    if (!paths?.length) return;

    let sessionId = sessionIdAtPoint(x, y);
    if (!sessionId) {
      sessionId = String(uiStore.get().focusedSessionId || "").trim();
    }
    if (!sessionId) return;

    const text = formatDroppedPaths(paths);
    if (!text) return;

    const tree = uiStore.get().splitTree;
    const pane = findLeafBySession(tree, sessionId);
    if (pane) {
      uiStore.set({ focusedPaneId: pane.id, focusedSessionId: sessionId });
    } else {
      uiStore.set({ focusedSessionId: sessionId });
    }
    void SetFocusedSession(sessionId);
    focusTerminal(sessionId);
    void WriteSession(sessionId, text).catch(() => {});
  }, false);

  return () => {
    OnFileDropOff();
  };
}
