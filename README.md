# Qterm

Mac-first terminal app built with **Wails (Go + React/TypeScript)**.

## Stack
- Go PTY (`creack/pty`) + Wails v2
- React, Tailwind, shadcn/ui
- Qortex (`qortex-store`, `qortex-query`, `qortex-db`)
- xterm.js, installable agent hooks

## Features
- Sidebar: **New terminal** (default path) + **Projects** (local folders)
- Split/grid panes (right / down), rename/close sessions
- Dark / light / system theme
- Git branch + dirty indicator on projects
- Command palette + hotkeys
- Hooks platform (demo + Claude reference hooks)

## Develop
```bash
wails dev
```

## Build
```bash
wails build
# app at build/bin/q-term.app
```

## Hotkeys
| Shortcut | Action |
|---|---|
| ⌘K | Command palette |
| ⌘T | New terminal |
| ⌘B | Toggle sidebar |
| ⌘⇧L | Split right |
| ⌘⇧J | Split down |
| ⌘⇧W | Close pane |
| ⌘] / ⌘[ | Focus next / prev pane |
| ⌘⇧D | Toggle dark/light |

## Hooks
Bundled examples live in `hooks/demo-hook` and `hooks/claude-hook`. Install more from any folder with a `manifest.json` via the puzzle icon.
