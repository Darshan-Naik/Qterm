"use client";

import mixpanel from "mixpanel-browser";
import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";

const MIXPANEL_TOKEN = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN;

let initialized = false;

function initMixpanel() {
  if (initialized || !MIXPANEL_TOKEN) return;
  mixpanel.init(MIXPANEL_TOKEN, {
    track_pageview: false,
    persistence: "localStorage",
  });
  initialized = true;
}

function HomePageView() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname === "/" && MIXPANEL_TOKEN) {
      initMixpanel();
      mixpanel.track("homepage_visit");
    }
  }, [pathname]);

  return null;
}

export function MixpanelProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    initMixpanel();
  }, []);

  return (
    <>
      <HomePageView />
      {children}
    </>
  );
}
