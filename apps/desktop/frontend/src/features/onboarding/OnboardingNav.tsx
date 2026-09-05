import { Button } from "@/components/ui/button";
import { OnboardingDots } from "./OnboardingDots";
import type { SetupStep } from "./steps";

export function OnboardingNav({
  step,
  nextLabel,
  onBack,
  onNext,
}: {
  step: SetupStep;
  nextLabel: string;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div className="mt-8 flex w-full flex-col gap-5">
      <OnboardingDots step={step} />
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" className="h-9 px-3 text-muted-foreground" onClick={onBack}>
          Back
        </Button>
        <Button className="h-9 min-w-[7.5rem] rounded-lg" onClick={onNext}>
          {nextLabel}
        </Button>
      </div>
    </div>
  );
}
