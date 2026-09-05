import { DownloadDialog } from "./DownloadDialog";

export function OpenAnywayDialog({ onNext }: { onNext: () => void }) {
  return (
    <DownloadDialog title="Mac is going to look suspicious" step={1} onClose={onNext} closeOnOverlay>
      <p className="text-[14px] leading-relaxed text-muted-foreground">
        Your download is already going. Apple blocks apps that are not signed, and Qterm is not signed yet.
        That takes a paid Apple Developer account. So Gatekeeper will say it cannot be opened. Completely
        normal. Not a virus. Just Apple being careful.
      </p>
      <ol className="mt-5 space-y-3 text-[14px] leading-relaxed">
        <li className="flex gap-3">
          <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-white/8 text-[11px] text-muted-foreground">
            1
          </span>
          <span>Open the DMG and drag Qterm into Applications.</span>
        </li>
        <li className="flex gap-3">
          <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-white/8 text-[11px] text-muted-foreground">
            2
          </span>
          <span>Right-click Qterm, click Open, then Open again if it asks.</span>
        </li>
        <li className="flex gap-3">
          <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-white/8 text-[11px] text-muted-foreground">
            3
          </span>
          <span>
            Still blocked? System Settings, Privacy & Security, then Open Anyway.
          </span>
        </li>
      </ol>
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
