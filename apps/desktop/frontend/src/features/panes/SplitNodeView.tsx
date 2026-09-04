import { useCallback } from "react";
import { currentScope } from "@/lib/sessions";
import { setSplitSize, uiStore, type SplitNode } from "@/store/ui";
import { cn } from "@/lib/utils";
import { SaveLayout } from "../../../wailsjs/go/main/App";
import { PaneLeaf } from "./PaneLeaf";
import { Splitter } from "./Splitter";

function liveSplitSize(tree: SplitNode, id: string): number | null {
  if (tree.type === "leaf") return null;
  if (tree.id === id) return tree.size;
  return liveSplitSize(tree.children[0], id) ?? liveSplitSize(tree.children[1], id);
}

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
      if (node.type !== "split") return;
      const tree = uiStore.get().splitTree;
      if (!tree) return;
      const current = liveSplitSize(tree, node.id) ?? node.size;
      const nextSize = Math.min(0.85, Math.max(0.15, current + delta));
      uiStore.set({ splitTree: setSplitSize(tree, node.id, nextSize) });
    },
    [node]
  );

  const onResizeEnd = useCallback(() => {
    const { splitTree } = uiStore.get();
    if (!splitTree) return;
    void SaveLayout(currentScope(), splitTree as any);
  }, []);

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
      <Splitter direction={node.direction} onDrag={onResize} onDragEnd={onResizeEnd} />
      <div
        className="min-h-0 min-w-0 flex-1 overflow-hidden"
        style={horizontal ? { height: "100%" } : { width: "100%" }}
      >
        <SplitNodeView node={node.children[1]} primaryPaneId={primaryPaneId} sidebarOpen={sidebarOpen} />
      </div>
    </div>
  );
}
