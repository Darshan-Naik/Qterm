declare module "../../../.github/scripts/contributors/model.mjs" {
  export function aggregateContributors(
    pulls: unknown[],
    config: {
      repo: string;
      siteUrl: string;
      maintainer: string;
      bots: string[];
      categories: { id: string; stat: string; enabled?: boolean }[];
      countBadges: { id: string; emoji: string; label: string; mergedPrs: number }[];
      categoryBadges: boolean;
    },
    options?: { generatedAt?: string | null },
  ): {
    generatedAt?: string | null;
    repo: string;
    siteUrl: string;
    maintainer: string;
    maintainers?: unknown[];
    stats: {
      contributors: number;
      contributions: number;
      categories: { id: string; label: string; count: number }[];
    };
    contributors: {
      username: string;
      avatarUrl: string;
      profileUrl: string;
      firstContribution: string;
      lastContribution: string;
      mergedPRs: number;
      contributions: {
        pr: number;
        title: string;
        url: string;
        category: string;
        mergedAt: string;
      }[];
      badges: { id: string; emoji: string; label: string }[];
    }[];
  };
  export function normalizeMaintainer(user: unknown): {
    username: string;
    name?: string;
    avatarUrl: string;
    profileUrl: string;
    bio?: string;
    blog?: string;
    company?: string;
    location?: string;
    twitter?: string;
    createdAt?: string;
  } | null;
}

declare module "../../../.github/scripts/contributors/config.mjs" {
  export function loadConfigText(text: string): {
    repo: string;
    siteUrl: string;
    maintainer: string;
    bots: string[];
    categories: { id: string; stat: string; enabled?: boolean }[];
    countBadges: { id: string; emoji: string; label: string; mergedPrs: number }[];
    categoryBadges: boolean;
  };
  export function normalizeConfig(raw: Record<string, unknown>): {
    repo: string;
    siteUrl: string;
    maintainer: string;
    bots: string[];
    categories: { id: string; stat: string; enabled?: boolean }[];
    countBadges: { id: string; emoji: string; label: string; mergedPrs: number }[];
    categoryBadges: boolean;
  };
}
