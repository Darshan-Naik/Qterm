import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronRight, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  GetAgentToolsCaps,
  InstallAgentTool,
  ListAgentTools,
  SetAgentToolEnabled,
  UninstallAgentTool,
  UpdateAgentTool,
} from "../../../../wailsjs/go/main/App";
import { AgentToolRow, type AgentToolItem } from "./AgentToolRow";

type ToolsCaps = {
  list: boolean;
  install: boolean;
  uninstall: boolean;
  enable: boolean;
  update?: boolean;
  browse?: boolean;
  kinds?: string[];
  installPlaceholder?: string;
};

type Tab = "plugins" | "skills" | "mcp" | "marketplace";

function matchesQuery(tool: AgentToolItem, q: string) {
  if (!q) return true;
  const parts = [
    tool.name,
    tool.id,
    tool.description,
    tool.source,
    ...(tool.skills || []).flatMap((p) => [p.name, p.description]),
    ...(tool.agents || []).flatMap((p) => [p.name, p.description]),
    ...(tool.hooks || []).flatMap((p) => [p.name, p.description]),
    ...(tool.mcpServers || []).flatMap((p) => [p.name, p.description]),
  ];
  return parts
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(q);
}

function pluginLabel(plugin: AgentToolItem) {
  return plugin.name || plugin.id.split("@")[0] || plugin.id;
}

export function AgentToolsPanel({
  cliID,
  cliName,
  open,
  onOpenChange,
}: {
  cliID: string;
  cliName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [caps, setCaps] = useState<ToolsCaps | null>(null);
  const [tools, setTools] = useState<AgentToolItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Tab>("plugins");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showAddMarketplace, setShowAddMarketplace] = useState(false);
  const [marketplaceSource, setMarketplaceSource] = useState("");
  const [showQuickInstall, setShowQuickInstall] = useState(false);
  const [quickSource, setQuickSource] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [nextCaps, nextTools] = await Promise.all([
        GetAgentToolsCaps(cliID) as Promise<ToolsCaps>,
        ListAgentTools(cliID) as Promise<AgentToolItem[]>,
      ]);
      setCaps(nextCaps || null);
      setTools(Array.isArray(nextTools) ? nextTools : []);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e || "Failed to load tools"));
    } finally {
      setLoading(false);
    }
  }, [cliID]);

  useEffect(() => {
    if (!open) return;
    setTab("plugins");
    setQuery("");
    setExpanded({});
    setShowAddMarketplace(false);
    setShowQuickInstall(false);
    void refresh();
  }, [open, refresh]);

  const q = query.trim().toLowerCase();
  const kinds = caps?.kinds || [];

  const plugins = useMemo(
    () =>
      tools.filter(
        (t) => (t.kind === "plugin" || t.kind === "extension") && !t.available && matchesQuery(t, q),
      ),
    [tools, q],
  );

  const installedIDs = useMemo(() => {
    const ids = new Set<string>();
    for (const t of tools) {
      if ((t.kind === "plugin" || t.kind === "extension") && !t.available) {
        ids.add(t.id.toLowerCase());
        ids.add(t.name.toLowerCase());
        const before = t.id.split("@")[0];
        if (before) ids.add(before.toLowerCase());
      }
    }
    return ids;
  }, [tools]);

  const skillRows = useMemo(() => {
    const rows: AgentToolItem[] = [];
    for (const t of tools) {
      if (t.kind === "skill" && !t.available && matchesQuery(t, q)) {
        rows.push(t);
      }
    }
    for (const plugin of tools) {
      if ((plugin.kind !== "plugin" && plugin.kind !== "extension") || plugin.available) continue;
      for (const skill of plugin.skills || []) {
        const row: AgentToolItem = {
          id: `${plugin.id}::skill::${skill.name}`,
          name: skill.name,
          kind: "skill",
          description: skill.description,
          enabled: plugin.enabled,
          managedBy: pluginLabel(plugin),
        };
        if (matchesQuery(row, q) || matchesQuery(plugin, q)) rows.push(row);
      }
    }
    return rows;
  }, [tools, q]);

  const mcpRows = useMemo(() => {
    const rows: AgentToolItem[] = [];
    for (const t of tools) {
      if (t.kind === "mcp" && matchesQuery(t, q)) rows.push(t);
    }
    for (const plugin of tools) {
      if ((plugin.kind !== "plugin" && plugin.kind !== "extension") || plugin.available) continue;
      for (const mcp of plugin.mcpServers || []) {
        const row: AgentToolItem = {
          id: `${plugin.id}::mcp::${mcp.name}`,
          name: mcp.name,
          kind: "mcp",
          description: mcp.description,
          enabled: plugin.enabled,
          managedBy: pluginLabel(plugin),
          system: !!plugin.system,
        };
        if (matchesQuery(row, q) || matchesQuery(plugin, q)) rows.push(row);
      }
    }
    return rows;
  }, [tools, q]);

  const marketplaces = useMemo(() => tools.filter((t) => t.kind === "marketplace"), [tools]);

  const availableByMarketplace = useMemo(() => {
    const map = new Map<string, AgentToolItem[]>();
    for (const t of tools) {
      if (!(t.kind === "plugin" || t.kind === "extension") || !t.available) continue;
      if (!matchesQuery(t, q)) continue;
      const key = t.source || "Other";
      const list = map.get(key) || [];
      list.push(t);
      map.set(key, list);
    }
    return map;
  }, [tools, q]);

  const marketplaceSections = useMemo(() => {
    const names = new Set<string>();
    for (const mp of marketplaces) names.add(mp.name);
    for (const key of availableByMarketplace.keys()) names.add(key);
    return [...names]
      .sort((a, b) => a.localeCompare(b))
      .map((name) => ({
        name,
        meta: marketplaces.find((m) => m.name === name),
        items: availableByMarketplace.get(name) || [],
      }));
  }, [marketplaces, availableByMarketplace]);

  const catalogCount = useMemo(
    () => [...availableByMarketplace.values()].reduce((n, items) => n + items.length, 0),
    [availableByMarketplace],
  );

  const hasSkills = kinds.includes("skill") || skillRows.length > 0 || plugins.some((p) => (p.skills?.length || 0) > 0);
  const hasMCP =
    kinds.includes("mcp") || mcpRows.length > 0 || plugins.some((p) => (p.mcpServers?.length || 0) > 0);
  const hasMarketplace = kinds.includes("marketplace") || !!caps?.browse || marketplaces.length > 0;

  const isInstalled = (tool: AgentToolItem) => {
    const id = tool.id.toLowerCase();
    const name = tool.name.toLowerCase();
    if (installedIDs.has(id) || installedIDs.has(name)) return true;
    const before = id.split("@")[0];
    return !!(before && installedIDs.has(before));
  };

  const toggleExpand = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const installPlugin = async (source: string) => {
    const src = source.trim();
    if (!src) {
      toast.error("Enter a plugin id");
      return;
    }
    setBusy(true);
    try {
      await InstallAgentTool(cliID, "plugin", src);
      setQuickSource("");
      setShowQuickInstall(false);
      toast.success("Installed");
      await refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e || "Install failed"));
    } finally {
      setBusy(false);
    }
  };

  const addMarketplace = async () => {
    const src = marketplaceSource.trim();
    if (!src) {
      toast.error("Enter a marketplace source");
      return;
    }
    setBusy(true);
    try {
      await InstallAgentTool(cliID, "marketplace", src);
      setMarketplaceSource("");
      setShowAddMarketplace(false);
      toast.success("Marketplace added");
      await refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e || "Add failed"));
    } finally {
      setBusy(false);
    }
  };

  const uninstall = async (tool: AgentToolItem) => {
    if (tool.managedBy) return;
    setBusy(true);
    try {
      await UninstallAgentTool(cliID, tool.kind, tool.id);
      toast.success("Uninstalled");
      await refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e || "Uninstall failed"));
    } finally {
      setBusy(false);
    }
  };

  const update = async (tool: AgentToolItem) => {
    if (tool.managedBy) return;
    setBusy(true);
    try {
      await UpdateAgentTool(cliID, tool.kind, tool.id);
      toast.success("Updated");
      await refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e || "Update failed"));
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (tool: AgentToolItem, enabled: boolean) => {
    if (tool.managedBy) return;
    setBusy(true);
    try {
      await SetAgentToolEnabled(cliID, tool.kind, tool.id, enabled);
      setTools((prev) =>
        prev.map((t) => (t.id === tool.id && t.kind === tool.kind ? { ...t, enabled } : t)),
      );
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e || "Update failed"));
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const emptyState = (title: string, body: string, action?: { label: string; onClick: () => void }) => (
    <div className="flex flex-col items-start gap-3 px-5 py-10">
      <div>
        <div className="text-[13px] font-medium">{title}</div>
        <p className="mt-1 max-w-sm text-[12.5px] leading-relaxed text-muted-foreground">{body}</p>
      </div>
      {action ? (
        <Button size="sm" variant="secondary" className="h-8 rounded-lg text-[12.5px]" onClick={action.onClick}>
          {action.label}
        </Button>
      ) : null}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0" showClose size="xl" aria-describedby={undefined}>
        <div className="flex max-h-[min(40rem,calc(100vh-3rem))] flex-col overflow-hidden">
          <div className="shrink-0 space-y-4 border-b border-border/50 px-5 pb-4 pt-5">
            <DialogHeader>
              <DialogTitle>{cliName}</DialogTitle>
            </DialogHeader>

            {loading && !caps ? (
              <div className="text-[12px] text-muted-foreground">Loading…</div>
            ) : !caps?.list ? (
              <div className="text-[12px] text-muted-foreground">Tools aren’t available for this CLI.</div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-1.5">
                  <TabChip active={tab === "plugins"} onClick={() => setTab("plugins")}>
                    Plugins
                    <Count>{plugins.length}</Count>
                  </TabChip>
                  {hasSkills ? (
                    <TabChip active={tab === "skills"} onClick={() => setTab("skills")}>
                      Skills
                      <Count>{skillRows.length}</Count>
                    </TabChip>
                  ) : null}
                  {hasMCP ? (
                    <TabChip active={tab === "mcp"} onClick={() => setTab("mcp")}>
                      MCP
                      <Count>{mcpRows.length}</Count>
                    </TabChip>
                  ) : null}
                  {hasMarketplace ? (
                    <TabChip active={tab === "marketplace"} onClick={() => setTab("marketplace")}>
                      Marketplace
                      <Count>{catalogCount}</Count>
                    </TabChip>
                  ) : null}
                  <button
                    type="button"
                    className="ml-auto text-[11.5px] text-muted-foreground hover:text-foreground"
                    disabled={loading || busy}
                    onClick={() => void refresh()}
                  >
                    Refresh
                  </button>
                </div>

                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={
                    tab === "marketplace"
                      ? "Search catalog…"
                      : tab === "plugins"
                        ? "Search plugins…"
                        : "Search…"
                  }
                  className="h-9"
                  disabled={busy}
                />
              </>
            )}
          </div>

          {caps?.list ? (
            <div className="min-h-0 flex-1 overflow-y-auto">
              {tab === "plugins" ? (
                plugins.length === 0 ? (
                  loading ? (
                    <div className="px-5 py-10 text-[12px] text-muted-foreground">Loading…</div>
                  ) : (
                    emptyState(
                      "No plugins yet",
                      "Install from Marketplace to get started.",
                      hasMarketplace
                        ? { label: "Open marketplace", onClick: () => setTab("marketplace") }
                        : undefined,
                    )
                  )
                ) : (
                  <div className="divide-y divide-border/40">
                    {plugins.map((tool) => (
                      <AgentToolRow
                        key={`${tool.kind}:${tool.id}`}
                        tool={tool}
                        canEnable={!!caps.enable}
                        canUninstall={!!caps.uninstall}
                        canUpdate={!!caps.update}
                        busy={busy}
                        expanded={!!expanded[tool.id]}
                        onToggleExpand={() => toggleExpand(tool.id)}
                        onToggle={(enabled) => void toggle(tool, enabled)}
                        onUpdate={() => void update(tool)}
                        onUninstall={() => void uninstall(tool)}
                      />
                    ))}
                  </div>
                )
              ) : null}

              {tab === "skills" ? (
                skillRows.length === 0 ? (
                  emptyState("No skills", "Plugin skills and standalone skills appear here.")
                ) : (
                  <div className="divide-y divide-border/40">
                    {skillRows.map((tool) => (
                      <AgentToolRow
                        key={`${tool.kind}:${tool.id}`}
                        tool={tool}
                        canUninstall={!tool.managedBy && !!caps.uninstall}
                        canUpdate={!tool.managedBy && !!caps.update}
                        busy={busy}
                        onUpdate={() => void update(tool)}
                        onUninstall={() => void uninstall(tool)}
                      />
                    ))}
                  </div>
                )
              ) : null}

              {tab === "mcp" ? (
                mcpRows.length === 0 ? (
                  emptyState("No MCP servers", "Plugin and user MCP servers appear here.")
                ) : (
                  <div className="divide-y divide-border/40">
                    {mcpRows.map((tool) => (
                      <AgentToolRow
                        key={`${tool.kind}:${tool.id}`}
                        tool={tool}
                        canUninstall={!tool.managedBy && !tool.system && !!caps.uninstall}
                        busy={busy}
                        onUninstall={() => void uninstall(tool)}
                      />
                    ))}
                  </div>
                )
              ) : null}

              {tab === "marketplace" ? (
                <div className="space-y-4 px-5 py-4">
                  {caps.install ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-8 rounded-lg text-[12.5px]"
                        onClick={() => setShowAddMarketplace((v) => !v)}
                      >
                        {showAddMarketplace ? "Cancel" : "Add marketplace"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-[12.5px] text-muted-foreground"
                        onClick={() => setShowQuickInstall((v) => !v)}
                      >
                        {showQuickInstall ? "Cancel" : "Install by id"}
                      </Button>
                    </div>
                  ) : null}

                  {showAddMarketplace ? (
                    <div className="flex flex-wrap gap-2">
                      <Input
                        value={marketplaceSource}
                        onChange={(e) => setMarketplaceSource(e.target.value)}
                        placeholder="owner/repo"
                        className="min-w-[14rem] flex-1"
                        disabled={busy}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void addMarketplace();
                        }}
                      />
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-9 rounded-lg text-[12.5px]"
                        disabled={busy || !marketplaceSource.trim()}
                        onClick={() => void addMarketplace()}
                      >
                        Add
                      </Button>
                    </div>
                  ) : null}

                  {showQuickInstall ? (
                    <div className="flex flex-wrap gap-2">
                      <Input
                        value={quickSource}
                        onChange={(e) => setQuickSource(e.target.value)}
                        placeholder={caps.installPlaceholder || "name@marketplace"}
                        className="min-w-[14rem] flex-1"
                        disabled={busy}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void installPlugin(quickSource);
                        }}
                      />
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-9 rounded-lg text-[12.5px]"
                        disabled={busy || !quickSource.trim()}
                        onClick={() => void installPlugin(quickSource)}
                      >
                        Install
                      </Button>
                    </div>
                  ) : null}

                  {marketplaceSections.length === 0 ? (
                    <p className="py-6 text-[12.5px] text-muted-foreground">
                      {loading ? "Loading…" : "No marketplaces yet. Add one to browse plugins."}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {marketplaceSections.map((section) => {
                        const openSection = expanded[`mp:${section.name}`] ?? true;
                        return (
                          <div
                            key={section.name}
                            className="overflow-hidden rounded-lg border border-border/50"
                          >
                            <div className="flex items-center gap-1 border-b border-border/40 bg-secondary/20 px-2 py-1.5">
                              <button
                                type="button"
                                className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-1.5 py-1 text-left hover:bg-secondary/60"
                                onClick={() => toggleExpand(`mp:${section.name}`)}
                              >
                                <ChevronRight
                                  className={cn(
                                    "size-4 shrink-0 text-muted-foreground transition-transform",
                                    openSection && "rotate-90",
                                  )}
                                />
                                <span className="truncate text-[12.5px] font-medium">{section.name}</span>
                                <Count>{section.items.length}</Count>
                              </button>
                              {section.meta && (caps.update || caps.uninstall) ? (
                                <DropdownMenu modal={false}>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      type="button"
                                      size="icon"
                                      variant="ghost"
                                      className="size-7 text-muted-foreground"
                                      disabled={busy}
                                      aria-label={`${section.name} actions`}
                                    >
                                      <MoreHorizontal className="size-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="min-w-[9.5rem]">
                                    {caps.update ? (
                                      <DropdownMenuItem
                                        disabled={busy}
                                        onSelect={() => void update(section.meta!)}
                                      >
                                        Update
                                      </DropdownMenuItem>
                                    ) : null}
                                    {caps.update && caps.uninstall ? <DropdownMenuSeparator /> : null}
                                    {caps.uninstall ? (
                                      <DropdownMenuItem
                                        disabled={busy}
                                        className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                                        onSelect={() => void uninstall(section.meta!)}
                                      >
                                        Remove
                                      </DropdownMenuItem>
                                    ) : null}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              ) : null}
                            </div>

                            {openSection ? (
                              section.items.length === 0 ? (
                                <div className="px-4 py-5 text-[12px] text-muted-foreground">
                                  {caps.browse
                                    ? "No catalog items match."
                                    : "Catalog browse isn’t available. Use Install by id."}
                                </div>
                              ) : (
                                <div className="divide-y divide-border/40">
                                  {section.items.slice(0, 60).map((tool) => (
                                    <AgentToolRow
                                      key={`${tool.kind}:${tool.id}`}
                                      tool={tool}
                                      canInstall={!!caps.install}
                                      busy={busy}
                                      installed={isInstalled(tool)}
                                      onInstall={() => void installPlugin(tool.id)}
                                    />
                                  ))}
                                  {section.items.length > 60 ? (
                                    <div className="px-4 py-3 text-[11.5px] text-muted-foreground">
                                      Showing 60 of {section.items.length}. Refine search to narrow results.
                                    </div>
                                  ) : null}
                                </div>
                              )
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TabChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition-colors",
        active ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function Count({ children }: { children: React.ReactNode }) {
  return <span className="text-[11px] opacity-60">{children}</span>;
}

