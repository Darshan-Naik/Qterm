import { cn } from "@/lib/utils";
import { setThemeMode, type ThemeMode } from "@/store/ui";

export function OnboardingThemeCard({
  id,
  label,
  hint,
  selected,
}: {
  id: ThemeMode;
  label: string;
  hint: string;
  selected: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => setThemeMode(id)}
      className={cn(
        "flex flex-col gap-2 rounded-xl border p-2 text-left transition-colors",
        selected
          ? "border-primary/70 bg-primary/8 ring-1 ring-primary/40"
          : "border-border/70 bg-card/40 hover:border-border hover:bg-accent/50",
      )}
    >
      <span
        className={cn(
          "relative block h-[72px] overflow-hidden rounded-lg border",
          id === "light" && "border-black/10 bg-[#f7f7f5]",
          id === "dark" && "border-white/10 bg-[#1c1c1b]",
          id === "system" && "border-black/10 dark:border-white/10",
          selected && "border-primary/40",
        )}
      >
        {id === "system" ? (
          <>
            <span className="absolute inset-y-0 left-0 w-1/2 bg-[#f7f7f5]">
              <span className="mt-4 ml-1 block h-1 w-6 rounded-full bg-black/20" />
              <span className="mt-1 ml-1 block h-1 w-4 rounded-full bg-black/10" />
            </span>
            <span className="absolute inset-y-0 right-0 w-1/2 bg-[#1c1c1b]">
              <span className="mt-4 ml-1 block h-1 w-6 rounded-full bg-white/20" />
              <span className="mt-1 ml-1 block h-1 w-4 rounded-full bg-white/10" />
            </span>
            <span className="absolute inset-y-0 left-1/2 w-px bg-black/20" />
          </>
        ) : (
          <>
            <span
              className={cn(
                "absolute inset-y-0 left-0 w-[28%] border-r",
                id === "light" ? "border-black/8 bg-[#ecece8]" : "border-white/8 bg-[#141413]",
              )}
            >
              <span
                className={cn(
                  "mx-1 mt-4 block h-1 rounded-full",
                  id === "light" ? "bg-black/20" : "bg-white/20",
                )}
              />
              <span
                className={cn(
                  "mx-1 mt-1 block h-1 w-2/3 rounded-full",
                  id === "light" ? "bg-black/10" : "bg-white/10",
                )}
              />
            </span>
            <span className="absolute inset-y-0 left-[28%] right-0 px-1.5 pt-4">
              <span
                className={cn(
                  "block h-1 w-3/4 rounded-full",
                  id === "light" ? "bg-black/18" : "bg-white/18",
                )}
              />
              <span
                className={cn(
                  "mt-1 block h-1 w-1/2 rounded-full",
                  id === "light" ? "bg-black/10" : "bg-white/10",
                )}
              />
            </span>
          </>
        )}
      </span>
      <span>
        <span className="block text-[12.5px] font-medium">{label}</span>
        <span className="block text-[11px] text-muted-foreground">{hint}</span>
      </span>
    </button>
  );
}
