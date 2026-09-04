import { toast } from "sonner";
import { BrowserOpenURL } from "../../../wailsjs/runtime/runtime";
import { CheckForAppUpdate, SkipAppUpdate } from "../../../wailsjs/go/main/App";

export type AppUpdateStatus = {
  available: boolean;
  currentVersion: string;
  latestVersion: string;
  downloadUrl: string;
  releaseUrl: string;
  skipped: boolean;
};

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

export function downloadAppUpdate(status: AppUpdateStatus) {
  const url = status.downloadUrl || status.releaseUrl;
  if (!url) {
    toast.error("No download is available yet.");
    return;
  }
  BrowserOpenURL(url);
}

export function showUpdateAvailableToast(status: AppUpdateStatus) {
  if (!status.available) return;
  toast.message(`Qterm ${status.latestVersion} is available`, {
    id: TOAST_ID,
    description: "Download the installer, then replace this app.",
    duration: 20000,
    action: {
      label: "Download",
      onClick: () => downloadAppUpdate(status),
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
}

export { asStatus };
