"use client";

import { SITE } from "@/lib/site";
import { cn } from "@/lib/cn";
import { trackCTA } from "@/lib/analytics";

export function GithubLink({ className }: { className?: string }) {
  return (
    <a
      href={SITE.github}
      target="_blank"
      rel="noreferrer"
      onClick={() => trackCTA("github_star_click")}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg border border-white/12 bg-white/4 px-4 py-2.5 text-[14px] font-medium text-foreground transition hover:border-white/20 hover:bg-white/8",
        className,
      )}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 6.82 21.02 8 14.14 3 9.27 9.91 8.26 12 2" />
      </svg>
      Star on GitHub
    </a>
  );
}
