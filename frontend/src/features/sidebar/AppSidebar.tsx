import { Plus, PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WithTooltip } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { persistUIPrefs, uiStore, useUI } from "@/store/ui";
import { createDefaultTerminal, isUnbound } from "@/lib/sessions";
import { SessionRow } from "./SessionRow";
import { ProjectsSection } from "./ProjectsSection";
import { SidebarResizeHandle } from "./SidebarResizeHandle";

export function AppSidebar() {
  const open = useUI((s) => s.sidebarOpen);
  const width = useUI((s) => s.sidebarWidth);
  const unboundSessions = useUI((s) => s.sessions.filter((s) => isUnbound(s.projectId)));

  if (!open) return null;

  return (
    <div className="flex h-full shrink-0">
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
        <ScrollArea className="min-h-0 flex-1 px-2">
          <div className="pb-4 pt-1">
            <div className="mb-1">
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

            {unboundSessions.length > 0 && (
              <div className="mt-2 space-y-0.5">
                {unboundSessions.map((s) => (
                  <SessionRow key={s.id} session={s} />
                ))}
              </div>
            )}

            <ProjectsSection />
          </div>
        </ScrollArea>
      </aside>
      <SidebarResizeHandle />
    </div>
  );
}
