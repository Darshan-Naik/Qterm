import { Switch } from "@/components/ui/switch";
import { setSidebarFooterItem, useUI, type SidebarFooterId } from "@/store/ui";
import { SettingCard } from "./SettingCard";
import { SettingRow } from "./SettingRow";

const ITEMS: { id: SidebarFooterId; title: string; description: string }[] = [
  {
    id: "settings",
    title: "Settings",
    description: "Gear icon to open Settings.",
  },
  {
    id: "agent",
    title: "Agent sessions",
    description: "Resume connected CLI sessions. Hidden until a CLI is connected.",
  },
  {
    id: "theme",
    title: "Theme",
    description: "Switch light, dark, or system appearance.",
  },
  {
    id: "palette",
    title: "Command palette",
    description: "Open the command palette.",
  },
];

export function SidebarFooterSettings() {
  const footer = useUI((s) => s.sidebarFooter);

  return (
    <SettingCard>
      {ITEMS.map((item) => (
        <SettingRow
          key={item.id}
          title={item.title}
          description={item.description}
          control={
            <Switch
              checked={footer.includes(item.id)}
              onCheckedChange={(on) => setSidebarFooterItem(item.id, on)}
            />
          }
        />
      ))}
    </SettingCard>
  );
}
