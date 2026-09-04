import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import { cn } from "@/lib/utils";
import {
  dropSessionOnPane,
  getActiveSessionDragId,
  isSessionDrag,
  markSessionDropHandled,
  readDraggedSessionId,
  splitEdgeFromPoint,
  subscribeSessionDrag,
  trackSessionDragPoint,
  type DropEdge,
} from "@/lib/sessionDrag";
import { TerminalView } from "@/features/terminal";
import { PaneChrome } from "./PaneChrome";

export function PaneLeaf({
  paneId,
  sessionId,
  showSidebarToggle,
  trafficInset,
}: {
  paneId: string;
  sessionId: string;
  showSidebarToggle: boolean;
  trafficInset: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState<Exclude<DropEdge, "center"> | null>(null);
  const [dragArmed, setDragArmed] = useState(false);

  const clear = useCallback(() => setEdge(null), []);

  useEffect(
    () =>
      subscribeSessionDrag(() => {
        const armed = !!getActiveSessionDragId();
        setDragArmed(armed);
        if (!armed) clear();
      }),
    [clear]
  );

  const onDragOver = (e: DragEvent) => {
    if (!isSessionDrag(e) && !getActiveSessionDragId()) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    trackSessionDragPoint(e.clientX, e.clientY);
    const el = rootRef.current;
    if (!el) return;
    setEdge(splitEdgeFromPoint(el.getBoundingClientRect(), e.clientX, e.clientY));
  };

  const onDrop = (e: DragEvent) => {
    if (!isSessionDrag(e) && !getActiveSessionDragId()) return;
    e.preventDefault();
    e.stopPropagation();
    const id = readDraggedSessionId(e);
    const el = rootRef.current;
    const nextEdge = el
      ? splitEdgeFromPoint(el.getBoundingClientRect(), e.clientX, e.clientY)
      : edge || "right";
    clear();
    if (!id) return;
    markSessionDropHandled();
    void dropSessionOnPane(id, paneId, nextEdge);
  };

  return (
    <div
      ref={rootRef}
      data-pane-id={paneId}
      className="group/pane relative flex h-full w-full min-h-0 min-w-0 flex-col overflow-hidden bg-background"
      onDragOverCapture={onDragOver}
      onDropCapture={onDrop}
    >
      <PaneChrome
        paneId={paneId}
        sessionId={sessionId}
        showSidebarToggle={showSidebarToggle}
        trafficInset={trafficInset}
      />
      <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
        <TerminalView sessionId={sessionId} paneId={paneId} />
        {edge ? <DropIndicator edge={edge} /> : null}
        {dragArmed ? (
          <div
            data-session-drag-overlay=""
            className="absolute inset-0 z-30"
            onDragOver={onDragOver}
            onDrop={onDrop}
            onDragLeave={(e) => {
              if (e.currentTarget.contains(e.relatedTarget as Node)) return;
              clear();
            }}
          />
        ) : null}
      </div>
    </div>
  );
}

function DropIndicator({ edge }: { edge: Exclude<DropEdge, "center"> }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      <div
        className={cn(
          "absolute bg-primary/25 ring-1 ring-inset ring-primary/50 transition-[inset]",
          edge === "left" && "inset-y-1 left-1 w-1/2 rounded-md",
          edge === "right" && "inset-y-1 right-1 w-1/2 rounded-md",
          edge === "top" && "inset-x-1 top-1 h-1/2 rounded-md",
          edge === "bottom" && "inset-x-1 bottom-1 h-1/2 rounded-md"
        )}
      />
    </div>
  );
}
