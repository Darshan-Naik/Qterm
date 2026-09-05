import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

export function MacMiniWindow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden rounded-[8px] bg-[#e8e8ed] shadow-[0_10px_22px_-14px_rgba(0,0,0,0.55)]",
        className,
      )}
    >
      <div className="flex h-[13px] shrink-0 items-center gap-[3px] bg-[#d8d8de] px-[6px]">
        <span className="size-[6px] rounded-full bg-[#ff5f57]" />
        <span className="size-[6px] rounded-full bg-[#febc2e]" />
        <span className="size-[6px] rounded-full bg-[#28c840]" />
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}
