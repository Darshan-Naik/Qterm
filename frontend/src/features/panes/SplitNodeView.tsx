import { useCallback } from "react";
import { setSplitSize, uiStore, type SplitNode } from "@/store/ui";
import { cn } from "@/lib/utils";
import { PaneLeaf } from "./PaneLeaf";
import { Splitter } from "./Splitter";

export function SplitNodeView({
  node,
  primaryPaneId,
  sidebarOpen,
}: {
  node: SplitNode;
  primaryPaneId: string | null;
  sidebarOpen: boolean;
}) {
  const onResize = useCallback(
    (delta: number) => {
      const tree = uiStore.get().splitTree;
      if (!tree || node.type !== "split") return;
      const nextSize = Math.min(0.85, Math.max(0.15, node.size + delta));
      uiStore.set({ splitTree: setSplitSize(tree, node.id, nextSize) });
    },
    [node]
  );

  if (node.type === "leaf") {
    const isPrimary = node.id === primaryPaneId;
    const showSidebarToggle = !sidebarOpen && isPrimary;
    const trafficInset = !sidebarOpen && isPrimary;

    return (
      <PaneLeaf
        paneId={node.id}
        sessionId={node.sessionId}
        showSidebarToggle={showSidebarToggle}
        trafficInset={trafficInset}
      />
    );
  }

  const horizontal = node.direction === "horizontal";
  return (
    <div className={cn("flex h-full w-full min-h-0 min-w-0", horizontal ? "flex-row" : "flex-col")}>
      <div
        className="min-h-0 min-w-0 overflow-hidden"
        style={{
          flexBasis: `${node.size * 100}%`,
          flexGrow: 0,
          flexShrink: 0,
          ...(horizontal ? { height: "100%" } : { width: "100%" }),
        }}
      >
        <SplitNodeView node={node.children[0]} primaryPaneId={primaryPaneId} sidebarOpen={sidebarOpen} />
      </div>
      <Splitter direction={node.direction} onDrag={onResize} />
      <div
        className="min-h-0 min-w-0 flex-1 overflow-hidden"
        style={horizontal ? { height: "100%" } : { width: "100%" }}
      >
        <SplitNodeView node={node.children[1]} primaryPaneId={primaryPaneId} sidebarOpen={sidebarOpen} />
      </div>
    </div>
  );
}
