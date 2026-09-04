import { MockSidebarRow } from "./MockSidebarRow";

export function MockSidebar() {
  return (
    <aside className="hidden w-[200px] shrink-0 border-r border-white/6 bg-sidebar p-3 sm:block">
      <div className="mb-3 px-2 text-[12px] text-muted-foreground">New</div>
      <MockSidebarRow label="zsh" />
      <div className="mt-4 px-2 text-[11px] uppercase tracking-wider text-muted-foreground/70">Projects</div>
      <div className="mt-1">
        <MockSidebarRow label="qterm" active />
        <MockSidebarRow label="dev" indent active />
        <MockSidebarRow label="claude" indent pulse />
      </div>
      <div className="mt-2">
        <MockSidebarRow label="website" />
        <MockSidebarRow label="zsh" indent />
      </div>
    </aside>
  );
}
