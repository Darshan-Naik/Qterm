import { useRef } from "react";
import { cn } from "@/lib/utils";
import { beginDragResize, endDragResize } from "@/lib/dragResize";
import { WithTooltip } from "@/components/ui/tooltip";
import { clampSidebarWidth, persistUIPrefs, uiStore } from "@/store/ui";

export function SidebarResizeHandle({ disabled = false }: { disabled?: boolean }) {
  const dragging = useRef(false);
  const pending = useRef(0);
  const raf = useRef(0);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    e.preventDefault();
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    beginDragResize("col-resize");
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    e.preventDefault();
    pending.current = clampSidebarWidth(e.clientX);
    if (raf.current) return;
    raf.current = requestAnimationFrame(() => {
      raf.current = 0;
      uiStore.set({ sidebarWidth: pending.current });
    });
  };

  const endDrag = () => {
    if (!dragging.current) return;
    dragging.current = false;
    if (raf.current) {
      cancelAnimationFrame(raf.current);
      raf.current = 0;
      uiStore.set({ sidebarWidth: pending.current });
    }
    endDragResize();
    void persistUIPrefs();
  };

  return (
    <WithTooltip label="Drag to resize" side="right">
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar"
        className={cn(
          "group relative z-20 w-1 shrink-0 touch-none self-stretch bg-transparent titlebar-no-drag",
          disabled
            ? "pointer-events-none cursor-default"
            : "cursor-col-resize hover:bg-foreground/10 active:bg-foreground/15"
        )}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      />
    </WithTooltip>
  );
}
