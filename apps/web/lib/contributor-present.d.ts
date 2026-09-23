export function escapeXml(value: string): string;
export function monthYear(isoDate: string): string;
export function rankedContributors<T extends { username?: string; mergedPRs?: number }>(people: T[]): T[];
export function visibleContributors(data: {
  maintainer?: string;
  maintainers?: { username: string }[];
  contributors?: { username: string }[];
}): { username: string }[];
export function shortMonth(isoDate: string): string;
export function contributionCountLabel(count: number): string;
export function firstContributionShareText(input: { maintainer: string; repoUrl: string }): string;
export function tweetIntentUrl(text: string): string;
export function contributorDisplayName(input?: { name?: string; username?: string }): string;
export function renderContributorCard(input: {
  username: string;
  name?: string;
  mergedPRs: number;
  firstContribution: string;
  repoPath: string;
}): string;
