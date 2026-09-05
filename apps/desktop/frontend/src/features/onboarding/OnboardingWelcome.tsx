import { Button } from "@/components/ui/button";
import { OnboardingWelcomeArt } from "./OnboardingWelcomeArt";
import { OnboardingWelcomeBg } from "./OnboardingWelcomeBg";
import { OnboardingWelcomeTitle } from "./OnboardingWelcomeTitle";

export function OnboardingWelcome({
  onStart,
  onSkip,
}: {
  onStart: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[#0b0b0a] text-white">
      <OnboardingWelcomeBg />
      <div className="relative z-10 h-[var(--titlebar-height)] shrink-0 titlebar-drag" aria-hidden />
      <div className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center px-6 pb-12">
        <OnboardingWelcomeArt />
        <OnboardingWelcomeTitle />
        <div className="setup-welcome-cta mt-10 flex w-full max-w-[15rem] flex-col items-center gap-2 titlebar-no-drag">
          <Button className="h-10 w-full rounded-lg text-[13.5px]" onClick={onStart}>
            Get started
          </Button>
          <Button
            variant="ghost"
            className="h-8 text-[12.5px] text-white/35 hover:bg-white/6 hover:text-white/70"
            onClick={onSkip}
          >
            Skip
          </Button>
        </div>
      </div>
    </div>
  );
}
