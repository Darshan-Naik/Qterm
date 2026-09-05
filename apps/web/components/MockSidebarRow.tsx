import { cn } from "@/lib/cn";
import { MockAgentIcon } from "./MockAgentIcon";
import { MockStatusDot } from "./MockStatusDot";

export function MockSidebarRow({
  label,
  agent,
  focused = false,
  open = false,
  indent = false,
  thinking = false,
  needsInput = false,
}: {
  label: string;
  agent?: string;
  focused?: boolean;
  open?: boolean;
  indent?: boolean;
  thinking?: boolean;
  needsInput?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative flex items-center gap-2 rounded-md py-1.5 pr-2 text-[12px]",
        indent ? "ml-3 pl-2" : "px-2",
        focused &&
          "bg-white/8 font-medium text-foreground before:absolute before:inset-y-1 before:left-0 before:w-[3px] before:rounded-full before:bg-primary",
        open && !focused && "bg-white/5 text-foreground/80",
        !focused && !open && "text-muted-foreground",
        needsInput && "session-needs-input"
      )}
    >
      <span className="relative flex size-4 shrink-0 items-center justify-center">
        <MockAgentIcon agent={agent} thinking={thinking} />
        {needsInput ? <MockStatusDot /> : null}
      </span>
      <span className={cn("min-w-0 flex-1 truncate leading-4", thinking && "session-flow-title")}>{label}</span>
    </div>
  );
}
