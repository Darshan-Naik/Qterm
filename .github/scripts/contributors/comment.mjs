/**
 * Post Qterm contributor comments.
 * Reads the GitHub event from disk. Does not execute pull request code.
 *
 *   GITHUB_EVENT_NAME=pull_request_target GITHUB_EVENT_PATH=event.json \
 *     GITHUB_REPOSITORY=Darshan-Naik/Qterm node .github/scripts/contributors/comment.mjs
 *
 * DRY_RUN=1 prints the plan and does not comment.
 */
import fs from "node:fs";
import { loadConfig } from "./config.mjs";
import {
  addLabels,
  isPermissionError,
  listAuthoredItems,
  listCommentBodies,
  listMergedPulls,
  normalizeEvent,
  postComment,
} from "./github.mjs";
import { hasMarker, planRecognition } from "./messages.mjs";

export async function recognize({
  eventName,
  event,
  repo,
  config = loadConfig(),
  dryRun = false,
  github = {},
} = {}) {
  const normalized = normalizeEvent(eventName, event);
  if (!normalized) return { skipped: "ignored-event", plan: null };

  const listPulls = github.listMergedPulls || listMergedPulls;
  const listComments = github.listCommentBodies || listCommentBodies;
  const listItems = github.listAuthoredItems || listAuthoredItems;
  const comment = github.postComment || postComment;
  const label = github.addLabels || addLabels;

  const commentBodies = await listComments(repo, normalized.number);
  let previousPulls = [];
  let historyComplete = true;
  let alreadyWelcomed = false;
  let otherIssueCount = 0;

  if (normalized.kind === "pr_opened" || normalized.kind === "pr_merged") {
    const history = await listPulls(repo);
    historyComplete = history.complete;
    previousPulls = history.pulls.filter(
      (pull) => pull.login.toLowerCase() === normalized.login.toLowerCase() && pull.number !== normalized.number,
    );
  }

  if (normalized.kind === "pr_opened" && previousPulls.length === 0) {
    alreadyWelcomed = await authoredMarker(repo, normalized, "qterm-contributor-bot:first-pr", listItems, listComments);
  }

  if (normalized.kind === "issue_opened") {
    const items = await listItems(repo, normalized.login);
    otherIssueCount = items.filter((item) => item.number !== normalized.number && !item.pull_request).length;
  }

  const plan = planRecognition({
    event: normalized,
    config,
    previousPulls,
    commentBodies,
    alreadyWelcomed,
    otherIssueCount,
    historyComplete,
  });

  if (dryRun) return { skipped: null, plan, posted: [], labeled: [] };

  const posted = [];
  for (const entry of plan.comments) {
    const fresh = await listComments(repo, normalized.number);
    if (hasMarker(fresh, entry.marker)) continue;
    try {
      await comment(repo, normalized.number, entry.body);
      posted.push(entry.marker);
    } catch (error) {
      if (isPermissionError(error) && normalized.isFork) {
        console.error(`Skipping comment on fork ${normalized.kind} #${normalized.number}: token cannot write.`);
        return { skipped: "fork-permission", plan, posted, labeled: [] };
      }
      throw error;
    }
  }

  let labeled = [];
  if (plan.labels.length) {
    try {
      await label(repo, normalized.number, plan.labels);
      labeled = plan.labels;
    } catch (error) {
      console.error(`Could not add labels (${plan.labels.join(", ")}): ${error.message}`);
    }
  }

  return { skipped: null, plan, posted, labeled };
}

async function authoredMarker(repo, event, marker, listItems, listComments) {
  const items = await listItems(repo, event.login);
  const others = items.filter((item) => item.number !== event.number && item.pull_request).slice(0, 20);
  for (const item of others) {
    const bodies = await listComments(repo, item.number);
    if (hasMarker(bodies, marker)) return true;
  }
  return false;
}

async function main() {
  const eventName = process.env.GITHUB_EVENT_NAME || "";
  const eventPath = process.env.GITHUB_EVENT_PATH || "";
  const repo = process.env.GITHUB_REPOSITORY || "";
  if (!eventName || !eventPath || !repo) {
    console.error("GITHUB_EVENT_NAME, GITHUB_EVENT_PATH, and GITHUB_REPOSITORY are required.");
    process.exit(1);
  }
  const event = JSON.parse(fs.readFileSync(eventPath, "utf8"));
  const result = await recognize({
    eventName,
    event,
    repo,
    dryRun: process.env.DRY_RUN === "1",
  });
  console.log(JSON.stringify({ skipped: result.skipped, reason: result.plan?.reason || null, posted: result.posted || [] }));
}

const invoked = process.argv[1] && process.argv[1].endsWith("comment.mjs");
if (invoked) {
  main().catch((error) => {
    console.error(error.message || error);
    process.exit(1);
  });
}
