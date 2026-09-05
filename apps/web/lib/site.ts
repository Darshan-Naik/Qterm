export const SITE = {
  name: "Qterm",
  tagline: "The best agentic terminal.",
  description:
    "Fast, clean, and light. Projects, splits, and your agents in one quiet window.",
  seoTitle: "Qterm: Fast Agent Terminal for Mac",
  seoDescription:
    "Fast, light Mac terminal for AI coding agents. Run Claude Code, Codex, Gemini CLI, and Cursor Agent in one quiet window with projects and splits.",
  github: "https://github.com/Darshan-Naik/Qterm",
  sponsors: "https://github.com/sponsors/Darshan-Naik",
  repo: "Darshan-Naik/Qterm",
  url: "https://qterm.darshannaik.com",
  website: "https://darshannaik.com",
  releases: "https://github.com/Darshan-Naik/Qterm/releases/latest",
  author: "Darshan Naik",
} as const;

export const MAC_ASSET = "Qterm-macos-arm64.dmg";

export function siteUrl() {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  if (process.env.NODE_ENV === "development") return "http://localhost:3000";
  return SITE.url;
}

export const NAV = [
  { href: "/#features", label: "Features" },
  { href: "/#agents", label: "Agents" },
  { href: "/#download", label: "Download" },
] as const;

export const FEATURES = [
  {
    title: "Projects, not clutter",
    visual: "projects" as const,
    body: "Map local folders as projects. Open as many terminals as you need under each one, rename them, and keep home shells separate when you’re just experimenting.",
  },
  {
    title: "Splits that feel native",
    visual: "splits" as const,
    body: "Split right or down and work side by side. Each pane has its own title and menu. No crowded tab strip fighting for attention.",
  },
  {
    title: "Built for flow",
    visual: "flow" as const,
    body: "Command palette, thoughtful shortcuts, dark and light themes, and a sidebar that stays out of your way until you need it.",
  },
  {
    title: "Ready for agents",
    visual: "agents" as const,
    body: "Qterm is an agent terminal: keep Claude Code, Codex, Gemini CLI, and Cursor Agent in the same window as your shells, without turning it into a chat app.",
  },
] as const;

export const AGENTS = [
  { id: "claude", slug: "claude-code", name: "Claude Code", src: "/agents/claude.png" },
  { id: "codex", slug: "codex", name: "Codex", src: "/agents/codex.png" },
  { id: "gemini", slug: "gemini-cli", name: "Gemini CLI", src: "/agents/gemini.png" },
  { id: "cursor", slug: "cursor-agent", name: "Cursor Agent", src: "/agents/cursor.png" },
  { id: "agy", slug: "antigravity", name: "Antigravity", src: "/agents/agy.png" },
] as const;

export const QUIET_POINTS = [
  "Simple sidebar: new terminals and projects",
  "Git branch awareness on project folders",
  "Sessions that remember where you left off",
  "Settings that stay out of the main view until you open them",
] as const;

export const FOOTER_LINKS = [
  { href: "/agent-terminal", label: "Agent terminal" },
  { href: "/agents/claude-code", label: "Claude Code" },
  { href: "/agents/codex", label: "Codex" },
  { href: "/agents/gemini-cli", label: "Gemini CLI" },
] as const;
