import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { uiStore } from "@/store/ui";
import {
  clearSessionFind,
  findInSession,
  focusTerminal,
  onSessionFindResults,
} from "./sessionTerminals";

export function TerminalFindBar({ sessionId }: { sessionId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [resultIndex, setResultIndex] = useState(-1);
  const [resultCount, setResultCount] = useState(0);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
    return () => clearSessionFind(sessionId);
  }, [sessionId]);

  useEffect(() => {
    return onSessionFindResults(sessionId, (ev) => {
      setResultIndex(ev.resultIndex);
      setResultCount(ev.resultCount);
    });
  }, [sessionId]);

  useEffect(() => {
    if (!q) {
      clearSessionFind(sessionId);
      setResultIndex(-1);
      setResultCount(0);
      return;
    }
    findInSession(sessionId, q, "next", true);
  }, [q, sessionId]);

  const close = () => {
    clearSessionFind(sessionId);
    uiStore.set({ terminalFindOpen: false });
    focusTerminal(sessionId);
  };

  const next = () => {
    if (!q) return;
    findInSession(sessionId, q, "next");
  };

  const prev = () => {
    if (!q) return;
    findInSession(sessionId, q, "prev");
  };

  const label =
    !q || resultCount === 0
      ? resultCount === 0 && q
        ? "No results"
        : ""
      : `${Math.max(1, resultIndex + 1)} / ${resultCount}`;

  return (
    <div
      className="absolute right-3 top-2 z-20 flex items-center gap-1 rounded-md border border-border bg-popover/95 px-1.5 py-1 shadow-lg backdrop-blur-sm"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <input
        ref={inputRef}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Find"
        className="h-7 w-44 bg-transparent px-2 text-[12px] outline-none placeholder:text-muted-foreground"
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            close();
            return;
          }
          if (e.key === "Enter") {
            e.preventDefault();
            e.stopPropagation();
            if (e.shiftKey) prev();
            else next();
          }
        }}
      />
      <span
        className={cn(
          "min-w-[4.5rem] px-1 text-right text-[11px] tabular-nums text-muted-foreground",
          q && resultCount === 0 && "text-destructive"
        )}
      >
        {label}
      </span>
      <button
        type="button"
        className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
        onClick={prev}
        aria-label="Previous match"
      >
        <ChevronUp className="size-3.5" />
      </button>
      <button
        type="button"
        className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
        onClick={next}
        aria-label="Next match"
      >
        <ChevronDown className="size-3.5" />
      </button>
      <button
        type="button"
        className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
        onClick={close}
        aria-label="Close find"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
