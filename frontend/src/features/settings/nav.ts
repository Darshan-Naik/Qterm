import { Palette, Bot, TerminalSquare, Keyboard } from "lucide-react";
import type { SettingsPage } from "@/store/ui";

export const NAV: { id: SettingsPage; label: string; icon: typeof Palette; keywords: string }[] = [
  { id: "appearance", label: "Appearance", icon: Palette, keywords: "theme dark light system zoom scale" },
  { id: "terminal", label: "Terminal", icon: TerminalSquare, keywords: "font shell size" },
  { id: "shortcuts", label: "Shortcuts", icon: Keyboard, keywords: "hotkey keybinding keyboard chord remap rebind" },
  { id: "agent", label: "Agent", icon: Bot, keywords: "cli claude codex hooks mcp plugin" },
];
