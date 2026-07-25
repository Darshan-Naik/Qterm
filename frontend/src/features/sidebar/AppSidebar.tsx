import { Plus, PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
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
        className="flex h-full min-w-0 flex-col bg-sidebar text-sidebar-foreground titlebar-no-drag"
      >
        <div className="flex h-[var(--titlebar-height)] shrink-0 items-center titlebar-drag pl-[var(--traffic-inset)]">
          <Button
            size="icon"
            variant="ghost"
            className="size-6 shrink-0 text-muted-foreground titlebar-no-drag"
            onClick={() => {
              uiStore.set({ sidebarOpen: false });
              void persistUIPrefs();
            }}
            title="Hide sidebar"
          >
            <PanelLeft className="size-3.5" />
          </Button>
          <div className="min-w-0 flex-1" />
        </div>
        <ScrollArea className="min-h-0 flex-1 px-1.5">
          <div className="pb-3 pt-0.5">
            <div className="mb-1 px-0.5">
              <button
                type="button"
                className="flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1 text-left text-[12.5px] text-sidebar-foreground hover:bg-sidebar-accent/40"
                onClick={() => void createDefaultTerminal()}
              >
                <Plus className="size-3.5 shrink-0 opacity-60" />
                <span>New</span>
              </button>
            </div>

            {unboundSessions.length > 0 && (
              <div className="space-y-px">
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
