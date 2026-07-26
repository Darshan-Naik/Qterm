import { useEffect, useRef, useState, type DragEvent } from "react";
import { MoreHorizontal, X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WithTooltip } from "@/components/ui/tooltip";
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
import { SESSION_DRAG_MIME } from "@/lib/sessionDrag";
import { TerminalShortcuts } from "@/lib/menuShortcuts";
import { RENAME_SESSION_EVENT } from "@/features/panes/PaneTitle";
import { AgentIcon, agentLabel } from "./AgentIcon";

export function SessionRow({ session }: { session: SessionInfo }) {
  const focusedSessionId = useUI((s) => s.focusedSessionId);
  const paneAnimations = useUI((s) => s.paneAnimations);
  const sessionAgents = useUI((s) => s.sessionAgents);
  const focused = focusedSessionId === session.id;
  const anim = paneAnimations[session.id] || "none";
  const agent = sessionAgents[session.id] || "";
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(session.name);
  const [dragging, setDragging] = useState(false);
  const draggedRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(session.name);
  }, [session.name, editing]);

  useEffect(() => {
    if (!editing) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editing]);

  useEffect(() => {
    const onRename = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== session.id) return;
      setDraft(session.name);
      setEditing(true);
    };
    window.addEventListener(RENAME_SESSION_EVENT, onRename);
    return () => window.removeEventListener(RENAME_SESSION_EVENT, onRename);
  }, [session.id, session.name]);

  const startRename = () => {
    setDraft(session.name);
    setEditing(true);
  };
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

  const needsInput = anim === "action_required";
  const thinking = anim === "thinking";
  const complete = anim === "task_complete";

  const onDragStart = (e: DragEvent) => {
    if (editing) {
      e.preventDefault();
      return;
    }
    draggedRef.current = true;
    e.dataTransfer.setData(SESSION_DRAG_MIME, session.id);
    e.dataTransfer.setData("text/plain", session.id);
    e.dataTransfer.effectAllowed = "move";
    setDragging(true);
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          draggable={!editing}
          onDragStart={onDragStart}
          onDragEnd={() => {
            setDragging(false);
            // Click fires after dragend — ignore that synthetic activation.
            window.setTimeout(() => {
              draggedRef.current = false;
            }, 0);
          }}
          className={cn(
            "group flex w-full cursor-grab items-center gap-0.5 rounded-lg text-[13px] leading-snug text-muted-foreground hover:text-sidebar-foreground active:cursor-grabbing",
            focused && "bg-sidebar-accent text-sidebar-foreground",
            dragging && "opacity-50",
            needsInput && "session-needs-input",
            thinking && "session-thinking",
            complete && "session-complete"
          )}
        >
          <button
            type="button"
            draggable={false}
            className="flex min-w-0 flex-1 cursor-inherit items-center gap-2.5 px-2.5 py-1.5 text-left"
            onClick={() => {
              if (!editing && !draggedRef.current) void focusSession(session.id);
            }}
          >
            <span className="relative flex size-4 shrink-0 items-center justify-center">
              {agent ? (
                <WithTooltip label={agentLabel(agent)} side="right">
                  <span className="inline-flex">
                    <AgentIcon
                      agent={agent}
                      thinking={thinking}
                      needsInput={needsInput}
                      complete={complete}
                    />
                  </span>
                </WithTooltip>
              ) : (
                <AgentIcon />
              )}
              {needsInput ? (
                <span className="pointer-events-none absolute -right-0.5 -top-0.5 flex size-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-amber-400" />
                </span>
              ) : null}
            </span>
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
                className="min-w-0 flex-1 select-text rounded-md bg-secondary/60 px-1.5 py-0.5 text-[13px] text-sidebar-foreground outline-none ring-1 ring-ring/40"
              />
            ) : (
                <span
                  className="min-w-0 flex-1 truncate"
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
                  className="mr-1 size-7 shrink-0 opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[12rem]">
              <DropdownMenuItem shortcut={TerminalShortcuts.rename.label} onClick={startRename}>
                Rename…
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                shortcut={TerminalShortcuts.close.label}
                onClick={() => void closeSessionPanes(session.id)}
              >
                <X className="size-3.5 opacity-70" />
                Close
              </DropdownMenuItem>
              <DropdownMenuItem
                shortcut={TerminalShortcuts.delete.label}
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
      <ContextMenuContent className="min-w-[12rem]">
        <ContextMenuItem shortcut={TerminalShortcuts.rename.label} onClick={startRename}>
          Rename…
        </ContextMenuItem>
        <ContextMenuItem
          shortcut={TerminalShortcuts.close.label}
          onClick={() => void closeSessionPanes(session.id)}
        >
          Close
        </ContextMenuItem>
        <ContextMenuItem
          shortcut={TerminalShortcuts.delete.label}
          onClick={() => void deleteSession(session.id)}
        >
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
