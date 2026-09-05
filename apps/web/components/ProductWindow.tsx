import { MockSidebar } from "./MockSidebar";
import { MockSplit } from "./MockSplit";

export function ProductWindow() {
  return (
    <div className="hero-window relative">
      <div className="hero-window-glow pointer-events-none absolute inset-x-8 -bottom-10 h-24 blur-2xl" />
      <div
        aria-hidden="true"
        className="relative overflow-hidden rounded-xl border border-white/10 bg-background shadow-[0_40px_90px_-28px_rgba(0,0,0,0.78)] ring-1 ring-white/6"
      >
        <div className="flex h-8 items-center gap-2 border-b border-white/6 bg-sidebar px-3">
          <span className="size-2.5 rounded-full bg-[#ff5f57]" />
          <span className="size-2.5 rounded-full bg-[#febc2e]" />
          <span className="size-2.5 rounded-full bg-[#28c840]" />
          <span className="ml-3 font-mono text-[11px] text-muted-foreground/80">Qterm</span>
        </div>
        <div className="flex min-h-[400px] sm:min-h-[468px]">
          <MockSidebar />
          <MockSplit />
        </div>
      </div>
    </div>
  );
}
