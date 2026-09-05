export function SponsorArt() {
  return (
    <div
      className="mb-4 flex h-[92px] items-center justify-center gap-4 rounded-xl border border-white/8 bg-black/25 px-4"
      aria-hidden="true"
    >
      <span className="flex size-12 items-center justify-center rounded-2xl border border-white/10 bg-white/6 text-[18px] font-semibold tracking-tight">
        $99
      </span>
      <span className="text-[20px] text-muted-foreground/70">→</span>
      <span className="flex size-12 items-center justify-center rounded-2xl border border-rose-400/20 bg-rose-400/10 text-rose-300">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
        </svg>
      </span>
    </div>
  );
}
