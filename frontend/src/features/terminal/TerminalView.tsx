import { useEffect, useRef } from "react";
import { ResizeSession, SetFocusedSession } from "../../../wailsjs/go/main/App";
import { uiStore, useUI } from "@/store/ui";
import { cn } from "@/lib/utils";
import {
  attachTerminal,
  detachTerminal,
  focusTerminal,
  refreshAllTerminalThemes,
} from "./sessionTerminals";

export function TerminalView({ sessionId, paneId }: { sessionId: string; paneId: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const theme = useUI((s) => s.theme);
  const fontSize = useUI((s) => s.fontSize);
  const uiZoom = useUI((s) => s.uiZoom);
  const focusedPaneId = useUI((s) => s.focusedPaneId);
  const paneAnimations = useUI((s) => s.paneAnimations);
  const anim = paneAnimations[sessionId] || "none";

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const entry = attachTerminal(sessionId, host, { fontSize });

    const ro = new ResizeObserver(() => {
      entry.fit.fit();
      void ResizeSession(sessionId, entry.term.cols, entry.term.rows);
    });
    ro.observe(host);

    return () => {
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
    if (focusedPaneId === paneId) focusTerminal(sessionId);
  }, [focusedPaneId, paneId, sessionId]);

  // Pane chrome only for finite attention cues. "thinking" is sidebar-only —
  // opacity-pulsing the whole terminal on first prompt is distracting.
  const paneAnim = anim === "action_required" || anim === "task_complete" ? anim : "none";

  return (
    <div
      className={cn(
        "relative h-full w-full min-h-0 min-w-0 overflow-hidden bg-background px-2.5 pb-2.5 pt-0",
        paneAnim !== "none" && `pane-${paneAnim}`
      )}
      onMouseDown={() => {
        uiStore.set({ focusedPaneId: paneId, focusedSessionId: sessionId });
        void SetFocusedSession(sessionId);
      }}
    >
      <div ref={hostRef} className="absolute inset-x-2.5 bottom-2.5 top-0 bg-background" />
    </div>
  );
}
