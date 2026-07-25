import { TerminalView } from "@/features/terminal";
import { PaneChrome } from "./PaneChrome";

export function PaneLeaf({
  paneId,
  sessionId,
  showSidebarToggle,
  trafficInset,
}: {
  paneId: string;
  sessionId: string;
  showSidebarToggle: boolean;
  trafficInset: boolean;
}) {
  return (
    <div className="relative flex h-full w-full min-h-0 min-w-0 flex-col overflow-hidden bg-background">
      <PaneChrome
        paneId={paneId}
        sessionId={sessionId}
        showSidebarToggle={showSidebarToggle}
        trafficInset={trafficInset}
      />
      <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
        <TerminalView sessionId={sessionId} paneId={paneId} />
      </div>
    </div>
  );
}
