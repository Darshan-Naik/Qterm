export function MockSidebarFooter() {
  return (
    <div className="mt-auto flex items-center justify-between border-t border-white/6 px-1.5 py-1.5">
      <div className="flex items-center">
        <span className="flex size-7 items-center justify-center rounded-md text-muted-foreground/70">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M3 5.5h10M3 10.5h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            <path
              d="M6 3.5 3 5.5l3 2M10 8.5l3 2-3 2"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span className="flex size-7 items-center justify-center rounded-md text-muted-foreground/70">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <rect x="3" y="4.5" width="10" height="8" rx="2" stroke="currentColor" strokeWidth="1.2" />
            <circle cx="6.2" cy="8.2" r="0.8" fill="currentColor" />
            <circle cx="9.8" cy="8.2" r="0.8" fill="currentColor" />
          </svg>
        </span>
      </div>
      <span className="flex size-7 items-center justify-center rounded-md text-muted-foreground/70">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="8" cy="8" r="2.1" stroke="currentColor" strokeWidth="1.2" />
          <path
            d="M8 2.4v1.3M8 12.3v1.3M2.4 8h1.3M12.3 8h1.3M4.1 4.1l.9.9M11 11l.9.9M4.1 11.9l.9-.9M11 5l.9-.9"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </svg>
      </span>
    </div>
  );
}
