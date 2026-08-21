import { useEffect, useMemo, useState, type DragEvent } from "react";
import { PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WithTooltip } from "@/components/ui/tooltip";
import { persistUIPrefs, uiStore, useUI } from "@/store/ui";
import { cn } from "@/lib/utils";
import { isUnbound } from "@/lib/sessions";
import {
  dropSessionOnOpenWorkspace,
  getActiveSessionDragId,
  isSessionDrag,
  isSessionDragActive,
  markSessionDropHandled,
  readDraggedSessionId,
  subscribeSessionDrag,
  trackSessionDragPoint,
} from "@/lib/sessionDrag";
import { OpenSessionGrid } from "./OpenSessionGrid";
import { WorkspaceStart } from "./WorkspaceStart";
import { WorkspaceActions } from "./WorkspaceActions";

export function OpenWorkspace() {
  const sidebarOpen = useUI((s) => s.sidebarOpen);
  const sessions = useUI((s) => s.sessions);
  const projects = useUI((s) => s.projects);
  // List screen when there are projects or pickable sessions; Get started only when neither.
  const showGrid = useMemo(() => {
    if (projects.length > 0) return true;
    if (!sessions.length) return false;
    const projectIds = new Set(projects.map((p) => p.id));
    return sessions.some((s) => isUnbound(s.projectId) || projectIds.has(s.projectId));
  }, [sessions, projects]);
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
      void dropSessionOnOpenWorkspace(id);
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
          "relative m-2 flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg transition-colors",
          over
            ? "border border-primary/50 bg-primary/10"
            : "border-0 bg-background/40"
        )}
        onDragOver={onDragOver}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        data-drop-open-workspace=""
      >
        {over ? (
          <div className="flex flex-1 flex-col items-center justify-center text-[13px] text-foreground">
            Drop to open terminal
          </div>
        ) : showGrid ? (
          <>
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 px-5 pb-2 pt-3">
              <div className="min-w-0">
                <p className="text-[14px] font-medium text-muted-foreground">Open a terminal</p>
                <p className="text-[11px] text-muted-foreground/70">
                  Pick a session, or create a new one
                </p>
              </div>
              <WorkspaceActions size="sm" />
            </div>
            <OpenSessionGrid />
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center px-6">
            <WorkspaceStart />
          </div>
        )}
      </div>
    </div>
  );
}
