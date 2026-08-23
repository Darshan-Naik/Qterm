import { PanelLeft } from "lucide-react";
import { persistUIPrefs, uiStore, useUI } from "@/store/ui";
import { isUnbound } from "@/lib/sessions";
import { Button } from "@/components/ui/button";
import { WithTooltip } from "@/components/ui/tooltip";
import { useExclusiveMenu } from "@/hooks/useExclusiveMenu";
import { GitChip } from "@/features/git";
import { PaneMenu } from "./PaneMenu";
import { PaneTitle } from "./PaneTitle";

export function PaneChrome({
  paneId,
  sessionId,
  showSidebarToggle = false,
  trafficInset = false,
}: {
  paneId: string;
  sessionId: string;
  showSidebarToggle?: boolean;
  trafficInset?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useExclusiveMenu(`pane:${paneId}`);
  const sessions = useUI((s) => s.sessions);
  const projects = useUI((s) => s.projects);
  const session = sessions.find((x) => x.id === sessionId);
  const project =
    session && !isUnbound(session.projectId)
      ? projects.find((p) => p.id === session.projectId)
      : undefined;

  return (
    <div
      className="group/chrome flex h-[var(--titlebar-height)] shrink-0 select-none items-center gap-1.5 pr-3 titlebar-drag"
      style={{ paddingLeft: trafficInset ? "var(--traffic-inset)" : "10px" }}
    >
      {showSidebarToggle && (
        <WithTooltip label="Show sidebar">
          <Button
            size="icon"
            variant="ghost"
            className="size-6 shrink-0 text-muted-foreground titlebar-no-drag"
            onClick={() => {
              uiStore.set({ sidebarOpen: true });
              void persistUIPrefs();
            }}
          >
            <PanelLeft className="size-3.5" />
          </Button>
        </WithTooltip>
      )}

      <PaneTitle key={sessionId} sessionId={sessionId} active={menuOpen} />
      {project ? (
        <GitChip
          projectId={project.id}
          path={session?.cwd || project.path}
          projectName={project.name}
          paneId={paneId}
          variant="pane"
        />
      ) : null}
      <PaneMenu paneId={paneId} sessionId={sessionId} open={menuOpen} onOpenChange={setMenuOpen} />
    </div>
  );
}
