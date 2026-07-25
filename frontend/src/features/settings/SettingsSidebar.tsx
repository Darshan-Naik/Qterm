import { ArrowLeft, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { closeSettings, uiStore, useUI, type SettingsPage } from "@/store/ui";
import { NAV } from "./nav";

export function SettingsSidebar({
  query,
  onQueryChange,
  filteredNav,
}: {
  query: string;
  onQueryChange: (q: string) => void;
  filteredNav: typeof NAV;
}) {
  const page = useUI((s) => s.settingsPage);

  return (
    <aside className="flex w-[240px] shrink-0 flex-col select-none bg-sidebar text-sidebar-foreground titlebar-no-drag">
      <div
        className="h-[var(--titlebar-height)] shrink-0 titlebar-drag"
        style={{ paddingLeft: "var(--traffic-inset)" }}
        aria-hidden
      />
      <div className="flex min-h-0 flex-1 flex-col px-3 pb-3">
        <button
          type="button"
          className="mb-2 flex h-8 w-fit cursor-pointer items-center gap-1.5 rounded-md px-1.5 text-[12.5px] text-muted-foreground hover:text-sidebar-foreground"
          onClick={() => closeSettings()}
        >
          <ArrowLeft className="size-3.5" />
          Back
        </button>

        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search settings"
            className="h-8 select-text rounded-full border-0 bg-secondary/70 pl-8 text-[12.5px] shadow-none focus-visible:ring-1"
          />
        </div>

        <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
          {filteredNav.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={cn(
                "flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[12.5px] text-sidebar-foreground/90 transition-colors hover:bg-sidebar-accent/60",
                page === id && "bg-sidebar-accent text-sidebar-accent-foreground"
              )}
              onClick={() => uiStore.set({ settingsPage: id as SettingsPage })}
            >
              <Icon className="size-3.5 shrink-0 opacity-70" />
              {label}
            </button>
          ))}
          {filteredNav.length === 0 && (
            <p className="px-2.5 py-2 text-[12px] text-muted-foreground">No matches</p>
          )}
        </nav>
      </div>
    </aside>
  );
}
