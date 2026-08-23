import { Bot, Command, Settings } from "lucide-react";
import { shortcutLabelFor } from "@/lib/shortcuts";
import { cn } from "@/lib/utils";
import { useAgentCLIs } from "@/queries";
import { openSettings, uiStore, useUI } from "@/store/ui";
import { SIDEBAR_STICKY_SEAL } from "./sidebarLayout";
import { SidebarFooterButton } from "./SidebarFooterButton";
import { SidebarThemeMenu } from "./SidebarThemeMenu";

function openCommandPalette() {
  uiStore.set({
    paletteOpen: true,
    quickOpen: false,
    agentSessionsOpen: false,
    terminalFindOpen: false,
  });
}

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
  const footer = useUI((s) => s.sidebarFooter);
  const showPalette = footer.includes("palette");
  const showAgentPref = footer.includes("agent");
  const showTheme = footer.includes("theme");
  const showSettings = footer.includes("settings");
  const { data: clis } = useAgentCLIs(showAgentPref);
  const showAgent = showAgentPref && !!clis?.some((c) => c.installed);
  const agents = shortcutLabelFor("agentSessions", keybindings);
  const palette = shortcutLabelFor("commandPalette", keybindings);
  const settings = shortcutLabelFor("openSettings", keybindings);

  if (!showPalette && !showAgent && !showTheme && !showSettings) return null;

  return (
    <footer
      className={cn(
        "relative z-30 shrink-0 bg-sidebar px-2 py-1.5",
        SIDEBAR_STICKY_SEAL
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          {showPalette ? (
            <SidebarFooterButton label={`Command palette (${palette})`} onClick={openCommandPalette}>
              <Command className="size-4" />
            </SidebarFooterButton>
          ) : null}
          {showAgent ? (
            <SidebarFooterButton label={`Agent sessions (${agents})`} onClick={openAgentSessions}>
              <Bot className="size-4" />
            </SidebarFooterButton>
          ) : null}
        </div>
        <div className="flex items-center">
          {showTheme ? <SidebarThemeMenu /> : null}
          {showSettings ? (
            <SidebarFooterButton label={`Settings (${settings})`} onClick={() => openSettings()}>
              <Settings className="size-4" />
            </SidebarFooterButton>
          ) : null}
        </div>
      </div>
    </footer>
  );
}
