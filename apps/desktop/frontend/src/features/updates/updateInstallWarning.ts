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
export const closeUpdateLabel = "Close";
export const tryAgainLabel = "Try again";

/** Sidebar chip only. Never include download progress. */
export function sidebarUpdateLabel(version: string): string {
  const v = version.trim();
  return v ? `Update ${v}` : "Update";
}

/** Percent for the dialog bar. Null when size is unknown. */
export function downloadPercent(bytes: number, total: number): number | null {
  if (!(total > 0) || !(bytes >= 0)) return null;
  return Math.min(100, Math.max(0, Math.round((bytes / total) * 100)));
}

export type UpdateDialogCopy = {
  title: string;
  description: string;
  showProgress: boolean;
  progressLabel: string;
  primaryLabel: string;
  primaryDisabled: boolean;
};

/** Dialog chrome for an available update. Download progress stays out of the sidebar. */
export function updateDialogCopy(opts: {
  version: string;
  state: string;
  error: string;
  available: boolean;
}): UpdateDialogCopy {
  const version = opts.version.trim();
  const ready = opts.state === "ready";
  const failed = opts.state === "error";
  const downloading = opts.state === "downloading" || (opts.available && !ready && !failed);

  if (failed) {
    return {
      title: "Could not download the update",
      description: opts.error.trim() || "Check your network, then try again.",
      showProgress: false,
      progressLabel: "",
      primaryLabel: tryAgainLabel,
      primaryDisabled: false,
    };
  }
  if (ready) {
    return {
      title: version ? `Qterm ${version} is ready` : "Update ready",
      description: "Restart Qterm to install this update.",
      showProgress: true,
      progressLabel: "Ready to install",
      primaryLabel: restartUpdateLabel,
      primaryDisabled: false,
    };
  }
  if (downloading) {
    return {
      title: version ? `Downloading Qterm ${version}` : "Downloading update",
      description: "You can close this window. The download keeps going.",
      showProgress: true,
      progressLabel: "Downloading",
      primaryLabel: restartUpdateLabel,
      primaryDisabled: true,
    };
  }
  return {
    title: version ? `Qterm ${version} is available` : "Update available",
    description: "Download runs in the background. Restart Qterm to install it.",
    showProgress: false,
    progressLabel: "",
    primaryLabel: restartUpdateLabel,
    primaryDisabled: true,
  };
}

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
