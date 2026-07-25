import { PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { persistUIPrefs, uiStore, useUI } from "@/store/ui";

export function EmptyWorkspace() {
  const sidebarOpen = useUI((s) => s.sidebarOpen);

  return (
    <div className="flex h-full flex-col">
      {!sidebarOpen && (
        <div
          className="flex h-[var(--titlebar-height)] shrink-0 items-center titlebar-drag"
          style={{ paddingLeft: "var(--traffic-inset)" }}
        >
          <Button
            size="icon"
            variant="ghost"
            className="size-6 text-muted-foreground titlebar-no-drag"
            onClick={() => {
              uiStore.set({ sidebarOpen: true });
              void persistUIPrefs();
            }}
            title="Show sidebar"
          >
            <PanelLeft className="size-3.5" />
          </Button>
        </div>
      )}
      <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
        Create a terminal from the sidebar or press ⌘T
      </div>
    </div>
  );
}
