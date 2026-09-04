export type BusyTerminal = {
  id: string;
  name: string;
  commands: string[];
};

export type UpdateRisk = {
  sessionCount: number;
  busy: BusyTerminal[];
};

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

/** Copy for the install confirm. Null when nothing would be killed. */
export function updateInstallWarning(opts: {
  sessionCount: number;
  busy: { name: string; commands: string[] }[];
  agentTasks: number;
}): { title: string; description: string; destructive: boolean } | null {
  const sessionCount = Math.max(0, opts.sessionCount | 0);
  const busy = Array.isArray(opts.busy) ? opts.busy : [];
  const agentTasks = Math.max(0, opts.agentTasks | 0);
  if (sessionCount <= 0 && agentTasks <= 0 && busy.length === 0) return null;

  const cmds = [...new Set(busy.flatMap((b) => b.commands).filter(Boolean))].slice(0, 4);
  const cmdList = formatList(cmds);
  const sessionWord = sessionCount === 1 ? "terminal" : "terminals";
  const hasWork = cmds.length > 0 || agentTasks > 0;

  if (hasWork) {
    const parts: string[] = [];
    if (sessionCount > 0) {
      parts.push(`You have ${sessionCount} open ${sessionWord}.`);
    }
    if (cmdList) {
      parts.push(`${cmdList} ${cmds.length === 1 ? "is" : "are"} still running.`);
    } else if (agentTasks === 1) {
      parts.push("An agent is still working in a terminal.");
    } else if (agentTasks > 1) {
      parts.push(`Agents are still working in ${agentTasks} terminals.`);
    }
    parts.push("Quitting Qterm to install this update will kill that work.");
    return {
      title: "Running work will be killed",
      description: parts.join(" "),
      destructive: true,
    };
  }

  return {
    title: "Open terminals will close",
    description: `You have ${sessionCount} open ${sessionWord}. Quitting Qterm to install this update will close them.`,
    destructive: false,
  };
}
