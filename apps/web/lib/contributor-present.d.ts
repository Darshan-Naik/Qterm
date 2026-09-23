export function escapeXml(value: string): string;
export function monthYear(isoDate: string): string;
export function shortMonth(isoDate: string): string;
export function contributionCountLabel(count: number): string;
export function firstContributionShareText(input: { maintainer: string; repoUrl: string }): string;
export function tweetIntentUrl(text: string): string;
export function renderContributorCard(input: {
  username: string;
  mergedPRs: number;
  firstContribution: string;
  repoPath: string;
}): string;
