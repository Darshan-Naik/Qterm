import { resetAllKeybindings, useUI } from "@/store/ui";
import { SHORTCUT_GROUPS, SHORTCUT_META } from "@/lib/shortcuts";
import { SectionLabel } from "../ui/SectionLabel";
import { SettingCard } from "../ui/SettingCard";
import { ShortcutRow } from "./ShortcutRow";

export function ShortcutsPage() {
  const keybindings = useUI((s) => s.keybindings);
  const hasCustom = Object.keys(keybindings).length > 0;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-[18px] font-medium tracking-tight">Keyboard shortcuts</h1>
        {hasCustom && (
          <button
            type="button"
            className="shrink-0 text-[12px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            onClick={() => void resetAllKeybindings()}
          >
            Reset all
          </button>
        )}
      </div>

      {SHORTCUT_GROUPS.map((group) => {
        const items = SHORTCUT_META.filter((s) => s.group === group);
        return (
          <div key={group} className="mb-6 last:mb-0">
            <SectionLabel>{group}</SectionLabel>
            <SettingCard>
              {items.map((s) => (
                <ShortcutRow key={s.id} id={s.id} label={s.label} description={s.description} />
              ))}
            </SettingCard>
          </div>
        );
      })}
    </div>
  );
}
