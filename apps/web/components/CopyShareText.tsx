"use client";

import { useState } from "react";

export function CopyShareText({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div>
      <pre className="overflow-x-auto whitespace-pre-wrap rounded-xl border border-white/10 bg-black/30 p-4 font-mono text-[13px] leading-relaxed text-foreground/90">
        {text}
      </pre>
      <button
        type="button"
        className="mt-3 inline-flex h-9 items-center rounded-lg border border-white/12 bg-white/4 px-3 text-[13px] font-medium text-foreground transition hover:border-white/20 hover:bg-white/8"
        onClick={async () => {
          await navigator.clipboard.writeText(text);
          setCopied(true);
        }}
      >
        {copied ? "Copied" : "Copy text"}
      </button>
    </div>
  );
}
