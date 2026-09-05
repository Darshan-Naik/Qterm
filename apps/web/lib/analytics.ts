import posthog from "posthog-js";

export type CTAEvent = "download_click" | "github_star_click" | "sponsor_click";

export function trackCTA(event: CTAEvent, properties?: Record<string, unknown>) {
  if (typeof window !== "undefined" && posthog.__loaded) {
    posthog.capture(event, properties);
  }
}
