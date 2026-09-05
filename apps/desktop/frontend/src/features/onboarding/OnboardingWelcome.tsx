import { Button } from "@/components/ui/button";
import { OnboardingWelcomeArt } from "./OnboardingWelcomeArt";

export function OnboardingWelcome({
  onStart,
  onSkip,
}: {
  onStart: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <img
        src="/icon.svg"
        alt=""
        width={72}
        height={72}
        className="mb-6 h-[72px] w-[72px] rounded-[18px] shadow-lg ring-1 ring-border/50"
        draggable={false}
      />
      <OnboardingWelcomeArt />
      <h1 className="mt-8 text-[26px] font-semibold tracking-tight">Welcome to Qterm</h1>
      <p className="mt-2 max-w-[22rem] text-[13.5px] leading-relaxed text-muted-foreground">
        Thanks for installing. A fast, quiet terminal for your projects and agents.
      </p>
      <div className="mt-8 flex w-full max-w-[16rem] flex-col items-center gap-2">
        <Button className="h-10 w-full rounded-lg text-[13.5px]" onClick={onStart}>
          Get started
        </Button>
        <Button
          variant="ghost"
          className="h-8 text-[12.5px] text-muted-foreground"
          onClick={onSkip}
        >
          Skip for now
        </Button>
      </div>
    </div>
  );
}
