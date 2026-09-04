import type { ReactNode } from "react";

export function PageTitle({ children }: { children: ReactNode }) {
  return <h1 className="mb-6 text-[18px] font-medium tracking-tight">{children}</h1>;
}
