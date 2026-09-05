export function FaqItem({ question, answer }: { question: string; answer: string }) {
  return (
    <details className="group rounded-xl border border-white/8 bg-card/60 px-4 py-3">
      <summary className="cursor-pointer list-none text-[14px] font-medium tracking-tight marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="flex items-center justify-between gap-4">
          {question}
          <span className="text-muted-foreground transition group-open:rotate-45">+</span>
        </span>
      </summary>
      <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground">{answer}</p>
    </details>
  );
}
