import { useCallback, useEffect, useRef, useState } from "react";
import { Pencil, X } from "lucide-react";
import { chordFromEvent, formatChords, setKeybindingCapturing, type KeyChord } from "@/lib/shortcuts";
import { describeChordConflict } from "@/lib/snippets";
import { uiStore } from "@/store/ui";
import { cn } from "@/lib/utils";
import { ShortcutKeys } from "../ui/ShortcutKeys";

export function SnippetShortcutButton({
  snippetId,
  chord,
  onChange,
}: {
  snippetId: string;
  chord?: KeyChord;
  onChange: (chord: KeyChord | undefined) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [conflict, setConflict] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const stop = useCallback(() => {
    setKeybindingCapturing(false);
    setRecording(false);
    setConflict(null);
  }, []);

  useEffect(() => {
    if (!recording) return;
    setKeybindingCapturing(true);

    const onKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") {
        stop();
        return;
      }
      if (e.key === "Backspace" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        onChange(undefined);
        stop();
        return;
      }
      const next = chordFromEvent(e);
      if (!next) return;
      const other = describeChordConflict(next, {
        keybindings: uiStore.get().keybindings,
        snippets: uiStore.get().snippets,
        exceptSnippetId: snippetId,
      });
      if (other) {
        setConflict(`Used by ${other}`);
        return;
      }
      onChange(next);
      stop();
    };

    const onPointerDown = (e: PointerEvent) => {
      if (wrapRef.current?.contains(e.target as Node)) return;
      stop();
    };

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("pointerdown", onPointerDown, true);
      setKeybindingCapturing(false);
    };
  }, [recording, snippetId, onChange, stop]);

  const chords = chord ? [chord] : [];

  return (
    <div ref={wrapRef} className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          title={
            recording
              ? "Press new keys. Esc cancels. Backspace clears."
              : chord
                ? `Edit shortcut (${formatChords(chords)})`
                : "Add a keyboard shortcut"
          }
          onClick={() => {
            if (recording) return;
            setConflict(null);
            setRecording(true);
          }}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-lg px-1.5 transition-colors",
            recording ? "bg-secondary text-foreground ring-1 ring-foreground/20" : "hover:bg-foreground/5",
          )}
        >
          {recording ? (
            <span className="animate-pulse px-1.5 text-[12px] text-muted-foreground">Press keys…</span>
          ) : chord ? (
            <>
              <ShortcutKeys chords={chords} />
              <Pencil className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
            </>
          ) : (
            <span className="px-1.5 text-[12px] text-muted-foreground">Shortcut</span>
          )}
        </button>
        {chord && !recording && (
          <button
            type="button"
            title="Remove shortcut"
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
            onClick={() => onChange(undefined)}
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
      {conflict && <div className="max-w-[220px] text-right text-[11px] text-destructive">{conflict}</div>}
    </div>
  );
}
