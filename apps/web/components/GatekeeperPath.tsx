export function GatekeeperPath() {
  return (
    <div className="flex items-start px-1 pb-3 pt-1">
      <StepDot n={1} label="Install" />
      <PathLine />
      <StepDot n={2} label="OK" />
      <PathLine />
      <StepDot n={3} label="Settings" />
      <PathLine />
      <StepDot n={4} label="Open" />
    </div>
  );
}

function StepDot({ n, label }: { n: number; label: string }) {
  return (
    <span className="flex w-[3.4rem] shrink-0 flex-col items-center gap-1.5">
      <span className="flex size-6 items-center justify-center rounded-full border border-white/25 bg-white/10 text-[11px] font-semibold tabular-nums">
        {n}
      </span>
      <span className="text-[10px] leading-none text-muted-foreground">{label}</span>
    </span>
  );
}

function PathLine() {
  return (
    <span className="mt-3 flex min-w-3 flex-1 items-center text-white/45">
      <span className="h-[2px] flex-1 rounded-full bg-white/40" />
      <span className="text-[11px] leading-none">›</span>
    </span>
  );
}
