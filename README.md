# Qterm

**A fast, focused terminal for people who live in the shell.**

Qterm keeps your projects, terminals, and splits in one calm Mac window, so you spend less time managing tabs and more time shipping.

This repository is a monorepo:

| Path | What |
| --- | --- |
| [`apps/desktop`](apps/desktop) | macOS app (Go + Wails + Vite) |
| [`apps/web`](apps/web) | Marketing site (Next.js, host on Vercel) |

---

## Why Qterm

**Projects, not clutter.**
Map local folders as projects. Open as many terminals as you need under each one, rename them, and keep home / quick shells separate when you’re just experimenting.

**Splits that feel native.**
Split right or down and work side by side. Each pane has its own title and menu. No crowded tab strip fighting for attention.

**Built for flow.**
Command palette, thoughtful shortcuts, dark and light themes, and a sidebar that stays out of your way until you need it.

**Ready for agents.**
Install hooks that observe your terminals and surface actions in the UI, without turning Qterm into another chat app.

**Powered by [Qortex](https://qortex.darshannaik.com).**
The same lightweight TypeScript suite behind Qterm’s state and storage.

---

## Designed for Mac

Qterm is Mac-first: traffic lights, menus, and chrome that feel at home next to the tools you already use. Cross-platform support is on the roadmap.

---

## A quieter workspace

- Simple sidebar: new terminals and projects
- Git branch awareness on project folders
- Sessions that remember where you left off
- Settings that stay out of the main view until you open them

---

## Get started

Download the latest release from [GitHub](https://github.com/Darshan-Naik/Qterm/releases/latest), open **Qterm**, and create a terminal, or add a project folder and go.

---

## Develop

From the repo root:

```bash
npm install
```

**Desktop app** (run Wails from `apps/desktop`):

```bash
cd apps/desktop
wails dev          # hot reload
wails build        # production .app
./scripts/build-dmg.sh   # macOS DMG
go test ./...
```

**Marketing site:**

```bash
npm run dev:web      # http://localhost:3000
npm run build:web    # production build
```

---

## Deploy the marketing site on Vercel

1. Import this GitHub repo in [Vercel](https://vercel.com/new).
2. Set **Root Directory** to `apps/web`.
3. Framework Preset: **Next.js** (auto-detected).
4. Leave Include source files outside the Root Directory enabled so npm workspaces resolve from the repo root.
5. Deploy.

`apps/web` is a standard Next.js App Router project. No extra Vercel env vars are required.

---

## Cut a Mac release

1. Set `info.productVersion` in `apps/desktop/wails.json` to the new version (for example `1.6.3`).
2. Commit and push to `main`.
3. Tag and push that version. The Release workflow builds Apple Silicon and Intel DMGs and publishes a GitHub Release with those files and a git tag:

```bash
git tag v1.6.3
git push origin v1.6.3
```

You can also run **Actions → Release → Run workflow** on `main` after the version bump. That creates the same `v*` tag and release.

The marketing site **Download for Mac** button fetches the latest GitHub Release and downloads `Qterm-macos-arm64.dmg`. Intel Macs use the Intel Mac link (`Qterm-macos-amd64.dmg`).

---

*Qterm: terminal, without the noise.*
