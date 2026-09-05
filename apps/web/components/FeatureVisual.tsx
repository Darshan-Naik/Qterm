import { AGENTS } from "@/lib/site";
import { cn } from "@/lib/cn";

export type FeatureVisualKind = "projects" | "splits" | "flow" | "agents";

export function FeatureVisual({ kind }: { kind: FeatureVisualKind }) {
  if (kind === "projects") {
    return (
      <div className="flex h-[92px] flex-col justify-center gap-1 rounded-xl border border-white/8 bg-background/70 px-3 py-2">
        <div className="flex items-center gap-2 text-[11px] text-foreground/80">
          <span className="size-1.5 rounded-full bg-white/30" />
          acme
          <span className="ml-auto font-mono text-[10px] text-muted-foreground/70">main</span>
        </div>
        <div className="ml-3 flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="size-1.5 rounded-full bg-emerald-400/80" />
          zsh
        </div>
        <div className="ml-3 flex items-center gap-2 rounded-md bg-white/5 px-1.5 py-0.5 text-[11px] text-foreground/80">
          <img src="/agents/claude.png" alt="" width={12} height={12} className="session-logo-pulse size-3 rounded-[2px]" />
          claude
        </div>
      </div>
    );
  }

  if (kind === "splits") {
    return (
      <div className="flex h-[92px] overflow-hidden rounded-xl border border-white/8 bg-background/70">
        <div className="flex flex-1 flex-col px-3 py-2">
          <div className="text-[10px] text-muted-foreground">zsh</div>
          <div className="mt-2 h-1.5 w-16 rounded-full bg-white/12" />
          <div className="mt-1.5 h-1.5 w-10 rounded-full bg-white/8" />
        </div>
        <div className="feature-split-rule w-px bg-white/40" />
        <div className="flex flex-1 flex-col px-3 py-2">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <img src="/agents/claude.png" alt="" width={12} height={12} className="size-3 rounded-[2px]" />
            claude
          </div>
          <div className="mt-2 h-1.5 w-14 rounded-full bg-white/12" />
          <div className="mt-1.5 h-1.5 w-11 rounded-full bg-amber-400/35" />
        </div>
      </div>
    );
  }

  if (kind === "flow") {
    return (
      <div className="flex h-[92px] items-center justify-center rounded-xl border border-white/8 bg-background/70 px-3">
        <div className="feature-palette flex w-full items-center gap-2 rounded-lg border border-white/10 bg-white/4 px-3 py-2 text-[12px] text-muted-foreground">
          <span className="opacity-60">⌘K</span>
          <span className="text-foreground/70">Go to session</span>
          <span className="term-caret ml-auto" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[92px] items-center justify-center gap-2 rounded-xl border border-white/8 bg-background/70 px-3">
      {AGENTS.slice(0, 5).map((agent, index) => (
        <span
          key={agent.id}
          className={cn(
            "flex size-9 items-center justify-center rounded-lg border border-white/8 bg-white/4",
            index === 1 && "session-needs-input border-amber-400/20",
            index === 2 && "ring-1 ring-white/10"
          )}
        >
          <img
            src={agent.src}
            alt=""
            width={16}
            height={16}
            className={cn("size-4 rounded-[3px] object-contain", index === 2 && "session-logo-pulse")}
          />
        </span>
      ))}
    </div>
  );
}
