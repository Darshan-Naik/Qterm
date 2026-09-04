import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageTitle } from "@/features/settings/ui/PageTitle";
import { SectionLabel } from "@/features/settings/ui/SectionLabel";
import { SettingCard } from "@/features/settings/ui/SettingCard";
import { SettingRow } from "@/features/settings/ui/SettingRow";
import {
  fetchAppUpdate,
  requestDownloadAppUpdate,
  skipAppUpdate,
  type AppUpdateStatus,
} from "./checkAppUpdate";
import { BrowserOpenURL } from "../../../wailsjs/runtime/runtime";

function statusHint(status: AppUpdateStatus | null, error: string | null): string {
  if (error) return error;
  if (!status) return "Check GitHub Releases for a newer Qterm.";
  if (status.available && status.skipped) {
    return `You skipped ${status.latestVersion}. Download it anytime, or turn reminders back on.`;
  }
  if (status.available) {
    return `Qterm ${status.latestVersion} is ready to download.`;
  }
  if (status.latestVersion) {
    return `Qterm ${status.currentVersion} is the latest release.`;
  }
  return "No GitHub Release was found yet.";
}

export function UpdatesPage() {
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

  const skip = async () => {
    if (!status?.latestVersion) return;
    await skipAppUpdate(status.latestVersion);
    toast.message(`Skipped Qterm ${status.latestVersion}`);
    await refresh();
  };

  const remind = async () => {
    await skipAppUpdate("");
    toast.message("You'll be reminded when this update is available.");
    await refresh();
  };

  const latestLabel = status?.latestVersion ? status.latestVersion : busy ? "Checking" : "Unknown";

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
              {status?.currentVersion || (busy ? "…" : "Unknown")}
            </span>
          }
        />
        <SettingRow
          title="Latest release"
          description={statusHint(status, error)}
          control={<span className="text-[12.5px] text-muted-foreground">{latestLabel}</span>}
        />
      </SettingCard>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button variant="secondary" disabled={busy} onClick={() => void refresh()}>
          {busy ? "Checking…" : "Check now"}
        </Button>
        {status?.available ? (
          <Button onClick={() => void requestDownloadAppUpdate(status)}>Download {status.latestVersion}</Button>
        ) : null}
        {status?.available && status.releaseUrl ? (
          <Button variant="ghost" onClick={() => BrowserOpenURL(status.releaseUrl)}>
            Release notes
          </Button>
        ) : null}
        {status?.available && !status.skipped ? (
          <Button variant="ghost" onClick={() => void skip()}>
            Skip this version
          </Button>
        ) : null}
        {status?.available && status.skipped ? (
          <Button variant="ghost" onClick={() => void remind()}>
            Remind me
          </Button>
        ) : null}
      </div>
    </div>
  );
}
