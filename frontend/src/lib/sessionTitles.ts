import { randomTerminalName } from "@/lib/terminalNames";
import type { SessionInfo } from "@/store/types";
import { SetSessionName } from "../../wailsjs/go/main/App";

/** Shell OSC titles: user@host or user@host:path — not Qterm session labels. */
export function looksLikeShellTitle(name: string) {
  return /^[^\s@]+@[^\s@]+/.test(name);
}

type SessionInput = {
  id: string;
  name: string;
  projectId?: string;
  cwd: string;
  pinned?: boolean;
  createdAt?: string;
};

/** Map backend sessions (already start-time sorted). Fix shell OSC titles only. */
export function mapLiveSessions(live: SessionInput[], prev: SessionInfo[] = []): SessionInfo[] {
  const prevById = new Map(prev.map((s) => [s.id, s]));
  const usedNames = prev.map((s) => s.name);

  return live.map((s) => {
    const prior = prevById.get(s.id);
    let name = s.name;
    if (looksLikeShellTitle(name)) {
      name = prior && !looksLikeShellTitle(prior.name) ? prior.name : randomTerminalName(usedNames);
      if (name !== s.name) void SetSessionName(s.id, name);
    }
    usedNames.push(name);
    return {
      id: s.id,
      name,
      projectId: s.projectId || "",
      cwd: s.cwd,
      pinned: s.pinned,
      createdAt: s.createdAt || prior?.createdAt,
    };
  });
}

/** Seed from config.json — sort by createdAt when present. */
export function sortSessionsByStart(sessions: SessionInfo[]): SessionInfo[] {
  return [...sessions].sort((a, b) => {
    const ta = a.createdAt ? Date.parse(a.createdAt) : 0;
    const tb = b.createdAt ? Date.parse(b.createdAt) : 0;
    return ta - tb;
  });
}

export function sortProjectsByAdded<T extends { addedAt?: string }>(projects: T[]): T[] {
  return [...projects].sort((a, b) => {
    const ta = a.addedAt ? Date.parse(a.addedAt) : 0;
    const tb = b.addedAt ? Date.parse(b.addedAt) : 0;
    return ta - tb;
  });
}
