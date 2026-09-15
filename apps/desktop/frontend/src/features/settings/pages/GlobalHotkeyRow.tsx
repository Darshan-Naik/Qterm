import { useCallback, useEffect, useRef, useState } from "react";
import { Pencil, RotateCcw } from "lucide-react";
import { chordId, DEFAULT_GLOBAL_HOTKEY, formatChords, setKeybindingCapturing, type KeyChord } from "@/lib/shortcuts";
import { saveGlobalHotkey, useUI } from "@/store/ui";
import { cn } from "@/lib/utils";
import { ShortcutKeys } from "../ui/ShortcutKeys";

function fromEvent(e: KeyboardEvent): KeyChord | null {
  if (e.key === "Shift" || e.key === "Meta" || e.key === "Control" || e.key === "Alt") return null;
  if (!e.metaKey && !e.ctrlKey && !e.altKey) return null;
  const ctrlOnly = e.ctrlKey && !e.metaKey;
  const key = e.code === "Backquote" ? "`" : e.key.length === 1 ? e.key.toLowerCase() : e.key;
  return {
    key,
    ...(e.code ? { codes: [e.code] } : {}),
    ...(ctrlOnly ? { ctrlOnly: true } : e.metaKey || e.ctrlKey ? { metaOrCtrl: true } : {}),
    ...(e.shiftKey ? { shift: true } : {}),
    ...(e.altKey ? { alt: true } : {}),
  };
}

export function GlobalHotkeyRow() {
  const stored = useUI((s) => s.globalHotkey);
  const chord = stored ?? DEFAULT_GLOBAL_HOTKEY;
  const customized = stored != null && chordId(stored) !== chordId(DEFAULT_GLOBAL_HOTKEY);
  const [recording, setRecording] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);

  const stop = useCallback(() => {
    setKeybindingCapturing(false);
    setRecording(false);
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
      const next = fromEvent(e);
      if (!next) return;
      void saveGlobalHotkey(next);
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
  }, [recording, stop]);

  return (
    <div
      ref={rowRef}
      className={cn("group flex items-center gap-3 px-4 py-2.5 transition-colors", recording && "bg-secondary/40")}
    >
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium leading-snug">Show Qterm</div>
        <div className="mt-0.5 text-[12px] leading-snug text-muted-foreground">
          System-wide. Works while another app is focused.
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {customized && !recording && (
          <button
            type="button"
            title="Reset to default"
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-secondary hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100"
            onClick={() => {
              void saveGlobalHotkey(null);
            }}
          >
            <RotateCcw className="h-3 w-3" />
          </button>
        )}
        <button
          type="button"
          title={recording ? "Press new keys · Esc to cancel" : `Edit shortcut (${formatChords([chord])})`}
          onClick={() => {
            if (recording) return;
            setRecording(true);
          }}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-lg px-1.5 transition-colors",
            recording ? "bg-secondary text-foreground ring-1 ring-foreground/20" : "hover:bg-foreground/5",
          )}
        >
          {recording ? (
            <span className="animate-pulse px-1.5 text-[12px] text-muted-foreground">Press keys…</span>
          ) : (
            <>
              <ShortcutKeys chords={[chord]} />
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
