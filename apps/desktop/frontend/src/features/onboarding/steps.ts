export const SETUP_STEPS = ["welcome", "theme", "agents", "ready"] as const;

export type SetupStep = (typeof SETUP_STEPS)[number];

const SETUP_INDEX: Record<SetupStep, number> = {
  welcome: 0,
  theme: 1,
  agents: 2,
  ready: 3,
};

export function setupStepIndex(step: SetupStep) {
  return SETUP_INDEX[step];
}

export function nextSetupStep(step: SetupStep): SetupStep | null {
  const i = SETUP_INDEX[step];
  return SETUP_STEPS[i + 1] ?? null;
}

export function prevSetupStep(step: SetupStep): SetupStep | null {
  const i = SETUP_INDEX[step];
  return i > 0 ? SETUP_STEPS[i - 1] : null;
}
