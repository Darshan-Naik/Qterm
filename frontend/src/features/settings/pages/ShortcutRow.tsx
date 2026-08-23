import { useCallback, useEffect, useRef, useState } from "react";
import { Pencil, RotateCcw } from "lucide-react";
import {
  chordFromEvent,
  conflictLabel,
  effectiveChords,
  findConflict,
  formatChords,
  isCustomized,
  setKeybindingCapturing,
  type ShortcutId,
} from "@/lib/shortcuts";
import { resetKeybinding, setKeybinding, uiStore, useUI } from "@/store/ui";
import { cn } from "@/lib/utils";
import { ShortcutKeys } from "../ui/ShortcutKeys";

export function ShortcutRow({
  id,
  label,
  description,
}: {
  id: ShortcutId;
  label: string;
  description?: string;
}) {
  const keybindings = useUI((s) => s.keybindings);
  const customized = isCustomized(id, keybindings);
  const chords = effectiveChords(id, keybindings);
  const [recording, setRecording] = useState(false);
  const [conflict, setConflict] = useState<string | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);

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

      const next = chordFromEvent(e);
      if (!next) return;

      const other = findConflict(next, uiStore.get().keybindings, id);
      if (other) {
        setConflict(`Used by ${conflictLabel(other)}`);
        return;
      }

      void setKeybinding(id, [next]);
      stop();
    };

    const onPointerDown = (e: PointerEvent) => {
      if (rowRef.current?.contains(e.target as Node)) return;
      stop();
    };

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("pointerdown", onPointerDown, true);
      setKeybindingCapturing(false);
    };
  }, [recording, id, stop]);

  return (
    <div
      ref={rowRef}
      className={cn(
        "group flex items-center gap-3 px-4 py-2.5 transition-colors",
        recording && "bg-secondary/40"
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium leading-snug">{label}</div>
        {(description || conflict) && (
          <div
            className={cn(
              "mt-0.5 text-[12px] leading-snug",
              conflict ? "text-destructive" : "text-muted-foreground"
            )}
          >
            {conflict || description}
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {customized && !recording && (
          <button
            type="button"
            title="Reset to default"
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-secondary hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100"
            onClick={() => void resetKeybinding(id)}
          >
            <RotateCcw className="h-3 w-3" />
          </button>
        )}

        <button
          type="button"
          title={recording ? "Press new keys · Esc to cancel" : `Edit shortcut (${formatChords(chords)})`}
          onClick={() => {
            if (recording) return;
            setConflict(null);
            setRecording(true);
          }}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-lg px-1.5 transition-colors",
            recording
              ? "bg-secondary text-foreground ring-1 ring-foreground/20"
              : "hover:bg-secondary/70"
          )}
        >
          {recording ? (
            <span className="animate-pulse px-1.5 text-[12px] text-muted-foreground">Press keys…</span>
          ) : (
            <>
              <ShortcutKeys chords={chords} />
              <Pencil
                className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-70"
                aria-hidden
              />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
