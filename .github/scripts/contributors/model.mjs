const TRIVIAL_ISSUE = /^(test|testing|hi|hello|asdf|foo|bar|wip)$/i;

export function isBot(login, userType, config) {
  const name = String(login || "");
  if (!name) return true;
  if (userType === "Bot") return true;
  if (name.toLowerCase().endsWith("[bot]")) return true;
  return config.bots.some((bot) => bot.toLowerCase() === name.toLowerCase());
}

export function isQuiet(login, config) {
  return config.quietLogins.some((name) => name.toLowerCase() === String(login || "").toLowerCase());
}

export function categoryForLabels(labels, config) {
  const names = (labels || []).map((label) => String(label).toLowerCase());
  for (const category of config.categories) {
    if (category.enabled === false) continue;
    if (category.labels.some((label) => names.includes(String(label).toLowerCase()))) {
      return category;
    }
  }
  return { id: "contribution", stat: "", badge: "", emoji: "", labels: [], enabled: true };
}

export function countBadgesFor(mergedPrs, config) {
  return config.countBadges.filter((badge) => mergedPrs >= badge.mergedPrs);
}

export function categoryBadgesFor(contributions, config) {
  if (!config.categoryBadges) return [];
  const seen = new Set();
  const badges = [];
  for (const contribution of contributions) {
    if (!contribution.category || contribution.category === "contribution" || seen.has(contribution.category)) {
      continue;
    }
    seen.add(contribution.category);
    const category = config.categories.find((item) => item.id === contribution.category);
    if (!category || category.enabled === false || !category.badge) continue;
    badges.push({ id: category.id, emoji: category.emoji, label: category.badge });
  }
  return badges;
}

export function badgesFor(contributor, config) {
  return [...countBadgesFor(contributor.mergedPRs, config).map(presentBadge), ...categoryBadgesFor(contributor.contributions, config)];
}

export function presentBadge(badge) {
  return { id: badge.id, emoji: badge.emoji, label: badge.label };
}

function filled(value) {
  const text = String(value ?? "").trim();
  return text || "";
}

function website(value) {
  const text = filled(value);
  if (!text) return "";
  if (/^https?:\/\//i.test(text)) return text;
  return `https://${text}`;
}

export function normalizeMaintainer(user) {
  const login = filled(user?.login);
  if (!login || user?.type === "Bot" || login.toLowerCase().endsWith("[bot]")) return null;
  const profile = {
    username: login,
    avatarUrl: filled(user.avatar_url) || `https://github.com/${login}.png`,
    profileUrl: filled(user.html_url) || `https://github.com/${login}`,
  };
  const name = filled(user.name);
  const bio = filled(user.bio);
  const blog = website(user.blog);
  const company = filled(user.company);
  const location = filled(user.location);
  const twitter = filled(user.twitter_username);
  const createdAt = filled(user.created_at);
  if (name) profile.name = name;
  if (bio) profile.bio = bio;
  if (blog) profile.blog = blog;
  if (company) profile.company = company;
  if (location) profile.location = location;
  if (twitter) profile.twitter = twitter;
  if (createdAt) profile.createdAt = createdAt;
  return profile;
}

export function freshCountBadges(previousCount, nextCount, config) {
  const before = new Set(countBadgesFor(previousCount, config).map((badge) => badge.id));
  return countBadgesFor(nextCount, config)
    .filter((badge) => !before.has(badge.id))
    .map(presentBadge);
}

export function isoDate(timestamp) {
  return String(timestamp).slice(0, 10);
}

/**
 * @param {object} [options]
 * @param {string | null} [options.generatedAt]
 */
export function aggregateContributors(pulls, config, { generatedAt = null } = {}) {
  const byLogin = new Map();
  const categoryCounts = new Map();

  for (const pull of pulls) {
    if (!pull?.mergedAt || !pull.login) continue;
    if (isBot(pull.login, pull.userType, config)) continue;
    const key = pull.login.toLowerCase();
    let person = byLogin.get(key);
    if (!person) {
      person = {
        username: pull.login,
        avatarUrl: `https://github.com/${pull.login}.png?size=160`,
        profileUrl: `https://github.com/${pull.login}`,
        firstContribution: isoDate(pull.mergedAt),
        lastContribution: isoDate(pull.mergedAt),
        mergedPRs: 0,
        contributions: [],
      };
      byLogin.set(key, person);
    } else if (pull.login !== person.username) {
      person.username = pull.login;
      person.avatarUrl = `https://github.com/${pull.login}.png?size=160`;
      person.profileUrl = `https://github.com/${pull.login}`;
    }

    const category = categoryForLabels(pull.labels, config);
    const day = isoDate(pull.mergedAt);
    person.contributions.push({
      pr: pull.number,
      title: String(pull.title || ""),
      url: pull.url || `https://github.com/${config.repo}/pull/${pull.number}`,
      category: category.id,
      mergedAt: day,
    });
    person.mergedPRs += 1;
    if (day < person.firstContribution) person.firstContribution = day;
    if (day > person.lastContribution) person.lastContribution = day;
    if (category.id !== "contribution") {
      categoryCounts.set(category.id, (categoryCounts.get(category.id) || 0) + 1);
    }
  }

  const contributors = [...byLogin.values()].map((person) => {
    person.contributions.sort((a, b) => a.mergedAt.localeCompare(b.mergedAt) || a.pr - b.pr);
    person.badges = badgesFor(person, config);
    return person;
  });

  contributors.sort((a, b) => {
    if (a.lastContribution !== b.lastContribution) return a.lastContribution < b.lastContribution ? 1 : -1;
    return a.username.localeCompare(b.username);
  });

  const categories = config.categories
    .filter((category) => categoryCounts.has(category.id))
    .map((category) => ({
      id: category.id,
      label: category.stat,
      count: categoryCounts.get(category.id),
    }));

  return {
    generatedAt,
    repo: config.repo,
    siteUrl: config.siteUrl,
    maintainer: config.maintainer,
    maintainers: [],
    stats: {
      contributors: contributors.length,
      contributions: contributors.reduce((sum, person) => sum + person.mergedPRs, 0),
      categories,
    },
    contributors,
  };
}

export function comparablePayload(data) {
  const { generatedAt: _generatedAt, ...rest } = data || {};
  return JSON.stringify(rest);
}

export function plainTitle(title) {
  const cleaned = String(title || "")
    .replace(/[\u0000-\u001f]+/g, " ")
    .replace(/[<>[\]]/g, "")
    .replace(/@/g, "@\u200b")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140);
  return cleaned || "Contribution";
}

export function isMeaningfulIssueTitle(title, config) {
  const trimmed = String(title || "").trim();
  if (trimmed.length < config.issueMinTitleLength) return false;
  if (TRIVIAL_ISSUE.test(trimmed)) return false;
  return true;
}

export function formatReleaseSection(pulls, config) {
  const sorted = [...pulls].sort((a, b) => String(b.mergedAt).localeCompare(String(a.mergedAt)) || b.number - a.number);
  const people = [];
  const seen = new Set();
  const groups = new Map();

  for (const pull of sorted) {
    if (!pull?.login || isBot(pull.login, pull.userType, config)) continue;
    const key = pull.login.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      people.push(pull.login);
    }
    const category = categoryForLabels(pull.labels, config);
    const groupId = category.id === "contribution" ? "contribution" : category.id;
    if (!groups.has(groupId)) {
      groups.set(groupId, {
        heading: category.id === "contribution" ? "Contributions" : `${category.emoji} ${category.stat}`.trim(),
        items: [],
      });
    }
    groups.get(groupId).items.push(pull);
  }

  if (people.length === 0) return "";

  const lines = [
    "",
    "## Contributors",
    "",
    "This release was made possible by:",
    "",
    ...people.map((login) => `@${login}`),
    "",
    "Thank you for helping shape Qterm. ❤️",
    "",
  ];

  for (const category of config.categories) {
    appendGroup(lines, groups.get(category.id));
  }
  appendGroup(lines, groups.get("contribution"));
  return `${lines.join("\n").trim()}\n`;
}

function appendGroup(lines, group) {
  if (!group || group.items.length === 0) return;
  lines.push(`### ${group.heading}`, "");
  for (const pull of group.items) {
    lines.push(`- ${plainTitle(pull.title)}. @${pull.login}`);
  }
  lines.push("");
}

export function isContributorDataOnlyCommit(commit) {
  if (!commit) return false;
  const files = [...(commit.added || []), ...(commit.modified || []), ...(commit.removed || [])];
  if (files.length === 0) return false;
  return files.every((file) => file === "apps/web/data/contributors.json");
}

export function pullsInRelease(pulls, { since, until }) {
  return pulls.filter((pull) => {
    const time = Date.parse(pull.mergedAt);
    if (Number.isNaN(time)) return false;
    if (since != null && time <= since) return false;
    if (until != null && time > until) return false;
    return true;
  });
}
