export type FaqItem = {
  question: string;
  answer: string;
};

export const HOME_FAQ: FaqItem[] = [
  {
    question: "What is an agent terminal?",
    answer:
      "An agent terminal is a terminal built so coding agents can run next to your shells. You keep Claude Code, Codex, Gemini CLI, or Cursor Agent in the same window as normal terminals, with projects and splits instead of a separate chat app.",
  },
  {
    question: "What is an agentic terminal?",
    answer:
      "An agentic terminal is a terminal designed for agent workflows. Qterm is an agentic terminal for Mac: fast, clean, and light, with your agents staying in the terminal rather than taking over the UI.",
  },
  {
    question: "Is Qterm a fast terminal?",
    answer:
      "Qterm is built to feel fast: a light Mac agent terminal that stays out of the way. For raw emulator throughput, Ghostty and Alacritty still lead public benchmarks. Qterm's job is a quiet window for agents, projects, and splits.",
  },
  {
    question: "Is Qterm a small or lightweight terminal?",
    answer:
      "Qterm is designed to stay light: a small Mac window for terminals and agents, not an Electron-heavy chat app. If you want the smallest possible emulator with no chrome, Alacritty is the usual pick. If you want a light agent terminal with projects and splits, that is Qterm.",
  },
  {
    question: "What is the best terminal for Claude Code on Mac?",
    answer:
      "Ghostty is a strong fast emulator. cmux is built for parallel agent notifications. Qterm is the pick when you want a fast, light agent terminal with projects and splits, and Claude Code stays in the terminal instead of a chat sidebar.",
  },
  {
    question: "How is Qterm different from Warp?",
    answer:
      "Warp is an all-in-one agentic development environment with its own agent. Qterm does not replace your agent. It is a quiet Mac terminal that hosts Claude Code, Codex, Gemini CLI, and other CLI agents without turning into another chat window.",
  },
  {
    question: "Does Qterm work on Mac?",
    answer:
      "Qterm is designed for Mac on Apple Silicon. Download the latest DMG, open a terminal or add a project folder, and start working.",
  },
];

export const AGENT_TERMINAL_FAQ: FaqItem[] = [
  {
    question: "What does agent terminal mean?",
    answer:
      "People searching for agent terminal want a terminal that can host coding agents. Qterm is that: an agent terminal for Mac where Claude Code, Codex, Gemini CLI, and Cursor Agent stay in the terminal.",
  },
  {
    question: "What is the best agentic terminal?",
    answer:
      "It depends on the job. Warp fits teams that want a built-in agent. Ghostty is a fast native emulator. Qterm is the best agentic terminal if you want a quiet Mac window for projects, splits, and the CLI agents you already run.",
  },
  {
    question: "Can I run multiple AI agents in one terminal?",
    answer:
      "Yes. Split right or down in Qterm and run one agent per pane. Each pane has its own title, and project folders keep those sessions grouped.",
  },
  {
    question: "Is an AI terminal the same as an agent terminal?",
    answer:
      "Almost. AI terminal often means a terminal with a vendor chatbot built in. Agent terminal usually means a terminal for CLI coding agents. Qterm is the second kind: your agent, your shell, one window.",
  },
  {
    question: "Is Qterm a fast, small terminal for agents?",
    answer:
      "Yes, that is the point. Qterm is a fast, light Mac agent terminal. It stays small on screen and in the workflow: projects, named splits, and your agents, without extra chrome.",
  },
];

export const BEST_AI_AGENTS_FAQ: FaqItem[] = [
  {
    question: "What is the best terminal for AI agents in 2026?",
    answer:
      "Pick by job. Ghostty or Alacritty if you want a fast, small emulator. Warp if you want a built-in AI terminal. cmux if you want notification rings on Mac. Qterm if you want a fast, light agent terminal with projects and splits for Claude Code, Codex, and Gemini CLI.",
  },
  {
    question: "What is the best fast terminal?",
    answer:
      "Alacritty and Ghostty win most public speed and RAM comparisons. Qterm is a fast-feeling Mac agent terminal, not a throughput benchmark toy. Choose it when the work is agents and projects, not raw cat of megabyte logs.",
  },
  {
    question: "What is the best small or lightweight terminal?",
    answer:
      "Alacritty is the usual answer for a tiny emulator. Qterm is a lightweight agent terminal: a quiet Mac window instead of a heavy AI IDE. Small as in little chrome, not as in a 2 MB binary.",
  },
  {
    question: "Is Warp the best AI terminal?",
    answer:
      "Warp is the strongest all-in-one AI-powered terminal if you want one vendor's agent. If you already run Claude Code or Codex and want a light Mac host, Qterm is the Warp alternative that keeps agents in the terminal.",
  },
];

export const CLAUDE_CODE_FAQ: FaqItem[] = [
  {
    question: "What is the best terminal for Claude Code?",
    answer:
      "Ghostty is a great fast emulator. cmux adds agent notifications on Mac. Qterm is the Claude Code terminal if you want projects, splits, and a light window where Claude stays in the PTY.",
  },
  {
    question: "Can I run Claude Code, Codex, and Gemini CLI together?",
    answer:
      "Yes. In Qterm, put each agent in its own pane or project session. They do not share a chat UI. Each one is a normal terminal.",
  },
  {
    question: "Do I need Warp to run Claude Code?",
    answer:
      "No. Claude Code is a CLI. Any terminal can host it. Qterm is built so that workflow feels like an agent terminal instead of a pile of tabs.",
  },
];
