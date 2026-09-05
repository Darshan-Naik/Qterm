export function SponsorArt() {
  return (
    <div
      className="mb-4 flex h-[92px] items-center justify-center rounded-xl border border-white/8 bg-black/25"
      aria-hidden="true"
    >
      <span className="relative flex size-14 items-center justify-center">
        <span className="absolute size-14 rounded-full bg-rose-400/10" />
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="relative text-rose-300"
        >
          <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
        </svg>
      </span>
    </div>
  );
}
