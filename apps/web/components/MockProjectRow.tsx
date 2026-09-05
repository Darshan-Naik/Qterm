export function MockProjectRow({ name, branch }: { name: string; branch?: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[12px] text-foreground/85">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0 opacity-55">
        <path
          d="M2.5 4.5h4.2l1.1 1.4H13.5v6.1a1.5 1.5 0 0 1-1.5 1.5H4a1.5 1.5 0 0 1-1.5-1.5z"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      </svg>
      <span className="min-w-0 flex-1 truncate">{name}</span>
      {branch ? (
        <span className="font-mono text-[10px] text-muted-foreground/80">{branch}</span>
      ) : null}
    </div>
  );
}
