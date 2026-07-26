import { useCallback, useRef, useState, type DragEvent } from "react";
import { cn } from "@/lib/utils";
import {
  dropEdgeFromPoint,
  dropSessionOnPane,
  isSessionDrag,
  readDraggedSessionId,
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
  const [edge, setEdge] = useState<DropEdge | null>(null);

  const clear = useCallback(() => setEdge(null), []);

  const onDragOver = (e: DragEvent) => {
    if (!isSessionDrag(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const el = rootRef.current;
    if (!el) return;
    setEdge(dropEdgeFromPoint(el.getBoundingClientRect(), e.clientX, e.clientY));
  };

  const onDrop = (e: DragEvent) => {
    if (!isSessionDrag(e)) return;
    e.preventDefault();
    e.stopPropagation();
    const id = readDraggedSessionId(e);
    const el = rootRef.current;
    const nextEdge = el
      ? dropEdgeFromPoint(el.getBoundingClientRect(), e.clientX, e.clientY)
      : edge || "center";
    clear();
    if (id) void dropSessionOnPane(id, paneId, nextEdge);
  };

  return (
    <div
      ref={rootRef}
      className="relative flex h-full w-full min-h-0 min-w-0 flex-col overflow-hidden bg-background"
      onDragOver={onDragOver}
      onDragLeave={(e) => {
        // Ignore leave events that stay inside this pane (entering children).
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        clear();
      }}
      onDrop={onDrop}
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
      </div>
    </div>
  );
}

function DropIndicator({ edge }: { edge: DropEdge }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      <div
        className={cn(
          "absolute bg-primary/25 ring-1 ring-inset ring-primary/50 transition-[inset]",
          edge === "center" && "inset-2 rounded-md",
          edge === "left" && "inset-y-1 left-1 w-1/2 rounded-md",
          edge === "right" && "inset-y-1 right-1 w-1/2 rounded-md",
          edge === "top" && "inset-x-1 top-1 h-1/2 rounded-md",
          edge === "bottom" && "inset-x-1 bottom-1 h-1/2 rounded-md"
        )}
      />
    </div>
  );
}
