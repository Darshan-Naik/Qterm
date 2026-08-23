import { Check, Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { WithTooltip } from "@/components/ui/tooltip";
import { useExclusiveMenu } from "@/hooks/useExclusiveMenu";
import { useMenuTooltipGate } from "@/hooks/useMenuTooltipGate";
import { shortcutLabelFor } from "@/lib/shortcuts";
import { cn } from "@/lib/utils";
import { setThemeMode, useUI, type ThemeMode } from "@/store/ui";

const THEMES: { id: ThemeMode; label: string; icon: typeof Sun }[] = [
  { id: "system", label: "System", icon: Monitor },
  { id: "dark", label: "Dark", icon: Moon },
  { id: "light", label: "Light", icon: Sun },
];

export function SidebarThemeMenu() {
  const theme = useUI((s) => s.theme);
  const keybindings = useUI((s) => s.keybindings);
  const [open, setOpen] = useExclusiveMenu("sidebar-theme");
  const { suppressTip, suppressTipAfterMenuClose, tipTriggerProps } = useMenuTooltipGate();
  const shortcut = shortcutLabelFor("toggleTheme", keybindings);
  const current = THEMES.find((t) => t.id === theme)?.label ?? "System";

  return (
    <DropdownMenu
      modal={false}
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) suppressTipAfterMenuClose();
      }}
    >
      <WithTooltip
        label={`Theme: ${current} (${shortcut})`}
        side="top"
        disabled={open || suppressTip}
      >
        <DropdownMenuTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            className={cn(
              "size-7 shrink-0 text-muted-foreground",
              open && "bg-sidebar-accent text-sidebar-foreground"
            )}
            aria-label={`Theme: ${current}`}
            {...tipTriggerProps}
          >
            {theme === "light" ? (
              <Sun className="size-4" />
            ) : theme === "dark" ? (
              <Moon className="size-4" />
            ) : (
              <Monitor className="size-4" />
            )}
          </Button>
        </DropdownMenuTrigger>
      </WithTooltip>
      <DropdownMenuContent
        side="top"
        align="end"
        sideOffset={6}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        {THEMES.map(({ id, label, icon: Icon }) => (
          <DropdownMenuItem key={id} onClick={() => setThemeMode(id)}>
            <Icon className="size-3.5 opacity-70" />
            {label}
            {theme === id ? <Check className="ml-auto size-3.5 opacity-70" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
