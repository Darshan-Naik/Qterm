type Status = {
  available: boolean;
  currentVersion: string;
  latestVersion: string;
  downloadUrl: string;
  releaseUrl: string;
  skipped: boolean;
  state: string;
  bytes: number;
  total: number;
  error: string;
};

export type UpdateProgress = {
  version: string;
  state: string;
  bytes: number;
  total: number;
  error: string;
};

/** Same major.minor.patch rules as internal/update.Normalize + Compare. */
export function compareVersions(a: string, b: string): number {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  for (let i = 0; i < 3; i++) {
    if (pa[i] < pb[i]) return -1;
    if (pa[i] > pb[i]) return 1;
  }
  return 0;
}

function parseVersion(v: string): [number, number, number] {
  const n = v.trim().replace(/^[vV]/, "").split(/[+-]/, 1)[0] ?? "";
  const parts = n.split(".");
  return [Number(parts[0]) || 0, Number(parts[1]) || 0, Number(parts[2]) || 0];
}

/** GitHub latest wins. Do not keep a ready 1.6.2 download on a 1.7.0 status. */
export function applyUpdateStatus(prev: Status | null, next: Status): Status {
  if (
    prev &&
    prev.latestVersion &&
    next.latestVersion &&
    compareVersions(next.latestVersion, prev.latestVersion) === 0
  ) {
    return {
      ...next,
      state: next.state || prev.state || "",
      bytes: next.bytes || prev.bytes || 0,
      total: next.total || prev.total || 0,
    };
  }
  return { ...next };
}

export function applyUpdateProgress(cur: Status | null, progress: UpdateProgress): Status | null {
  const version = progress.version.trim();
  if (!cur) {
    if (!version) return null;
    return {
      available: true,
      currentVersion: "",
      latestVersion: version,
      downloadUrl: "",
      releaseUrl: "",
      skipped: false,
      state: progress.state,
      bytes: progress.bytes,
      total: progress.total,
      error: progress.error,
    };
  }
  if (version && cur.latestVersion && compareVersions(version, cur.latestVersion) < 0) {
    return cur;
  }
  return {
    ...cur,
    available: true,
    latestVersion: version || cur.latestVersion,
    skipped: false,
    state: progress.state || cur.state,
    bytes: progress.bytes,
    total: progress.total,
    error: progress.error,
  };
}

export function updatedToastCopy(from: string, to: string): { title: string; description: string } {
  const version = to.trim();
  const prev = from.trim();
  return {
    title: version ? `Qterm ${version} is installed` : "Qterm is installed",
    description: prev ? `Updated from ${prev}.` : "This window is running the new version.",
  };
}
