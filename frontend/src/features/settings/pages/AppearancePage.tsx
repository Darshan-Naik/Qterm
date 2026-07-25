import {
  applyTheme,
  persistUIPrefs,
  setUiZoom,
  UI_ZOOM_MAX,
  UI_ZOOM_MIN,
  uiStore,
  useUI,
  type ThemeMode,
} from "@/store/ui";
import { SaveTheme } from "../../../../wailsjs/go/main/App";
import { PageTitle } from "../ui/PageTitle";
import { SectionLabel } from "../ui/SectionLabel";
import { SettingCard } from "../ui/SettingCard";
import { SettingRow } from "../ui/SettingRow";
import { PillSelect } from "../ui/PillSelect";
import { Input } from "@/components/ui/input";

export function AppearancePage() {
  const theme = useUI((s) => s.theme);
  const uiZoom = useUI((s) => s.uiZoom);

  return (
    <div>
      <PageTitle>Appearance</PageTitle>
      <SectionLabel>Theme</SectionLabel>
      <SettingCard>
        <SettingRow
          title="Color theme"
          description="Choose light, dark, or follow the system appearance."
          control={
            <PillSelect
              value={theme}
              options={[
                { value: "system", label: "System" },
                { value: "dark", label: "Dark" },
                { value: "light", label: "Light" },
              ]}
              onChange={async (v) => {
                const t = v as ThemeMode;
                uiStore.set({ theme: t });
                applyTheme(t);
                await SaveTheme(t);
                await persistUIPrefs();
              }}
            />
          }
        />
      </SettingCard>

      <div className="mt-6">
        <SectionLabel>Interface</SectionLabel>
        <SettingCard>
          <SettingRow
            title="UI scale"
            description={`Scales the whole app (${UI_ZOOM_MIN}–${UI_ZOOM_MAX}%). ⌘+ / ⌘− to adjust, ⌘0 to reset.`}
            control={
              <Input
                type="number"
                min={UI_ZOOM_MIN}
                max={UI_ZOOM_MAX}
                step={10}
                className="h-8 w-20 rounded-lg border-border/60 bg-secondary/50 text-center text-[12.5px] shadow-none"
                value={uiZoom}
                onChange={(e) => {
                  void setUiZoom(Number(e.target.value));
                }}
              />
            }
          />
        </SettingCard>
      </div>
    </div>
  );
}
