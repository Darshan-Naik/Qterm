/** App-mark brain with wires that draw, then a slow signal along the circuit. */
export function OnboardingWelcomeArt() {
  return (
    <div className="relative" aria-hidden="true">
      <div className="setup-welcome-mark-glow pointer-events-none absolute inset-[-28%] rounded-[40px]" />
      <svg
        className="setup-welcome-mark relative h-[196px] w-[196px] drop-shadow-[0_24px_48px_rgba(0,0,0,0.45)]"
        viewBox="0 0 1024 1024"
        fill="none"
      >
        <rect
          x="84"
          y="84"
          width="856"
          height="856"
          rx="228"
          className="setup-welcome-mark-tile"
        />
        <g
          transform="translate(232, 232) scale(23.333)"
          fill="none"
          stroke="#F3F0E8"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path className="setup-wire setup-wire-a" pathLength="1" d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
          <path className="setup-wire setup-wire-b" pathLength="1" d="M9 13a4.5 4.5 0 0 0 3-4" />
          <path className="setup-wire setup-wire-c" pathLength="1" d="M6.003 5.125A3 3 0 0 0 6.401 6.5" />
          <path className="setup-wire setup-wire-d" pathLength="1" d="M3.477 10.896a4 4 0 0 1 .585-.396" />
          <path className="setup-wire setup-wire-e" pathLength="1" d="M6 18a4 4 0 0 1-1.967-.516" />
          <path className="setup-wire setup-wire-f" pathLength="1" d="M12 13h4" />
          <path className="setup-wire setup-wire-g" pathLength="1" d="M12 18h6a2 2 0 0 1 2 2v1" />
          <path className="setup-wire setup-wire-h" pathLength="1" d="M12 8h8" />
          <path className="setup-wire setup-wire-i" pathLength="1" d="M16 8V5a2 2 0 0 1 2-2" />
          <path className="setup-wire-spark" pathLength="1" d="M12 8h8" />
          <path className="setup-wire-spark setup-wire-spark-b" pathLength="1" d="M12 13h4" />
          <path className="setup-wire-spark setup-wire-spark-c" pathLength="1" d="M12 18h6a2 2 0 0 1 2 2v1" />
          <circle className="setup-node setup-node-a" cx="16" cy="13" r=".55" fill="#F3F0E8" stroke="none" />
          <circle className="setup-node setup-node-b" cx="18" cy="3" r=".55" fill="#F3F0E8" stroke="none" />
          <circle className="setup-node setup-node-c" cx="20" cy="21" r=".55" fill="#F3F0E8" stroke="none" />
          <circle className="setup-node setup-node-d" cx="20" cy="8" r=".55" fill="#F3F0E8" stroke="none" />
        </g>
      </svg>
    </div>
  );
}
