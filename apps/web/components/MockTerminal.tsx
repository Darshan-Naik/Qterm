const TONE: Record<"muted" | "fg" | "dim" | "cmd", string> = {
  muted: "text-muted-foreground",
  fg: "text-foreground/90",
  dim: "text-muted-foreground/70",
  cmd: "text-primary/80",
};

export function MockTerminal({
  lines,
  caret,
  reveal = false,
}: {
  lines: Array<{ text: string; tone: "muted" | "fg" | "dim" | "cmd" }>;
  caret?: boolean;
  reveal?: boolean;
}) {
  return (
    <div className="flex-1 p-3 font-mono text-[12px] leading-6">
      {lines.map((line, index) => (
        <div
          key={`${line.text}-${index}`}
          className={`${TONE[line.tone]} ${reveal ? "mock-line" : ""}`}
          style={reveal ? { animationDelay: `${0.28 + index * 0.32}s` } : undefined}
        >
          {line.text}
        </div>
      ))}
      {caret ? (
        <div className="text-muted-foreground">
          ~/acme % <span className="term-caret" />
        </div>
      ) : null}
    </div>
  );
}
