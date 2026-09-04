const TONE: Record<"muted" | "fg" | "dim", string> = {
  muted: "text-muted-foreground",
  fg: "text-foreground/90",
  dim: "text-muted-foreground/70",
};

export function MockTerminal({
  lines,
  caret,
}: {
  lines: Array<{ text: string; tone: "muted" | "fg" | "dim" }>;
  caret?: boolean;
}) {
  return (
    <div className="flex-1 p-3 font-mono text-[12px] leading-6">
      {lines.map((line) => (
        <div key={line.text} className={TONE[line.tone]}>
          {line.text}
        </div>
      ))}
      {caret ? (
        <div className="text-muted-foreground">
          ~/qterm % <span className="term-caret" />
        </div>
      ) : null}
    </div>
  );
}
