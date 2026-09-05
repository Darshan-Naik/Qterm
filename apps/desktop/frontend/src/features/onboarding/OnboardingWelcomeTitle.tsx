import { OnboardingWelcomeLine } from "./OnboardingWelcomeLine";

export function OnboardingWelcomeTitle() {
  return (
    <h1 className="mt-9 text-center">
      <OnboardingWelcomeLine
        text="Qterm"
        className="text-[36px] font-semibold tracking-tight text-white"
        delayMs={900}
        stepMs={92}
      />
      <OnboardingWelcomeLine
        text="The Smartest Terminal"
        className="mt-2.5 text-[15px] font-medium tracking-[0.06em] text-white/50"
        delayMs={1500}
        stepMs={52}
      />
    </h1>
  );
}
