/** Shared copy after connecting an agent CLI plugin. */

export function connectSuccessToast(cliName: string) {
  return {
    title: `${cliName} connected`,
    description: `Start a new ${cliName} session for live status and hooks. This running session won’t pick them up.`,
  } as const;
}

const SNOOZE_KEY = "qterm:cli-nudge-snooze";
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

type SnoozeMap = Record<string, number>;

function readSnooze(): SnoozeMap {
  try {
    const raw = localStorage.getItem(SNOOZE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as SnoozeMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function isCliNudgeSnoozed(cli: string): boolean {
  const until = readSnooze()[cli];
  return typeof until === "number" && until > Date.now();
}

export function snoozeCliNudge(cli: string) {
  const next = { ...readSnooze(), [cli]: Date.now() + SNOOZE_MS };
  try {
    localStorage.setItem(SNOOZE_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota */
  }
}
