import type { SplitLeaf, SplitNode } from "./types";

export function leaf(sessionId: string): SplitNode {
  return { type: "leaf", id: crypto.randomUUID(), sessionId };
}

export function collectSessionIds(node: SplitNode | null): string[] {
  if (!node) return [];
  if (node.type === "leaf") return [node.sessionId];
  return [...collectSessionIds(node.children[0]), ...collectSessionIds(node.children[1])];
}

export function findFirstLeaf(node: SplitNode | null): SplitNode | null {
  if (!node) return null;
  if (node.type === "leaf") return node;
  return findFirstLeaf(node.children[0]);
}

export function findLeafBySession(node: SplitNode | null, sessionId: string): SplitLeaf | null {
  if (!node) return null;
  if (node.type === "leaf") return node.sessionId === sessionId ? node : null;
  return (
    findLeafBySession(node.children[0], sessionId) || findLeafBySession(node.children[1], sessionId)
  );
}

export function replaceLeafSession(node: SplitNode, paneId: string, sessionId: string): SplitNode {
  if (node.type === "leaf") {
    return node.id === paneId ? { ...node, sessionId } : node;
  }
  return {
    ...node,
    children: [
      replaceLeafSession(node.children[0], paneId, sessionId),
      replaceLeafSession(node.children[1], paneId, sessionId),
    ],
  };
}

export function splitPane(
  node: SplitNode,
  paneId: string,
  direction: "horizontal" | "vertical",
  newSessionId: string
): SplitNode {
  if (node.type === "leaf") {
    if (node.id !== paneId) return node;
    return {
      type: "split",
      id: crypto.randomUUID(),
      direction,
      size: 0.5,
      children: [node, leaf(newSessionId)],
    };
  }
  return {
    ...node,
    children: [
      splitPane(node.children[0], paneId, direction, newSessionId),
      splitPane(node.children[1], paneId, direction, newSessionId),
    ],
  };
}

export function removePane(node: SplitNode, paneId: string): SplitNode | null {
  if (node.type === "leaf") {
    return node.id === paneId ? null : node;
  }
  const left = removePane(node.children[0], paneId);
  const right = removePane(node.children[1], paneId);
  if (!left) return right;
  if (!right) return left;
  return { ...node, children: [left, right] };
}

export function listLeaves(node: SplitNode | null): SplitLeaf[] {
  if (!node) return [];
  if (node.type === "leaf") return [node];
  return [...listLeaves(node.children[0]), ...listLeaves(node.children[1])];
}

export function setSplitSize(node: SplitNode, splitId: string, size: number): SplitNode {
  if (node.type === "leaf") return node;
  if (node.id === splitId) return { ...node, size };
  return {
    ...node,
    children: [setSplitSize(node.children[0], splitId, size), setSplitSize(node.children[1], splitId, size)],
  };
}
