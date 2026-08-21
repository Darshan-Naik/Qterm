import { MoreHorizontal, Columns2, Rows2, X, Trash2, Pencil, Pin } from "lucide-react";
import { useState } from "react";
import { closePane, deleteSession } from "@/lib/panes";
import { toggleSessionPin } from "@/lib/sessionPin";
import { TerminalShortcuts } from "@/lib/menuShortcuts";
import { listLeaves, persistUIPrefs, uiStore, useUI } from "@/store/ui";
import { splitFocused } from "@/app/splitActions";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { WithTooltip } from "@/components/ui/tooltip";
import { requestSessionRename } from "./PaneTitle";

export function PaneMenu({
  paneId,
  sessionId,
  open,
  onOpenChange,
}: {
  paneId: string;
  sessionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const leafCount = useUI((s) => listLeaves(s.splitTree).length);
  const pinned = useUI((s) => !!s.sessions.find((x) => x.id === sessionId)?.pinned);
  const canClosePane = leafCount > 1;
  const [suppressTip, setSuppressTip] = useState(false);

  const renameInSidebar = () => {
    if (!uiStore.get().sidebarOpen) {
      uiStore.set({ sidebarOpen: true });
      void persistUIPrefs();
    }
    // Wait for the dropdown to close and release focus, then start rename.
    window.setTimeout(() => requestSessionRename(sessionId), 60);
  };

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          // Closing restores focus to the trigger and would pop the tooltip.
          setSuppressTip(true);
          window.setTimeout(() => setSuppressTip(false), 150);
        }
      }}
    >
      <WithTooltip label="Pane menu" disabled={open || suppressTip}>
        <DropdownMenuTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            className={cn(
              "size-6 shrink-0 text-muted-foreground opacity-0 titlebar-no-drag transition-[opacity,background-color,color]",
              "group-hover/pane:opacity-45 group-hover/chrome:!opacity-100",
              "hover:bg-accent hover:text-foreground",
              open && "!opacity-100 bg-accent text-foreground"
            )}
          >
            <MoreHorizontal className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
      </WithTooltip>
      <DropdownMenuContent
        align="end"
        className="min-w-[13rem]"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <DropdownMenuItem
          shortcut={TerminalShortcuts.rename.label}
          onClick={renameInSidebar}
        >
          <Pencil className="size-3.5 opacity-70" />
          Rename…
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void toggleSessionPin(sessionId)}>
          <Pin className={cn("size-3.5 opacity-70", pinned && "fill-current")} />
          {pinned ? "Unpin terminal" : "Pin terminal"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          shortcut={TerminalShortcuts.splitRight.label}
          onClick={() => {
            uiStore.set({ focusedPaneId: paneId, focusedSessionId: sessionId });
            void splitFocused("horizontal");
          }}
        >
          <Columns2 className="size-3.5 opacity-70" />
          Split right
        </DropdownMenuItem>
        <DropdownMenuItem
          shortcut={TerminalShortcuts.splitDown.label}
          onClick={() => {
            uiStore.set({ focusedPaneId: paneId, focusedSessionId: sessionId });
            void splitFocused("vertical");
          }}
        >
          <Rows2 className="size-3.5 opacity-70" />
          Split down
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          shortcut={TerminalShortcuts.close.label}
          disabled={!canClosePane}
          onClick={() => void closePane(paneId)}
        >
          <X className="size-3.5 opacity-70" />
          Close
        </DropdownMenuItem>
        <DropdownMenuItem
          shortcut={TerminalShortcuts.delete.label}
          className="text-destructive focus:bg-destructive/10 focus:text-destructive"
          onClick={() => void deleteSession(sessionId)}
        >
          <Trash2 className="size-3.5 opacity-70" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
