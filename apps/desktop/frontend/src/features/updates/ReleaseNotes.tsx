import { ScrollArea } from "@/components/ui/scroll-area";

export function ReleaseNotes({ notes, className = "" }: { notes: string; className?: string }) {
  const text = notes.trim();
  if (!text) return null;
  return (
    <ScrollArea className={`max-h-48 rounded-md border border-border/60 bg-secondary/40 ${className}`.trim()}>
      <pre className="whitespace-pre-wrap break-words px-3 py-2 font-sans text-[12.5px] leading-relaxed text-muted-foreground">
        {text}
      </pre>
    </ScrollArea>
  );
}
