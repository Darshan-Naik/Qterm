import { spawn } from "node:child_process";
import { normalizeMaintainer } from "./model.mjs";

export class GhError extends Error {
  constructor(message) {
    super(message);
    this.name = "GhError";
  }
}

export function isPermissionError(error) {
  return /\b(403|401|Resource not accessible|must have admin|not accessible by integration)\b/i.test(String(error?.message || error));
}

export function runGh(args, { input, env = process.env } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn("gh", args, { env });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) reject(new GhError((stderr || stdout || `gh exited ${code}`).trim()));
      else resolve(stdout);
    });
    child.stdin.end(input ?? "");
  });
}

export async function ghJson(args, options) {
  const stdout = await runGh(args, options);
  return JSON.parse(stdout);
}

export async function githubApiGet(pathname) {
  const headers = {
    accept: "application/vnd.github+json",
    "user-agent": "qterm-contributors",
    "x-github-api-version": "2022-11-28",
  };
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (token) headers.authorization = `Bearer ${token}`;
  const response = await fetch(`https://api.github.com/${pathname}`, { headers });
  if (!response.ok) {
    throw new GhError(`GitHub ${pathname} returned ${response.status}`);
  }
  return response.json();
}

export async function fetchMaintainerProfiles(repo, config, { get = githubApiGet } = {}) {
  const logins = [];
  const add = (login) => {
    const name = String(login || "").trim();
    if (!name) return;
    if (logins.some((item) => item.toLowerCase() === name.toLowerCase())) return;
    logins.push(name);
  };
  add(config?.maintainer);
  const repository = await get(`repos/${repo}`);
  const owner = repository?.owner;
  if (owner?.login && owner.type !== "Bot") add(owner.login);

  const profiles = [];
  for (const login of logins) {
    const user = await get(`users/${encodeURIComponent(login)}`);
    const profile = normalizeMaintainer(user);
    if (profile) profiles.push(profile);
  }
  if (config?.maintainer && profiles.length === 0) {
    throw new GhError(`GitHub did not return a profile for ${config.maintainer}.`);
  }
  return profiles;
}

export async function listMergedPulls(repo, { maxPages = 20, gh = ghJson } = {}) {
  const pulls = [];
  for (let page = 1; page <= maxPages; page++) {
    const batch = await gh([
      "api",
      `repos/${repo}/pulls?state=closed&sort=updated&direction=desc&per_page=100&page=${page}`,
    ]);
    if (!Array.isArray(batch)) throw new GhError("Unexpected pull request list from GitHub");
    for (const pull of batch) {
      const normalized = normalizePull(pull);
      if (normalized) pulls.push(normalized);
    }
    if (batch.length < 100) return { pulls, complete: true };
  }
  return { pulls, complete: false };
}

export function normalizePull(pull) {
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

export async function listCommentBodies(repo, number, { gh = ghJson } = {}) {
  const bodies = [];
  for (let page = 1; page <= 10; page++) {
    const batch = await gh(["api", `repos/${repo}/issues/${number}/comments?per_page=100&page=${page}`]);
    if (!Array.isArray(batch)) throw new GhError("Unexpected comment list from GitHub");
    for (const comment of batch) bodies.push(comment.body || "");
    if (batch.length < 100) break;
  }
  return bodies;
}

export async function postComment(repo, number, body, { gh = runGh } = {}) {
  await gh(["api", "--method", "POST", `repos/${repo}/issues/${number}/comments`, "--input", "-"], {
    input: JSON.stringify({ body }),
  });
}

export async function addLabels(repo, number, labels, { gh = runGh } = {}) {
  if (!labels.length) return;
  await gh(["api", "--method", "POST", `repos/${repo}/issues/${number}/labels`, "--input", "-"], {
    input: JSON.stringify({ labels }),
  });
}

export async function listAuthoredItems(repo, login, { gh = ghJson, maxPages = 3 } = {}) {
  const items = [];
  const creator = encodeURIComponent(login);
  for (let page = 1; page <= maxPages; page++) {
    const batch = await gh([
      "api",
      `repos/${repo}/issues?creator=${creator}&state=all&per_page=100&page=${page}`,
    ]);
    if (!Array.isArray(batch)) throw new GhError("Unexpected issue list from GitHub");
    items.push(...batch);
    if (batch.length < 100) break;
  }
  return items;
}

export async function listLabels(repo, { gh = ghJson } = {}) {
  const labels = [];
  for (let page = 1; page <= 10; page++) {
    const batch = await gh(["api", `repos/${repo}/labels?per_page=100&page=${page}`]);
    if (!Array.isArray(batch)) throw new GhError("Unexpected label list from GitHub");
    labels.push(...batch);
    if (batch.length < 100) break;
  }
  return labels;
}

export async function createLabel(repo, label, { gh = runGh } = {}) {
  await gh(["api", "--method", "POST", `repos/${repo}/labels`, "--input", "-"], {
    input: JSON.stringify({
      name: label.name,
      color: label.color,
      description: label.description,
    }),
  });
}

export function normalizeEvent(eventName, event) {
  if (eventName === "pull_request_target" || eventName === "pull_request") {
    const pull = event.pull_request;
    if (!pull) return null;
    if (event.action === "opened" || event.action === "reopened") return basePull(pull, "pr_opened");
    if (event.action === "closed" && pull.merged) return basePull(pull, "pr_merged");
    return null;
  }
  if (eventName === "pull_request_review") {
    if (event.review?.state !== "approved") return null;
    const pull = event.pull_request;
    if (!pull) return null;
    return {
      ...basePull(pull, "pr_approved"),
      reviewerAssociation: event.review.author_association || "",
      reviewerLogin: event.review.user?.login || "",
    };
  }
  if (eventName === "issues") {
    if (event.action !== "opened") return null;
    const issue = event.issue;
    if (!issue || issue.pull_request) return null;
    return {
      kind: "issue_opened",
      login: issue.user?.login || "",
      userType: issue.user?.type || "User",
      number: issue.number,
      title: issue.title || "",
      url: issue.html_url || "",
      labels: labelNames(issue.labels),
      isFork: false,
    };
  }
  return null;
}

function basePull(pull, kind) {
  const headRepo = pull.head?.repo?.full_name || "";
  const baseRepo = pull.base?.repo?.full_name || "";
  return {
    kind,
    login: pull.user?.login || "",
    userType: pull.user?.type || "User",
    number: pull.number,
    title: pull.title || "",
    url: pull.html_url || "",
    labels: labelNames(pull.labels),
    isFork: Boolean(headRepo && baseRepo && headRepo !== baseRepo),
    mergedAt: pull.merged_at || null,
  };
}

function labelNames(labels) {
  return (labels || []).map((label) => (typeof label === "string" ? label : label?.name)).filter(Boolean);
}
