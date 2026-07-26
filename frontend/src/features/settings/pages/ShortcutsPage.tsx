import { useCallback, useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
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
import { PageTitle } from "../ui/PageTitle";
import { SectionLabel } from "../ui/SectionLabel";
import { SettingCard } from "../ui/SettingCard";
import { SettingRow } from "../ui/SettingRow";

function KeybindingControl({ id }: { id: ShortcutId }) {
  const keybindings = useUI((s) => s.keybindings);
  const customized = isCustomized(id, keybindings);
  const label = formatChords(effectiveChords(id, keybindings));
  const [recording, setRecording] = useState(false);
  const [conflict, setConflict] = useState<string | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

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

      const chord = chordFromEvent(e);
      if (!chord) return;

      const other = findConflict(chord, uiStore.get().keybindings, id);
      if (other) {
        setConflict(`Used by ${conflictLabel(other)}`);
        return;
      }

      void setKeybinding(id, [chord]);
      stop();
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      setKeybindingCapturing(false);
    };
  }, [recording, id, stop]);

  return (
    <div className="flex items-center gap-1.5">
      {customized && (
        <button
          type="button"
          title="Reset to default"
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          onClick={() => void resetKeybinding(id)}
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      )}
      <button
        ref={btnRef}
        type="button"
        onClick={() => {
          setConflict(null);
          setRecording(true);
        }}
        onBlur={() => {
          window.setTimeout(() => {
            if (document.activeElement !== btnRef.current) stop();
          }, 120);
        }}
        className={cn(
          "min-w-30 rounded-lg border px-2.5 py-1.5 text-center font-mono text-[12px] tabular-nums transition-colors",
          recording
            ? "border-foreground/40 bg-secondary text-foreground ring-2 ring-foreground/15"
            : "border-border/60 bg-secondary/50 text-foreground/90 hover:bg-secondary"
        )}
      >
        {recording ? "Press keys…" : label}
      </button>
      {conflict && (
        <span className="max-w-36 text-[11px] leading-tight text-destructive">{conflict}</span>
      )}
    </div>
  );
}

export function ShortcutsPage() {
  const keybindings = useUI((s) => s.keybindings);
  const hasCustom = Object.keys(keybindings).length > 0;

  return (
    <div>
      <div className="mb-2 flex items-start justify-between gap-4">
        <PageTitle>Keyboard shortcuts</PageTitle>
        {hasCustom && (
          <button
            type="button"
            className="mt-1 shrink-0 text-[12px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            onClick={() => void resetAllKeybindings()}
          >
            Reset all
          </button>
        )}
      </div>
      <p className="mb-6 text-[13px] text-muted-foreground">
        Click a shortcut, then press the new keys. Escape cancels.
      </p>

      {SHORTCUT_GROUPS.map((group) => {
        const items = SHORTCUT_META.filter((s) => s.group === group);
        return (
          <div key={group} className="mb-6 last:mb-0">
            <SectionLabel>{group}</SectionLabel>
            <SettingCard>
              {items.map((s) => (
                <SettingRow
                  key={s.id}
                  title={s.label}
                  description={s.description}
                  control={<KeybindingControl id={s.id} />}
                />
              ))}
            </SettingCard>
          </div>
        );
      })}
    </div>
  );
}
