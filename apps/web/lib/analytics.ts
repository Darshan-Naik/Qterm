import mixpanel from "mixpanel-browser";

export type CTAEvent = "download_click" | "github_star_click" | "sponsor_click";

export function trackCTA(event: CTAEvent, properties?: Record<string, unknown>) {
  if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_MIXPANEL_TOKEN) {
    mixpanel.track(event, properties);
  }
}
