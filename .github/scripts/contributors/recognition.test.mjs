import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  contributionCountLabel,
  escapeXml,
  contributorDisplayName,
  firstContributionShareText,
  monthYear,
  renderContributorCard,
  shortMonth,
  rankedContributors,
  visibleContributors,
} from "../../../apps/web/lib/contributor-present.mjs";
import { loadConfig, loadConfigText, repoRoot } from "./config.mjs";
import { fetchMaintainerProfiles, normalizeEvent } from "./github.mjs";
import { MARKERS, hasMarker, planRecognition } from "./messages.mjs";
import {
  aggregateContributors,
  categoryForLabels,
  comparablePayload,
  formatReleaseSection,
  freshCountBadges,
  isBot,
  isContributorDataOnlyCommit,
  isMeaningfulIssueTitle,
  isQuiet,
  normalizeMaintainer,
  plainTitle,
  pullsInRelease,
} from "./model.mjs";
import { ensureLabels } from "./labels.mjs";
import { recognize } from "./comment.mjs";
import { syncContributors } from "./sync.mjs";
import { parseSimpleYaml } from "./yaml.mjs";

const config = loadConfig();
const emDash = "\u2014";

function event(overrides = {}) {
  return {
    kind: "pr_opened",
    login: "alex",
    userType: "User",
    number: 142,
    title: "Improve terminal rendering",
    url: "https://github.com/Darshan-Naik/Qterm/pull/142",
    labels: [],
    isFork: false,
    ...overrides,
  };
}

test("config file enables the quiet default journey", () => {
  assert.equal(config.recognition.firstPr, true);
  assert.equal(config.recognition.returningPr, false);
  assert.equal(config.recognition.approval, false);
  assert.equal(config.recognition.merge, true);
  assert.equal(config.recognition.firstMerge, true);
  assert.equal(config.recognition.issueWelcome, true);
  assert.equal(config.social.generateCard, true);
  assert.equal(config.countBadges.find((badge) => badge.id === "builder").mergedPrs, 3);
  assert.equal(config.countBadges.find((badge) => badge.id === "regular-contributor").mergedPrs, 5);
  assert.equal(config.countBadges.find((badge) => badge.id === "core-community").mergedPrs, 10);
  assert.equal(categoryForLabels(["contribution:performance"], config).id, "performance");
  assert.equal(categoryForLabels(["bug"], config).id, "bug");
  assert.equal(categoryForLabels(["nope"], config).id, "contribution");
  assert.equal(categoryForLabels(["bug", "contribution:feature"], config).id, "feature");
});

test("milestone overrides and disabled badges come from config", () => {
  const custom = loadConfigText(`
repo: "Darshan-Naik/Qterm"
maintainer: "Ada"
quiet_logins: []
milestones:
  builder: 4
count_badges:
  - id: builder
    emoji: "🔨"
    label: "Builder"
    merged_prs: 3
  - id: hidden
    emoji: "👻"
    label: "Hidden"
    merged_prs: 1
    enabled: false
badges:
  category: false
`);
  assert.equal(custom.countBadges.find((badge) => badge.id === "builder").mergedPrs, 4);
  assert.equal(custom.countBadges.some((badge) => badge.id === "hidden"), false);
  assert.equal(custom.categoryBadges, false);
  assert.deepEqual(custom.quietLogins, []);
});

test("yaml parser reads maps, lists, and inline lists", () => {
  const parsed = parseSimpleYaml(`
# comment
name: "Qterm"
on_purpose: true
count: 3
empty: []
labels: [contribution:bug, bug]
items:
  - one
nested:
  alpha: yes
people:
  - login: alex
    city: Pune
`);
  assert.equal(parsed.name, "Qterm");
  assert.equal(parsed.on_purpose, true);
  assert.equal(parsed.count, 3);
  assert.deepEqual(parsed.empty, []);
  assert.deepEqual(parsed.labels, ["contribution:bug", "bug"]);
  assert.deepEqual(parsed.items, ["one"]);
  assert.equal(parsed.nested.alpha, "yes");
  assert.equal(parsed.people[0].login, "alex");
  assert.equal(parsed.people[0].city, "Pune");
});

test("bots and quiet logins are filtered differently", () => {
  assert.equal(isBot("dependabot[bot]", "Bot", config), true);
  assert.equal(isBot("renovate[bot]", "User", config), true);
  assert.equal(isBot("alex", "User", config), false);
  assert.equal(isQuiet("Darshan-Naik", config), true);
  assert.equal(isQuiet("alex", config), false);
});

test("aggregate orders by recent contribution and skips bots", () => {
  const data = aggregateContributors(
    [
      pull({ number: 1, login: "ada", mergedAt: "2026-01-01T00:00:00Z", labels: ["bug"] }),
      pull({ number: 2, login: "ada", mergedAt: "2026-02-01T00:00:00Z", labels: ["bug"] }),
      pull({ number: 3, login: "ada", mergedAt: "2026-03-01T00:00:00Z", labels: ["bug"] }),
      pull({ number: 4, login: "ada", mergedAt: "2026-04-01T00:00:00Z" }),
      pull({ number: 5, login: "ada", mergedAt: "2026-05-01T00:00:00Z" }),
      pull({ number: 9, login: "alex", mergedAt: "2026-09-23T00:00:00Z", labels: ["contribution:performance"] }),
      pull({ number: 8, login: "dependabot[bot]", userType: "Bot", mergedAt: "2026-09-24T00:00:00Z" }),
      pull({ number: 7, login: "ghost", mergedAt: null }),
    ],
    config,
  );
  assert.deepEqual(data.contributors.map((person) => person.username), ["alex", "ada"]);
  assert.deepEqual(data.maintainers, []);
  assert.equal(data.stats.contributors, 2);
  assert.equal(data.stats.contributions, 6);
  assert.equal(data.stats.categories.find((category) => category.id === "bug").count, 3);
  assert.equal(data.stats.categories.find((category) => category.id === "performance").count, 1);
  const alex = data.contributors[0];
  assert.equal(alex.mergedPRs, 1);
  assert.equal(alex.firstContribution, "2026-09-23");
  assert.equal(alex.badges.some((badge) => badge.id === "first-contribution"), true);
  assert.equal(alex.badges.some((badge) => badge.id === "performance"), true);
  assert.equal(alex.badges.some((badge) => badge.id === "builder"), false);
  const ada = data.contributors[1];
  assert.equal(ada.mergedPRs, 5);
  assert.equal(ada.badges.some((badge) => badge.id === "regular-contributor"), true);
  assert.equal(ada.badges.some((badge) => badge.id === "core-community"), false);
  assert.equal(ada.badges.filter((badge) => badge.id === "bug").length, 1);
});

test("fresh count badges announce only the newly crossed milestone", () => {
  assert.deepEqual(freshCountBadges(0, 1, config).map((badge) => badge.id), ["first-contribution"]);
  assert.deepEqual(freshCountBadges(2, 3, config).map((badge) => badge.id), ["builder"]);
  assert.deepEqual(freshCountBadges(4, 5, config).map((badge) => badge.id), ["regular-contributor"]);
  assert.deepEqual(freshCountBadges(9, 10, config).map((badge) => badge.id), ["core-community"]);
  assert.deepEqual(freshCountBadges(5, 6, config), []);
});

test("first pull request welcome is once, and returning comments stay off", () => {
  const first = planRecognition({ event: event(), config, historyComplete: true });
  assert.equal(first.reason, "first-pr");
  assert.equal(first.labels[0], "first-contribution");
  assert.match(first.comments[0].body, /Welcome to Qterm, @alex/);
  assert.doesNotMatch(first.comments[0].body, /Sent by Qterm bot/);
  assert.equal(hasMarker([first.comments[0].body], MARKERS.firstPr), true);

  const again = planRecognition({
    event: event(),
    config,
    commentBodies: [first.comments[0].body],
    historyComplete: true,
  });
  assert.equal(again.comments.length, 0);

  const otherPr = planRecognition({
    event: event({ number: 143 }),
    config,
    alreadyWelcomed: true,
    historyComplete: true,
  });
  assert.equal(otherPr.comments.length, 0);

  const returning = planRecognition({
    event: event(),
    config,
    previousPulls: [pull({ number: 1, login: "alex" })],
    historyComplete: true,
  });
  assert.equal(returning.comments.length, 0);
});

test("incomplete history does not invent a first welcome", () => {
  const opened = planRecognition({ event: event(), config, historyComplete: false });
  assert.equal(opened.reason, "incomplete-history");
  const merged = planRecognition({
    event: event({ kind: "pr_merged", labels: ["bug"] }),
    config,
    historyComplete: false,
  });
  assert.equal(merged.reason, "merge-history-incomplete");
  assert.match(merged.comments[0].body, /Thanks @alex/);
  assert.doesNotMatch(merged.comments[0].body, /Qterm family/);
  assert.doesNotMatch(merged.comments[0].body, /Bug Hunter/);
});

test("first merge is the long note and later merges stay short", () => {
  const first = planRecognition({
    event: event({ kind: "pr_merged", labels: ["contribution:performance"] }),
    config,
    historyComplete: true,
  });
  assert.match(first.comments[0].body, /Welcome to the Qterm family, @alex/);
  assert.match(first.comments[0].body, /#142/);
  assert.match(first.comments[0].body, /First Contribution/);
  assert.match(first.comments[0].body, /Performance Contributor/);
  assert.match(first.comments[0].body, /https:\/\/qterm\.darshannaik\.com\/contributors\/alex/);
  assert.match(first.comments[0].body, /My first contribution to Qterm just got merged!/);
  assert.equal(hasMarker([first.comments[0].body], MARKERS.firstMerge), true);
  assert.doesNotMatch(first.comments[0].body, /Sent by Qterm bot/);
  assert.doesNotMatch(first.comments[0].body, new RegExp(emDash));

  const repeat = planRecognition({
    event: event({ kind: "pr_merged" }),
    config,
    commentBodies: [first.comments[0].body],
    historyComplete: true,
  });
  assert.equal(repeat.comments.length, 0);

  const later = planRecognition({
    event: event({ kind: "pr_merged", number: 150 }),
    config,
    previousPulls: [pull({ number: 142 }), pull({ number: 143 })],
    historyComplete: true,
  });
  assert.match(later.comments[0].body, /Thanks @alex/);
  assert.match(later.comments[0].body, /Builder/);
  assert.doesNotMatch(later.comments[0].body, /Welcome to the Qterm family/);
});

test("approval is configurable and only reacts to a maintainer approval", () => {
  assert.equal(
    planRecognition({ event: event({ kind: "pr_approved", reviewerAssociation: "OWNER" }), config }).reason,
    "approval-disabled",
  );
  const enabled = loadConfigText(`
repo: "Darshan-Naik/Qterm"
maintainer: "Darshan-Naik"
recognition:
  approval: true
  first_pr: false
  merge: false
  first_merge: false
  issue_welcome: false
`);
  const approved = planRecognition({
    event: event({ kind: "pr_approved", reviewerAssociation: "MEMBER", reviewerLogin: "ada" }),
    config: enabled,
  });
  assert.match(approved.comments[0].body, /This looks good, @alex/);
  assert.equal(
    planRecognition({
      event: event({ kind: "pr_approved", reviewerAssociation: "CONTRIBUTOR", reviewerLogin: "sam" }),
      config: enabled,
    }).comments.length,
    0,
  );
  assert.equal(
    planRecognition({
      event: event({ kind: "pr_approved", reviewerAssociation: "OWNER", reviewerLogin: "alex" }),
      config: enabled,
    }).reason,
    "self-approval",
  );
  assert.equal(
    planRecognition({
      event: event({ kind: "pr_approved", reviewerAssociation: "OWNER", reviewerLogin: "ada" }),
      config: enabled,
      commentBodies: [approved.comments[0].body],
    }).comments.length,
    0,
  );
});

test("first issue welcome ignores bots, repeats, and placeholders", () => {
  const welcome = planRecognition({
    event: event({ kind: "issue_opened", title: "Terminal stays blank on launch" }),
    config,
    otherIssueCount: 0,
  });
  assert.match(welcome.comments[0].body, /first issue in Qterm, @alex/);
  assert.equal(planRecognition({
    event: event({ kind: "issue_opened", title: "Terminal stays blank on launch" }),
    config,
    otherIssueCount: 1,
  }).comments.length, 0);
  assert.equal(planRecognition({
    event: event({ kind: "issue_opened", title: "test" }),
    config,
  }).reason, "trivial-issue");
  assert.equal(isMeaningfulIssueTitle("Crash", config), false);
  assert.equal(planRecognition({
    event: event({ kind: "issue_opened", title: "App crashes on launch", userType: "Bot", login: "dependabot[bot]" }),
    config,
  }).reason, "bot");
  assert.equal(planRecognition({
    event: event({ kind: "pr_opened", login: "Darshan-Naik" }),
    config,
  }).reason, "quiet");
});

test("recognize does not post a second welcome", async () => {
  const body = planRecognition({ event: event(), config }).comments[0].body;
  const posts = [];
  const result = await recognize({
    eventName: "pull_request_target",
    event: {
      action: "opened",
      pull_request: {
        number: 142,
        title: "Improve terminal rendering",
        html_url: "https://github.com/Darshan-Naik/Qterm/pull/142",
        user: { login: "alex", type: "User" },
        labels: [],
        head: { repo: { full_name: "alex/Qterm" } },
        base: { repo: { full_name: "Darshan-Naik/Qterm" } },
      },
    },
    repo: "Darshan-Naik/Qterm",
    config,
    github: {
      listMergedPulls: async () => ({ pulls: [], complete: true }),
      listCommentBodies: async () => [body],
      listAuthoredItems: async () => [],
      postComment: async (_repo, _number, comment) => posts.push(comment),
      addLabels: async () => {},
    },
  });
  assert.equal(posts.length, 0);
  assert.equal(result.plan.reason, "label-only");
  assert.equal(result.plan.labels.includes("first-contribution"), true);
});

test("events from forks are marked and unmerged closes are ignored", () => {
  const opened = normalizeEvent("pull_request_target", {
    action: "opened",
    pull_request: {
      number: 3,
      title: "Fix docs",
      user: { login: "sam", type: "User" },
      labels: [{ name: "documentation" }],
      head: { repo: { full_name: "sam/Qterm" } },
      base: { repo: { full_name: "Darshan-Naik/Qterm" } },
    },
  });
  assert.equal(opened.kind, "pr_opened");
  assert.equal(opened.isFork, true);
  assert.deepEqual(opened.labels, ["documentation"]);
  assert.equal(normalizeEvent("pull_request_target", {
    action: "closed",
    pull_request: { merged: false, number: 3, user: { login: "sam", type: "User" } },
  }), null);
  assert.equal(normalizeEvent("pull_request_review", {
    action: "submitted",
    review: { state: "changes_requested", author_association: "OWNER", user: { login: "ada" } },
    pull_request: { number: 3, user: { login: "sam", type: "User" } },
  }), null);
});

test("sync writes once and refuses partial history", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "qterm-contributors-"));
  const outputPath = path.join(dir, "contributors.json");
  const pulls = [pull({ number: 9, login: "alex", mergedAt: "2026-09-23T12:00:00Z", labels: ["performance"] })];
  const first = await syncContributors({
    repo: "Darshan-Naik/Qterm",
    config,
    outputPath,
    now: new Date("2026-09-23T12:00:00Z"),
    listPulls: async () => ({ pulls, complete: true }),
    fetchMaintainers: async () => [],
  });
  assert.equal(first.changed, true);
  const written = fs.readFileSync(outputPath, "utf8");
  const second = await syncContributors({
    repo: "Darshan-Naik/Qterm",
    config,
    outputPath,
    now: new Date("2026-09-24T12:00:00Z"),
    listPulls: async () => ({ pulls, complete: true }),
    fetchMaintainers: async () => [],
  });
  assert.equal(second.changed, false);
  assert.equal(fs.readFileSync(outputPath, "utf8"), written);
  assert.equal(comparablePayload(first.data), comparablePayload(second.data));
  await assert.rejects(
    syncContributors({
      repo: "Darshan-Naik/Qterm",
      config,
      outputPath,
      listPulls: async () => ({ pulls: [], complete: false }),
      fetchMaintainers: async () => [],
    }),
    /partial pull request history/,
  );
});

test("maintainer profiles are copied from GitHub and hidden from the people list", async () => {
  const user = {
    login: "Ada",
    type: "User",
    name: "Ada Lovelace",
    avatar_url: "https://avatars.githubusercontent.com/u/1?v=4",
    html_url: "https://github.com/Ada",
    bio: "  Notes from the engine  ",
    blog: "ada.example",
    company: " @Engines ",
    location: " London ",
    twitter_username: "ada",
    created_at: "2021-01-06T04:24:39Z",
  };
  const profile = normalizeMaintainer(user);
  assert.equal(profile.name, "Ada Lovelace");
  assert.equal(profile.bio, "Notes from the engine");
  assert.equal(profile.blog, "https://ada.example");
  assert.equal(profile.company, "@Engines");
  assert.equal(profile.location, "London");
  assert.equal(profile.twitter, "ada");
  assert.equal(normalizeMaintainer({ login: "dependabot[bot]", type: "Bot" }), null);
  assert.equal(normalizeMaintainer({ login: "  ", type: "User" }), null);

  const calls = [];
  const profiles = await fetchMaintainerProfiles("Darshan-Naik/Qterm", { maintainer: "Ada" }, {
    get: async (pathname) => {
      calls.push(pathname);
      if (pathname.startsWith("repos/")) return { owner: { login: "octo", type: "User" } };
      if (pathname === "users/Ada") return user;
      return {
        login: "octo",
        type: "User",
        avatar_url: "https://avatars.githubusercontent.com/u/2?v=4",
        html_url: "https://github.com/octo",
      };
    },
  });
  assert.deepEqual(calls, ["repos/Darshan-Naik/Qterm", "users/Ada", "users/octo"]);
  assert.deepEqual(profiles.map((person) => person.username), ["Ada", "octo"]);
  assert.equal(profiles[1].name, undefined);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "qterm-maintainers-"));
  const outputPath = path.join(dir, "contributors.json");
  const written = await syncContributors({
    repo: "Darshan-Naik/Qterm",
    config,
    outputPath,
    now: new Date("2026-09-23T12:00:00Z"),
    listPulls: async () => ({
      pulls: [
        pull({ number: 1, login: "Ada", mergedAt: "2026-09-01T00:00:00Z" }),
        pull({ number: 2, login: "alex", mergedAt: "2026-09-23T00:00:00Z" }),
      ],
      complete: true,
    }),
    fetchMaintainers: async () => profiles,
  });
  assert.equal(written.data.maintainers[0].bio, "Notes from the engine");
  assert.deepEqual(
    visibleContributors(written.data).map((person) => person.username),
    ["alex"],
  );
  const again = await syncContributors({
    repo: "Darshan-Naik/Qterm",
    config,
    outputPath,
    now: new Date("2026-09-24T12:00:00Z"),
    listPulls: async () => ({
      pulls: [
        pull({ number: 1, login: "Ada", mergedAt: "2026-09-01T00:00:00Z" }),
        pull({ number: 2, login: "alex", mergedAt: "2026-09-23T00:00:00Z" }),
      ],
      complete: true,
    }),
    fetchMaintainers: async () => [{ ...profiles[0], bio: "A newer note" }, profiles[1]],
  });
  assert.equal(again.changed, true);
  assert.equal(again.data.maintainers[0].bio, "A newer note");
});

test("labels are created only when missing", async () => {
  const created = [];
  const result = await ensureLabels({
    repo: "Darshan-Naik/Qterm",
    config,
    list: async () => [{ name: "contribution:bug", color: "000000", description: "kept" }],
    create: async (_repo, label) => created.push(label.name),
  });
  assert.equal(created.includes("contribution:bug"), false);
  assert.equal(created.includes("first-contribution"), true);
  assert.equal(result.includes("contribution:bug"), false);
});

test("release credits are grouped and are not a ranking", () => {
  const section = formatReleaseSection(
    [
      pull({ number: 1, login: "ada", title: "Add splits [click](https://evil.example)", mergedAt: "2026-09-01T00:00:00Z", labels: ["enhancement"] }),
      pull({ number: 2, login: "ada", title: "Another feature", mergedAt: "2026-09-02T00:00:00Z", labels: ["enhancement"] }),
      pull({ number: 3, login: "ada", title: "Third feature", mergedAt: "2026-09-03T00:00:00Z", labels: ["enhancement"] }),
      pull({ number: 4, login: "alex", title: "Fix startup @everyone", mergedAt: "2026-09-23T00:00:00Z", labels: ["bug"] }),
      pull({ number: 5, login: "dependabot[bot]", userType: "Bot", title: "Bump deps", mergedAt: "2026-09-24T00:00:00Z" }),
    ],
    config,
  );
  const ada = section.indexOf("@ada");
  const alex = section.indexOf("@alex");
  assert.ok(alex !== -1 && alex < ada);
  assert.match(section, /### 🚀 Features/);
  assert.match(section, /### 🐛 Bug Fixes/);
  assert.match(section, /Add splits click\(https:\/\/evil\.example\)\. @ada/);
  assert.doesNotMatch(section, /\[click\]/);
  assert.doesNotMatch(section, /@everyone/);
  assert.match(section, /@\u200beveryone/);
  assert.doesNotMatch(section, /3 pull requests|mergedPRs/i);
  assert.equal(formatReleaseSection([pull({ login: "dependabot[bot]", userType: "Bot" })], config), "");
  const since = Date.parse("2026-09-20T00:00:00Z");
  const included = pullsInRelease(
    [
      pull({ number: 4, mergedAt: "2026-09-23T00:00:00Z" }),
      pull({ number: 1, mergedAt: "2026-09-01T00:00:00Z" }),
    ],
    { since, until: Date.parse("2026-09-30T00:00:00Z") },
  );
  assert.deepEqual(included.map((item) => item.number), [4]);
});

test("contributor data commits are detected", () => {
  assert.equal(isContributorDataOnlyCommit({ added: [], modified: ["apps/web/data/contributors.json"], removed: [] }), true);
  assert.equal(isContributorDataOnlyCommit({ added: ["README.md"], modified: ["apps/web/data/contributors.json"], removed: [] }), false);
  assert.equal(isContributorDataOnlyCommit(null), false);
  assert.equal(isContributorDataOnlyCommit({ added: [], modified: [], removed: [] }), false);
});

test("share card escapes text and uses the family wording", async () => {
  const svg = renderContributorCard({
    username: "alex<script>",
    mergedPRs: 1,
    firstContribution: "2026-09-23",
    repoPath: "Darshan-Naik/Qterm",
  });
  assert.match(svg, /Welcome to the family/);
  assert.match(svg, /M12 5a3 3 0 1 0-5\.997\.125/);
  assert.match(svg, /@alex&lt;script&gt;/);
  assert.match(svg, /September 2026/);
  assert.match(svg, /I helped build Qterm/);
  assert.match(svg, /github.com\/Darshan-Naik\/Qterm/);
  assert.doesNotMatch(svg, /<script>/);
  assert.equal(escapeXml(`a&b<c>`), "a&amp;b&lt;c&gt;");
  assert.equal(monthYear("2026-09-23"), "September 2026");
  assert.equal(shortMonth("2026-09-23"), "Sep 2026");
  assert.equal(contributionCountLabel(1), "1 PR merged");
  assert.equal(contributionCountLabel(3), "3 PRs merged");
  const share = firstContributionShareText({ maintainer: "Darshan-Naik", repoUrl: "https://github.com/Darshan-Naik/Qterm" });
  assert.match(share, /Thanks @Darshan-Naik/);
  assert.doesNotMatch(share, new RegExp(emDash));
  const later = renderContributorCard({
    username: "ada",
    mergedPRs: 3,
    firstContribution: "2026-01-02",
    repoPath: "Darshan-Naik/Qterm",
  });
  assert.match(later, /Thanks for building Qterm/);
  assert.match(later, /Qterm family · since January 2026/);
  assert.doesNotMatch(later, /PRs merged/);
  const named = renderContributorCard({
    username: "ada",
    name: "Ada <Lovelace>",
    mergedPRs: 1,
    firstContribution: "2026-09-23",
    repoPath: "Darshan-Naik/Qterm",
  });
  assert.match(named, /Ada &lt;Lovelace&gt;/);
  assert.doesNotMatch(named, /@ada/);
  assert.equal(contributorDisplayName({ name: "  Ada Lovelace  ", username: "ada" }), "Ada Lovelace");
  assert.equal(contributorDisplayName({ username: "ada" }), "@ada");
  assert.equal(contributorDisplayName({ name: "   ", username: "ada" }), "@ada");
  const sharePage = fs.readFileSync(path.join(repoRoot, "apps/web/app/contributors/[username]/page.tsx"), "utf8");
  const cardRoute = fs.readFileSync(path.join(repoRoot, "apps/web/app/contributors/card/[username]/route.ts"), "utf8");
  assert.match(sharePage, /contributorDisplayName/);
  assert.doesNotMatch(sharePage, /@\$\{person\.username\}/);
  assert.match(sharePage, /download=1/);
  assert.match(sharePage, /qterm-\$\{person\.username\}\.png/);
  assert.match(cardRoute, /name: person\.name/);
  assert.match(cardRoute, /image\/png/);
  assert.match(cardRoute, /qterm-\$\{person\.username\}\.png/);
  assert.match(cardRoute, /attachment/);
  const sharp = (await import("sharp")).default;
  const png = await sharp(Buffer.from(named)).png().toBuffer();
  assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
});

test("seeded contributor data does not invent people", () => {
  const seeded = JSON.parse(fs.readFileSync(path.join(repoRoot, "apps/web/data/contributors.json"), "utf8"));
  assert.equal(seeded.stats.contributors, 0);
  assert.equal(seeded.stats.contributions, 0);
  assert.deepEqual(seeded.contributors, []);
  assert.deepEqual(seeded.stats.categories, []);
  assert.deepEqual(seeded.maintainers ?? [], []);
});

test("more merged pull requests sort a person higher", () => {
  const ranked = rankedContributors([
    { username: "ada", mergedPRs: 1 },
    { username: "alex", mergedPRs: 5 },
    { username: "sam", mergedPRs: 5 },
  ]);
  assert.deepEqual(
    ranked.map((person) => person.username),
    ["alex", "sam", "ada"],
  );
});

test("the contributors page loads people from GitHub and caches for half a day", () => {
  const source = fs.readFileSync(path.join(repoRoot, "apps/web/lib/contributor-data.ts"), "utf8");
  const page = fs.readFileSync(path.join(repoRoot, "apps/web/app/contributors/page.tsx"), "utf8");
  const card = fs.readFileSync(path.join(repoRoot, "apps/web/components/MaintainerCard.tsx"), "utf8");
  assert.match(source, /https:\/\/api\.github\.com/);
  assert.match(source, /CONTRIBUTOR_CACHE_SECONDS = 60 \* 60 \* 12/);
  assert.match(source, /revalidate: CONTRIBUTOR_CACHE_SECONDS/);
  for (const file of [
    "apps/web/app/contributors/page.tsx",
    "apps/web/app/contributors/[username]/page.tsx",
    "apps/web/app/contributors/card/[username]/route.ts",
    "apps/web/app/contributors/[username]/opengraph-image.tsx",
  ]) {
    const route = fs.readFileSync(path.join(repoRoot, file), "utf8");
    assert.match(route, /export const revalidate = 43200;/, file);
  }
  assert.doesNotMatch(source, /contributors\.json/);
  assert.match(page, /getContributorData/);
  assert.doesNotMatch(page, /contributors\.json/);
  assert.doesNotMatch(card, /contributors\.json/);
  assert.equal(page.includes("Darshan Naik"), false);
  assert.equal(card.includes("Darshan Naik"), false);
});

test("recognition workflow cannot run pull request code", () => {
  const workflow = fs.readFileSync(path.join(repoRoot, ".github/workflows/contributor-recognition.yml"), "utf8");
  assert.match(workflow, /pull_request_target:/);
  assert.match(workflow, /persist-credentials:\s*false/);
  assert.match(workflow, /github\.event\.repository\.default_branch/);
  assert.match(workflow, /contents:\s*read/);
  assert.doesNotMatch(workflow, /contents:\s*write/);
  assert.doesNotMatch(workflow, /head\.sha|refs\/pull|npm ci|npm test|pull_request:/);
  const sync = fs.readFileSync(path.join(repoRoot, ".github/workflows/contributor-sync.yml"), "utf8");
  assert.match(sync, /contents:\s*write/);
  assert.match(sync, /secrets\.CONTRIBUTOR_SYNC_TOKEN/);
  assert.doesNotMatch(sync, /pull_request_target|npm ci|head\.sha/);
  assert.match(sync, /chore: update contributor recognition data/);
});

test("user-facing recognition copy has no em dash", () => {
  const files = [
    "docs/contributor-recognition.md",
    "CONTRIBUTING.md",
    "README.md",
    "apps/web/app/contributors/page.tsx",
    "apps/web/app/contributors/[username]/page.tsx",
    "apps/web/components/ContributorCard.tsx",
    "apps/web/components/ContributorGlance.tsx",
    "apps/web/components/ContributorGlanceSection.tsx",
    "apps/web/components/ProfileLinks.tsx",
    "apps/web/components/MaintainerCard.tsx",
    "apps/web/components/CopyShareText.tsx",
    "apps/web/lib/contributor-present.mjs",
    ".github/scripts/contributors/messages.mjs",
    ".github/qterm-contributors.yml",
  ];
  for (const file of files) {
    const text = fs.readFileSync(path.join(repoRoot, file), "utf8");
    const matches = text.match(new RegExp(emDash, "g")) || [];
    if (file === "CONTRIBUTING.md") {
      assert.equal(matches.length, 1, "only the existing style rule may name an em dash");
      continue;
    }
    assert.equal(matches.length, 0, file);
  }
});

test("plain titles cannot smuggle markdown links", () => {
  assert.equal(plainTitle("  Hello\nworld  "), "Hello world");
  assert.equal(plainTitle("[click](https://evil.example)"), "click(https://evil.example)");
  assert.equal(plainTitle(""), "Contribution");
});

function pull(overrides = {}) {
  return {
    number: 1,
    title: "Contribution",
    url: "https://github.com/Darshan-Naik/Qterm/pull/1",
    mergedAt: "2026-09-23T00:00:00Z",
    login: "alex",
    userType: "User",
    labels: [],
    ...overrides,
  };
}
