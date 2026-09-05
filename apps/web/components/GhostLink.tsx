import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function GhostLink({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "inline-flex items-center justify-center rounded-lg border border-white/12 bg-white/4 px-4 py-2.5 text-[14px] font-medium text-foreground transition hover:border-white/20 hover:bg-white/8",
        className,
      )}
    >
      {children}
    </a>
  );
}
