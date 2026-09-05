import { ArrowUpCircle } from "lucide-react";
import { WithTooltip } from "@/components/ui/tooltip";
import { uiStore, useUI } from "@/store/ui";
import { requestRestartAppUpdate } from "./checkAppUpdate";

function chipLabel(version: string, state: string, bytes: number, total: number): string {
  if (state === "ready") return "Restart to update";
  if (state === "error") return "Update failed";
  if (total > 0 && bytes > 0) {
    const pct = Math.min(99, Math.round((bytes / total) * 100));
    return `Downloading ${pct}%`;
  }
  return version ? `Downloading ${version}` : "Downloading";
}

/** Floating chip at the bottom of the sidebar when a newer release exists. */
export function SidebarUpdateOverlay() {
  const available = useUI((s) => s.appUpdate?.available ?? false);
  const skipped = useUI((s) => s.appUpdate?.skipped ?? false);
  const version = useUI((s) => s.appUpdate?.latestVersion ?? "");
  const state = useUI((s) => s.appUpdate?.state ?? "");
  const bytes = useUI((s) => s.appUpdate?.bytes ?? 0);
  const total = useUI((s) => s.appUpdate?.total ?? 0);

  if (!available || skipped) return null;

  const label = chipLabel(version, state, bytes, total);
  const ready = state === "ready";
  const tip = ready
    ? `Qterm ${version} is ready. Restart to install.`
    : state === "error"
      ? `Could not download Qterm ${version}`
      : `Downloading Qterm ${version}`;

  return (
    <div className="pointer-events-none absolute inset-x-3 bottom-2 z-40 flex justify-center">
      <WithTooltip label={tip} side="top">
        <button
          type="button"
          className="pointer-events-auto inline-flex h-8 max-w-full cursor-pointer items-center justify-center gap-1.5 rounded-full border border-border/70 bg-sidebar/95 px-2.5 text-[12px] font-medium text-sidebar-foreground shadow-md ring-1 ring-black/5 backdrop-blur-sm hover:bg-sidebar-accent"
          onClick={() => {
            const status = uiStore.get().appUpdate;
            if (status) void requestRestartAppUpdate(status);
          }}
        >
          <ArrowUpCircle className="size-3.5 shrink-0 opacity-80" />
          <span className="min-w-0 truncate">{label}</span>
        </button>
      </WithTooltip>
    </div>
  );
}
