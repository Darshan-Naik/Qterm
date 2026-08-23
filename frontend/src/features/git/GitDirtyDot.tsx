import { WithTooltip } from "@/components/ui/tooltip";

export function GitDirtyDot({ label = "Uncommitted changes" }: { label?: string }) {
  return (
    <WithTooltip label={label}>
      <span
        className="size-1.5 shrink-0 rounded-full bg-emerald-400"
        aria-label={label}
      />
    </WithTooltip>
  );
}
