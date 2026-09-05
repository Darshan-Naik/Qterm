import { SITE } from "@/lib/site";
import { DownloadDialog } from "./DownloadDialog";

export function SponsorDialog({ onNext }: { onNext: () => void }) {
  return (
    <DownloadDialog title="Want to help kill that warning?" step={2} onClose={onNext} closeOnOverlay>
      <p className="text-[14px] leading-relaxed text-muted-foreground">
        Signing the app needs Apple&apos;s Developer Program, which is $99 a year. You do not have to sponsor
        $99. If you like Qterm, chip in whatever feels right. If not, no guilt trip.
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <a
          href={SITE.sponsors}
          target="_blank"
          rel="noreferrer"
          data-dialog-primary
          onClick={onNext}
          className="inline-flex h-10 items-center justify-center rounded-lg bg-foreground px-4 text-[14px] font-medium text-background transition hover:bg-white"
        >
          Chip in
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
