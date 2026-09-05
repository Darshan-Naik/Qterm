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
      "Qterm is built to feel fast: a light Mac agent terminal that stays out of the way. The job is a quiet window for agents, projects, and splits.",
  },
  {
    question: "Is Qterm a small or lightweight terminal?",
    answer:
      "Qterm is designed to stay light: a small Mac window for terminals and agents, not an Electron-heavy chat app. Projects, named splits, and your CLIs, without extra chrome.",
  },
  {
    question: "Can I run Claude Code, Codex, and Gemini CLI in Qterm?",
    answer:
      "Yes. Open a project, split panes, and run Claude Code, Codex, Gemini CLI, Cursor Agent, or Antigravity beside your shells. Each one stays in the terminal.",
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
      "An agent terminal hosts coding agents in a real shell. Qterm is an agent terminal for Mac where Claude Code, Codex, Gemini CLI, and Cursor Agent stay in the terminal.",
  },
  {
    question: "What is the best agentic terminal?",
    answer:
      "Qterm is built as an agentic terminal: a quiet Mac window for projects, splits, and the CLI agents you already run.",
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
