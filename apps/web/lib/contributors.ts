import data from "@/data/contributors.json";

export type ContributorBadge = {
  id: string;
  emoji: string;
  label: string;
};

export type Contribution = {
  pr: number;
  title: string;
  url: string;
  category: string;
  mergedAt: string;
};

export type Contributor = {
  username: string;
  avatarUrl: string;
  profileUrl: string;
  firstContribution: string;
  lastContribution: string;
  mergedPRs: number;
  contributions: Contribution[];
  badges: ContributorBadge[];
};

export type ContributorCategoryStat = {
  id: string;
  label: string;
  count: number;
};

export type ContributorData = {
  generatedAt?: string | null;
  repo: string;
  siteUrl: string;
  maintainer: string;
  stats: {
    contributors: number;
    contributions: number;
    categories: ContributorCategoryStat[];
  };
  contributors: Contributor[];
};

export function contributorData(): ContributorData {
  return data as ContributorData;
}

export function findContributor(username: string) {
  const key = username.toLowerCase();
  return contributorData().contributors.find((person) => person.username.toLowerCase() === key) ?? null;
}

export function repoUrl(source: ContributorData = contributorData()) {
  return `https://github.com/${source.repo}`;
}

export function contributorPath(username: string) {
  return `/contributors/${username}`;
}

export function contributorCardPath(username: string) {
  return `/contributors/card/${username}`;
}
