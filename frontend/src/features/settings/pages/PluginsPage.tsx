import { toast } from "sonner";
import { invalidateQuery } from "qortex-query";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useHooks } from "@/queries";
import {
  InstallHook,
  PickHookFolder,
  SetHookEnabled,
  SetHookPermissions,
  UninstallHook,
} from "../../../../wailsjs/go/main/App";
import { PageTitle } from "../ui/PageTitle";
import { SectionLabel } from "../ui/SectionLabel";
import { SettingCard } from "../ui/SettingCard";
import { SettingRow } from "../ui/SettingRow";

export function PluginsPage() {
  const { data: hooks, refetch } = useHooks();
  const list = ((hooks as any[]) || []) as any[];

  return (
    <div>
      <PageTitle>Plugins</PageTitle>

      <SectionLabel>Installed</SectionLabel>
      <SettingCard>
        <SettingRow
          title="Install plugin"
          description="Add a hook from a local folder that can observe terminals and emit UI intents."
          control={
            <Button
              size="sm"
              variant="secondary"
              className="h-8 rounded-lg text-[12.5px]"
              onClick={async () => {
                const path = await PickHookFolder();
                if (!path) return;
                await InstallHook(path);
                invalidateQuery(["hooks"]);
                await refetch();
                toast.success("Plugin installed");
              }}
            >
              Install from folder
            </Button>
          }
        />
      </SettingCard>

      <div className="mt-6 space-y-4">
        {list.map((h: any) => (
          <div key={h.manifest.id}>
            <SectionLabel>{h.manifest.name}</SectionLabel>
            <SettingCard>
              <SettingRow
                title={h.manifest.name}
                description={
                  <>
                    {h.manifest.description}
                    <span className="mt-1 block text-[11px] opacity-80">
                      {h.manifest.id} · v{h.manifest.version}
                    </span>
                  </>
                }
                control={
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={h.enabled}
                      onCheckedChange={async (v) => {
                        await SetHookEnabled(h.manifest.id, v);
                        invalidateQuery(["hooks"]);
                        await refetch();
                      }}
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-[12.5px] text-muted-foreground"
                      onClick={async () => {
                        await UninstallHook(h.manifest.id);
                        invalidateQuery(["hooks"]);
                        await refetch();
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                }
              />
              {(
                [
                  ["readOutput", "Read output", "Allow reading terminal scrollback and live output."],
                  ["writePty", "Write PTY", "Allow sending input to the terminal."],
                  ["notify", "Notify", "Allow showing notifications."],
                  ["animate", "Animate", "Allow pane attention animations."],
                  ["network", "Network", "Allow network access from the hook."],
                ] as const
              ).map(([key, label, desc]) => (
                <SettingRow
                  key={key}
                  title={label}
                  description={desc}
                  control={
                    <Switch
                      checked={!!(h.granted as any)[key]}
                      onCheckedChange={async (v) => {
                        const granted = { ...h.granted, [key]: v };
                        await SetHookPermissions(h.manifest.id, granted);
                        invalidateQuery(["hooks"]);
                        await refetch();
                      }}
                    />
                  }
                />
              ))}
            </SettingCard>
          </div>
        ))}

        {list.length === 0 && (
          <p className="px-0.5 text-[13px] text-muted-foreground">No plugins installed yet.</p>
        )}
      </div>
    </div>
  );
}
