import { MockSidebar } from "./MockSidebar";
import { MockSplit } from "./MockSplit";

export function ProductWindow() {
  return (
    <div
      aria-hidden="true"
      className="overflow-hidden rounded-xl border border-white/10 bg-background shadow-[0_40px_80px_-32px_rgba(0,0,0,0.7)] ring-1 ring-white/6"
    >
      <div className="flex h-8 items-center gap-2 border-b border-white/6 bg-sidebar px-3">
        <span className="size-2.5 rounded-full bg-[#ff5f57]" />
        <span className="size-2.5 rounded-full bg-[#febc2e]" />
        <span className="size-2.5 rounded-full bg-[#28c840]" />
        <span className="ml-3 font-mono text-[11px] text-muted-foreground/80">Qterm</span>
      </div>
      <div className="flex min-h-[380px] sm:min-h-[440px]">
        <MockSidebar />
        <MockSplit />
      </div>
    </div>
  );
}
