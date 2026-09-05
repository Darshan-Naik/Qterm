"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { OpenAnywayDialog } from "./OpenAnywayDialog";
import { SponsorDialog } from "./SponsorDialog";
import { StarDialog } from "./StarDialog";

type DownloadStep = "open" | "sponsor" | "star" | null;

const DownloadGuideContext = createContext<{ beginDownload: () => void } | null>(null);

export function useDownloadGuide() {
  return useContext(DownloadGuideContext);
}

export function DownloadGuide({ children }: { children: ReactNode }) {
  const [step, setStep] = useState<DownloadStep>(null);
  const beginDownload = useCallback(() => setStep("open"), []);
  const value = useMemo(() => ({ beginDownload }), [beginDownload]);

  return (
    <DownloadGuideContext.Provider value={value}>
      {children}
      {step === "open" ? <OpenAnywayDialog onNext={() => setStep("sponsor")} /> : null}
      {step === "sponsor" ? (
        <SponsorDialog onSkip={() => setStep("star")} onSponsored={() => setStep(null)} />
      ) : null}
      {step === "star" ? <StarDialog onClose={() => setStep(null)} /> : null}
    </DownloadGuideContext.Provider>
  );
}
