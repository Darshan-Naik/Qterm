import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { closeAbout, useUI } from "@/store/ui";
import { AboutInfo } from "../../../wailsjs/go/main/App";

type AboutData = Awaited<ReturnType<typeof AboutInfo>>;

const aboutFallback: AboutData = {
  title: "Qterm",
  description: "A fast terminal with project groups and agent hooks.",
  version: "",
  author: "",
};

export function AboutDialog() {
  const open = useUI((s) => s.aboutOpen);
  const [info, setInfo] = useState<AboutData>(aboutFallback);

  useEffect(() => {
    let cancelled = false;
    void AboutInfo().then((data) => {
      if (!cancelled) setInfo(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) closeAbout();
      }}
    >
      <DialogContent
        className="max-w-sm gap-0 p-0 text-center [&>button]:hidden"
        aria-describedby={undefined}
      >
        <div className="flex flex-col items-center gap-4 px-6 pb-6 pt-8">
          <img
            src="/icon.svg"
            alt=""
            width={72}
            height={72}
            className="h-[72px] w-[72px] rounded-[18px] shadow-lg ring-1 ring-border/50"
            draggable={false}
          />

          <div className="space-y-2">
            <DialogTitle className="text-lg font-semibold tracking-tight">{info.title}</DialogTitle>
            <p className="min-h-[2.75rem] text-[13px] leading-relaxed text-muted-foreground">
              {info.description}
            </p>
          </div>

          <div className="min-h-[2.5rem] space-y-0.5 text-[12px] text-muted-foreground/90">
            <p>{info.version ? `Version ${info.version}` : "\u00A0"}</p>
            <p>{info.author ? `Designed by ${info.author}` : "\u00A0"}</p>
          </div>

          <DialogClose asChild>
            <Button className="mt-1 min-w-[88px]" size="default">
              OK
            </Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}
