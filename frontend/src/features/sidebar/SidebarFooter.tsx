import { Bot, Settings } from "lucide-react";
import { shortcutLabelFor } from "@/lib/shortcuts";
import { cn } from "@/lib/utils";
import { useAgentCLIs } from "@/queries";
import { openSettings, uiStore, useUI } from "@/store/ui";
import { SIDEBAR_STICKY_SEAL } from "./sidebarLayout";
import { SidebarFooterButton } from "./SidebarFooterButton";

function openAgentSessions() {
  uiStore.set({
    agentSessionsOpen: true,
    paletteOpen: false,
    quickOpen: false,
    terminalFindOpen: false,
  });
}

export function SidebarFooter() {
  const keybindings = useUI((s) => s.keybindings);
  const { data: clis } = useAgentCLIs();
  const hasAgents = !!clis?.some((c) => c.installed);
  const agents = shortcutLabelFor("agentSessions", keybindings);
  const settings = shortcutLabelFor("openSettings", keybindings);

  return (
    <footer
      className={cn(
        "relative z-30 shrink-0 bg-sidebar px-2 py-1.5",
        SIDEBAR_STICKY_SEAL
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          {hasAgents ? (
            <SidebarFooterButton label={`Agent sessions (${agents})`} onClick={openAgentSessions}>
              <Bot className="size-4" />
            </SidebarFooterButton>
          ) : null}
        </div>
        <div className="flex items-center">
          <SidebarFooterButton label={`Settings (${settings})`} onClick={() => openSettings()}>
            <Settings className="size-4" />
          </SidebarFooterButton>
        </div>
      </div>
    </footer>
  );
}
