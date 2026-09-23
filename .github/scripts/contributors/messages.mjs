import {
  firstContributionShareText,
  tweetIntentUrl,
} from "../../../apps/web/lib/contributor-present.mjs";
import { repoWebUrl } from "./config.mjs";
import { freshCountBadges, categoryForLabels, isMeaningfulIssueTitle } from "./model.mjs";

export const MARKERS = {
  firstPr: "qterm-contributor-bot:first-pr",
  returningPr: "qterm-contributor-bot:returning-pr",
  approval: "qterm-contributor-bot:approval",
  firstMerge: "qterm-contributor-bot:first-merge",
  merge: "qterm-contributor-bot:merge",
  firstIssue: "qterm-contributor-bot:first-issue",
};

const MAINTAINER_ASSOCIATIONS = new Set(["OWNER", "MEMBER", "COLLABORATOR"]);

export function hasMarker(bodies, marker) {
  const token = `<!-- ${marker} -->`;
  return (bodies || []).some((body) => String(body).includes(token));
}

export function planRecognition({
  event,
  config,
  previousPulls = [],
  commentBodies = [],
  alreadyWelcomed = false,
  otherIssueCount = 0,
  historyComplete = true,
}) {
  if (!event?.login) return emptyPlan("missing-login");
  if (event.userType === "Bot" || isConfiguredBot(event, config)) return emptyPlan("bot");
  if (isQuietLogin(event.login, config)) return emptyPlan("quiet");

  if (event.kind === "pr_opened") return planOpened({ event, config, previousPulls, commentBodies, alreadyWelcomed, historyComplete });
  if (event.kind === "pr_merged") return planMerged({ event, config, previousPulls, commentBodies, historyComplete });
  if (event.kind === "pr_approved") return planApproval({ event, config, commentBodies });
  if (event.kind === "issue_opened") return planIssue({ event, config, commentBodies, otherIssueCount });
  return emptyPlan("ignored-event");
}

function planOpened({ event, config, previousPulls, commentBodies, alreadyWelcomed, historyComplete }) {
  const welcomedHere = hasMarker(commentBodies, MARKERS.firstPr);
  const returningHere = hasMarker(commentBodies, MARKERS.returningPr);
  const knownEarlier = previousPulls.length > 0 || alreadyWelcomed;
  const firstTime = !knownEarlier && (historyComplete || previousPulls.length > 0);

  if (!knownEarlier && !historyComplete) return emptyPlan("incomplete-history");

  const labels = [];
  if (config.recognition.firstPr && firstTime && !hasLabel(event, "first-contribution")) {
    labels.push("first-contribution");
  }

  if (config.recognition.firstPr && firstTime && !welcomedHere) {
    return {
      comments: [{ marker: MARKERS.firstPr, body: firstPrMessage(event.login) }],
      labels,
      reason: "first-pr",
    };
  }

  if (config.recognition.returningPr && knownEarlier && !returningHere && !welcomedHere) {
    return {
      comments: [{ marker: MARKERS.returningPr, body: returningMessage(event.login) }],
      labels,
      reason: "returning-pr",
    };
  }

  return { comments: [], labels, reason: labels.length ? "label-only" : "already-welcomed" };
}

function planMerged({ event, config, previousPulls, commentBodies, historyComplete }) {
  const previousCount = previousPulls.length;
  const uncertainFirst = previousCount === 0 && !historyComplete;
  const isFirst = previousCount === 0 && historyComplete;
  const total = previousCount + 1;
  if (hasMarker(commentBodies, MARKERS.firstMerge) || hasMarker(commentBodies, MARKERS.merge)) {
    return emptyPlan("already-merged-comment");
  }

  const countBadges = freshCountBadges(previousCount, uncertainFirst ? previousCount : total, config);
  const categoryBadge = uncertainFirst ? null : freshCategoryBadge(event, previousPulls, config);
  const achievements = [...countBadges, ...(categoryBadge ? [categoryBadge] : [])];

  if (isFirst && config.recognition.firstMerge) {
    return {
      comments: [{ marker: MARKERS.firstMerge, body: firstMergeMessage({ event, config, achievements }) }],
      labels: [],
      reason: "first-merge",
    };
  }

  if (config.recognition.merge && (!isFirst || !config.recognition.firstMerge)) {
    return {
      comments: [{ marker: MARKERS.merge, body: mergeMessage({ login: event.login, number: event.number, achievements }) }],
      labels: [],
      reason: uncertainFirst ? "merge-history-incomplete" : "merge",
    };
  }

  return emptyPlan("merge-disabled");
}

function planApproval({ event, config, commentBodies }) {
  if (!config.recognition.approval) return emptyPlan("approval-disabled");
  if (!MAINTAINER_ASSOCIATIONS.has(event.reviewerAssociation || "")) return emptyPlan("not-maintainer");
  if (event.reviewerLogin && event.reviewerLogin.toLowerCase() === event.login.toLowerCase()) {
    return emptyPlan("self-approval");
  }
  if (hasMarker(commentBodies, MARKERS.approval)) return emptyPlan("already-approved-comment");
  return {
    comments: [{ marker: MARKERS.approval, body: approvalMessage(event.login) }],
    labels: [],
    reason: "approval",
  };
}

function planIssue({ event, config, commentBodies, otherIssueCount }) {
  if (!config.recognition.issueWelcome) return emptyPlan("issue-disabled");
  if (hasMarker(commentBodies, MARKERS.firstIssue)) return emptyPlan("already-issue-comment");
  if (otherIssueCount > 0) return emptyPlan("not-first-issue");
  if (!isMeaningfulIssueTitle(event.title, config)) return emptyPlan("trivial-issue");
  return {
    comments: [{ marker: MARKERS.firstIssue, body: issueMessage(event.login) }],
    labels: [],
    reason: "first-issue",
  };
}

export function firstPrMessage(login) {
  return `👋 Welcome to Qterm, @${login}!

Thanks for making your first contribution to Qterm.

Whether you're fixing a bug, adding a feature, improving documentation, or making a small improvement, we're glad you're here.

A maintainer will take a look soon.

Thanks for building with us. ❤️${signature(MARKERS.firstPr)}`;
}

export function returningMessage(login) {
  return `🚀 Good to see you back, @${login}!${signature(MARKERS.returningPr)}`;
}

export function approvalMessage(login) {
  return `🚀 This looks good, @${login}!

We're one step closer to getting your contribution into Qterm.${signature(MARKERS.approval)}`;
}

export function firstMergeMessage({ event, config, achievements }) {
  const card = config.social.generateCard
    ? `\n\nYour contributor card is here when you want it:\n${config.siteUrl}/contributors/${event.login}\n\nIf you feel like sharing it, this text is ready to copy:\n\n\`\`\`\n${firstContributionShareText({
        maintainer: config.maintainer,
        repoUrl: repoWebUrl(config),
      })}\n\`\`\`\n\n[Post on X](${tweetIntentUrl(
        firstContributionShareText({ maintainer: config.maintainer, repoUrl: repoWebUrl(config) }),
      )})`
    : "";

  return `🎉 Welcome to the Qterm family, @${event.login}!

Your contribution in #${event.number} has officially landed in Qterm.

You didn't just submit a PR. You helped shape the project.

Thanks for building Qterm with us. ❤️

Welcome aboard! 🚀
${achievementBlock(achievements)}${card}${signature(MARKERS.firstMerge)}`;
}

export function mergeMessage({ login, number, achievements }) {
  return `🚀 Thanks @${login}!

Your contribution in #${number} is now part of Qterm.

Thanks for continuing to build with us. ❤️
${achievementBlock(achievements)}${signature(MARKERS.merge)}`;
}

export function issueMessage(login) {
  return `👋 Thanks for opening your first issue in Qterm, @${login}!

We appreciate you taking the time to report this.

We'll take a look. ❤️${signature(MARKERS.firstIssue)}`;
}

function achievementBlock(achievements) {
  if (!achievements?.length) return "";
  return `\n${achievements.map((badge) => `${badge.emoji} Achievement unlocked: **${badge.label}**`).join("\n")}\n`;
}

function freshCategoryBadge(event, previousPulls, config) {
  if (!config.categoryBadges) return null;
  const current = categoryForLabels(event.labels, config);
  if (!current.badge || current.id === "contribution") return null;
  const seen = previousPulls.some((pull) => categoryForLabels(pull.labels, config).id === current.id);
  if (seen) return null;
  return { id: current.id, emoji: current.emoji, label: current.badge };
}

function signature(marker) {
  return `\n\n<sub>Sent by Qterm bot</sub>\n<!-- ${marker} -->\n`;
}

function hasLabel(event, name) {
  return (event.labels || []).some((label) => String(label).toLowerCase() === name.toLowerCase());
}

function isConfiguredBot(event, config) {
  return config.bots.some((bot) => bot.toLowerCase() === event.login.toLowerCase()) || event.login.toLowerCase().endsWith("[bot]");
}

function isQuietLogin(login, config) {
  return config.quietLogins.some((name) => name.toLowerCase() === login.toLowerCase());
}

function emptyPlan(reason) {
  return { comments: [], labels: [], reason };
}
