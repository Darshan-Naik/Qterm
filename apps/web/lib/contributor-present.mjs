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

export function renderContributorCard({ username, mergedPRs, firstContribution, repoPath }) {
  const safeUser = escapeXml(username);
  const when = escapeXml(monthYear(firstContribution));
  const first = Number(mergedPRs) <= 1;
  const headline = first ? "Welcome to the family" : "Thanks for building Qterm";
  const detail = first ? `First contribution · ${when}` : `Qterm family · since ${when}`;
  const label = escapeXml(`${headline}. @${username}. ${first ? "First contribution" : "Qterm family"}. ${when}.`);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-label="${label}">
  <title>${label}</title>
  <rect width="1200" height="630" fill="#141413"/>
  <g stroke="#f3f0e8" stroke-opacity="0.045" stroke-width="1">
    ${gridLines()}
  </g>
  <rect x="48" y="40" width="1104" height="550" rx="28" fill="#1c1c1b" stroke="#f3f0e8" stroke-opacity="0.14"/>
  <rect x="96" y="108" width="18" height="28" rx="2" fill="#8eb4ff"/>
  <text x="128" y="132" fill="#8eb4ff" font-family="ui-sans-serif, system-ui, sans-serif" font-size="22" letter-spacing="6">QTERM</text>
  <text x="96" y="250" fill="#f3f0e8" font-family="ui-sans-serif, system-ui, sans-serif" font-size="64" font-weight="600">${escapeXml(headline)}</text>
  <text x="96" y="330" fill="#f3f0e8" font-family="ui-monospace, ui-sans-serif, monospace" font-size="36">@${safeUser}</text>
  <text x="96" y="392" fill="#b9b5ab" font-family="ui-sans-serif, system-ui, sans-serif" font-size="26">${detail}</text>
  <text x="96" y="470" fill="#f3f0e8" font-family="ui-monospace, ui-sans-serif, monospace" font-size="28">"I helped build Qterm."</text>
  <text x="96" y="536" fill="#8d8a80" font-family="ui-sans-serif, system-ui, sans-serif" font-size="20">github.com/${escapeXml(repoPath)}</text>
</svg>
`;
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
