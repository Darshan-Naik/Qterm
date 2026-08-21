import { useEffect, useState, type DragEvent } from "react";
import { PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WithTooltip } from "@/components/ui/tooltip";
import { persistUIPrefs, uiStore, useUI } from "@/store/ui";
import { cn } from "@/lib/utils";
import {
  dropSessionOnEmpty,
  getActiveSessionDragId,
  isSessionDrag,
  isSessionDragActive,
  markSessionDropHandled,
  readDraggedSessionId,
  subscribeSessionDrag,
  trackSessionDragPoint,
} from "@/lib/sessionDrag";

export function EmptyWorkspace() {
  const sidebarOpen = useUI((s) => s.sidebarOpen);
  const [over, setOver] = useState(false);

  useEffect(
    () =>
      subscribeSessionDrag(() => {
        if (!isSessionDragActive()) setOver(false);
      }),
    []
  );

  const onDragOver = (e: DragEvent) => {
    if (!isSessionDrag(e) && !getActiveSessionDragId()) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    trackSessionDragPoint(e.clientX, e.clientY);
    setOver(true);
  };

  const onDrop = (e: DragEvent) => {
    if (!isSessionDrag(e) && !getActiveSessionDragId()) return;
    e.preventDefault();
    e.stopPropagation();
    setOver(false);
    const id = readDraggedSessionId(e);
    if (id) {
      markSessionDropHandled();
      void dropSessionOnEmpty(id);
    }
  };

  return (
    <div className="flex h-full flex-col">
      {!sidebarOpen && (
        <div
          className="flex h-[var(--titlebar-height)] shrink-0 items-center titlebar-drag"
          style={{ paddingLeft: "var(--traffic-inset)" }}
        >
          <WithTooltip label="Show sidebar">
            <Button
              size="icon"
              variant="ghost"
              className="size-6 text-muted-foreground titlebar-no-drag"
              onClick={() => {
                uiStore.set({ sidebarOpen: true });
                void persistUIPrefs();
              }}
            >
              <PanelLeft className="size-3.5" />
            </Button>
          </WithTooltip>
        </div>
      )}
      <div
        className={cn(
          "m-2 flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed text-xs transition-colors",
          over
            ? "border-primary/50 bg-primary/10 text-foreground"
            : "border-transparent text-muted-foreground"
        )}
        onDragOver={onDragOver}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        data-drop-empty=""
      >
        {over ? "Drop to open terminal" : "Create a terminal from the sidebar or press ⌘T"}
        <span className="mt-1 text-[11px] text-muted-foreground/80">
          Drag a terminal from the sidebar to split
        </span>
      </div>
    </div>
  );
}
