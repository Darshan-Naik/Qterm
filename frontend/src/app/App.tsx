import { useTrafficInsetVar } from "@/hooks/useTrafficInset";
import { SettingsMode } from "@/features/settings";
import { useUI } from "@/store/ui";
import { AppProviders } from "./AppProviders";
import { useAppBootstrap } from "./useAppBootstrap";
import { useAppHotkeys } from "./useAppHotkeys";
import { WorkspaceLayout } from "./WorkspaceLayout";

export default function App() {
  const appMode = useUI((s) => s.appMode);
  useTrafficInsetVar();
  useAppBootstrap();
  useAppHotkeys();

  return (
    <AppProviders>
      {appMode === "settings" ? <SettingsMode /> : <WorkspaceLayout />}
    </AppProviders>
  );
}
