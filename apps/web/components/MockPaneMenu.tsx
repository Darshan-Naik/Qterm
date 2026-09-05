export function MockPaneMenu({ active = false }: { active?: boolean }) {
  return (
    <span
      className={`flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground ${
        active ? "opacity-80" : "opacity-45"
      }`}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="1" />
        <circle cx="19" cy="12" r="1" />
        <circle cx="5" cy="12" r="1" />
      </svg>
    </span>
  );
}
