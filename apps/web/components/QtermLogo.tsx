export function QtermLogo({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 1024 1024" aria-hidden="true">
      <g transform="translate(512, 512) scale(0.82) translate(-512, -512)">
        <rect width="1024" height="1024" rx="228" fill="#1C1C1B" stroke="#FFFFFF" strokeOpacity="0.22" strokeWidth="10" />
        <g
          transform="translate(232, 232) scale(23.333)"
          fill="none"
          stroke="#F3F0E8"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
          <path d="M9 13a4.5 4.5 0 0 0 3-4" />
          <path d="M6.003 5.125A3 3 0 0 0 6.401 6.5" />
          <path d="M3.477 10.896a4 4 0 0 1 .585-.396" />
          <path d="M6 18a4 4 0 0 1-1.967-.516" />
          <path d="M12 13h4" />
          <path d="M12 18h6a2 2 0 0 1 2 2v1" />
          <path d="M12 8h8" />
          <path d="M16 8V5a2 2 0 0 1 2-2" />
          <circle cx="16" cy="13" r=".5" fill="#F3F0E8" stroke="none" />
          <circle cx="18" cy="3" r=".5" fill="#F3F0E8" stroke="none" />
          <circle cx="20" cy="21" r=".5" fill="#F3F0E8" stroke="none" />
          <circle cx="20" cy="8" r=".5" fill="#F3F0E8" stroke="none" />
        </g>
      </g>
    </svg>
  );
}
