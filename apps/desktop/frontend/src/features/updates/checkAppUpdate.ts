import { toast } from "sonner";
import { uiStore, type AppUpdateInfo } from "@/store/ui";
import {
  ApplyAppUpdateAndRestart,
  CheckForAppUpdate,
  SkipAppUpdate,
} from "../../../wailsjs/go/main/App";

export type AppUpdateStatus = AppUpdateInfo;

const TOAST_ID = "app-update";

let dialogOpen = false;
const dialogListeners = new Set<(open: boolean) => void>();

function emitDialog() {
  for (const listener of dialogListeners) listener(dialogOpen);
}

export function openUpdateDialog() {
  dialogOpen = true;
  emitDialog();
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
  const version = String(o.version || "");
  const cur = uiStore.get().appUpdate;
  if (!cur) {
    if (!version) return;
    rememberAppUpdate({
      available: true,
      currentVersion: "",
      latestVersion: version,
      downloadUrl: "",
      releaseUrl: "",
      skipped: false,
      state: String(o.state || ""),
      bytes: Number(o.bytes || 0),
      total: Number(o.total || 0),
      error: String(o.error || ""),
    });
    return;
  }
  if (version && cur.latestVersion && version !== cur.latestVersion) return;
  rememberAppUpdate({
    ...cur,
    state: String(o.state || cur.state),
    bytes: Number(o.bytes || 0),
    total: Number(o.total || 0),
    error: String(o.error || ""),
  });
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
  rememberAppUpdate({
    ...status,
    state: status.state || prev?.state || "",
    bytes: status.bytes || prev?.bytes || 0,
    total: status.total || prev?.total || 0,
  });
  return uiStore.get().appUpdate as AppUpdateStatus;
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

export { asStatus };
