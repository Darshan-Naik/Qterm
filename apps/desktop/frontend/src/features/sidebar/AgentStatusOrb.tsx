import { ThinkingOrb, type OrbState } from "thinking-orbs";
import type { AnimateState } from "@/store/ui";

/** Statuses that replace the agent icon with a thinking orb. Idle and none keep the icon. */
type LiveStatus = Exclude<AnimateState, "none" | "idle">;

const STATUS: Record<LiveStatus, { state: OrbState; color?: string; label: string }> = {
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

export function isLiveAgentStatus(state: AnimateState): state is LiveStatus {
  return state !== "none" && state !== "idle";
}

/** Thinking orb that stands in for the agent icon while a status is live. */
export function AgentStatusOrb({ state }: { state: AnimateState }) {
  if (!isLiveAgentStatus(state)) return null;
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
