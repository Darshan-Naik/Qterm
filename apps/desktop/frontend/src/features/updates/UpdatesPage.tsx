import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageTitle } from "@/features/settings/ui/PageTitle";
import { SectionLabel } from "@/features/settings/ui/SectionLabel";
import { SettingCard } from "@/features/settings/ui/SettingCard";
import { SettingRow } from "@/features/settings/ui/SettingRow";
import { useUI } from "@/store/ui";
import {
  fetchAppUpdate,
  requestRestartAppUpdate,
  skipAppUpdate,
  type AppUpdateStatus,
} from "./checkAppUpdate";
import { restartUpdateLabel } from "./updateInstallWarning";
import { BrowserOpenURL } from "../../../wailsjs/runtime/runtime";

function statusHint(status: AppUpdateStatus | null, error: string | null): string {
  if (error) return error;
  if (!status) return "Check GitHub Releases for a newer Qterm.";
  if (status.available && status.skipped) {
    return `You skipped ${status.latestVersion}. Restart to update anytime, or turn reminders back on.`;
  }
  if (status.available && status.state === "ready") {
    return `Qterm ${status.latestVersion} is ready. Restart to install.`;
  }
  if (status.available && status.state === "downloading") {
    return `Downloading Qterm ${status.latestVersion}.`;
  }
  if (status.available && status.state === "error") {
    return status.error || "The update download failed. Check now to try again.";
  }
  if (status.available) {
    return `Qterm ${status.latestVersion} is available.`;
  }
  if (status.latestVersion) {
    return `Qterm ${status.currentVersion} is the latest release.`;
  }
  return "No GitHub Release was found yet.";
}

export function UpdatesPage() {
  const live = useUI((s) => s.appUpdate);
  const [status, setStatus] = useState<AppUpdateStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      setStatus(await fetchAppUpdate());
    } catch (e: unknown) {
      const err = e as { message?: string };
      setError(String(err?.message || e || "Could not check for updates"));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const shown = live ?? status;

  const skip = async () => {
    if (!shown?.latestVersion) return;
    await skipAppUpdate(shown.latestVersion);
    toast.message(`OK. The sidebar button is hidden for Qterm ${shown.latestVersion}.`);
    await refresh();
  };

  const remind = async () => {
    await skipAppUpdate("");
    toast.message("You'll be reminded when this update is available.");
    await refresh();
  };

  const latestLabel = shown?.latestVersion ? shown.latestVersion : busy ? "Checking" : "Unknown";
  const restartLabel =
    shown?.state === "downloading"
      ? "Downloading…"
      : shown?.latestVersion
        ? restartUpdateLabel
        : "Restart to update";

  return (
    <div>
      <PageTitle>Updates</PageTitle>
      <SectionLabel>Qterm</SectionLabel>
      <SettingCard>
        <SettingRow
          title="Current version"
          description="The version running in this window."
          control={
            <span className="text-[12.5px] text-muted-foreground">
              {shown?.currentVersion || (busy ? "…" : "Unknown")}
            </span>
          }
        />
        <SettingRow
          title="Latest release"
          description={statusHint(shown, error)}
          control={<span className="text-[12.5px] text-muted-foreground">{latestLabel}</span>}
        />
      </SettingCard>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button variant="secondary" disabled={busy} onClick={() => void refresh()}>
          {busy ? "Checking…" : "Check now"}
        </Button>
        {shown?.available ? (
          <Button
            disabled={shown.state === "downloading"}
            onClick={() => void requestRestartAppUpdate(shown)}
          >
            {restartLabel}
          </Button>
        ) : null}
        {shown?.available && shown.releaseUrl ? (
          <Button variant="ghost" onClick={() => BrowserOpenURL(shown.releaseUrl)}>
            Release notes
          </Button>
        ) : null}
        {shown?.available && !shown.skipped ? (
          <Button variant="ghost" onClick={() => void skip()}>
            Remind me later
          </Button>
        ) : null}
        {shown?.available && shown.skipped ? (
          <Button variant="ghost" onClick={() => void remind()}>
            Remind me
          </Button>
        ) : null}
      </div>
    </div>
  );
}
