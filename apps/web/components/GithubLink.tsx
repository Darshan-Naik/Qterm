import { SITE } from "@/lib/site";
import { GhostLink } from "./GhostLink";

export function GithubLink({ className }: { className?: string }) {
  return (
    <GhostLink href={SITE.github} className={className}>
      View on GitHub
    </GhostLink>
  );
}
