import {
  applyTheme,
  persistUIPrefs,
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

export function AppearancePage() {
  const theme = useUI((s) => s.theme);

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
    </div>
  );
}
