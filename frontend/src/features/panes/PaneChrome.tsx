import { PanelLeft } from "lucide-react";
import { persistUIPrefs, uiStore } from "@/store/ui";
import { Button } from "@/components/ui/button";
import { WithTooltip } from "@/components/ui/tooltip";
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

      <PaneTitle key={sessionId} sessionId={sessionId} />
      <PaneMenu paneId={paneId} sessionId={sessionId} />
    </div>
  );
}
