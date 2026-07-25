import { MoreHorizontal, Columns2, Rows2, X, Trash2, Pencil } from "lucide-react";
import { closePane, deleteSession } from "@/lib/panes";
import { listLeaves, uiStore, useUI } from "@/store/ui";
import { splitFocused } from "@/app/splitActions";
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

export function PaneMenu({ paneId, sessionId }: { paneId: string; sessionId: string }) {
  const leafCount = useUI((s) => listLeaves(s.splitTree).length);
  const canClosePane = leafCount > 1;

  return (
    <DropdownMenu>
      <WithTooltip label="Pane menu">
        <DropdownMenuTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            className="size-6 shrink-0 text-muted-foreground titlebar-no-drag"
          >
            <MoreHorizontal className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
      </WithTooltip>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => requestSessionRename(sessionId)}>
          <Pencil className="size-3.5 opacity-70" />
          Rename…
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            uiStore.set({ focusedPaneId: paneId, focusedSessionId: sessionId });
            void splitFocused("horizontal");
          }}
        >
          <Columns2 className="size-3.5 opacity-70" />
          Split right
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            uiStore.set({ focusedPaneId: paneId, focusedSessionId: sessionId });
            void splitFocused("vertical");
          }}
        >
          <Rows2 className="size-3.5 opacity-70" />
          Split down
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={!canClosePane} onClick={() => void closePane(paneId)}>
          <X className="size-3.5 opacity-70" />
          Close pane
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-destructive focus:bg-destructive/10 focus:text-destructive"
          onClick={() => void deleteSession(sessionId)}
        >
          <Trash2 className="size-3.5 opacity-70" />
          Delete terminal
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
