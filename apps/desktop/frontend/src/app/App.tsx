import { useTrafficInsetVar } from "@/hooks/useTrafficInset";
import { Onboarding } from "@/features/onboarding";
import { SettingsMode } from "@/features/settings";
import { useUI } from "@/store/ui";
import { AppProviders } from "./AppProviders";
import { useAppBootstrap } from "./useAppBootstrap";
import { useAppHotkeys } from "./useAppHotkeys";
import { WorkspaceLayout } from "./WorkspaceLayout";

export default function App() {
  const appMode = useUI((s) => s.appMode);
  const uiReady = useUI((s) => s.uiReady);
  useTrafficInsetVar();
  useAppBootstrap();
  useAppHotkeys();

  return (
    <AppProviders>
      {!uiReady ? (
        <div className="h-full w-full bg-background" />
      ) : appMode === "setup" ? (
        <Onboarding />
      ) : appMode === "settings" ? (
        <SettingsMode />
      ) : (
        <WorkspaceLayout />
      )}
    </AppProviders>
  );
}
