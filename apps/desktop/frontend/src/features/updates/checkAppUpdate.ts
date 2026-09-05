import { toast } from "sonner";
import { confirm } from "@/lib/confirm";
import { uiStore, type AppUpdateInfo } from "@/store/ui";
import {
  ApplyAppUpdateAndRestart,
  CheckForAppUpdate,
  ListUpdateRisk,
  SkipAppUpdate,
  StartAppUpdateDownload,
} from "../../../wailsjs/go/main/App";
import {
  countAgentTasks,
  remindLaterLabel,
  restartUpdateLabel,
  updateInstallWarning,
} from "./updateInstallWarning";

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

async function confirmRestartRisk(): Promise<boolean> {
  let busy: { name: string; commands: string[] }[] = [];
  try {
    const risk = await ListUpdateRisk();
    if (Array.isArray(risk?.busy)) {
      busy = risk.busy.map((row) => ({
        name: String(row?.name || "Terminal"),
        commands: Array.isArray(row?.commands) ? row.commands.map(String) : [],
      }));
    }
  } catch {
    // Fall back to agent-hook activity if the process scan fails.
  }
  const warning = updateInstallWarning({
    sessionCount: 0,
    busy,
    agentTasks: countAgentTasks(uiStore.get().paneAnimations),
  });
  if (!warning) return true;
  return confirm({
    title: warning.title,
    description: warning.description,
    confirmLabel: restartUpdateLabel,
    cancelLabel: remindLaterLabel,
    destructive: warning.destructive,
  });
}

export async function remindLaterAppUpdate(status?: AppUpdateStatus | null): Promise<void> {
  const cur = status || uiStore.get().appUpdate;
  const version = cur?.latestVersion || "";
  if (version) {
    await skipAppUpdate(version);
  }
  toast.dismiss(TOAST_ID);
}

export async function requestRestartAppUpdate(status: AppUpdateStatus): Promise<void> {
  if (status.state !== "ready") {
    try {
      await StartAppUpdateDownload();
    } catch (e: unknown) {
      const err = e as { message?: string };
      toast.error("Could not download the update", {
        id: TOAST_ID,
        description: String(err?.message || e || "Try again in a bit."),
      });
      return;
    }
    toast.message(`Downloading Qterm ${status.latestVersion}`, {
      id: TOAST_ID,
      description: "You can restart when the download finishes.",
    });
    return;
  }
  const ok = await confirmRestartRisk();
  if (!ok) {
    await remindLaterAppUpdate(status);
    return;
  }
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

export function showUpdateReadyToast(status: AppUpdateStatus) {
  if (!status.available || status.skipped || status.state !== "ready") return;
  toast.message(`Qterm ${status.latestVersion} is ready`, {
    id: TOAST_ID,
    description: "Restart Qterm to install the update.",
    duration: 20000,
    action: {
      label: restartUpdateLabel,
      onClick: () => {
        void requestRestartAppUpdate(status);
      },
    },
    cancel: {
      label: remindLaterLabel,
      onClick: () => {
        void remindLaterAppUpdate(status);
      },
    },
  });
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
    if (status.state === "ready") {
      showUpdateReadyToast(status);
      return status;
    }
    toast.message(`Qterm ${status.latestVersion} is downloading`, {
      id: TOAST_ID,
      description: "You'll be asked to restart when it's ready.",
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
