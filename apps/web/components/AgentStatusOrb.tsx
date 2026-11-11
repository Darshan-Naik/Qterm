"use client";

import { ThinkingOrb, type OrbState } from "thinking-orbs";

export type AgentStatus = "thinking" | "action_required" | "task_complete";

const STATUS: Record<AgentStatus, { state: OrbState; color?: string; label: string }> = {
  thinking: { state: "working", label: "Agent working" },
  action_required: { state: "listening", color: "#fbbf24", label: "Needs input" },
  task_complete: { state: "solving", color: "#34d399", label: "Task complete" },
};

/** Inline thinking-orb for an agent status shown in the product UI. */
export function AgentStatusOrb({ state }: { state: AgentStatus }) {
  const spec = STATUS[state];
  return (
    <ThinkingOrb
      state={spec.state}
      size={20}
      color={spec.color}
      aria-label={spec.label}
      className="shrink-0"
    />
  );
}
