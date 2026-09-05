import { useUI, type ThemeMode } from "@/store/ui";
import { OnboardingThemeCard } from "./OnboardingThemeCard";

const THEMES: { id: ThemeMode; label: string; hint: string }[] = [
  { id: "system", label: "System", hint: "Match the Mac" },
  { id: "dark", label: "Dark", hint: "Dim and quiet" },
  { id: "light", label: "Light", hint: "Bright and clean" },
];

export function OnboardingTheme() {
  const theme = useUI((s) => s.theme);

  return (
    <div className="w-full">
      <h1 className="text-[22px] font-semibold tracking-tight">Choose a theme</h1>
      <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
        Pick a look. You can change this anytime in Settings.
      </p>
      <div className="mt-6 grid grid-cols-3 gap-2.5">
        {THEMES.map((item) => (
          <OnboardingThemeCard
            key={item.id}
            id={item.id}
            label={item.label}
            hint={item.hint}
            selected={theme === item.id}
          />
        ))}
      </div>
    </div>
  );
}
