import { cn } from "@/lib/cn";
import { MockAgentIcon } from "./MockAgentIcon";
import { MockGitChip } from "./MockGitChip";
import { MockPaneMenu } from "./MockPaneMenu";
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
  active = false,
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
  active?: boolean;
  branch?: string;
  prompt?: { action: string; path: string };
}) {
  return (
    <div className="group/chrome flex min-w-0 flex-1 flex-col border-white/6 sm:border-l sm:first:border-l-0">
      <div className="flex h-8 items-center gap-1 border-b border-white/6 px-2 text-[12px] text-muted-foreground">
        <span
          className={cn(
            "flex min-w-0 flex-1 items-center gap-1.5 px-1",
            active || needsInput ? "text-foreground/90" : "opacity-45"
          )}
        >
          <MockAgentIcon agent={agent} thinking={thinking} size={14} />
          <span className="truncate">{title}</span>
          {needsInput ? (
            <span className="rounded-full border border-amber-400/25 bg-amber-400/10 px-1.5 py-px text-[10px] tracking-wide text-amber-100/80">
              Needs input
            </span>
          ) : null}
        </span>
        {branch ? <MockGitChip branch={branch} active={active} /> : null}
        <MockPaneMenu active={active} />
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
