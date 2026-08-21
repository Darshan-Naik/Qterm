import { useRef } from "react";
import { cn } from "@/lib/utils";
import { beginDragResize, endDragResize } from "@/lib/dragResize";

export function Splitter({
  direction,
  onDrag,
  onDragEnd,
}: {
  direction: "horizontal" | "vertical";
  onDrag: (deltaRatio: number) => void;
  onDragEnd?: () => void;
}) {
  const dragging = useRef(false);
  const start = useRef(0);
  const parentSize = useRef(1);
  const pendingDelta = useRef(0);
  const raf = useRef(0);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragging.current = true;
    start.current = direction === "horizontal" ? e.clientX : e.clientY;
    const parent = (e.currentTarget.parentElement as HTMLElement)?.getBoundingClientRect();
    parentSize.current = direction === "horizontal" ? parent.width : parent.height || 1;
    e.currentTarget.setPointerCapture(e.pointerId);
    beginDragResize(direction === "horizontal" ? "col-resize" : "row-resize");
  };

  const flush = () => {
    raf.current = 0;
    const d = pendingDelta.current;
    pendingDelta.current = 0;
    if (d !== 0) onDrag(d);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    e.preventDefault();
    const pos = direction === "horizontal" ? e.clientX : e.clientY;
    pendingDelta.current += (pos - start.current) / parentSize.current;
    start.current = pos;
    if (raf.current) return;
    raf.current = requestAnimationFrame(flush);
  };

  const onPointerUp = () => {
    if (!dragging.current) return;
    dragging.current = false;
    if (raf.current) {
      cancelAnimationFrame(raf.current);
      flush();
    }
    endDragResize();
    onDragEnd?.();
  };

  const horizontal = direction === "horizontal";

  return (
    <div
      role="separator"
      aria-orientation={horizontal ? "vertical" : "horizontal"}
      className={cn(
        "group relative z-10 shrink-0 touch-none",
        horizontal ? "w-1.5 cursor-col-resize self-stretch" : "h-1.5 w-full cursor-row-resize"
      )}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div
        className={cn(
          "absolute bg-border transition-colors group-hover:bg-foreground/25 group-active:bg-foreground/35",
          horizontal
            ? "inset-y-0 left-1/2 w-px -translate-x-1/2"
            : "inset-x-0 top-1/2 h-px -translate-y-1/2"
        )}
      />
    </div>
  );
}
