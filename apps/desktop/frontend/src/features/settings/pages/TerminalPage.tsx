import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { useInstalledIDEs } from "@/queries";
import { Switch } from "@/components/ui/switch";
import {
  clampFontSize,
  clampNotifyCommandMinSec,
  DEFAULT_IDE,
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  NOTIFY_COMMAND_MIN_MAX,
  NOTIFY_COMMAND_MIN_MIN,
  saveNotifyPrefs,
  uiStore,
  useUI,
} from "@/store/ui";
import { SaveDefaultIDE, SaveFontSize, SaveShell } from "../../../../wailsjs/go/main/App";
import { PageTitle } from "../ui/PageTitle";
import { SectionLabel } from "../ui/SectionLabel";
import { SettingCard } from "../ui/SettingCard";
import { SettingRow } from "../ui/SettingRow";
import { PillSelect } from "../ui/PillSelect";

export function TerminalPage() {
  const fontSize = useUI((s) => s.fontSize);
  const shell = useUI((s) => s.shell);
  const defaultIDE = useUI((s) => s.defaultIDE);
  const notifyCommand = useUI((s) => s.notifyCommand);
  const notifyCommandMinSec = useUI((s) => s.notifyCommandMinSec);
  const installed = useInstalledIDEs().data ?? [];
  const [shellDraft, setShellDraft] = useState(shell);

  useEffect(() => {
    setShellDraft(shell);
  }, [shell]);

  const ideOptions = [
    { value: DEFAULT_IDE, label: "Auto" },
    ...installed.map((e) => ({ value: e.id, label: e.label })),
  ];
  if (defaultIDE && !ideOptions.some((o) => o.value === defaultIDE)) {
    ideOptions.push({ value: defaultIDE, label: defaultIDE });
  }

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
              min={FONT_SIZE_MIN}
              max={FONT_SIZE_MAX}
              className="h-8 w-20 rounded-lg border-border/60 bg-secondary/50 text-center text-[12.5px] shadow-none"
              value={fontSize}
              onChange={async (e) => {
                const n = clampFontSize(Number(e.target.value));
                uiStore.set({ fontSize: n });
                await SaveFontSize(n);
              }}
            />
          }
        />
        <SettingRow
          title="Default IDE"
          description="Preferred editor for Open in IDE. Auto uses the first installed."
          control={
            <PillSelect
              value={defaultIDE}
              options={ideOptions}
              onChange={async (v) => {
                uiStore.set({ defaultIDE: v });
                await SaveDefaultIDE(v);
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

      <div className="mt-6">
        <SectionLabel>Notifications</SectionLabel>
        <SettingCard>
          <SettingRow
            title="Command finished"
            description="Notify when a command longer than the threshold finishes while Qterm is in the background."
            control={
              <Switch
                checked={notifyCommand}
                onCheckedChange={(on) => {
                  const s = uiStore.get();
                  void saveNotifyPrefs(s.notifyAgent, on, s.notifyCommandMinSec);
                }}
              />
            }
          />
          <SettingRow
            title="Minimum runtime"
            description="Seconds a command must run before Qterm notifies."
            control={
              <Input
                type="number"
                min={NOTIFY_COMMAND_MIN_MIN}
                max={NOTIFY_COMMAND_MIN_MAX}
                className="h-8 w-20 rounded-lg border-border/60 bg-secondary/50 text-center text-[12.5px] shadow-none"
                value={notifyCommandMinSec}
                onChange={(e) => {
                  const s = uiStore.get();
                  const n = clampNotifyCommandMinSec(Number(e.target.value));
                  void saveNotifyPrefs(s.notifyAgent, s.notifyCommand, n);
                }}
              />
            }
          />
        </SettingCard>
      </div>
    </div>
  );
}
