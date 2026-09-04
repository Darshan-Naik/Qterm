export const SITE = {
  name: "Qterm",
  tagline: "Terminal, without the noise.",
  description:
    "A fast, focused terminal for people who live in the shell. Projects, splits, and your agents in one calm Mac window.",
  github: "https://github.com/Darshan-Naik/Qterm",
  repo: "Darshan-Naik/Qterm",
  releases: "https://github.com/Darshan-Naik/Qterm/releases/latest",
  author: "Darshan Naik",
} as const;

export const MAC_ASSET = {
  arm64: "Qterm-macos-arm64.dmg",
  amd64: "Qterm-macos-amd64.dmg",
} as const;

export function siteUrl() {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel.replace(/\/$/, "")}`;
  return "http://localhost:3000";
}

export const NAV = [
  { href: "#features", label: "Features" },
  { href: "#agents", label: "Agents" },
  { href: "#download", label: "Download" },
] as const;

export const FEATURES = [
  {
    title: "Projects, not clutter",
    body: "Map local folders as projects. Open as many terminals as you need under each one, rename them, and keep home shells separate when you’re just experimenting.",
  },
  {
    title: "Splits that feel native",
    body: "Split right or down and work side by side. Each pane has its own title and menu. No crowded tab strip fighting for attention.",
  },
  {
    title: "Built for flow",
    body: "Command palette, thoughtful shortcuts, dark and light themes, and a sidebar that stays out of your way until you need it.",
  },
  {
    title: "Ready for agents",
    body: "Keep your coding agents in the same window as your terminals, without turning Qterm into another chat app.",
  },
] as const;

export const AGENTS = [
  { id: "claude", name: "Claude Code", src: "/agents/claude.png" },
  { id: "codex", name: "Codex", src: "/agents/codex.png" },
  { id: "gemini", name: "Gemini CLI", src: "/agents/gemini.png" },
  { id: "cursor", name: "Cursor Agent", src: "/agents/cursor.png" },
  { id: "agy", name: "Antigravity", src: "/agents/agy.png" },
] as const;

export const QUIET_POINTS = [
  "Simple sidebar: new terminals and projects",
  "Git branch awareness on project folders",
  "Sessions that remember where you left off",
  "Settings that stay out of the main view until you open them",
] as const;
