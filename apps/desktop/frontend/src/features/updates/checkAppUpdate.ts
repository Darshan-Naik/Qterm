import { toast } from "sonner";
import { uiStore, type AppUpdateInfo } from "@/store/ui";
import {
  ApplyAppUpdateAndRestart,
  CheckForAppUpdate,
  ConsumeAppUpdated,
  FetchAppReleaseNotes,
  SkipAppUpdate,
} from "../../../wailsjs/go/main/App";
import { applyUpdateProgress, applyUpdateStatus, updatedToastCopy } from "./updateStatus";

export type AppUpdateStatus = AppUpdateInfo;

const TOAST_ID = "app-update";

let dialogOpen = false;
const dialogListeners = new Set<(open: boolean) => void>();
const notesInFlight = new Set<string>();

function emitDialog() {
  for (const listener of dialogListeners) listener(dialogOpen);
}

export function openUpdateDialog() {
  dialogOpen = true;
  emitDialog();
  void ensureReleaseNotes();
}

export function closeUpdateDialog() {
  dialogOpen = false;
  emitDialog();
}

export function subscribeUpdateDialog(listener: (open: boolean) => void): () => void {
  dialogListeners.add(listener);
  listener(dialogOpen);
  return () => {
    dialogListeners.delete(listener);
  };
}

function asStatus(raw: unknown): AppUpdateStatus | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  return {
    available: Boolean(o.available),
    currentVersion: String(o.currentVersion || ""),
    latestVersion: String(o.latestVersion || ""),
    downloadUrl: String(o.downloadUrl || ""),
    releaseUrl: String(o.releaseUrl || ""),
    releaseNotes: String(o.releaseNotes || ""),
    skipped: Boolean(o.skipped),
    state: String(o.state || ""),
    bytes: Number(o.bytes || 0),
    total: Number(o.total || 0),
    error: String(o.error || ""),
  };
}

export function rememberAppUpdate(status: AppUpdateStatus | null) {
  uiStore.set({ appUpdate: status });
}

export function mergeUpdateProgress(raw: unknown) {
  if (!raw || typeof raw !== "object") return;
  const o = raw as Record<string, unknown>;
  const next = applyUpdateProgress(uiStore.get().appUpdate, {
    version: String(o.version || ""),
    state: String(o.state || ""),
    bytes: Number(o.bytes || 0),
    total: Number(o.total || 0),
    error: String(o.error || ""),
  });
  if (next) rememberAppUpdate(next);
}

export async function remindLaterAppUpdate(status?: AppUpdateStatus | null): Promise<void> {
  const cur = status || uiStore.get().appUpdate;
  const version = cur?.latestVersion || "";
  if (version) {
    await skipAppUpdate(version);
  }
  closeUpdateDialog();
  toast.dismiss(TOAST_ID);
}

export async function applyReadyAppUpdate(): Promise<void> {
  const status = uiStore.get().appUpdate;
  if (!status || status.state !== "ready") return;
  try {
    await ApplyAppUpdateAndRestart();
  } catch (e: unknown) {
    const err = e as { message?: string };
    toast.error("Could not install the update", {
      id: TOAST_ID,
      description: String(err?.message || e || "Try again in a bit."),
    });
  }
}

export async function fetchAppUpdate(): Promise<AppUpdateStatus> {
  const status = asStatus(await CheckForAppUpdate());
  if (!status) {
    throw new Error("Could not check for updates");
  }
  const prev = uiStore.get().appUpdate;
  rememberAppUpdate(applyUpdateStatus(prev, status));
  void ensureReleaseNotes();
  return uiStore.get().appUpdate as AppUpdateStatus;
}

/** Lazy-load release notes when the web update check omitted the body. */
export async function ensureReleaseNotes(version?: string): Promise<void> {
  const cur = uiStore.get().appUpdate;
  const ver = (version || cur?.latestVersion || "").trim();
  if (!ver || !cur) return;
  if (cur.releaseNotes?.trim()) return;
  if (notesInFlight.has(ver)) return;
  notesInFlight.add(ver);
  try {
    const notes = String((await FetchAppReleaseNotes(ver)) || "").trim();
    if (!notes) return;
    const latest = uiStore.get().appUpdate;
    if (!latest || latest.latestVersion !== ver) return;
    if (latest.releaseNotes?.trim()) return;
    rememberAppUpdate({ ...latest, releaseNotes: notes });
  } catch {
    // Link to GitHub still works when the notes API is rate-limited.
  } finally {
    notesInFlight.delete(ver);
  }
}

export async function runManualUpdateCheck(): Promise<AppUpdateStatus | null> {
  try {
    const status = await fetchAppUpdate();
    if (!status.available) {
      toast.success("You're up to date", {
        id: TOAST_ID,
        description: status.currentVersion
          ? `Qterm ${status.currentVersion} is the latest release.`
          : "No newer release was found.",
      });
      return status;
    }
    openUpdateDialog();
    return status;
  } catch (e: unknown) {
    const err = e as { message?: string };
    toast.error("Could not check for updates", {
      id: TOAST_ID,
      description: String(err?.message || e || "Try again in a bit."),
    });
    return null;
  }
}

export async function skipAppUpdate(version: string): Promise<void> {
  await SkipAppUpdate(version);
  const cur = uiStore.get().appUpdate;
  if (!cur) return;
  rememberAppUpdate({ ...cur, skipped: Boolean(version.trim()) });
}

export async function showInstalledUpdateToast(): Promise<void> {
  try {
    const applied = await ConsumeAppUpdated();
    const to = String(applied?.to || "").trim();
    if (!to) return;
    const copy = updatedToastCopy(String(applied?.from || ""), to);
    toast.success(copy.title, { description: copy.description });
  } catch {
    // Launch still works if this IPC is missing on an older helper.
  }
}

export { asStatus };
