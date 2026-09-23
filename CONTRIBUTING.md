# Contributing to Qterm

Thanks for helping improve Qterm. This guide covers how to set up the repo, make changes, and open a pull request.

## Before you start

- Read the [README](README.md) for product context.
- Qterm prioritizes speed. Treat latency, jank, and unnecessary work on hot paths as bugs.
- By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).

## Repo layout

```
apps/desktop/   # Wails desktop app (Go backend + Vite/React frontend)
apps/web/       # Marketing site (Next.js)
```

## Prerequisites

- Node.js 20+
- Go 1.25+ (for the desktop app)
- [Wails v2](https://wails.io) (`go install github.com/wailsapp/wails/v2/cmd/wails@latest`)
- macOS on Apple Silicon for full desktop builds (Qterm targets Mac)

## Setup

From the repo root:

```bash
npm install
```

### Desktop app

```bash
cd apps/desktop
wails dev
```

Useful checks:

```bash
npm run test:desktop   # frontend tests
npm run test:go        # Go tests
```

### Marketing site

```bash
npm run dev:web
```

## Finding something to work on

Browse [open issues](https://github.com/Darshan-Naik/Qterm/issues). Bug reports and small, focused improvements are a good first pull request. If you are unsure about a larger change, open an issue first.

## Making changes

1. Create a branch from `main`.
2. Keep the change focused. Prefer one logical change per PR.
3. Match existing structure and naming:
   - One React component per file
   - Feature code under `apps/desktop/frontend/src/features/<name>/`
   - Shared domain helpers in `lib/`
   - App shell stays thin (`app/`)
4. Do not put PTY output through React state or the UI store. Terminal data stays on the xterm path.
5. Avoid drive-by refactors and unsolicited docs.
6. Do not use em dashes (—) in user-facing copy (UI strings, marketing site, README product text).

## Pull requests

- Use a clear conventional title when practical, for example `feat(terminal): …`, `fix(notify): …`, `docs: …`. Release notes are generated from merged PR titles.
- Describe what changed and why.
- Include screenshots or a short recording for UI changes.
- Run relevant tests before requesting review (`npm run test:desktop`, `npm run test:go`, or both).
- Do not bump `apps/desktop/wails.json` `productVersion` unless you intend to ship a release. Version bumps belong in their own commit: `chore: bump version to X.Y.Z`.

## What happens after you submit

A maintainer reviews your pull request. You may get questions, or a request to adjust the change. When it is approved and merged, it becomes part of Qterm.

If this is your first pull request, Qterm bot leaves a short welcome. That message is posted once, not on every update.

## What happens after you contribute

Every contribution matters.

When your first contribution is merged, you officially become part of the Qterm contributor community. Qterm bot comments on the pull request, and your name is added to the [contributors page](https://qterm.darshannaik.com/contributors).

We recognize people through contributor badges, release credits, and that page. Badges mark personal milestones, such as a first contribution or several merged pull requests. Nobody is ranked.

If you want to share your first merged pull request, the bot includes a contribution card and text you can copy. Posting it is up to you.

A maintainer can add a label so the page can describe the kind of work, for example `contribution:bug`, `contribution:feature`, `contribution:documentation`, `contribution:performance`, `contribution:ui`, or `contribution:testing`.

Maintainer details live in [docs/contributor-recognition.md](docs/contributor-recognition.md).

## Questions

Open an issue for bugs, feature ideas, or design questions before large changes when you are unsure about direction.
