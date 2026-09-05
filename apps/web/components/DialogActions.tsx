import type { ReactNode } from "react";

export function DialogActions({ children }: { children: ReactNode }) {
  return (
    <div className="mt-6 flex flex-wrap items-center justify-end gap-3">{children}</div>
  );
}
