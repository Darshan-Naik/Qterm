import type { ReactNode } from "react";

export function SettingCard({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-card/40 divide-y divide-border/50">
      {children}
    </div>
  );
}
