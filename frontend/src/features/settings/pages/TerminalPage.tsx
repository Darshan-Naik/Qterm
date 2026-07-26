import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { uiStore, useUI } from "@/store/ui";
import { SaveFontSize, SaveShell } from "../../../../wailsjs/go/main/App";
import { PageTitle } from "../ui/PageTitle";
import { SectionLabel } from "../ui/SectionLabel";
import { SettingCard } from "../ui/SettingCard";
import { SettingRow } from "../ui/SettingRow";

export function TerminalPage() {
  const fontSize = useUI((s) => s.fontSize);
  const shell = useUI((s) => s.shell);
  const [shellDraft, setShellDraft] = useState(shell);

  useEffect(() => {
    setShellDraft(shell);
  }, [shell]);

  return (
    <div>
      <PageTitle>Terminal</PageTitle>

      <SectionLabel>Display</SectionLabel>
      <SettingCard>
        <SettingRow
          title="Font size"
          description="Size of the terminal text in points."
          control={
            <Input
              type="number"
              min={10}
              max={24}
              className="h-8 w-20 rounded-lg border-border/60 bg-secondary/50 text-center text-[12.5px] shadow-none"
              value={fontSize}
              onChange={async (e) => {
                const n = Number(e.target.value) || 12;
                uiStore.set({ fontSize: n });
                await SaveFontSize(n);
              }}
            />
          }
        />
      </SettingCard>

      <div className="mt-6">
        <SectionLabel>Shell</SectionLabel>
        <SettingCard>
          <SettingRow
            title="Default shell"
            description="Leave empty to use the system default shell."
            control={
              <Input
                className="h-8 w-52 rounded-lg border-border/60 bg-secondary/50 text-[12.5px] shadow-none"
                placeholder="/bin/zsh"
                value={shellDraft}
                onChange={(e) => setShellDraft(e.target.value)}
                onBlur={async () => {
                  const next = shellDraft.trim();
                  uiStore.set({ shell: next });
                  await SaveShell(next);
                }}
              />
            }
          />
        </SettingCard>
      </div>
    </div>
  );
}
