import { useEffect, useRef } from "react";
import { ResizeSession, SetFocusedSession } from "../../../wailsjs/go/main/App";
import { uiStore, useUI } from "@/store/ui";
import {
  attachTerminal,
  detachTerminal,
  focusTerminal,
  refreshAllTerminalThemes,
} from "./sessionTerminals";
import { TerminalFindBar } from "./TerminalFindBar";

export function TerminalView({ sessionId, paneId }: { sessionId: string; paneId: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const theme = useUI((s) => s.theme);
  const fontSize = useUI((s) => s.fontSize);
  const uiZoom = useUI((s) => s.uiZoom);
  const focusedPaneId = useUI((s) => s.focusedPaneId);
  const findOpen = useUI((s) => s.terminalFindOpen && s.focusedSessionId === sessionId);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const entry = attachTerminal(sessionId, host, { fontSize });

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
      const entry = attachTerminal(sessionId, host, { fontSize });
      entry.term.options.fontSize = fontSize;
      entry.fit.fit();
    });
  }, [theme, fontSize, uiZoom, sessionId]);

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
      }}
    >
      {findOpen ? <TerminalFindBar sessionId={sessionId} /> : null}
      <div ref={hostRef} className="absolute bottom-2.5 left-2.5 right-1 top-0 bg-background" />
    </div>
  );
}
