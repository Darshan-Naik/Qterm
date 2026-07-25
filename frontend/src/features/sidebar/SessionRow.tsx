import { useEffect, useRef, useState } from "react";
import { MoreHorizontal, TerminalSquare, X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { uiStore, useUI, type SessionInfo } from "@/store/ui";
import { RenameSession } from "../../../wailsjs/go/main/App";
import { cn } from "@/lib/utils";
import { focusSession } from "@/lib/sessions";
import { closeSessionPanes, deleteSession } from "@/lib/panes";

export function SessionRow({ session }: { session: SessionInfo }) {
  const focused = useUI((s) => s.focusedSessionId === session.id);
  const anim = useUI((s) => s.paneAnimations[session.id] || "none");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(session.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(session.name);
  }, [session.name, editing]);

  useEffect(() => {
    if (!editing) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editing]);

  const commit = async () => {
    const next = draft.trim();
    setEditing(false);
    if (!next || next === session.name) {
      setDraft(session.name);
      return;
    }
    await RenameSession(session.id, next);
    uiStore.set({
      sessions: uiStore.get().sessions.map((s) => (s.id === session.id ? { ...s, name: next } : s)),
    });
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          className={cn(
            "group flex w-full items-center gap-0.5 rounded-md text-[12.5px] text-muted-foreground hover:text-sidebar-foreground",
            focused && "bg-sidebar-accent/50 text-sidebar-foreground",
            anim !== "none" && `pane-${anim}`
          )}
        >
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1 text-left"
            onClick={() => {
              if (!editing) void focusSession(session.id);
            }}
          >
            <TerminalSquare className="size-3.5 shrink-0 opacity-50" />
            {editing ? (
              <input
                ref={inputRef}
                value={draft}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={() => void commit()}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void commit();
                  }
                  if (e.key === "Escape") {
                    e.preventDefault();
                    setDraft(session.name);
                    setEditing(false);
                  }
                }}
                className="min-w-0 flex-1 rounded-sm bg-secondary/60 px-1 py-0.5 text-[12.5px] text-sidebar-foreground outline-none ring-1 ring-ring/40"
              />
            ) : (
              <span
                className="min-w-0 flex-1 truncate"
                title="Double-click to rename"
                onDoubleClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDraft(session.name);
                  setEditing(true);
                }}
              >
                {session.name}
              </span>
            )}
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="mr-0.5 size-6 shrink-0 opacity-0 group-hover:opacity-100"
                onClick={(e) => e.stopPropagation()}
                title="Terminal menu"
              >
                <MoreHorizontal className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem
                onClick={() => {
                  setDraft(session.name);
                  setEditing(true);
                }}
              >
                Rename…
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => void closeSessionPanes(session.id)}>
                <X className="size-3.5 opacity-70" />
                Close
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                onClick={() => void deleteSession(session.id)}
              >
                <Trash2 className="size-3.5 opacity-70" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem
          onClick={() => {
            setDraft(session.name);
            setEditing(true);
          }}
        >
          Rename…
        </ContextMenuItem>
        <ContextMenuItem onClick={() => void closeSessionPanes(session.id)}>Close</ContextMenuItem>
        <ContextMenuItem onClick={() => void deleteSession(session.id)}>Delete</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
