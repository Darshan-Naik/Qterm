# Qterm — Agent Guide

## Core goal: speed

Qterm must feel **lightning fast**. That is why the stack is **Go + TypeScript** (Wails) — not Electron-heavy abstractions. Treat latency, jank, and unnecessary work as bugs.

### Performance rules

- **PTY path stays off React** — terminal output writes straight to xterm; never put PTY chunks in React state or the UI store.
- **Batch before emit** — coalesce high-frequency PTY reads / IPC / EventsEmit (see `internal/ptyemit`); don’t fire one JSON+base64 round-trip per OS read.
- **Scrollback must stay O(chunk)** — no full-buffer copies on every append; prefer amortized/in-place trim and per-session locking (`internal/scrollback`).
- **Config writes are async** — never block hot paths on synchronous full `config.json` rewrites; debounce + atomic tmp+rename (`internal/config`).
- **Store selectors stay cheap** — select primitives or stable refs; never `.filter()` / `.map()` inside `useUI(...)` (defeats memoization). Prefer per-id slices (`paneAnimations[id]`) over whole dictionaries.
- **Drag / resize = rAF** — pointer-move updates at most once per frame; debounce PTY `ResizeSession` IPC; persist layout/prefs on drag end, not every pixel.
- **Don’t re-render the world** — one session’s agent animation must not re-render every sidebar row and pane.
- **Hotkeys are hot** — match shortcuts once per keydown; cache resolved bindings; avoid alloc/scan storms on every typed character.
- **Measure before micro-opt** — skip theoretical nits on tiny trees; fix real jank (firehose output, drag storms, selector fan-out) first.
- When adding features, ask: *does this add work on the typing / PTY / resize path?* If yes, redesign.

## Code structure

```
frontend/src/
  app/           # thin shell: App, providers, bootstrap, hotkeys, layout
  features/      # sidebar, panes, settings, terminal, palette, hooks
  store/         # types, store, prefs, theme, splits (+ ui barrel)
  lib/           # shared domain logic (sessions, panes, utils)
  components/ui/ # shadcn primitives
  hooks/         # shared React hooks
```

## Rules

- **One component per file.**
- **Split by feature** — keep related UI under `features/<name>/` with an `index.ts` barrel.
- **Keep App thin** — bootstrap, hotkeys, and actions live in dedicated modules under `app/`.
- **Store by concern** — types / store / prefs / theme / splits are separate; public API is `@/store/ui`.
- **Shared logic in `lib/`** — reusable domain helpers (e.g. `focusSession`, close/delete), not buried in components.
- **Abstraction in balance** — extract when it aids reuse or clarity; avoid deep indirection and premature abstraction.
- **Reusability** — shared UI pieces (settings rows, pane chrome bits) are standalone components; don’t duplicate.
- **Scalability** — new screens/features get their own folder; don’t grow monolith files.
- Match existing naming, `@/` imports, and Wails path depth from the feature folder.
- Stay on task — no drive-by refactors or unsolicited docs.
- **Defaults live once** — app defaults are named constants in `store/defaults.ts` (TS) and `internal/config` (Go). Callers use clamp helpers / `currentScope()` — never re-literal `12`, `240`, `100`, or `"_default"`.
