import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      { source: "/ai-terminal", destination: "/agent-terminal", permanent: true },
      { source: "/agentic-terminal", destination: "/agent-terminal", permanent: true },
      { source: "/best-terminal", destination: "/agent-terminal", permanent: true },
      { source: "/fast-terminal", destination: "/agent-terminal", permanent: true },
      { source: "/best-terminal-for-ai-agents", destination: "/agent-terminal", permanent: true },
      { source: "/best-terminal-for-claude-code", destination: "/agents/claude-code", permanent: true },
      { source: "/compare", destination: "/", permanent: true },
      { source: "/vs/:slug", destination: "/", permanent: true },
      { source: "/warp-alternative", destination: "/", permanent: true },
    ];
  },
};

export default nextConfig;
