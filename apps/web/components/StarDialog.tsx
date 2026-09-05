import { SITE } from "@/lib/site";
import { DownloadDialog } from "./DownloadDialog";
import { StarArt } from "./StarArt";

export function StarDialog({ onClose }: { onClose: () => void }) {
  return (
    <DownloadDialog title="Cool. GitHub is free." step={3} onClose={onClose} closeOnOverlay>
      <StarArt />
      <p className="text-[14px] leading-relaxed text-muted-foreground">
        Star the repo. Zero dollars, takes a second, and it actually helps people find Qterm. No Apple
        paperwork involved.
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <a
          href={SITE.github}
          target="_blank"
          rel="noreferrer"
          data-dialog-primary
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-foreground px-4 text-[14px] font-medium text-background transition hover:bg-white"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 6.82 21.02 8 14.14 3 9.27 9.91 8.26 12 2" />
          </svg>
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
