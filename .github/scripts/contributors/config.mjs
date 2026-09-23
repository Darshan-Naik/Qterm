import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseSimpleYaml } from "./yaml.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));

export const repoRoot = path.resolve(here, "../../..");
export const configPath = path.join(repoRoot, ".github", "qterm-contributors.yml");

const DEFAULT_COUNT_BADGES = [
  { id: "first-contribution", emoji: "🌱", label: "First Contribution", merged_prs: 1 },
  { id: "builder", emoji: "🔨", label: "Builder", merged_prs: 3 },
  { id: "regular-contributor", emoji: "🚀", label: "Regular Contributor", merged_prs: 5 },
  { id: "core-community", emoji: "⭐", label: "Core Community Contributor", merged_prs: 10 },
];

const DEFAULT_CATEGORIES = [
  {
    id: "feature",
    stat: "Features",
    badge: "Feature Contributor",
    emoji: "🚀",
    labels: ["contribution:feature", "feature", "enhancement"],
  },
  {
    id: "bug",
    stat: "Bug Fixes",
    badge: "Bug Hunter",
    emoji: "🐛",
    labels: ["contribution:bug", "bug"],
  },
  {
    id: "documentation",
    stat: "Documentation",
    badge: "Documentation Contributor",
    emoji: "📚",
    labels: ["contribution:documentation", "documentation", "docs"],
  },
  {
    id: "testing",
    stat: "Tests",
    badge: "Testing Contributor",
    emoji: "🧪",
    labels: ["contribution:testing", "testing", "tests"],
  },
  {
    id: "performance",
    stat: "Performance",
    badge: "Performance Contributor",
    emoji: "⚡",
    labels: ["contribution:performance", "performance"],
  },
  {
    id: "ui",
    stat: "UI",
    badge: "UI Contributor",
    emoji: "🎨",
    labels: ["contribution:ui", "ui", "design"],
  },
  {
    id: "accessibility",
    stat: "Accessibility",
    badge: "Accessibility Contributor",
    emoji: "♿",
    labels: ["contribution:accessibility", "accessibility", "a11y"],
  },
  {
    id: "tooling",
    stat: "Tooling",
    badge: "Tooling Contributor",
    emoji: "🛠️",
    labels: ["contribution:tooling", "tooling"],
  },
  {
    id: "security",
    stat: "Security",
    badge: "Security Contributor",
    emoji: "🔐",
    labels: ["contribution:security", "security"],
  },
  {
    id: "community",
    stat: "Community",
    badge: "Community Contributor",
    emoji: "🤝",
    labels: ["contribution:community", "community"],
  },
];

export function loadConfigText(text) {
  const raw = parseSimpleYaml(text);
  return normalizeConfig(raw);
}

export function loadConfig(file = configPath) {
  return loadConfigText(fs.readFileSync(file, "utf8"));
}

export function normalizeConfig(raw) {
  const recognition = raw.recognition || {};
  const social = raw.social || {};
  const badges = raw.badges || {};
  const milestones = raw.milestones || {};
  const countBadges = Array.isArray(raw.count_badges) && raw.count_badges.length
    ? raw.count_badges.map(normalizeCountBadge)
    : DEFAULT_COUNT_BADGES.map((badge) => ({ ...badge }));

  applyMilestoneOverrides(countBadges, milestones);

  const categories = Array.isArray(raw.categories) && raw.categories.length
    ? raw.categories.map(normalizeCategory)
    : DEFAULT_CATEGORIES.map((category) => ({ ...category, labels: [...category.labels] }));

  const repo = requiredString(raw.repo, "Darshan-Naik/Qterm", "repo");
  const siteUrl = String(raw.site_url || "https://qterm.darshannaik.com").replace(/\/$/, "");
  const maintainer = requiredString(raw.maintainer, "Darshan-Naik", "maintainer");

  return {
    repo,
    siteUrl,
    maintainer,
    bots: stringList(raw.bots, [
      "dependabot[bot]",
      "dependabot",
      "renovate[bot]",
      "github-actions[bot]",
    ]),
    quietLogins: stringList(raw.quiet_logins, [maintainer]),
    recognition: {
      firstPr: bool(recognition.first_pr, true),
      returningPr: bool(recognition.returning_pr, false),
      approval: bool(recognition.approval, false),
      merge: bool(recognition.merge, true),
      firstMerge: bool(recognition.first_merge, true),
      issueWelcome: bool(recognition.issue_welcome, true),
    },
    issueMinTitleLength: numberValue(raw.issue_min_title_length, 8),
    countBadges: countBadges
      .filter((badge) => badge.enabled)
      .sort((a, b) => a.mergedPrs - b.mergedPrs || a.id.localeCompare(b.id)),
    categoryBadges: bool(badges.category, true),
    categories,
    social: {
      generateCard: bool(social.generate_card, true),
    },
    labels: Array.isArray(raw.labels) ? raw.labels.map(normalizeLabel) : [],
  };
}

function applyMilestoneOverrides(countBadges, milestones) {
  const overrides = [
    ["builder", milestones.builder],
    ["regular-contributor", milestones.regular],
    ["core-community", milestones.community],
  ];
  for (const [id, value] of overrides) {
    if (value == null || value === "") continue;
    const badge = countBadges.find((item) => item.id === id);
    if (badge) badge.mergedPrs = numberValue(value, badge.mergedPrs);
  }
}

function normalizeCountBadge(badge) {
  if (!badge || typeof badge !== "object") {
    throw new Error("Each count_badges entry must be a map");
  }
  return {
    id: requiredString(badge.id, "", "count badge id"),
    emoji: requiredString(badge.emoji, "", "count badge emoji"),
    label: requiredString(badge.label, "", "count badge label"),
    mergedPrs: numberValue(badge.merged_prs, 1),
    enabled: badge.enabled !== false,
  };
}

function normalizeCategory(category) {
  if (!category || typeof category !== "object") {
    throw new Error("Each categories entry must be a map");
  }
  return {
    id: requiredString(category.id, "", "category id"),
    stat: requiredString(category.stat, "", "category stat"),
    badge: category.badge ? String(category.badge) : "",
    emoji: category.emoji ? String(category.emoji) : "",
    labels: stringList(category.labels, []),
    enabled: category.enabled !== false,
  };
}

function normalizeLabel(label) {
  if (!label || typeof label !== "object") throw new Error("Each labels entry must be a map");
  return {
    name: requiredString(label.name, "", "label name"),
    color: String(label.color || "ededed").replace(/^#/, ""),
    description: String(label.description || ""),
  };
}

function stringList(value, fallback) {
  if (!Array.isArray(value)) return [...fallback];
  return value.map((item) => String(item));
}

function bool(value, fallback) {
  if (typeof value === "boolean") return value;
  return fallback;
}

function numberValue(value, fallback) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return fallback;
}

function requiredString(value, fallback, name) {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (fallback) return fallback;
  throw new Error(`Missing ${name} in contributor config`);
}

export function repoWebUrl(config) {
  return `https://github.com/${config.repo}`;
}
