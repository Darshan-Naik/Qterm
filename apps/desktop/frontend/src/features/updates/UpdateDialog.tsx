import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { uiStore, useUI } from "@/store/ui";
import { ListUpdateRisk, StartAppUpdateDownload } from "../../../wailsjs/go/main/App";
import {
  applyReadyAppUpdate,
  closeUpdateDialog,
  remindLaterAppUpdate,
  subscribeUpdateDialog,
} from "./checkAppUpdate";
import {
  closeUpdateLabel,
  countAgentTasks,
  downloadPercent,
  remindLaterLabel,
  updateDialogCopy,
  updateInstallWarning,
} from "./updateInstallWarning";

export function UpdateDialog() {
  const [open, setOpen] = useState(false);
  const available = useUI((s) => s.appUpdate?.available ?? false);
  const version = useUI((s) => s.appUpdate?.latestVersion ?? "");
  const state = useUI((s) => s.appUpdate?.state ?? "");
  const bytes = useUI((s) => s.appUpdate?.bytes ?? 0);
  const total = useUI((s) => s.appUpdate?.total ?? 0);
  const error = useUI((s) => s.appUpdate?.error ?? "");
  const [warning, setWarning] = useState<{ title: string; description: string; destructive: boolean } | null>(
    null,
  );

  useEffect(() => subscribeUpdateDialog(setOpen), []);

  useEffect(() => {
    if (!open) {
      setWarning(null);
      return;
    }
    let cancelled = false;
    void (async () => {
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
        // Agent-hook activity still covers in-progress work.
      }
      if (cancelled) return;
      setWarning(
        updateInstallWarning({
          sessionCount: 0,
          busy,
          agentTasks: countAgentTasks(uiStore.get().paneAnimations),
        }),
      );
    })();
    const status = uiStore.get().appUpdate;
    if (status?.available && status.state !== "ready") {
      void StartAppUpdateDownload();
    }
    return () => {
      cancelled = true;
    };
  }, [open]);

  const copy = updateDialogCopy({ version, state, error, available });
  const ready = state === "ready";
  const pct = downloadPercent(bytes, total);
  const barPct = ready ? 100 : pct;
  const indeterminate = copy.showProgress && barPct == null;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && closeUpdateDialog()}>
      <DialogContent showClose>
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>

        {warning ? (
          <div className="mt-4 rounded-md bg-destructive/10 px-2.5 py-2 text-[12.5px] text-destructive">
            <p className="font-medium">{warning.title}</p>
            <p className="mt-0.5 text-destructive/90">{warning.description}</p>
          </div>
        ) : null}

        {copy.showProgress ? (
          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between text-[12px] text-muted-foreground">
              <span>{copy.progressLabel}</span>
              <span>{barPct == null ? "…" : `${barPct}%`}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
              <div
                className={`h-full rounded-full bg-primary ${indeterminate ? "w-1/3 animate-pulse" : ""}`}
                style={indeterminate ? undefined : { width: `${barPct ?? 0}%` }}
              />
            </div>
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => closeUpdateDialog()}>
            {closeUpdateLabel}
          </Button>
          <Button type="button" variant="ghost" onClick={() => void remindLaterAppUpdate()}>
            {remindLaterLabel}
          </Button>
          <Button
            type="button"
            variant={warning && ready ? "destructive" : "default"}
            disabled={copy.primaryDisabled}
            onClick={() => {
              if (state === "error") {
                void StartAppUpdateDownload();
                return;
              }
              void applyReadyAppUpdate();
            }}
          >
            {copy.primaryLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
