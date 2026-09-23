import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      { source: "/ai-terminal", destination: "/agent-terminal", permanent: true },
      { source: "/agentic-terminal", destination: "/agent-terminal", permanent: true },
    ];
  },
};

export default nextConfig;
