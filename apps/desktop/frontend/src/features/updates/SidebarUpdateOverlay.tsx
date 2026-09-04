import { ArrowUpCircle } from "lucide-react";
import { WithTooltip } from "@/components/ui/tooltip";
import { useUI } from "@/store/ui";
import { requestDownloadAppUpdate } from "./checkAppUpdate";

/** Floating chip at the bottom of the sidebar when a newer release exists. */
export function SidebarUpdateOverlay() {
  const status = useUI((s) => s.appUpdate);
  if (!status?.available || status.skipped) return null;

  const version = status.latestVersion;
  const label = version ? `Update ${version}` : "Update";

  return (
    <div className="pointer-events-none absolute inset-x-3 bottom-2 z-40 flex justify-center">
      <WithTooltip label={`Qterm ${version || "update"} is available`} side="top">
        <button
          type="button"
          className="pointer-events-auto inline-flex h-8 max-w-full cursor-pointer items-center justify-center gap-1.5 rounded-full border border-border/70 bg-sidebar/95 px-2.5 text-[12px] font-medium text-sidebar-foreground shadow-md ring-1 ring-black/5 backdrop-blur-sm hover:bg-sidebar-accent"
          onClick={() => void requestDownloadAppUpdate(status)}
        >
          <ArrowUpCircle className="size-3.5 shrink-0 opacity-80" />
          <span className="min-w-0 truncate">{label}</span>
        </button>
      </WithTooltip>
    </div>
  );
}
