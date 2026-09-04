import { AppSidebar } from "@/features/sidebar";
import { SplitGrid } from "@/features/panes";

export function WorkspaceLayout() {
  return (
    <div className="flex h-full min-h-0 w-full min-w-0 bg-background text-foreground">
      <AppSidebar />
      <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
        <SplitGrid />
      </div>
    </div>
  );
}
