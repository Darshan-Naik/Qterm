import { WithTooltip } from "@/components/ui/tooltip";
import type { AnimateState } from "@/store/ui";
import { AgentIcon, agentLabel } from "./AgentIcon";
import { AgentStatusOrb, isLiveAgentStatus } from "./AgentStatusOrb";

/** Agent logo while idle. A live status replaces that logo with its orb. */
export function AgentMark({
  agent,
  state,
  iconClassName,
  side = "right",
}: {
  agent?: string;
  state: AnimateState;
  iconClassName?: string;
  side?: "right" | "bottom" | "top";
}) {
  const live = isLiveAgentStatus(state);
  const mark = live ? (
    <AgentStatusOrb state={state} />
  ) : (
    <AgentIcon agent={agent} className={iconClassName} />
  );
  if (!agent) return mark;
  return (
    <WithTooltip label={agentLabel(agent)} side={side}>
      <span className="inline-flex">{mark}</span>
    </WithTooltip>
  );
}
