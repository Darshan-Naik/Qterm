export type CompareRow = {
  feature: string;
  qterm: string;
  warp: string;
  ghostty: string;
  iterm: string;
  wave: string;
  cmux: string;
};

export const COMPARE_ROWS: CompareRow[] = [
  {
    feature: "What it is",
    qterm: "Agent terminal for Mac",
    warp: "Agentic development environment",
    ghostty: "Native terminal emulator",
    iterm: "Classic Mac terminal",
    wave: "AI-integrated workspace terminal",
    cmux: "Agent-aware Mac terminal",
  },
  {
    feature: "Coding agents",
    qterm: "Claude Code, Codex, Gemini CLI, Cursor Agent, Antigravity",
    warp: "Warp Agent plus Claude Code, Codex, Gemini, OpenCode",
    ghostty: "Any CLI, no agent layer",
    iterm: "Any CLI, no agent layer",
    wave: "Built-in Wave AI chat",
    cmux: "Any CLI agent",
  },
  {
    feature: "Agent model",
    qterm: "Bring your own CLI agents",
    warp: "Built-in agent plus hosted CLIs",
    ghostty: "None",
    iterm: "None",
    wave: "Built-in assistant",
    cmux: "Bring your own CLI agents",
  },
  {
    feature: "Projects and splits",
    qterm: "Projects, named panes, split right or down",
    warp: "Vertical tabs, worktrees, workflows",
    ghostty: "Splits, config-file driven",
    iterm: "Mature splits and profiles",
    wave: "Block-based workspace",
    cmux: "Vertical tabs and splits",
  },
  {
    feature: "Platform",
    qterm: "macOS, Apple Silicon",
    warp: "macOS, Linux, Windows",
    ghostty: "macOS, Linux",
    iterm: "macOS",
    wave: "macOS, Linux, Windows",
    cmux: "macOS",
  },
  {
    feature: "Price",
    qterm: "Free",
    warp: "Free tier, paid subscription",
    ghostty: "Free",
    iterm: "Free",
    wave: "Free, optional cloud sync",
    cmux: "Free",
  },
];

export type VsPage = {
  slug: string;
  name: string;
  title: string;
  description: string;
  kicker: string;
  heading: string;
  intro: string;
  pickQterm: string[];
  pickOther: string[];
  summary: string;
};

export const VS_PAGES: VsPage[] = [
  {
    slug: "warp",
    name: "Warp",
    title: "Qterm vs Warp",
    description:
      "Qterm vs Warp: Qterm is a quiet agent terminal for Mac that hosts Claude Code, Codex, and Gemini CLI. Warp is an all-in-one agentic development environment with a built-in agent.",
    kicker: "Compare",
    heading: "Qterm vs Warp",
    intro:
      "Warp calls itself an agentic development environment. It ships a built-in Warp Agent, cloud workflows, and a polished AI terminal. Qterm is a different bet: a fast Mac agent terminal that keeps Claude Code, Codex, Gemini CLI, and Cursor Agent in the terminal, without replacing them.",
    pickQterm: [
      "You already use Claude Code, Codex, or Gemini CLI and want a quiet Mac window around them.",
      "You do not want a vendor agent or a subscription sitting between you and the CLI.",
      "You want projects, splits, and git-aware folders instead of a chat-first layout.",
    ],
    pickOther: [
      "You want one product to own the terminal, the agent, and cloud orchestration.",
      "Your team needs Warp Agent, shared workflows, or enterprise controls.",
      "You need Linux or Windows, which Qterm does not ship yet.",
    ],
    summary:
      "Choose Warp if you want a built-in AI terminal. Choose Qterm if you want an agent terminal for the coding agents you already run on Mac.",
  },
  {
    slug: "ghostty",
    name: "Ghostty",
    title: "Qterm vs Ghostty",
    description:
      "Qterm vs Ghostty: Ghostty is a fast native terminal emulator. Qterm is an agent terminal for Mac with projects, splits, and first-class room for Claude Code, Codex, and Gemini CLI.",
    kicker: "Compare",
    heading: "Qterm vs Ghostty",
    intro:
      "Ghostty is the native emulator to beat: GPU-fast, correct, and deliberately small. It is a great place to run an agent if you bring your own multiplexer. Qterm is an agentic terminal: still quiet, but with projects, named splits, and a sidebar built for agent sessions on Mac.",
    pickQterm: [
      "You want project folders, named panes, and agent sessions without tmux as a requirement.",
      "You run several CLI agents and want them grouped with your shells.",
      "You want a Mac app that is ready for agents without a long config file.",
    ],
    pickOther: [
      "You want the fastest, most correct emulator and are happy with a config file.",
      "You already live in tmux or Zellij and do not want another window model.",
      "You need Linux, which Ghostty covers and Qterm does not.",
    ],
    summary:
      "Choose Ghostty for a minimal native emulator. Choose Qterm when the terminal itself should be an agent terminal.",
  },
  {
    slug: "iterm2",
    name: "iTerm2",
    title: "Qterm vs iTerm2",
    description:
      "Qterm vs iTerm2: iTerm2 is the classic Mac terminal. Qterm is a modern agent terminal for Claude Code, Codex, Gemini CLI, and other coding agents.",
    kicker: "Compare",
    heading: "Qterm vs iTerm2",
    intro:
      "iTerm2 is the default power-user terminal on Mac: profiles, splits, search, and years of polish. It will run any CLI agent. Qterm is built for the agent era: projects instead of profile sprawl, splits that stay readable, and agents that live in the same quiet window as your shells.",
    pickQterm: [
      "You opened iTerm2 to run Claude Code and ended up managing tabs more than code.",
      "You want git-aware projects and sessions that remember where you left off.",
      "You want an agent terminal, not a general-purpose emulator with extra profiles.",
    ],
    pickOther: [
      "You need iTerm2's deep features, triggers, or Instant Replay.",
      "Your workflow is already profiles, hotkeys, and shell integration.",
      "You are not running coding agents and just want a classic terminal.",
    ],
    summary:
      "Choose iTerm2 as a mature daily-driver emulator. Choose Qterm as an iTerm2 alternative when the job is an agent terminal.",
  },
  {
    slug: "wave",
    name: "Wave",
    title: "Qterm vs Wave Terminal",
    description:
      "Qterm vs Wave Terminal: Wave is an AI-integrated workspace terminal with chat and widgets. Qterm is a light agent terminal that keeps agents in the shell.",
    kicker: "Compare",
    heading: "Qterm vs Wave Terminal",
    intro:
      "Wave Terminal rethinks the terminal as a workspace: blocks, file previews, and a built-in AI chat. Qterm stays a terminal. Coding agents stay in the PTY, not in a side chat, so Claude Code and Codex feel like themselves.",
    pickQterm: [
      "You want the CLI agent UI, not a second chat widget.",
      "You prefer a light Mac window with projects and splits.",
      "You already picked Claude Code, Codex, or Gemini CLI.",
    ],
    pickOther: [
      "You want inline previews, widgets, and a built-in assistant.",
      "You like a block-based workspace more than a classic terminal.",
      "You need Windows or Linux today.",
    ],
    summary:
      "Choose Wave for an AI-integrated workspace. Choose Qterm for a quiet agent terminal.",
  },
  {
    slug: "cmux",
    name: "cmux",
    title: "Qterm vs cmux",
    description:
      "Qterm vs cmux: both are Mac terminals for coding agents. cmux is Ghostty-based with notification rings. Qterm is a quiet agentic terminal with projects and splits.",
    kicker: "Compare",
    heading: "Qterm vs cmux",
    intro:
      "cmux is a native Mac terminal built on libghostty, with vertical tabs and notification rings when agents need attention. Qterm is also a Mac agent terminal, with a quieter project sidebar, named splits, and the same bring-your-own-agent model.",
    pickQterm: [
      "You want projects, a calm sidebar, and splits that feel native.",
      "You care about a light window more than notification rings.",
      "You want Claude Code, Codex, and Gemini CLI grouped under folders.",
    ],
    pickOther: [
      "You want Ghostty rendering plus notification rings when agents wait.",
      "You need an in-app browser beside the terminal.",
      "You want a CLI and socket API as the main control surface.",
    ],
    summary:
      "Both are agent terminals for Mac. Pick cmux for Ghostty-based notifications. Pick Qterm for a quieter project-and-split agentic terminal.",
  },
];

export function vsPage(slug: string) {
  return VS_PAGES.find((page) => page.slug === slug) ?? null;
}
