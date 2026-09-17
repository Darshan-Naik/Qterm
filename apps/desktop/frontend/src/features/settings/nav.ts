import { Palette, Bot, TerminalSquare, Keyboard, TextQuote, Download } from "lucide-react";
import type { SettingsPage } from "@/store/ui";

export const NAV: { id: SettingsPage; label: string; icon: typeof Palette; keywords: string }[] = [
  { id: "appearance", label: "Appearance", icon: Palette, keywords: "theme dark light system zoom scale footer sidebar icons" },
  { id: "terminal", label: "Terminal", icon: TerminalSquare, keywords: "font shell size ide editor vscode cursor notify command finished" },
  { id: "shortcuts", label: "Shortcuts", icon: Keyboard, keywords: "hotkey keybinding keyboard chord remap rebind global visor show hide" },
  { id: "snippets", label: "Snippets", icon: TextQuote, keywords: "snippet shortcut command expand paste insert keyword" },
  { id: "agent", label: "Agent", icon: Bot, keywords: "cli claude codex gemini grok hooks mcp plugin skills marketplace extension tools notify badge dock" },
  { id: "updates", label: "Updates", icon: Download, keywords: "version download release github installer dmg upgrade" },
];
