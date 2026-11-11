import { ThinkingOrb, type OrbState } from "thinking-orbs";
import type { AnimateState } from "@/store/ui";

/** Live agent statuses that already have a visible indication. */
type LiveStatus = "thinking" | "action_required" | "task_complete";

const STATUS: Record<LiveStatus, { state: OrbState; color?: string; label: string }> = {
  thinking: { state: "working", label: "Agent working" },
  action_required: { state: "listening", color: "#fbbf24", label: "Needs input" },
  task_complete: { state: "solving", color: "#34d399", label: "Task complete" },
};

function liveStatus(state: AnimateState): LiveStatus | null {
  if (state === "thinking" || state === "action_required" || state === "task_complete") return state;
  return null;
}

/** Inline thinking-orb for the session's current agent status. */
export function AgentStatusOrb({ state }: { state: AnimateState }) {
  const live = liveStatus(state);
  if (!live) return null;
  const spec = STATUS[live];
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
