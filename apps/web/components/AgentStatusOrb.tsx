"use client";

import { ThinkingOrb, type OrbState } from "thinking-orbs";

export type AgentStatus =
  | "thinking"
  | "searching"
  | "tool_use"
  | "editing"
  | "running"
  | "background"
  | "connecting"
  | "action_required"
  | "task_complete";

const STATUS: Record<AgentStatus, { state: OrbState; color?: string; label: string }> = {
  thinking: { state: "working", label: "Agent working" },
  searching: { state: "searching", label: "Searching" },
  tool_use: { state: "weaving", label: "Using a tool" },
  editing: { state: "composing", label: "Editing" },
  running: { state: "shaping", label: "Running a command" },
  background: { state: "breathing", label: "Running in the background" },
  connecting: { state: "connecting", label: "Connecting" },
  action_required: { state: "listening", color: "#fbbf24", label: "Needs input" },
  task_complete: { state: "solving", color: "#34d399", label: "Turn complete" },
};

/** Thinking orb that stands in for the agent icon while a status is live. */
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
