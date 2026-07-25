import { listLeaves, useUI } from "@/store/ui";
import { EmptyWorkspace } from "./EmptyWorkspace";
import { SplitNodeView } from "./SplitNodeView";

export function SplitGrid() {
  const tree = useUI((s) => s.splitTree);
  const sidebarOpen = useUI((s) => s.sidebarOpen);
  const leaves = listLeaves(tree);
  const primaryPaneId = leaves[0]?.id ?? null;

  if (!tree) {
    return <EmptyWorkspace />;
  }

  return (
    <div className="h-full w-full min-h-0 min-w-0 overflow-hidden">
      <SplitNodeView node={tree} primaryPaneId={primaryPaneId} sidebarOpen={sidebarOpen} />
      <span className="sr-only">{leaves.length} panes</span>
    </div>
  );
}
