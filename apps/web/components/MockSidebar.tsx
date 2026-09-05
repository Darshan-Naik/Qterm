import { MockProjectRow } from "./MockProjectRow";
import { MockSidebarFooter } from "./MockSidebarFooter";
import { MockSidebarRow } from "./MockSidebarRow";

export function MockSidebar({ claude }: { claude: "thinking" | "input" }) {
  return (
    <aside className="hidden w-[220px] shrink-0 flex-col border-r border-white/6 bg-sidebar sm:flex">
      <div className="flex items-center gap-2 px-4 py-3 text-[12px] text-muted-foreground">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="opacity-55">
          <path d="M8 3.2v9.6M3.2 8h9.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        New
      </div>
      <div className="min-h-0 flex-1 px-3 pb-2">
        <div className="px-2 pb-1 text-[11px] uppercase tracking-wider text-muted-foreground/70">Projects</div>
        <MockProjectRow name="acme" branch="main" />
        <div className="mt-0.5 space-y-0.5">
          <MockSidebarRow label="zsh" focused open indent />
          <MockSidebarRow
            label="claude"
            agent="claude"
            open
            indent
            thinking={claude === "thinking"}
            needsInput={claude === "input"}
          />
          <MockSidebarRow label="cursor" agent="cursor" indent thinking />
        </div>
        <div className="mt-2">
          <MockProjectRow name="notes" />
          <MockSidebarRow label="zsh" indent />
        </div>
      </div>
      <MockSidebarFooter />
    </aside>
  );
}
