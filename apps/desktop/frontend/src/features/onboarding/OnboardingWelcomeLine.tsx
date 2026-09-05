import { cn } from "@/lib/utils";

export function OnboardingWelcomeLine({
  text,
  className,
  delayMs = 0,
  stepMs = 44,
}: {
  text: string;
  className?: string;
  delayMs?: number;
  stepMs?: number;
}) {
  return (
    <span className={cn("block", className)}>
      {Array.from(text).map((ch, i) => (
        <span
          key={`${ch}-${i}`}
          className="setup-letter inline-block"
          style={{ animationDelay: `${delayMs + i * stepMs}ms` }}
        >
          {ch === " " ? "\u00A0" : ch}
        </span>
      ))}
    </span>
  );
}
