const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function monthYear(isoDate) {
  const [year, month] = String(isoDate || "").split("-");
  const index = Number(month) - 1;
  if (!year || index < 0 || index > 11) return "";
  return `${MONTHS[index]} ${year}`;
}

export function rankedContributors(people) {
  return [...(people || [])].sort((a, b) => {
    const byCount = (Number(b.mergedPRs) || 0) - (Number(a.mergedPRs) || 0);
    if (byCount !== 0) return byCount;
    return String(a.username || "").localeCompare(String(b.username || ""));
  });
}

export function visibleContributors(data) {
  const hidden = new Set(
    [data?.maintainer, ...(data?.maintainers || []).map((person) => person.username)]
      .filter(Boolean)
      .map((name) => String(name).toLowerCase()),
  );
  return (data?.contributors || []).filter((person) => !hidden.has(String(person.username || "").toLowerCase()));
}

export function shortMonth(isoDate) {
  const [year, month] = String(isoDate || "").split("-");
  const index = Number(month) - 1;
  if (!year || index < 0 || index > 11) return "";
  return `${SHORT_MONTHS[index]} ${year}`;
}

export function contributionCountLabel(count) {
  const total = Number(count) || 0;
  return total === 1 ? "1 PR merged" : `${total} PRs merged`;
}

export function firstContributionShareText({ maintainer, repoUrl }) {
  return [
    "My first contribution to Qterm just got merged!",
    "",
    "Happy to be part of an open-source project building a better terminal experience for developers.",
    "",
    `Thanks @${maintainer} for the warm welcome!`,
    "",
    repoUrl,
  ].join("\n");
}

export function tweetIntentUrl(text) {
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
}

export function contributorDisplayName({ name, username } = {}) {
  const display = String(name || "").trim();
  if (display) return display;
  const login = String(username || "").trim();
  return login ? `@${login}` : "";
}

export function renderContributorCard({ username, name, mergedPRs, firstContribution, repoPath }) {
  const displayName = contributorDisplayName({ name, username });
  const safeName = escapeXml(displayName);
  const when = escapeXml(monthYear(firstContribution));
  const first = Number(mergedPRs) <= 1;
  const headline = first ? "Welcome to the family" : "Thanks for building Qterm";
  const detail = first ? `First contribution · ${when}` : `Qterm family · since ${when}`;
  const label = escapeXml(`${headline}. ${displayName}. ${first ? "First contribution" : "Qterm family"}. ${when}.`);
  const named = Boolean(String(name || "").trim());
  const nameFont = named ? "ui-sans-serif, system-ui, sans-serif" : "ui-monospace, ui-sans-serif, monospace";
  const nameSize = displayName.length > 32 ? 28 : displayName.length > 22 ? 32 : 36;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-label="${label}">
  <title>${label}</title>
  <rect width="1200" height="630" fill="#141413"/>
  <g stroke="#f3f0e8" stroke-opacity="0.045" stroke-width="1">
    ${gridLines()}
  </g>
  <rect x="48" y="40" width="1104" height="550" rx="28" fill="#1c1c1b" stroke="#f3f0e8" stroke-opacity="0.14"/>
  ${qtermLogo(96, 76, 88)}
  <text x="204" y="130" fill="#8eb4ff" font-family="ui-sans-serif, system-ui, sans-serif" font-size="22" letter-spacing="6">QTERM</text>
  <text x="96" y="250" fill="#f3f0e8" font-family="ui-sans-serif, system-ui, sans-serif" font-size="64" font-weight="600">${escapeXml(headline)}</text>
  <text x="96" y="330" fill="#f3f0e8" font-family="${nameFont}" font-size="${nameSize}">${safeName}</text>
  <text x="96" y="392" fill="#b9b5ab" font-family="ui-sans-serif, system-ui, sans-serif" font-size="26">${detail}</text>
  <text x="96" y="470" fill="#f3f0e8" font-family="ui-monospace, ui-sans-serif, monospace" font-size="28">"I helped build Qterm."</text>
  <text x="96" y="536" fill="#8d8a80" font-family="ui-sans-serif, system-ui, sans-serif" font-size="20">github.com/${escapeXml(repoPath)}</text>
</svg>
`;
}

function qtermLogo(x, y, size) {
  return `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 1024 1024">
    <g transform="translate(512, 512) scale(0.82) translate(-512, -512)">
      <rect width="1024" height="1024" rx="228" fill="#1C1C1B" stroke="#FFFFFF" stroke-opacity="0.22" stroke-width="10"/>
      <g transform="translate(232, 232) scale(23.333)" fill="none" stroke="#F3F0E8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/>
        <path d="M9 13a4.5 4.5 0 0 0 3-4"/>
        <path d="M6.003 5.125A3 3 0 0 0 6.401 6.5"/>
        <path d="M3.477 10.896a4 4 0 0 1 .585-.396"/>
        <path d="M6 18a4 4 0 0 1-1.967-.516"/>
        <path d="M12 13h4"/>
        <path d="M12 18h6a2 2 0 0 1 2 2v1"/>
        <path d="M12 8h8"/>
        <path d="M16 8V5a2 2 0 0 1 2-2"/>
        <circle cx="16" cy="13" r=".5" fill="#F3F0E8" stroke="none"/>
        <circle cx="18" cy="3" r=".5" fill="#F3F0E8" stroke="none"/>
        <circle cx="20" cy="21" r=".5" fill="#F3F0E8" stroke="none"/>
        <circle cx="20" cy="8" r=".5" fill="#F3F0E8" stroke="none"/>
      </g>
    </g>
  </svg>`;
}

function gridLines() {
  const lines = [];
  for (let x = 0; x <= 1200; x += 48) {
    lines.push(`<line x1="${x}" y1="0" x2="${x}" y2="630"/>`);
  }
  for (let y = 0; y <= 630; y += 48) {
    lines.push(`<line x1="0" y1="${y}" x2="1200" y2="${y}"/>`);
  }
  return lines.join("");
}
