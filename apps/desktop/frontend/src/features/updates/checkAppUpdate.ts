import { toast } from "sonner";
import { confirm } from "@/lib/confirm";
import { uiStore, type AppUpdateInfo } from "@/store/ui";
import { BrowserOpenURL } from "../../../wailsjs/runtime/runtime";
import { CheckForAppUpdate, ListUpdateRisk, SkipAppUpdate } from "../../../wailsjs/go/main/App";
import { countAgentTasks, updateInstallWarning } from "./updateInstallWarning";

export type AppUpdateStatus = AppUpdateInfo;

const TOAST_ID = "app-update";

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
  };
}

export function rememberAppUpdate(status: AppUpdateStatus | null) {
  uiStore.set({ appUpdate: status });
}

function openInstaller(status: AppUpdateStatus) {
  const url = status.downloadUrl || status.releaseUrl;
  if (!url) {
    toast.error("No download is available yet.");
    return false;
  }
  BrowserOpenURL(url);
  return true;
}

async function confirmInstallRisk(): Promise<boolean> {
  let sessionCount = uiStore.get().sessions.length;
  let busy: { name: string; commands: string[] }[] = [];
  try {
    const risk = await ListUpdateRisk();
    if (risk && typeof risk.sessionCount === "number") {
      sessionCount = risk.sessionCount;
    }
    if (Array.isArray(risk?.busy)) {
      busy = risk.busy.map((row) => ({
        name: String(row?.name || "Terminal"),
        commands: Array.isArray(row?.commands) ? row.commands.map(String) : [],
      }));
    }
  } catch {
    // Fall back to sidebar session count if the process scan fails.
  }
  const warning = updateInstallWarning({
    sessionCount,
    busy,
    agentTasks: countAgentTasks(uiStore.get().paneAnimations),
  });
  if (!warning) return true;
  return confirm({
    title: warning.title,
    description: warning.description,
    confirmLabel: "Download anyway",
    cancelLabel: "Not now",
    destructive: warning.destructive,
  });
}

export async function requestDownloadAppUpdate(status: AppUpdateStatus): Promise<void> {
  const ok = await confirmInstallRisk();
  if (!ok) return;
  openInstaller(status);
}

export function showUpdateAvailableToast(status: AppUpdateStatus) {
  if (!status.available) return;
  toast.message(`Qterm ${status.latestVersion} is available`, {
    id: TOAST_ID,
    description: "Download the installer, then replace this app.",
    duration: 20000,
    action: {
      label: "Download",
      onClick: () => {
        void requestDownloadAppUpdate(status);
      },
    },
    cancel: {
      label: "Later",
      onClick: () => toast.dismiss(TOAST_ID),
    },
  });
}

export async function fetchAppUpdate(): Promise<AppUpdateStatus> {
  const status = asStatus(await CheckForAppUpdate());
  if (!status) {
    throw new Error("Could not check for updates");
  }
  rememberAppUpdate(status);
  return status;
}

export async function runManualUpdateCheck(): Promise<AppUpdateStatus | null> {
  try {
    const status = await fetchAppUpdate();
    if (status.available) {
      showUpdateAvailableToast(status);
      return status;
    }
    toast.success("You're up to date", {
      id: TOAST_ID,
      description: status.currentVersion
        ? `Qterm ${status.currentVersion} is the latest release.`
        : "No newer release was found.",
    });
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
