import { SITE } from "@/lib/site";
import { cn } from "@/lib/cn";
import { GhostLink } from "./GhostLink";

export function GithubLink({ className }: { className?: string }) {
  return (
    <GhostLink href={SITE.github} className={cn("gap-2", className)}>
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
    </GhostLink>
  );
}
