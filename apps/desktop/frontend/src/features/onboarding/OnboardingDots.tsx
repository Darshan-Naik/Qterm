import { cn } from "@/lib/utils";
import { setupStepIndex, type SetupStep } from "./steps";

const DOT_STEPS: SetupStep[] = ["theme", "agents", "ready"];

export function OnboardingDots({ step }: { step: SetupStep }) {
  const current = setupStepIndex(step);
  return (
    <div className="flex items-center justify-center gap-1.5" aria-hidden="true">
      {DOT_STEPS.map((id) => {
        const active = setupStepIndex(id) <= current && current > 0;
        const here = id === step;
        return (
          <span
            key={id}
            className={cn(
              "h-1.5 rounded-full transition-all",
              here ? "w-4 bg-foreground/80" : active ? "w-1.5 bg-foreground/35" : "w-1.5 bg-foreground/15",
            )}
          />
        );
      })}
    </div>
  );
}
