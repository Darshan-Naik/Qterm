import { useCallback, useEffect, useState } from "react";
import { completeSetup } from "./completeSetup";
import { OnboardingAgents } from "./OnboardingAgents";
import { OnboardingNav } from "./OnboardingNav";
import { OnboardingReady } from "./OnboardingReady";
import { OnboardingTheme } from "./OnboardingTheme";
import { OnboardingWelcome } from "./OnboardingWelcome";
import { nextSetupStep, prevSetupStep, type SetupStep } from "./steps";

export function Onboarding() {
  const [step, setStep] = useState<SetupStep>("welcome");

  const finish = useCallback(() => {
    void completeSetup();
  }, []);

  const goNext = useCallback(() => {
    const next = nextSetupStep(step);
    if (next) setStep(next);
    else void completeSetup();
  }, [step]);

  const goBack = useCallback(() => {
    const prev = prevSetupStep(step);
    if (prev) setStep(prev);
  }, [step]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Escape") {
        if (step === "welcome") return;
        e.preventDefault();
        goBack();
        return;
      }
      if (e.key !== "Enter") return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "BUTTON" || tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      e.preventDefault();
      goNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goBack, goNext, step]);

  if (step === "welcome") {
    return (
      <div className="flex h-full min-h-0 w-full min-w-0 flex-col bg-[#0b0b0a] text-white">
        <OnboardingWelcome onStart={() => setStep("theme")} onSkip={finish} />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col bg-background text-foreground">
      <div className="h-[var(--titlebar-height)] shrink-0 titlebar-drag" aria-hidden />
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto px-6 pb-10">
        <div className="w-full max-w-[420px]">
          {step === "theme" ? <OnboardingTheme /> : null}
          {step === "agents" ? <OnboardingAgents /> : null}
          {step === "ready" ? <OnboardingReady /> : null}
          <OnboardingNav
            step={step}
            nextLabel={step === "ready" ? "Open Qterm" : "Continue"}
            onBack={goBack}
            onNext={goNext}
          />
        </div>
      </div>
    </div>
  );
}
