export type AgentPage = {
  slug: string;
  name: string;
  title: string;
  description: string;
  heading: string;
  intro: string;
  points: string[];
  closing: string;
};

export const AGENT_PAGES: AgentPage[] = [
  {
    slug: "claude-code",
    name: "Claude Code",
    title: "Claude Code Terminal for Mac",
    description:
      "Qterm is a fast, light Claude Code terminal for Mac. Run Anthropic's CLI agent in a project pane beside your shells, without a chat app taking over.",
    heading: "The Claude Code terminal",
    intro:
      "Claude Code is a CLI agent. It wants a real terminal, not a sidebar. Qterm is an agent terminal for Mac: open a project, split a pane, and run claude next to your shells. Fast, clean, and light.",
    points: [
      "Keep Claude Code in the PTY, with the same prompts and permissions you already use.",
      "Group Claude sessions under a project folder instead of a pile of tabs.",
      "Split right or down and run a second agent, tests, or git beside Claude.",
      "Stay on Apple Silicon with a quiet window that feels like a Mac terminal.",
    ],
    closing:
      "If you searched for the best terminal for Claude Code and you want a small, fast agent terminal rather than Warp or a GPU emulator alone, start with Qterm.",
  },
  {
    slug: "codex",
    name: "Codex",
    title: "Codex CLI Terminal for Mac",
    description:
      "Run OpenAI Codex CLI in Qterm, a fast Mac agent terminal with projects and splits. Codex stays in the terminal next to your shells.",
    heading: "Codex CLI, in an agent terminal",
    intro:
      "Codex CLI is a terminal agent. Qterm gives it a light Mac home: named panes, project folders, and splits so Codex does not live in a random tab.",
    points: [
      "Launch Codex in a project directory you already mapped in the sidebar.",
      "Keep a shell beside it for git, tests, or logs.",
      "Resume the session later. Qterm remembers where you left off.",
      "Use Codex next to Claude Code or Gemini CLI without a shared chat UI.",
    ],
    closing: "Qterm is a Codex terminal the same way it is a Claude Code terminal: your CLI, our window.",
  },
  {
    slug: "gemini-cli",
    name: "Gemini CLI",
    title: "Gemini CLI Terminal for Mac",
    description:
      "Qterm is a Mac agent terminal for Gemini CLI. Fast and light, with projects and splits so Gemini runs beside your other shells.",
    heading: "Gemini CLI terminal",
    intro:
      "Gemini CLI belongs in a terminal. Qterm is the quiet Mac agent terminal around it: projects for repos, splits for parallel work, no extra chat chrome.",
    points: [
      "Open Gemini CLI under the project it should touch.",
      "Split a pane for a second agent or a normal shell.",
      "Stay in a fast, light window instead of an AI IDE.",
      "Mix Gemini with Claude Code or Codex when you want two models in view.",
    ],
    closing: "Search for Gemini CLI terminal and you want a host, not another product. Qterm is that host.",
  },
  {
    slug: "cursor-agent",
    name: "Cursor Agent",
    title: "Cursor Agent Terminal for Mac",
    description:
      "Run Cursor Agent in Qterm, a fast agent terminal for Mac. Keep the CLI in a project pane with splits, not buried in an editor.",
    heading: "Cursor Agent, still a terminal",
    intro:
      "Cursor Agent can run from the command line. Qterm treats it like any other coding agent: a named pane in a light Mac window, next to your shells.",
    points: [
      "Park Cursor Agent under the project folder you already use.",
      "Keep editor work in Cursor if you want, and the agent session in Qterm.",
      "Split for git or logs without leaving the terminal.",
      "Same window as Claude Code, Codex, and Gemini CLI.",
    ],
    closing: "An agent terminal should not care which CLI you picked. Qterm does not.",
  },
  {
    slug: "antigravity",
    name: "Antigravity",
    title: "Antigravity Terminal for Mac",
    description:
      "Run Antigravity in Qterm, a fast, light Mac agent terminal with projects and splits for CLI coding agents.",
    heading: "Antigravity in Qterm",
    intro:
      "Antigravity is one of the CLI agents Qterm is built to host. Same quiet window, same projects and splits as Claude Code and Codex.",
    points: [
      "Start Antigravity in a project pane instead of a floating tab.",
      "Keep other agents visible in splits when you compare runs.",
      "Stay on a Mac-native, light layout.",
      "Agents stay in the terminal. Qterm never becomes a chat app.",
    ],
    closing: "If Antigravity is your agent, Qterm is still the agent terminal around it.",
  },
];

export function agentPage(slug: string) {
  return AGENT_PAGES.find((page) => page.slug === slug) ?? null;
}
