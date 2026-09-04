import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Zoom only the visual paint of portaled UI — never the positioned Radix wrapper. */
export const portalZoomStyle: CSSProperties = {
  zoom: "var(--ui-zoom, 1)",
};

export function PortalZoom({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn(className)} style={portalZoomStyle}>
      {children}
    </div>
  );
}
