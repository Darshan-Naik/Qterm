/** Dark aurora wash. Orbs drift, line-waves slide. No filled landscape. */
export function OnboardingWelcomeBg() {
  return (
    <div className="setup-welcome-bg pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="setup-welcome-orb setup-welcome-orb-a" />
      <div className="setup-welcome-orb setup-welcome-orb-b" />
      <div className="setup-welcome-orb setup-welcome-orb-c" />
      <svg
        className="absolute inset-[-10%] h-[120%] w-[120%] text-white/10"
        viewBox="0 0 1200 800"
        preserveAspectRatio="none"
      >
        <path
          className="setup-welcome-wave-line setup-welcome-wave-line-a"
          d="M-80 520 C 140 460, 280 600, 500 530 C 720 460, 880 590, 1280 500"
        />
        <path
          className="setup-welcome-wave-line setup-welcome-wave-line-b"
          d="M-80 580 C 180 510, 340 650, 560 570 C 780 490, 960 640, 1280 560"
        />
        <path
          className="setup-welcome-wave-line setup-welcome-wave-line-c"
          d="M-80 430 C 160 370, 300 510, 520 440 C 740 370, 920 500, 1280 410"
        />
      </svg>
    </div>
  );
}
