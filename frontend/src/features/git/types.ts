export type GitStatus = {
  path: string;
  isRepo: boolean;
  branch: string;
  dirty: boolean;
  ahead: number;
  behind: number;
};

export type GitFile = {
  path: string;
  code: string;
  staged: boolean;
  unstaged: boolean;
};

export type GitSnapshot = GitStatus & {
  upstream: string;
  inProgress: string;
  files: GitFile[];
};

export type GitBranch = {
  name: string;
  current: boolean;
  date: number;
};

export type GitResult = {
  ok: boolean;
  stdout: string;
  stderr: string;
  cmd: string;
};

export function asStatus(raw: unknown): GitStatus | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const s = raw as Partial<GitStatus>;
  return {
    path: s.path || "",
    isRepo: !!s.isRepo,
    branch: s.branch || "",
    dirty: !!s.dirty,
    ahead: Number(s.ahead) || 0,
    behind: Number(s.behind) || 0,
  };
}

export function asSnapshot(raw: unknown): GitSnapshot | undefined {
  const st = asStatus(raw);
  if (!st) return undefined;
  const s = raw as Partial<GitSnapshot>;
  return {
    ...st,
    upstream: s.upstream || "",
    inProgress: s.inProgress || "",
    files: Array.isArray(s.files) ? s.files : [],
  };
}

export function trackingLabel(ahead: number, behind: number): string {
  const parts: string[] = [];
  if (ahead > 0) parts.push(`↑${ahead}`);
  if (behind > 0) parts.push(`↓${behind}`);
  return parts.join(" ");
}

export function chipTooltip(st: GitStatus): string {
  const bits = [`Git · ${st.branch || "detached"}`];
  if (st.ahead > 0) bits.push(`${st.ahead} unpushed`);
  if (st.behind > 0) bits.push(`${st.behind} unpulled`);
  if (st.dirty) bits.push("uncommitted changes");
  return bits.join(" · ");
}

export function statusLetter(code: string): string {
  const xy = (code || "  ").padEnd(2, " ");
  if (xy === "??") return "U";
  const mark = xy[0] !== " " ? xy[0] : xy[1];
  return (mark || "?").trim() || "?";
}
