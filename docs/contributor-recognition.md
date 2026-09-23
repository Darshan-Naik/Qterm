# Contributor recognition

Qterm thanks people when they show up, and again when their work lands. The messages are short on purpose. Badges mark personal milestones. They are not a leaderboard, and contributors are never ranked against each other.

The contributors page reads the public GitHub API. It does not hand-maintain a list of names, and it does not keep a generated snapshot in the repo.

## What contributors see

| Moment | What happens |
| --- | --- |
| First pull request opened | One welcome comment, and the `first-contribution` label when that label exists |
| Later pull request opened | No comment, unless `recognition.returning_pr` is turned on |
| Maintainer approval | No comment unless `recognition.approval` is turned on |
| First merged pull request | The Qterm family note, a badge line, a contribution card link, and text they can copy |
| Later merged pull request | A short thank-you, plus a new badge line only when they just crossed a milestone |
| First issue | One thank-you, skipped for bots, placeholders, and anyone who already opened an issue |

Qterm bot posts as `github-actions[bot]`. The comment itself is the welcome. A hidden marker sits at the end so a re-run can tell it already spoke.

## How first-time contributors are detected

A person is new when they have no previously merged pull request in this repository.

The workflow reads merged pull requests from the GitHub API (`state=closed`, then `merged_at`). That list follows renamed accounts, because GitHub returns the current login. Fork pull requests use the pull request author, not the fork owner.

These accounts are ignored:

- `user.type` of `Bot`
- logins ending in `[bot]`
- logins listed under `bots` in the config
- logins listed under `quiet_logins` (tracked on the page, but not commented on)

The maintainer login is quiet by default, so Qterm does not welcome its own author. Remove that entry if you want those comments too.

If the history request stops early, the bot will not guess that someone is new. It skips the first-pull-request welcome, and a merge gets the shorter thank-you instead of the family note.

## Idempotency

Every comment includes a hidden marker:

```html
<!-- qterm-contributor-bot:first-pr -->
<!-- qterm-contributor-bot:returning-pr -->
<!-- qterm-contributor-bot:approval -->
<!-- qterm-contributor-bot:first-merge -->
<!-- qterm-contributor-bot:merge -->
<!-- qterm-contributor-bot:first-issue -->
```

Before posting, the workflow reads existing comments. A second run for the same event does not post again. A second open pull request from someone who was already welcomed does not welcome them again.

## Workflows

| File | When it runs | Permissions |
| --- | --- | --- |
| `.github/workflows/contributor-recognition.yml` | Pull request opened, reopened, or merged; review submitted; issue opened | `contents: read`, `pull-requests: write`, `issues: write` |
| `.github/workflows/release.yml` | Existing release path | Appends contributor credits from merged pull requests |

Recognition uses `pull_request_target` so a pull request from a fork can still receive a comment. The job checks out the default branch only (`persist-credentials: false`) and runs the script already on that branch. It does not checkout the pull request head, and it does not install or execute pull request code.

Approval comments use `pull_request_review`. On a fork, GitHub's token may be read-only, so the script logs that and exits cleanly instead of failing the job. Approval is off by default.

Pull request titles are not passed through the shell. The script reads the event JSON itself.

## Configuration

Edit `.github/qterm-contributors.yml`.

```yaml
recognition:
  first_pr: true
  returning_pr: false
  approval: false
  merge: true
  first_merge: true
  issue_welcome: true
```

Set a flag to `false` to stop that message. No code change is required.

`issue_min_title_length` skips very short first issues. Titles that are only `test`, `hi`, and similar placeholders are skipped too.

`social.generate_card` turns the card link and copy-paste share text on or off. The merge thank-you still posts.

## Badges

Count badges live under `count_badges`. Each one needs `id`, `emoji`, `label`, and `merged_prs`. Set `enabled: false` to hide one. `milestones.builder`, `milestones.regular`, and `milestones.community` override the matching thresholds if you would rather edit those numbers in one place.

To add a milestone, append an entry:

```yaml
  - id: century
    emoji: "💯"
    label: "Century"
    merged_prs: 100
```

The next merge comment picks it up. Ship the config change before you expect the comment to mention it, because recognition runs the workflow from the default branch.

Category badges come from `categories`. The first matching label wins. A pull request with no matching label is stored as `contribution` and does not earn a category badge. Set `badges.category` to `false` to keep the categories for stats but hide the badges.

The contributors page orders people by merged pull requests, most first. It does not print the count on the card.

## Messages

Edit the strings in `.github/scripts/contributors/messages.mjs`. Keep the marker line. The hidden marker is how re-runs stay quiet.

Share text for a first merged pull request lives in `apps/web/lib/contributor-present.mjs` so the website and the GitHub comment stay the same.

Avoid the em dash character in this copy. Use a period, comma, or colon.

## Contributor data

`/contributors` is server-rendered and asks the public GitHub API for merged pull requests and for the maintainer profile (the configured login and the repository owner). Next caches those responses for 12 hours (`CONTRIBUTOR_CACHE_SECONDS` in `apps/web/lib/contributor-data.ts`). Names and avatars come from that response. The page does not keep them in source, and it does not show the GitHub bio.

## Contributors page

- `/contributors` lists people with the most merged pull requests first. A card is a name, the GitHub login, a site or X link when GitHub has one, and the badges they have earned. The maintainer card uses that same layout, with a Maintainer label. Location, company, and the GitHub bio stay off the card.
- The home page shows those portraits just before the FAQ. A name shows when you hover.
- `/contributors/<username>` is the share page for someone GitHub shows as a merged contributor. Unknown names 404. The page will not mint a card for a person who has not merged anything.
- `/contributors/card/<username>` returns the SVG.

The page does not render category counts. Release notes group people from GitHub when a release is published.

## Share card

The SVG is generated in `apps/web/lib/contributor-present.mjs`. It uses Qterm colors and the word Qterm. It does not embed another product's logo. The card is self-contained, so it does not depend on an external avatar request.

The first-merge comment links to the share page and includes text in a code block. There is also a link to post on X. Nothing is posted to a contributor's social accounts.

The share page uses the same GitHub data as `/contributors`, cached for 12 hours.

## Release notes

When a GitHub Release is published, `.github/scripts/contributors/release.mjs` appends:

```md
## Contributors

This release was made possible by:

@octocat

Thank you for helping shape Qterm. ❤️
```

Labeled pull requests are grouped under their category. Names follow the most recent merge in that release, not the number of pull requests. Pull request titles are stripped of markdown link characters so a title cannot inject a link. `@` inside a title is neutralized. The credit `@login` after the title is the real mention.

The window is every merged pull request after the previous release's `published_at`, excluding the tag currently being published so a re-run still credits the same people.

## Labels

The recognition workflow creates labels from the `labels` list when the name is missing. It does not edit color or description afterward, so maintainer changes stick. It also does not remove labels from pull requests.

Useful labels:

```text
first-contribution
contribution:feature
contribution:bug
contribution:documentation
contribution:performance
contribution:ui
contribution:testing
contribution:accessibility
contribution:tooling
contribution:security
contribution:community
```

Common names such as `bug`, `enhancement`, and `documentation` count too. See `categories` in the config.

The bot may add `first-contribution` on a first pull request. It does not add category labels, because those should be a maintainer's call.

## Security

- Recognition never checks out pull request code.
- Permissions stay limited to reading the repo and writing comments, labels, and issues.
- Treat pull request titles as untrusted. They are not executed, and release notes escape them.
- Do not put secrets in contributor comments. The workflows only pass `GITHUB_TOKEN`.

## Local checks

From the repo root:

```bash
npm run test:contributors
```

That covers detection, badges, messages, idempotency markers, the SVG, release credits, and the workflow safety checks.
