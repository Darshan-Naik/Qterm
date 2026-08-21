import { FolderPlus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uiStore, useUI } from "@/store/ui";
import { createDefaultTerminal } from "@/lib/sessions";
import { sortProjectsByAdded } from "@/lib/sessionTitles";
import { shortcutLabelFor } from "@/lib/shortcuts";
import { AddProject, PickFolder } from "../../../wailsjs/go/main/App";

export async function addProjectFromWorkspace() {
  const path = await PickFolder();
  if (!path) return;
  const p = await AddProject(path, "");
  uiStore.set({
    projects: sortProjectsByAdded([...uiStore.get().projects, p]),
  });
  return p;
}

/** New terminal + Add project — always shown on the open workspace. */
export function WorkspaceActions({ size = "default" }: { size?: "default" | "sm" }) {
  const keybindings = useUI((s) => s.keybindings);
  const newTerminalLabel = shortcutLabelFor("newTerminal", keybindings);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size={size} onClick={() => void createDefaultTerminal()}>
        <Plus className={size === "sm" ? "size-3.5" : "size-4"} />
        New terminal
        <span className="text-[10px] tabular-nums opacity-70">{newTerminalLabel}</span>
      </Button>
      <Button size={size} variant="outline" onClick={() => void addProjectFromWorkspace()}>
        <FolderPlus className={size === "sm" ? "size-3.5" : "size-4"} />
        Add project
      </Button>
    </div>
  );
}
