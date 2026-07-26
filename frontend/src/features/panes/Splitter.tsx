import { useRef } from "react";
import { cn } from "@/lib/utils";

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
    dragging.current = true;
    start.current = direction === "horizontal" ? e.clientX : e.clientY;
    const parent = (e.currentTarget.parentElement as HTMLElement)?.getBoundingClientRect();
    parentSize.current = direction === "horizontal" ? parent.width : parent.height || 1;
    e.currentTarget.setPointerCapture(e.pointerId);
    document.body.style.cursor = direction === "horizontal" ? "col-resize" : "row-resize";
    document.body.style.userSelect = "none";
  };

  const flush = () => {
    raf.current = 0;
    const d = pendingDelta.current;
    pendingDelta.current = 0;
    if (d !== 0) onDrag(d);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
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
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    onDragEnd?.();
  };

  return (
    <div
      className={cn(
        "z-10 shrink-0 bg-transparent transition-colors hover:bg-foreground/10 active:bg-foreground/15",
        direction === "horizontal" ? "w-1 cursor-col-resize self-stretch" : "h-1 w-full cursor-row-resize"
      )}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    />
  );
}
