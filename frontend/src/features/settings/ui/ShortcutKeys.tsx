import { chordKeys, formatChords, type KeyChord } from "@/lib/shortcuts";
import { cn } from "@/lib/utils";

export function ShortcutKeys({ chords, className }: { chords: KeyChord[]; className?: string }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1", className)}
      aria-label={formatChords(chords)}
    >
      {chords.map((chord, i) => (
        <span key={i} className="inline-flex items-center gap-1">
          {i > 0 && (
            <span className="px-0.5 text-[10px] font-medium text-muted-foreground/80">or</span>
          )}
          <span className="inline-flex items-center gap-0.75">
            {chordKeys(chord).map((key, j) => (
              <kbd
                key={j}
                className={cn(
                  "inline-flex h-5.5 min-w-5.5 items-center justify-center rounded-[5px] px-1.5 font-sans",
                  "border border-border/80 bg-background text-[12px] font-medium leading-none text-foreground/90",
                  "shadow-[0_1px_0_0_var(--border)]"
                )}
              >
                {key}
              </kbd>
            ))}
          </span>
        </span>
      ))}
    </span>
  );
}
