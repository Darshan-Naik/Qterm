export function MockPermissionPrompt({ action, path }: { action: string; path: string }) {
  return (
    <div className="mock-prompt mt-3 rounded-lg border border-amber-400/25 bg-amber-400/7 px-3 py-2.5">
      <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-amber-200/75">Needs input</div>
      <p className="mt-1.5 text-[12px] leading-snug text-foreground/90">
        {action}{" "}
        <span className="font-mono text-[11px] text-muted-foreground">{path}</span>
      </p>
      <div className="mt-2.5 flex items-center gap-2">
        <span className="mock-prompt-yes rounded-md px-2 py-0.5 text-[11px] text-amber-50">Yes</span>
        <span className="rounded-md bg-white/6 px-2 py-0.5 text-[11px] text-muted-foreground">No</span>
      </div>
    </div>
  );
}
