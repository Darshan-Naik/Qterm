export function GatekeeperGuide() {
  return (
    <div className="mt-4 space-y-2.5" aria-hidden="true">
      <div className="grid gap-3 rounded-xl border border-white/8 bg-black/25 p-3 sm:grid-cols-[minmax(0,12.5rem)_1fr] sm:items-center">
        <div className="rounded-lg border border-white/10 bg-[#1f1f1f] px-3 py-2.5">
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <img src="/icon.svg" alt="" width={18} height={18} className="rounded-[4px]" />
            Qterm.app
            <span className="text-foreground/70">→</span>
            Applications
          </div>
          <div className="mt-2 h-8 rounded-md border border-dashed border-white/15 bg-white/4" />
        </div>
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Step 1</p>
          <p className="mt-1 text-[13px] leading-snug">Open the DMG and drag Qterm into Applications.</p>
        </div>
      </div>

      <div className="grid gap-3 rounded-xl border border-white/8 bg-black/25 p-3 sm:grid-cols-[minmax(0,12.5rem)_1fr] sm:items-center">
        <div className="rounded-lg border border-white/10 bg-[#2c2c2e] px-3 py-2.5">
          <p className="text-[11px] font-medium text-foreground/90">Qterm cannot be opened</p>
          <p className="mt-1 text-[10px] leading-snug text-muted-foreground">Apple cannot check it for malware.</p>
          <div className="mt-2.5 flex justify-end gap-1.5">
            <span className="rounded-md bg-white/8 px-2 py-1 text-[10px] text-muted-foreground/40 line-through decoration-red-400/80">
              Move to Trash
            </span>
            <span className="guide-click rounded-md bg-white px-2 py-1 text-[10px] font-medium text-black">OK</span>
          </div>
        </div>
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Step 2</p>
          <p className="mt-1 text-[13px] leading-snug">
            Click OK. Do not click Move to Trash, or Move to Bin.
          </p>
        </div>
      </div>

      <div className="grid gap-3 rounded-xl border border-white/8 bg-black/25 p-3 sm:grid-cols-[minmax(0,12.5rem)_1fr] sm:items-center">
        <div className="rounded-lg border border-white/10 bg-[#1f1f1f] px-3 py-2.5">
          <p className="text-[10px] font-medium text-muted-foreground">System Settings</p>
          <p className="mt-1 text-[11px] text-foreground/90">Privacy & Security</p>
          <p className="mt-1.5 text-[10px] leading-snug text-muted-foreground">
            Qterm was blocked because it is not from an identified developer.
          </p>
          <div className="mt-2 flex justify-end">
            <span className="guide-click rounded-md bg-white px-2 py-1 text-[10px] font-medium text-black">
              Open Anyway
            </span>
          </div>
        </div>
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Step 3</p>
          <p className="mt-1 text-[13px] leading-snug">
            Open System Settings, then Privacy & Security, then Open Anyway.
          </p>
        </div>
      </div>

      <div className="grid gap-3 rounded-xl border border-white/8 bg-black/25 p-3 sm:grid-cols-[minmax(0,12.5rem)_1fr] sm:items-center">
        <div className="rounded-lg border border-white/10 bg-[#2c2c2e] px-3 py-2.5">
          <p className="text-[11px] font-medium text-foreground/90">Open Qterm?</p>
          <p className="mt-1 text-[10px] leading-snug text-muted-foreground">macOS will ask one more time.</p>
          <div className="mt-2.5 flex justify-end gap-1.5">
            <span className="rounded-md bg-white/8 px-2 py-1 text-[10px] text-muted-foreground">Cancel</span>
            <span className="guide-click rounded-md bg-white px-2 py-1 text-[10px] font-medium text-black">
              Open Anyway
            </span>
          </div>
        </div>
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Step 4</p>
          <p className="mt-1 text-[13px] leading-snug">Click Open Anyway again on the next prompt. Then you are in.</p>
        </div>
      </div>
    </div>
  );
}
