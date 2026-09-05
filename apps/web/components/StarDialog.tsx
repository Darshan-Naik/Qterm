import { SITE } from "@/lib/site";
import { DownloadDialog } from "./DownloadDialog";

export function StarDialog({ onClose }: { onClose: () => void }) {
  return (
    <DownloadDialog title="Cool. GitHub is free." step={3} onClose={onClose} closeOnOverlay>
      <p className="text-[14px] leading-relaxed text-muted-foreground">
        Star the repo instead. Zero dollars, takes a second, and it actually helps people find Qterm. No
        Apple paperwork involved.
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <a
          href={SITE.github}
          target="_blank"
          rel="noreferrer"
          data-dialog-primary
          onClick={onClose}
          className="inline-flex h-10 items-center justify-center rounded-lg bg-foreground px-4 text-[14px] font-medium text-background transition hover:bg-white"
        >
          Star Qterm
        </a>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-10 items-center justify-center rounded-lg border border-white/12 bg-white/4 px-4 text-[14px] font-medium transition hover:border-white/20 hover:bg-white/8"
        >
          Maybe later
        </button>
      </div>
    </DownloadDialog>
  );
}
