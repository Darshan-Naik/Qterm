import { AgentIcon } from "@/features/sidebar/AgentIcon";

/** Quiet product window for the welcome step, in the same language as the marketing site. */
export function OnboardingWelcomeArt() {
  return (
    <div className="relative mx-auto w-full max-w-[280px]" aria-hidden="true">
      <div className="pointer-events-none absolute inset-x-6 -bottom-6 h-16 rounded-full bg-primary/25 blur-2xl dark:bg-primary/40" />
      <div className="relative overflow-hidden rounded-xl border border-border/70 bg-card shadow-[0_24px_48px_-28px_rgba(0,0,0,0.55)] ring-1 ring-black/4 dark:ring-white/6">
        <div className="flex h-7 items-center gap-1.5 border-b border-border/60 bg-sidebar px-2.5">
          <span className="size-2 rounded-full bg-[#ff5f57]" />
          <span className="size-2 rounded-full bg-[#febc2e]" />
          <span className="size-2 rounded-full bg-[#28c840]" />
          <span className="ml-2 font-mono text-[10px] text-muted-foreground/80">Qterm</span>
        </div>
        <div className="flex h-[132px]">
          <div className="flex w-[88px] shrink-0 flex-col gap-1.5 border-r border-border/50 bg-sidebar px-2 py-2">
            <div className="flex items-center gap-1.5 text-[9px] text-foreground/80">
              <span className="size-1 rounded-full bg-foreground/30" />
              acme
            </div>
            <div className="ml-2 flex items-center gap-1.5 text-[9px] text-muted-foreground">
              <span className="size-1 rounded-full bg-emerald-400/80" />
              zsh
            </div>
            <div className="ml-2 flex items-center gap-1.5 rounded-md bg-foreground/6 px-1 py-0.5 text-[9px] text-foreground/80">
              <AgentIcon agent="claude" className="size-2.5 rounded-[2px]" thinking />
              claude
            </div>
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5 px-3 py-2.5 font-mono text-[9px] leading-relaxed">
            <div className="text-muted-foreground/70">~/acme</div>
            <div className="text-foreground/85">
              <span className="text-primary/80">❯</span> claude
            </div>
            <div className="mt-1 h-1.5 w-[72%] rounded-full bg-foreground/12" />
            <div className="h-1.5 w-[48%] rounded-full bg-foreground/8" />
            <div className="mt-auto h-1.5 w-[36%] rounded-full bg-amber-400/35" />
          </div>
        </div>
      </div>
    </div>
  );
}
