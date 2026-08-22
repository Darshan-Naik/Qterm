import { useEffect } from "react";
import { invalidateQuery, useQuery } from "qortex-query-react";
import {
  ListProjects,
  ListSessions,
  GetGitStatus,
  GetGitSnapshot,
  ListGitBranches,
  GetConfig,
} from "../../wailsjs/go/main/App";

const gitPaths = new Set<string>();
let focusBound = false;

function ensureGitFocusRefresh() {
  if (focusBound) return;
  focusBound = true;
  window.addEventListener("focus", () => {
    for (const path of gitPaths) invalidateQuery(["git", path]);
  });
}

export function useProjects() {
  return useQuery(["projects"], {
    fetcher: () => ListProjects(),
    staleTime: 5_000,
  });
}

export function useSessions() {
  return useQuery(["sessions"], {
    fetcher: () => ListSessions(),
    staleTime: 1_000,
  });
}

export function useGitStatus(path: string | undefined) {
  useEffect(() => {
    if (!path) return;
    gitPaths.add(path);
    ensureGitFocusRefresh();
    return () => {
      gitPaths.delete(path);
    };
  }, [path]);

  return useQuery(["git", path || ""], {
    fetcher: () => GetGitStatus(path || ""),
    enabled: !!path,
    staleTime: 15_000,
    persist: false,
  });
}

export function useGitSnapshot(path: string | undefined, enabled: boolean) {
  return useQuery(["git-snapshot", path || ""], {
    fetcher: () => GetGitSnapshot(path || ""),
    enabled: !!path && enabled,
    staleTime: 2_000,
    persist: false,
  });
}

export function useGitBranches(path: string | undefined, enabled: boolean) {
  return useQuery(["git-branches", path || ""], {
    fetcher: () => ListGitBranches(path || ""),
    enabled: !!path && enabled,
    staleTime: 5_000,
    persist: false,
  });
}

export function invalidateGit(path: string) {
  if (!path) return;
  invalidateQuery(["git", path]);
  invalidateQuery(["git-snapshot", path]);
  invalidateQuery(["git-branches", path]);
}

export function useAppConfig() {
  return useQuery(["config"], {
    fetcher: () => GetConfig(),
    staleTime: 10_000,
  });
}
