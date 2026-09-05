import { cn } from "@/lib/cn";
import { MockAgentIcon } from "./MockAgentIcon";
import { MockPermissionPrompt } from "./MockPermissionPrompt";
import { MockTerminal } from "./MockTerminal";

export function MockPane({
  title,
  agent,
  lines,
  caret = false,
  thinking = false,
  needsInput = false,
  reveal = false,
  working = false,
  branch,
  prompt,
}: {
  title: string;
  agent?: string;
  lines: Array<{ text: string; tone: "muted" | "fg" | "dim" | "cmd" }>;
  caret?: boolean;
  thinking?: boolean;
  needsInput?: boolean;
  reveal?: boolean;
  working?: boolean;
  branch?: string;
  prompt?: { action: string; path: string };
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col border-white/6 sm:border-l sm:first:border-l-0">
      <div className="flex h-8 items-center gap-1.5 border-b border-white/6 px-3 text-[12px] text-muted-foreground">
        <MockAgentIcon agent={agent} thinking={thinking} size={16} />
        <span className={cn("truncate", needsInput && "text-amber-100/90")}>{title}</span>
        {branch ? (
          <span className="ml-auto font-mono text-[10px] text-muted-foreground/75">{branch}</span>
        ) : null}
        {needsInput ? (
          <span className="ml-auto rounded-full border border-amber-400/25 bg-amber-400/10 px-1.5 py-px text-[10px] tracking-wide text-amber-100/80">
            Needs input
          </span>
        ) : null}
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        <MockTerminal lines={lines} caret={caret} reveal={reveal} working={working} />
        {prompt ? (
          <div className="px-3 pb-3">
            <MockPermissionPrompt action={prompt.action} path={prompt.path} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
