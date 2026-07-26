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
  SHORTCUT_GROUPS,
  SHORTCUT_META,
  type ShortcutId,
} from "@/lib/shortcuts";
import {
  resetAllKeybindings,
  resetKeybinding,
  setKeybinding,
  uiStore,
  useUI,
} from "@/store/ui";
import { cn } from "@/lib/utils";
import { SectionLabel } from "../ui/SectionLabel";
import { SettingCard } from "../ui/SettingCard";

function ShortcutRow({ id, label, description }: { id: ShortcutId; label: string; description?: string }) {
  const keybindings = useUI((s) => s.keybindings);
  const customized = isCustomized(id, keybindings);
  const chord = formatChords(effectiveChords(id, keybindings));
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
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-secondary hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100"
            onClick={() => void resetKeybinding(id)}
          >
            <RotateCcw className="h-3 w-3" />
          </button>
        )}

        <button
          type="button"
          title={recording ? "Press new keys · Esc to cancel" : "Edit shortcut"}
          onClick={() => {
            if (recording) return;
            setConflict(null);
            setRecording(true);
          }}
          className={cn(
            "inline-flex h-7 items-center gap-1.5 rounded-md px-2 font-mono text-[12px] tabular-nums tracking-tight transition-colors",
            recording
              ? "bg-secondary text-foreground ring-1 ring-foreground/20"
              : "text-muted-foreground group-hover:bg-secondary/70 group-hover:text-foreground"
          )}
        >
          {recording ? (
            <span className="animate-pulse">Press keys…</span>
          ) : (
            <>
              <span>{chord}</span>
              <Pencil className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-60" aria-hidden />
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export function ShortcutsPage() {
  const keybindings = useUI((s) => s.keybindings);
  const hasCustom = Object.keys(keybindings).length > 0;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-[18px] font-medium tracking-tight">Keyboard shortcuts</h1>
        {hasCustom && (
          <button
            type="button"
            className="shrink-0 text-[12px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            onClick={() => void resetAllKeybindings()}
          >
            Reset all
          </button>
        )}
      </div>

      {SHORTCUT_GROUPS.map((group) => {
        const items = SHORTCUT_META.filter((s) => s.group === group);
        return (
          <div key={group} className="mb-6 last:mb-0">
            <SectionLabel>{group}</SectionLabel>
            <SettingCard>
              {items.map((s) => (
                <ShortcutRow key={s.id} id={s.id} label={s.label} description={s.description} />
              ))}
            </SettingCard>
          </div>
        );
      })}
    </div>
  );
}
