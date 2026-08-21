import { useMemo } from "react";
import { Plus, PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WithTooltip } from "@/components/ui/tooltip";
import { persistUIPrefs, collectSessionIds, uiStore, useUI } from "@/store/ui";
import { createDefaultTerminal, isUnbound } from "@/lib/sessions";
import { cn } from "@/lib/utils";
import { SessionRow } from "./SessionRow";
import { ProjectsSection } from "./ProjectsSection";
import { SidebarResizeHandle } from "./SidebarResizeHandle";
import { SIDEBAR_STICKY_SEAL, sidebarShellWidth } from "./sidebarLayout";

export function AppSidebar() {
  const open = useUI((s) => s.sidebarOpen);
  const width = useUI((s) => s.sidebarWidth);
  const sessions = useUI((s) => s.sessions);
  const splitTree = useUI((s) => s.splitTree);
  const unboundSessions = useMemo(
    () => sessions.filter((s) => isUnbound(s.projectId)),
    [sessions]
  );
  const layoutIds = useMemo(() => new Set(collectSessionIds(splitTree)), [splitTree]);
  const unboundOpenIds = useMemo(
    () => new Set(unboundSessions.map((s) => s.id).filter((id) => layoutIds.has(id))),
    [unboundSessions, layoutIds]
  );
  const shellWidth = sidebarShellWidth(width);

  return (
    <div
      className="motion-sidebar flex h-full shrink-0 overflow-hidden"
      style={{ width: open ? shellWidth : 0 }}
      aria-hidden={!open}
    >
      <div className="flex h-full min-w-0" style={{ width: shellWidth }}>
        <aside
          style={{ width }}
          className="flex h-full min-w-0 flex-col select-none bg-sidebar text-sidebar-foreground titlebar-no-drag"
        >
          <div className="flex h-[var(--titlebar-height)] shrink-0 items-center titlebar-drag pl-[var(--traffic-inset)]">
            <WithTooltip label="Hide sidebar">
              <Button
                size="icon"
                variant="ghost"
                className="size-7 shrink-0 text-muted-foreground titlebar-no-drag"
                onClick={() => {
                  uiStore.set({ sidebarOpen: false });
                  void persistUIPrefs();
                }}
              >
                <PanelLeft className="size-4" />
              </Button>
            </WithTooltip>
            <div className="min-w-0 flex-1" />
          </div>

          {/* Always pinned — not part of the scroll region. */}
          <div className={cn("relative z-30 shrink-0 bg-sidebar px-3 pb-1 pt-1", SIDEBAR_STICKY_SEAL)}>
            <WithTooltip label="New terminal in home" side="right">
              <button
                type="button"
                className="flex w-full min-w-0 cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] leading-snug text-sidebar-foreground hover:bg-sidebar-accent/50"
                onClick={() => void createDefaultTerminal()}
              >
                <Plus className="size-4 shrink-0 opacity-60" />
                <span>New</span>
              </button>
            </WithTooltip>
          </div>

          {/* Native overflow so position:sticky works (Radix ScrollArea breaks it). */}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-4">
            {unboundSessions.length > 0 && (
              <div className="mt-1 space-y-0.5">
                {unboundSessions.map((s) => (
                  <SessionRow key={s.id} session={s} openInPane={unboundOpenIds.has(s.id)} />
                ))}
              </div>
            )}

            <ProjectsSection />
          </div>
        </aside>
        <SidebarResizeHandle disabled={!open} />
      </div>
    </div>
  );
}
