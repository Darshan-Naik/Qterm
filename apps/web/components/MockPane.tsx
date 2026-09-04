import { MockTerminal } from "./MockTerminal";

export function MockPane({
  title,
  lines,
  caret = false,
}: {
  title: string;
  lines: Array<{ text: string; tone: "muted" | "fg" | "dim" }>;
  caret?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col border-white/6 sm:border-l sm:first:border-l-0">
      <div className="flex h-8 items-center border-b border-white/6 px-3 text-[12px] text-muted-foreground">
        {title}
      </div>
      <MockTerminal lines={lines} caret={caret} />
    </div>
  );
}
