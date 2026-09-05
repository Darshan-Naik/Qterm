import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      { source: "/ai-terminal", destination: "/agent-terminal", permanent: true },
      { source: "/agentic-terminal", destination: "/agent-terminal", permanent: true },
      { source: "/best-terminal", destination: "/best-terminal-for-ai-agents", permanent: true },
      { source: "/fast-terminal", destination: "/best-terminal-for-ai-agents", permanent: true },
      { source: "/warp-alternative", destination: "/vs/warp", permanent: true },
    ];
  },
};

export default nextConfig;
