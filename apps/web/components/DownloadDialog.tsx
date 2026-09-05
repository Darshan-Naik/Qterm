"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export function DownloadDialog({
  title,
  step,
  onClose,
  closeOnOverlay = false,
  wide = false,
  children,
}: {
  title: string;
  step: 1 | 2 | 3;
  onClose: () => void;
  closeOnOverlay?: boolean;
  wide?: boolean;
  children: ReactNode;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.querySelector<HTMLElement>("[data-dialog-primary]")?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [onClose]);

  return (
    <div className="dialog-overlay fixed inset-0 z-50 overflow-y-auto p-5">
      <div
        className="absolute inset-0 bg-black/55 backdrop-blur-md"
        onClick={() => {
          if (closeOnOverlay) onClose();
        }}
      />
      <div className="relative z-10 flex min-h-full items-center justify-center py-6 pointer-events-none">
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className={cn(
            "dialog-panel pointer-events-auto w-full rounded-2xl border border-white/10 bg-card p-6 shadow-[0_24px_80px_-24px_rgba(0,0,0,0.8)]",
            wide ? "max-w-[28rem]" : "max-w-[26rem]"
          )}
        >
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <p className="sr-only">Step {step} of 3</p>
              <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                {step} of 3
              </p>
              <h2 id={titleId} className="text-[20px] font-semibold tracking-tight">
                {title}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-white/8 hover:text-foreground"
              aria-label="Close"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
