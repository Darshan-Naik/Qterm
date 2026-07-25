import { useRef } from "react";
import { WithTooltip } from "@/components/ui/tooltip";
import { persistUIPrefs, SIDEBAR_MAX, SIDEBAR_MIN, uiStore } from "@/store/ui";

export function SidebarResizeHandle() {
  const dragging = useRef(false);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    const next = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, e.clientX));
    uiStore.set({ sidebarWidth: next });
  };

  const endDrag = () => {
    if (!dragging.current) return;
    dragging.current = false;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    void persistUIPrefs();
  };

  return (
    <WithTooltip label="Drag to resize" side="right">
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar"
        className="group relative z-20 w-1 shrink-0 cursor-col-resize self-stretch bg-transparent titlebar-no-drag hover:bg-foreground/10 active:bg-foreground/15"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      />
    </WithTooltip>
  );
}
