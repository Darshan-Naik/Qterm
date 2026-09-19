import { useEffect, useRef } from "react";
import { ResizeSession, SetFocusedSession } from "../../../wailsjs/go/main/App";
import { uiStore, useUI } from "@/store/ui";
import { dismissSessionComplete } from "@/lib/sessionAnim";
import {
  attachTerminal,
  detachTerminal,
  focusTerminal,
  refreshAllTerminalThemes,
} from "./sessionTerminals";
import { TerminalFindBar } from "./TerminalFindBar";

/**
 * The app is zoomed with CSS `zoom` on #root, which xterm's mouse -> cell math
 * can't see (pointer px are zoomed, cell size isn't), so selection lands on the
 * wrong cells. The host below cancels that zoom; the terminal is zoomed by
 * font size instead, which xterm measures correctly.
 */
const scaledFontSize = (fontSize: number, uiZoom: number) =>
  Math.round(fontSize * (uiZoom / 100) * 10) / 10;

export function TerminalView({ sessionId, paneId }: { sessionId: string; paneId: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const theme = useUI((s) => s.theme);
  const fontSize = useUI((s) => s.fontSize);
  const uiZoom = useUI((s) => s.uiZoom);
  const termFontSize = scaledFontSize(fontSize, uiZoom);
  const focusedPaneId = useUI((s) => s.focusedPaneId);
  const findOpen = useUI((s) => s.terminalFindOpen && s.focusedSessionId === sessionId);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const entry = attachTerminal(sessionId, host, { fontSize: termFontSize });

    let resizeTimer = 0;
    const ro = new ResizeObserver(() => {
      entry.fit.fit();
      // Fit immediately for crisp local layout; debounce PTY resize IPC.
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        void ResizeSession(sessionId, entry.term.cols, entry.term.rows);
      }, 80);
    });
    ro.observe(host);

    return () => {
      window.clearTimeout(resizeTimer);
      ro.disconnect();
      detachTerminal(sessionId, host);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    // Wait a frame so .dark class / CSS vars have applied.
    requestAnimationFrame(() => {
      refreshAllTerminalThemes();
      const entry = attachTerminal(sessionId, host, { fontSize: termFontSize });
      entry.term.options.fontSize = termFontSize;
      entry.fit.fit();
    });
  }, [theme, termFontSize, sessionId]);

  useEffect(() => {
    if (focusedPaneId === paneId && !findOpen) focusTerminal(sessionId);
  }, [focusedPaneId, paneId, sessionId, findOpen]);

  return (
    <div
      data-session-id={sessionId}
      className="relative h-full w-full min-h-0 min-w-0 overflow-hidden bg-background pb-2.5 pl-2.5 pr-1 pt-0"
      onMouseDown={() => {
        uiStore.set({ focusedPaneId: paneId, focusedSessionId: sessionId });
        void SetFocusedSession(sessionId);
        dismissSessionComplete(sessionId);
      }}
    >
      {findOpen ? <TerminalFindBar sessionId={sessionId} /> : null}
      <div
        ref={hostRef}
        className="absolute bottom-2.5 left-2.5 right-1 top-0 bg-background"
        style={{ zoom: 100 / uiZoom }}
      />
    </div>
  );
}
