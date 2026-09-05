export type GuidePick = {
  name: string;
  href?: string;
  bestFor: string;
  body: string;
};

export const BEST_AI_AGENTS_PICKS: GuidePick[] = [
  {
    name: "Qterm",
    href: "/",
    bestFor: "Fast, light Mac agent terminal with projects and splits",
    body: "Qterm hosts Claude Code, Codex, Gemini CLI, Cursor Agent, and Antigravity in one quiet window. Agents stay in the terminal. No vendor chat, no Electron-heavy IDE. Best when you want an agent terminal, not another product sitting on top of your CLI.",
  },
  {
    name: "Ghostty",
    bestFor: "Fastest native emulator on Mac",
    body: "Ghostty wins most 'fast terminal' roundups: GPU rendering, native UI, small RAM versus iTerm2 and Warp. It is not an agent layer. Pair it with tmux, or use it as the emulator under an agent-aware app.",
  },
  {
    name: "Alacritty",
    bestFor: "Smallest, lightest emulator",
    body: "Alacritty is the usual answer to 'small terminal' and 'lightweight terminal': minimal chrome, low RAM, GPU throughput. No tabs, no splits, no agent awareness. Use it with tmux if that is your stack.",
  },
  {
    name: "Warp",
    bestFor: "All-in-one AI-powered terminal",
    body: "Warp ranks for 'AI terminal' because it is one: built-in Warp Agent, blocks, cloud workflows. Heavier, account-based. Pick Warp if you want the vendor agent. Pick Qterm if you already have Claude Code or Codex.",
  },
  {
    name: "cmux",
    bestFor: "Mac terminal with agent notification rings",
    body: "cmux is a Ghostty-based Mac terminal for parallel agents: vertical tabs, rings when a session needs you. Strong if notifications are the bottleneck. Qterm is quieter: projects, named splits, same bring-your-own-agent model.",
  },
  {
    name: "iTerm2",
    bestFor: "Classic Mac power-user terminal",
    body: "iTerm2 still ranks for 'Mac terminal' after a decade of profiles, triggers, and tmux -CC. It will run any CLI agent. It is not built as an agent terminal. Switch when tabs start managing you.",
  },
];

export const CLAUDE_CODE_PICKS: GuidePick[] = [
  {
    name: "Qterm",
    href: "/",
    bestFor: "Claude Code in a fast, light agent terminal",
    body: "Open a project, split a pane, run claude. Qterm is a Claude Code terminal that stays a terminal: no chat takeover, Apple Silicon, projects and splits.",
  },
  {
    name: "Ghostty",
    bestFor: "Fast Mac emulator for a single Claude session",
    body: "Many 2026 guides pick Ghostty as the default Claude Code host because Shift+Enter, notifications, and speed work out of the box. Add tmux if you need persistence.",
  },
  {
    name: "cmux",
    bestFor: "Several Claude sessions with attention rings",
    body: "If the pain is 'which pane is waiting', cmux's notification rings are the feature. Qterm is the pick when the pain is clutter: projects, names, a small window.",
  },
  {
    name: "Warp",
    bestFor: "Claude Code inside an AI development environment",
    body: "Warp can host Claude Code alongside Warp Agent. Choose it when you want one integrated environment. Choose Qterm when Claude Code should stay your agent.",
  },
];
