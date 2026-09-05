import { SITE } from "@/lib/site";
import { DownloadDialog } from "./DownloadDialog";

export function SponsorDialog({ onNext }: { onNext: () => void }) {
  return (
    <DownloadDialog title="Want to help kill that warning?" step={2} onClose={onNext} closeOnOverlay>
      <p className="text-[14px] leading-relaxed text-muted-foreground">
        Signing the app needs Apple&apos;s Developer Program, which is $99 a year. You do not have to sponsor
        $99. If you like Qterm, sponsor whatever feels right. If not, no guilt trip.
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <a
          href={SITE.sponsors}
          target="_blank"
          rel="noreferrer"
          data-dialog-primary
          onClick={onNext}
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
        <button
          type="button"
          onClick={onNext}
          className="inline-flex h-10 items-center justify-center rounded-lg border border-white/12 bg-white/4 px-4 text-[14px] font-medium transition hover:border-white/20 hover:bg-white/8"
        >
          Not today
        </button>
      </div>
    </DownloadDialog>
  );
}
