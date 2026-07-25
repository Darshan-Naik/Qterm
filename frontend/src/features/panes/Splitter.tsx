import { useRef } from "react";
import { cn } from "@/lib/utils";

export function Splitter({
  direction,
  onDrag,
}: {
  direction: "horizontal" | "vertical";
  onDrag: (deltaRatio: number) => void;
}) {
  const dragging = useRef(false);
  const start = useRef(0);
  const parentSize = useRef(1);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    start.current = direction === "horizontal" ? e.clientX : e.clientY;
    const parent = (e.currentTarget.parentElement as HTMLElement)?.getBoundingClientRect();
    parentSize.current = direction === "horizontal" ? parent.width : parent.height || 1;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    const pos = direction === "horizontal" ? e.clientX : e.clientY;
    const delta = (pos - start.current) / parentSize.current;
    start.current = pos;
    onDrag(delta);
  };

  const onPointerUp = () => {
    dragging.current = false;
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
    />
  );
}
