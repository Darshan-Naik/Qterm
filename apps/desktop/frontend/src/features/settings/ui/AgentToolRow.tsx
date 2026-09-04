import { ChevronRight, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export type AgentToolPart = {
  name: string;
  description?: string;
};

export type AgentToolItem = {
  id: string;
  name: string;
  kind: string;
  version?: string;
  source?: string;
  description?: string;
  enabled: boolean;
  scope?: string;
  system?: boolean;
  available?: boolean;
  installCount?: number;
  managedBy?: string;
  skills?: AgentToolPart[];
  hooks?: AgentToolPart[];
  agents?: AgentToolPart[];
  mcpServers?: AgentToolPart[];
};

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md bg-secondary/80 px-1.5 py-0.5 text-[10.5px] text-muted-foreground">
      {children}
    </span>
  );
}

function NestedPartRow({ part }: { part: AgentToolPart }) {
  return (
    <div className="px-2 py-1.5">
      <div className="text-[12.5px] font-medium leading-snug">{part.name}</div>
      {part.description?.trim() ? (
        <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">{part.description}</p>
      ) : null}
    </div>
  );
}

function NestedGroup({ label, items }: { label: string; items: AgentToolPart[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="mb-1 px-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="space-y-1">
        {items.map((item) => (
          <NestedPartRow key={item.name} part={item} />
        ))}
      </div>
    </div>
  );
}

export function AgentToolRow({
  tool,
  canEnable,
  canUninstall,
  canUpdate,
  canInstall,
  busy,
  expanded,
  onToggleExpand,
  onToggle,
  onUpdate,
  onUninstall,
  onInstall,
  installed,
}: {
  tool: AgentToolItem;
  canEnable?: boolean;
  canUninstall?: boolean;
  canUpdate?: boolean;
  canInstall?: boolean;
  busy?: boolean;
  expanded?: boolean;
  onToggleExpand?: () => void;
  onToggle?: (enabled: boolean) => void;
  onUpdate?: () => void;
  onUninstall?: () => void;
  onInstall?: () => void;
  installed?: boolean;
}) {
  const managed = !!tool.managedBy;
  const nestedCount =
    (tool.skills?.length || 0) +
    (tool.hooks?.length || 0) +
    (tool.agents?.length || 0) +
    (tool.mcpServers?.length || 0);
  const expandable = !!onToggleExpand && nestedCount > 0;
  const showMenu =
    !tool.system && !managed && !tool.available && !!(canUpdate || canUninstall);

  return (
    <div className="px-4 py-3.5">
      <div className="flex items-start gap-2.5">
        {expandable ? (
          <button
            type="button"
            className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
            onClick={onToggleExpand}
            aria-label={expanded ? "Collapse" : "Expand"}
          >
            <ChevronRight className={cn("size-4 transition-transform", expanded && "rotate-90")} />
          </button>
        ) : (
          <span className="size-6 shrink-0" />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="truncate text-[13px] font-medium leading-snug">{tool.name}</span>
            {tool.system ? (
              <span className="rounded-md bg-emerald-500/12 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
                Qterm
              </span>
            ) : null}
            {managed ? (
              <span className="rounded-md bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
                via {tool.managedBy}
              </span>
            ) : null}
            {tool.version && tool.version.toLowerCase() !== "unknown" ? (
              <span className="font-mono text-[11px] text-muted-foreground">
                v{tool.version.replace(/^v/i, "")}
              </span>
            ) : null}
            {installed ? (
              <span className="rounded-md bg-emerald-500/12 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
                Installed
              </span>
            ) : null}
          </div>

          {tool.description && !expanded ? (
            <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-muted-foreground">
              {tool.description}
            </p>
          ) : null}

          {!expanded && nestedCount > 0 ? (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {tool.skills?.length ? <Chip>{tool.skills.length} skills</Chip> : null}
              {tool.agents?.length ? <Chip>{tool.agents.length} agents</Chip> : null}
              {tool.hooks?.length ? <Chip>{tool.hooks.length} hooks</Chip> : null}
              {tool.mcpServers?.length ? <Chip>{tool.mcpServers.length} MCP</Chip> : null}
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {canEnable && !tool.system && !managed && !tool.available && onToggle ? (
            <Switch
              checked={tool.enabled}
              disabled={busy}
              onCheckedChange={(v) => onToggle(!!v)}
              aria-label={`Enable ${tool.name}`}
            />
          ) : null}

          {canInstall && tool.available && !installed && onInstall ? (
            <Button
              size="sm"
              variant="secondary"
              className="h-7 rounded-md px-2.5 text-[11.5px]"
              disabled={busy}
              onClick={onInstall}
            >
              Install
            </Button>
          ) : null}

          {tool.system ? (
            <span className="text-[11px] text-muted-foreground">Disconnect</span>
          ) : managed ? (
            <span className="text-[11px] text-muted-foreground">Managed by plugin</span>
          ) : showMenu ? (
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-7 text-muted-foreground"
                  disabled={busy}
                  aria-label={`${tool.name} actions`}
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[9.5rem]">
                {canUpdate && onUpdate ? (
                  <DropdownMenuItem disabled={busy} onSelect={() => onUpdate()}>
                    Update
                  </DropdownMenuItem>
                ) : null}
                {canUpdate && canUninstall ? <DropdownMenuSeparator /> : null}
                {canUninstall && onUninstall ? (
                  <DropdownMenuItem
                    disabled={busy}
                    className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                    onSelect={() => onUninstall()}
                  >
                    Uninstall
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>

      {expanded ? (
        <div className="ml-8 mt-3 space-y-3 border-t border-border/40 pt-3">
          {tool.description ? (
            <p className="px-2 text-[12.5px] leading-relaxed text-muted-foreground">{tool.description}</p>
          ) : null}
          <NestedGroup label="Skills" items={tool.skills || []} />
          <NestedGroup label="Agents" items={tool.agents || []} />
          <NestedGroup label="Hooks" items={tool.hooks || []} />
          <NestedGroup label="MCP" items={tool.mcpServers || []} />
          {nestedCount === 0 && !tool.description ? (
            <p className="px-2 text-[12px] text-muted-foreground">No nested components.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
