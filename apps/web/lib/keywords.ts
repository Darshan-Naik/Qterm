/**
 * Keyword map from live SERPs (Sep 2026).
 *
 * "best terminal" / "fast terminal" / "small terminal" are won by comparison posts
 * plus Alacritty, Ghostty, and iTerm2 product pages. Qterm cannot beat those head
 * terms alone. Rankable compounds from the same result pages:
 *
 * Product-page titles that rank: "AI-Powered Terminal" (Warp), "macOS terminal for
 * AI coding agents" (cmux), "fast ... terminal emulator" (Ghostty), "macOS Terminal
 * Replacement" (iTerm2).
 *
 * Guide titles that rank: "Best Terminal for AI Agents in 2026", "Best Terminal for
 * Claude Code", "Best terminal for agentic coding", "Best Terminal for Mac".
 */

export const PRIMARY_KEYWORDS = [
  "agent terminal",
  "agentic terminal",
  "best agentic terminal",
  "AI terminal",
  "AI coding terminal",
  "terminal for AI agents",
  "best terminal for AI agents",
  "best terminal for Claude Code",
  "best terminal for agentic coding",
  "fast terminal",
  "light terminal",
  "lightweight terminal",
  "Mac terminal",
  "macOS terminal",
  "best Mac terminal",
] as const;

export const AGENT_KEYWORDS = [
  "Claude Code terminal",
  "terminal for Claude Code",
  "Codex CLI terminal",
  "Gemini CLI terminal",
  "Cursor Agent terminal",
  "Antigravity terminal",
] as const;

export const COMPARE_KEYWORDS = [
  "Warp alternative",
  "Ghostty vs Warp",
  "iTerm2 alternative",
  "cmux alternative",
  "best terminal for coding agents",
] as const;

export const SITE_KEYWORDS = [
  "Qterm",
  "terminal",
  "agent",
  "agent terminal",
  "agentic terminal",
  "fast",
  "light",
  "lightweight",
  "small terminal",
  "Mac",
  "macOS",
  "Apple Silicon",
  "Claude Code",
  "Codex",
  "Gemini CLI",
  "Cursor Agent",
  "Antigravity",
  "splits",
  "projects",
  ...PRIMARY_KEYWORDS,
  ...AGENT_KEYWORDS,
  ...COMPARE_KEYWORDS,
] as const;
