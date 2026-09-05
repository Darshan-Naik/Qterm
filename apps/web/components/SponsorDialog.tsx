"use client";

import { SITE } from "@/lib/site";
import { trackCTA } from "@/lib/analytics";
import { DownloadDialog } from "./DownloadDialog";
import { DialogActions } from "./DialogActions";
import { SponsorArt } from "./SponsorArt";

export function SponsorDialog({ onNext }: { onNext: () => void }) {
  return (
    <DownloadDialog title="Keep it. Love it." step={2} onClose={onNext} closeOnOverlay>
      <SponsorArt />
      <p className="text-[14px] leading-relaxed text-muted-foreground">
        If you keep Qterm and you love it, sponsor to help it grow.
      </p>
      <DialogActions>
        <a
          href={SITE.github}
          target="_blank"
          rel="noreferrer"
          onClick={() => {
            trackCTA("github_star_click");
            onNext();
          }}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-white/12 bg-white/4 px-4 text-[14px] font-medium transition hover:border-white/20 hover:bg-white/8"
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
          Star on GitHub
        </a>
        <a
          href={SITE.sponsors}
          target="_blank"
          rel="noreferrer"
          data-dialog-primary
          onClick={() => {
            trackCTA("sponsor_click");
            onNext();
          }}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-foreground px-4 text-[14px] font-medium text-background transition hover:bg-white"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
          </svg>
          Sponsor
        </a>
      </DialogActions>
    </DownloadDialog>
  );
}
