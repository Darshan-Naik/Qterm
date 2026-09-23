"use client";

import { useState, type ReactNode, useRef } from "react";
import { downloadElementPng } from "@/lib/download-element-png";
import { QtermLogo } from "./QtermLogo";

type ContributorShareCardProps = {
  headline: string;
  name: string;
  detail: string;
  repoPath: string;
  fileName: string;
  children?: ReactNode;
};

export function ContributorShareCard({
  headline,
  name,
  detail,
  repoPath,
  fileName,
  children,
}: ContributorShareCardProps) {
  const cardRef = useRef<HTMLElement>(null);
  const [saving, setSaving] = useState(false);

  return (
    <>
      <article
        ref={cardRef}
        className="mt-8 overflow-hidden rounded-2xl border border-white/10 bg-[#141413]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(243,240,232,0.045) 1px, transparent 1px), linear-gradient(to bottom, rgba(243,240,232,0.045) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      >
        <div className="m-4 rounded-3xl border border-white/10 bg-[#1c1c1b] px-6 py-8 sm:m-6 sm:px-10 sm:py-10">
          <div className="flex items-center gap-4">
            <QtermLogo size={44} />
            <p className="text-[13px] font-medium tracking-[0.28em] text-[#8eb4ff]">QTERM</p>
          </div>
          <p className="mt-8 text-[32px] font-semibold leading-tight tracking-tight text-[#f3f0e8] sm:text-[44px]">
            {headline}
          </p>
          <p className="mt-4 text-[22px] text-[#f3f0e8] sm:text-[28px]">{name}</p>
          <p className="mt-3 text-[16px] text-[#b9b5ab]">{detail}</p>
          <p className="mt-8 font-mono text-[16px] text-[#f3f0e8] sm:text-[18px]">&quot;I helped build Qterm.&quot;</p>
          <p className="mt-6 text-[13px] text-[#8d8a80]">github.com/{repoPath}</p>
        </div>
      </article>
      <div className="mt-4 flex flex-wrap gap-4 text-[13px]">
        <button
          type="button"
          className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:opacity-60"
          disabled={saving}
          onClick={() => {
            const card = cardRef.current;
            if (!card) return;
            setSaving(true);
            downloadElementPng(card, fileName)
              .catch(() => undefined)
              .finally(() => setSaving(false));
          }}
        >
          Save this
        </button>
        {children}
      </div>
    </>
  );
}
