import type { ReactNode } from "react";

export function GatekeeperTile({
  step,
  title,
  children,
}: {
  step: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-[8.75rem] flex-col gap-2 p-2.5">
      <p className="text-[11px] font-medium leading-none text-muted-foreground">
        {step}. {title}
      </p>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}
