export function StarArt() {
  return (
    <div
      className="mb-4 flex h-[92px] items-center justify-center rounded-xl border border-white/8 bg-black/25"
      aria-hidden="true"
    >
      <span className="relative flex size-14 items-center justify-center">
        <span className="absolute size-14 rounded-full bg-amber-300/10" />
        <svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor" className="relative text-amber-200">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 6.82 21.02 8 14.14 3 9.27 9.91 8.26 12 2" />
        </svg>
      </span>
    </div>
  );
}
