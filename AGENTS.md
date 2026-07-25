# Qterm — Agent Guide

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
