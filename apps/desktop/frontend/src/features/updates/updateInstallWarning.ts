export type BusyTerminal = {
  id: string;
  name: string;
  commands: string[];
};

export type UpdateRisk = {
  sessionCount: number;
  busy: BusyTerminal[];
};

export const restartUpdateLabel = "Restart to update";
export const remindLaterLabel = "Remind me later";

function formatList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

export function countAgentTasks(anims: Record<string, string> | undefined): number {
  if (!anims) return 0;
  let n = 0;
  for (const state of Object.values(anims)) {
    if (state === "thinking" || state === "action_required") n += 1;
  }
  return n;
}

/** Copy for the restart confirm. Null when no running process would be killed. */
export function updateInstallWarning(opts: {
  sessionCount: number;
  busy: { name: string; commands: string[] }[];
  agentTasks: number;
}): { title: string; description: string; destructive: boolean } | null {
  const busy = Array.isArray(opts.busy) ? opts.busy : [];
  const agentTasks = Math.max(0, opts.agentTasks | 0);
  const cmds = [...new Set(busy.flatMap((b) => b.commands).filter(Boolean))].slice(0, 4);
  if (cmds.length === 0 && agentTasks <= 0) return null;

  const cmdList = formatList(cmds);
  const parts: string[] = [];
  if (cmdList) {
    parts.push(`${cmdList} ${cmds.length === 1 ? "is" : "are"} still running.`);
  } else if (agentTasks === 1) {
    parts.push("An agent is still working in a terminal.");
  } else if (agentTasks > 1) {
    parts.push(`Agents are still working in ${agentTasks} terminals.`);
  }
  parts.push(
    cmds.length === 1 && agentTasks === 0
      ? "Restarting Qterm to install this update will terminate it."
      : "Restarting Qterm to install this update will terminate that work.",
  );
  return {
    title: cmds.length === 1 && agentTasks === 0 ? "A process is still running" : "Running work will be killed",
    description: parts.join(" "),
    destructive: true,
  };
}
