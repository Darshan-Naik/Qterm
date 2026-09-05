import { DownloadDialog } from "./DownloadDialog";
import { GatekeeperGuide } from "./GatekeeperGuide";

export function OpenAnywayDialog({ onNext }: { onNext: () => void }) {
  return (
    <DownloadDialog title="Mac is going to look suspicious" step={1} onClose={onNext} closeOnOverlay wide>
      <p className="text-[14px] leading-relaxed text-muted-foreground">
        Your download is already going. Apple blocks unsigned apps, and Qterm is not signed yet. Gatekeeper
        will say it cannot be opened. Completely normal. Follow the screen guide, especially the part where you
        skip Move to Trash.
      </p>
      <GatekeeperGuide />
      <div className="mt-6">
        <button
          type="button"
          data-dialog-primary
          onClick={onNext}
          className="inline-flex h-10 items-center justify-center rounded-lg bg-foreground px-4 text-[14px] font-medium text-background transition hover:bg-white"
        >
          Got it
        </button>
      </div>
    </DownloadDialog>
  );
}
