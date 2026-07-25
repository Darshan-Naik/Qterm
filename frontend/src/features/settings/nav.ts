import { Palette, Puzzle, TerminalSquare } from "lucide-react";
import type { SettingsPage } from "@/store/ui";

export const NAV: { id: SettingsPage; label: string; icon: typeof Palette; keywords: string }[] = [
  { id: "appearance", label: "Appearance", icon: Palette, keywords: "theme dark light system" },
  { id: "terminal", label: "Terminal", icon: TerminalSquare, keywords: "font shell size" },
  { id: "plugins", label: "Plugins", icon: Puzzle, keywords: "hooks install permissions" },
];
