import { useQuery } from "qortex-query-react";
import { ListProjects, ListSessions, GetGitStatus, GetConfig } from "../../wailsjs/go/main/App";

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
  return useQuery(["git", path || ""], {
    fetcher: () => GetGitStatus(path || ""),
    enabled: !!path,
    staleTime: 10_000,
  });
}

export function useAppConfig() {
  return useQuery(["config"], {
    fetcher: () => GetConfig(),
    staleTime: 10_000,
  });
}
