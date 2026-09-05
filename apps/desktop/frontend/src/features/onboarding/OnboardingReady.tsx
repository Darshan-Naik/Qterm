import { shortcutLabel } from "@/lib/shortcutLabel";
import { SettingCard } from "@/features/settings/ui/SettingCard";

const TIPS = [
  { keys: shortcutLabel("mod", "K"), label: "Command palette" },
  { keys: shortcutLabel("mod", "T"), label: "New terminal" },
  { keys: shortcutLabel("mod", ","), label: "Settings" },
] as const;

export function OnboardingReady() {
  return (
    <div className="w-full">
      <h1 className="text-[22px] font-semibold tracking-tight">Ready to go</h1>
      <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
        Open a terminal or add a project from the start screen. Connect more agents anytime in
        Settings.
      </p>
      <div className="mt-6">
        <SettingCard>
          {TIPS.map((tip) => (
            <div key={tip.label} className="flex items-center gap-3 px-3 py-2.5">
              <span className="min-w-[2.75rem] rounded-md bg-secondary px-1.5 py-0.5 text-center font-mono text-[11px] text-muted-foreground">
                {tip.keys}
              </span>
              <span className="text-[13px]">{tip.label}</span>
            </div>
          ))}
        </SettingCard>
      </div>
    </div>
  );
}
