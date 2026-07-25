import { useEffect, useRef, useState } from "react";
import { RenameSession } from "../../../wailsjs/go/main/App";
import { uiStore, useUI } from "@/store/ui";
import { cn } from "@/lib/utils";
import { WithTooltip } from "@/components/ui/tooltip";

export const RENAME_SESSION_EVENT = "qterm:rename-session";

export function requestSessionRename(sessionId: string) {
  window.dispatchEvent(new CustomEvent(RENAME_SESSION_EVENT, { detail: sessionId }));
}

export function PaneTitle({ sessionId }: { sessionId: string }) {
  const name = useUI((s) => s.sessions.find((x) => x.id === sessionId)?.name || "Terminal");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(name);
  }, [name, editing]);

  useEffect(() => {
    if (!editing) return;
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    el.select();
  }, [editing]);

  useEffect(() => {
    const onRename = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== sessionId) return;
      setDraft(name);
      setEditing(true);
    };
    window.addEventListener(RENAME_SESSION_EVENT, onRename);
    return () => window.removeEventListener(RENAME_SESSION_EVENT, onRename);
  }, [sessionId, name]);

  const commit = async () => {
    const next = draft.trim();
    setEditing(false);
    if (!next || next === name) {
      setDraft(name);
      return;
    }
    await RenameSession(sessionId, next);
    uiStore.set({
      sessions: uiStore.get().sessions.map((s) => (s.id === sessionId ? { ...s, name: next } : s)),
    });
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void commit();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            setDraft(name);
            setEditing(false);
          }
        }}
        className="min-w-0 flex-1 rounded-sm bg-secondary/60 px-1 py-0.5 text-[12.5px] leading-none text-foreground outline-none ring-1 ring-ring/40 titlebar-no-drag"
      />
    );
  }

  return (
    <WithTooltip label="Double-click to rename">
      <button
        type="button"
        className={cn(
          "min-w-0 flex-1 cursor-pointer truncate rounded-sm px-1 py-0.5 text-left text-[12.5px] leading-none text-foreground titlebar-no-drag",
          "hover:bg-secondary/40"
        )}
        onDoubleClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDraft(name);
          setEditing(true);
        }}
      >
        {name}
      </button>
    </WithTooltip>
  );
}
