import { useEffect, useMemo, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { uiStore, useUI } from "@/store/ui";
import { NAV } from "./nav";
import { SettingsSidebar } from "./SettingsSidebar";
import { AppearancePage } from "./pages/AppearancePage";
import { TerminalPage } from "./pages/TerminalPage";
import { PluginsPage } from "./pages/PluginsPage";

export function SettingsMode() {
  const page = useUI((s) => s.settingsPage);
  const [query, setQuery] = useState("");

  const filteredNav = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return NAV;
    return NAV.filter(
      (n) => n.label.toLowerCase().includes(q) || n.keywords.includes(q)
    );
  }, [query]);

  useEffect(() => {
    if (!filteredNav.some((n) => n.id === page) && filteredNav[0]) {
      uiStore.set({ settingsPage: filteredNav[0].id });
    }
  }, [filteredNav, page]);

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 bg-background text-foreground">
      <SettingsSidebar query={query} onQueryChange={setQuery} filteredNav={filteredNav} />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="h-[var(--titlebar-height)] shrink-0 titlebar-drag" aria-hidden />
        <ScrollArea className="min-h-0 flex-1">
          <div className="mx-auto w-full max-w-[640px] px-8 pb-16 pt-4">
            {page === "appearance" && <AppearancePage />}
            {page === "terminal" && <TerminalPage />}
            {page === "plugins" && <PluginsPage />}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
