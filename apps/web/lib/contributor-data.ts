import fs from "node:fs";
import path from "node:path";
import { cache } from "react";
import { loadConfigText, normalizeConfig } from "../../../.github/scripts/contributors/config.mjs";
import { aggregateContributors, normalizeMaintainer } from "../../../.github/scripts/contributors/model.mjs";
import type { ContributorData, Maintainer } from "./contributors";
import { SITE } from "./site";

/** Half a day. The contributors page is server-rendered, so GitHub answers live here. */
export const CONTRIBUTOR_CACHE_SECONDS = 60 * 60 * 12;

type GithubUser = {
  login?: string;
  type?: string;
  name?: string | null;
  avatar_url?: string | null;
  html_url?: string | null;
  bio?: string | null;
  blog?: string | null;
  company?: string | null;
  location?: string | null;
  twitter_username?: string | null;
  created_at?: string | null;
};

type GithubPull = {
  number?: number;
  title?: string;
  html_url?: string;
  merged_at?: string | null;
  user?: { login?: string; type?: string } | null;
  labels?: { name?: string }[];
};

type GithubRepo = {
  owner?: { login?: string; type?: string };
};

function githubHeaders() {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "qterm-web",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function githubGet<T>(pathname: string): Promise<T> {
  const response = await fetch(`https://api.github.com/${pathname}`, {
    headers: githubHeaders(),
    next: { revalidate: CONTRIBUTOR_CACHE_SECONDS },
  });
  if (!response.ok) {
    throw new Error(`GitHub ${pathname} returned ${response.status}`);
  }
  return response.json() as Promise<T>;
}

function recognitionConfig() {
  const candidates = [
    path.join(process.cwd(), ".github", "qterm-contributors.yml"),
    path.join(process.cwd(), "..", "..", ".github", "qterm-contributors.yml"),
    path.join(process.cwd(), "..", ".github", "qterm-contributors.yml"),
  ];
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    return loadConfigText(fs.readFileSync(file, "utf8"));
  }
  return normalizeConfig({ repo: SITE.repo, site_url: SITE.url });
}

function normalizePull(pull: GithubPull) {
  if (!pull?.merged_at || !pull.user?.login) return null;
  return {
    number: pull.number,
    title: pull.title || "",
    url: pull.html_url || "",
    mergedAt: pull.merged_at,
    login: pull.user.login,
    userType: pull.user.type || "User",
    labels: (pull.labels || []).map((label) => label?.name).filter(Boolean),
  };
}

async function listMergedPulls(repo: string) {
  const pulls = [];
  for (let page = 1; page <= 20; page++) {
    const batch = await githubGet<GithubPull[]>(
      `repos/${repo}/pulls?state=closed&sort=updated&direction=desc&per_page=100&page=${page}`,
    );
    if (!Array.isArray(batch)) throw new Error("Unexpected pull request list from GitHub");
    for (const pull of batch) {
      const normalized = normalizePull(pull);
      if (normalized) pulls.push(normalized);
    }
    if (batch.length < 100) break;
  }
  return pulls;
}

async function fetchMaintainers(repo: string, maintainerLogin: string) {
  const logins: string[] = [];
  const add = (login?: string) => {
    const name = String(login || "").trim();
    if (!name) return;
    if (logins.some((item) => item.toLowerCase() === name.toLowerCase())) return;
    logins.push(name);
  };
  add(maintainerLogin);
  const repository = await githubGet<GithubRepo>(`repos/${repo}`);
  if (repository.owner?.type !== "Bot") add(repository.owner?.login);

  const profiles: Maintainer[] = [];
  for (const login of logins) {
    const user = await githubGet<GithubUser>(`users/${encodeURIComponent(login)}`);
    const profile = normalizeMaintainer(user) as Maintainer | null;
    if (profile) profiles.push(profile);
  }
  return profiles;
}

async function loadContributorData(): Promise<ContributorData> {
  const config = recognitionConfig();
  const [pulls, maintainers] = await Promise.all([
    listMergedPulls(config.repo),
    fetchMaintainers(config.repo, config.maintainer),
  ]);
  const latest = pulls.reduce((newest, pull) => (pull.mergedAt > newest ? pull.mergedAt : newest), "");
  const data = aggregateContributors(pulls, config, { generatedAt: latest || null } as never) as ContributorData;
  data.maintainers = maintainers;
  await attachContributorNames(data.contributors);
  return data;
}

async function attachContributorNames(contributors: ContributorData["contributors"]) {
  await Promise.all(
    contributors.map(async (person) => {
      try {
        const user = await githubGet<GithubUser>(`users/${encodeURIComponent(person.username)}`);
        const profile = normalizeMaintainer(user) as Maintainer | null;
        if (!profile) return;
        if (profile.name) person.name = profile.name;
        if (profile.avatarUrl) person.avatarUrl = profile.avatarUrl;
        if (profile.blog) person.blog = profile.blog;
        if (profile.twitter) person.twitter = profile.twitter;
      } catch {
        // The card still has the login from the pull request.
      }
    }),
  );
}

export const getContributorData = cache(loadContributorData);
