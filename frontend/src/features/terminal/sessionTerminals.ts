/** Long-lived xterm instances so switching panes/scopes does not wipe content. */

import { Terminal, type ITheme } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { SearchAddon, type ISearchOptions } from "@xterm/addon-search";
import { EventsOn } from "../../../wailsjs/runtime/runtime";
import { GetScrollback, ResizeSession, WriteSessionBytes } from "../../../wailsjs/go/main/App";
import { isAppShortcut } from "@/app/appShortcuts";
import {
  clearLeakingDecModes,
  installShellProtocolGuard,
  shouldForwardToPty,
} from "@/features/terminal/shellProtocolGuard";

function b64encode(u8: Uint8Array) {
  const CHUNK = 0x8000;
  let s = "";
  for (let i = 0; i < u8.length; i += CHUNK) {
    s += String.fromCharCode(...u8.subarray(i, i + CHUNK));
  }
  return btoa(s);
}

function b64decode(b64: string) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function cssColor(name: string, fallback: string) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

/** Terminal theme pulled from app CSS tokens so the pane blends with the chrome. */
export function terminalThemeFromCss(): ITheme {
  const fg = cssColor("--muted-foreground", "#a1a1a1");
  const bg = cssColor("--background", "#252525");
  return {
    background: bg,
    foreground: cssColor("--foreground", "#fafafa"),
    cursor: cssColor("--primary", "#7c6cf0"),
    cursorAccent: cssColor("--primary-foreground", "#fafafa"),
    selectionBackground: cssColor("--accent", "#3a3480"),
    selectionForeground: cssColor("--accent-foreground", "#fafafa"),
    // Hairline scrollbar (xterm custom slider — not native CSS scrollbar).
    scrollbarSliderBackground: colorWithAlpha(fg, 0.28),
    scrollbarSliderHoverBackground: colorWithAlpha(fg, 0.45),
    scrollbarSliderActiveBackground: colorWithAlpha(fg, 0.6),
    overviewRulerBorder: bg,
  };
}

function colorWithAlpha(color: string, alpha: number): string {
  const c = color.trim();
  if (c.startsWith("oklch(") || c.startsWith("rgb(") || c.startsWith("hsl(")) {
    // Wrap via color-mix so we don't have to parse every CSS color space.
    return `color-mix(in oklab, ${c} ${Math.round(alpha * 100)}%, transparent)`;
  }
  if (c.startsWith("#") && (c.length === 7 || c.length === 4)) {
    const hex =
      c.length === 4
        ? `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}`
        : c;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return c;
}

type Pending = { data: string; seq: number };

type Entry = {
  term: Terminal;
  fit: FitAddon;
  search: SearchAddon;
  appliedSeq: number;
  seeding: boolean;
  pending: Pending[];
  dataDisposable: { dispose: () => void };
  protocolGuard: { dispose: () => void };
};

const entries = new Map<string, Entry>();
let listening = false;

const FIND_DECORATIONS: NonNullable<ISearchOptions["decorations"]> = {
  matchBackground: "#5c4b1f",
  matchBorder: "#b58900",
  matchOverviewRuler: "#b58900",
  activeMatchBackground: "#cb4b16",
  activeMatchBorder: "#ff6b2d",
  activeMatchColorOverviewRuler: "#cb4b16",
};

function applyChunk(entry: Entry, data: string, seq: number) {
  if (seq && seq <= entry.appliedSeq) return;
  entry.term.write(b64decode(data));
  if (seq) entry.appliedSeq = seq;
}

function ensureListeners() {
  if (listening) return;
  listening = true;
  (EventsOn as any)("pty:data", (payload: { sessionId: string; data: string; seq?: number }) => {
    const entry = entries.get(payload.sessionId);
    if (!entry) return;
    const seq = Number(payload.seq || 0);
    if (entry.seeding) {
      entry.pending.push({ data: payload.data, seq });
      return;
    }
    applyChunk(entry, payload.data, seq);
  });
  (EventsOn as any)("pty:exit", (payload: { sessionId: string }) => {
    disposeSession(payload.sessionId);
  });
}

export function getOrCreateTerminal(sessionId: string, opts: { fontSize: number }): Entry {
  ensureListeners();
  let entry = entries.get(sessionId);
  if (entry) return entry;

  const term = new Terminal({
    cursorBlink: true,
    fontFamily: '"JetBrains Mono", Menlo, monospace',
    fontSize: opts.fontSize,
    fontWeight: "400",
    lineHeight: 1.35,
    theme: terminalThemeFromCss(),
    allowProposedApi: true,
    scrollback: 5000,
    // Drives custom scrollbar width (defaults to 14px — looks bulky).
    overviewRuler: { width: 4 },
  });
  const fit = new FitAddon();
  term.loadAddon(fit);
  const search = new SearchAddon();
  term.loadAddon(search);
  // Let app chords (⌘K, ⌘P, …) skip xterm so the capture-phase window
  // handler can open palettes instead of feeding the PTY.
  term.attachCustomKeyEventHandler((ev) => {
    if (ev.type !== "keydown") return true;
    return !isAppShortcut(ev);
  });
  // Stop focus/DA/CPR/mouse replies from being generated (and forwarded) on
  // the shell buffer; alternate-screen TUIs keep normal xterm behavior.
  const protocolGuard = installShellProtocolGuard(term);
  const dataDisposable = term.onData((data) => {
    if (!shouldForwardToPty(term, data)) return;
    const bytes = new TextEncoder().encode(data);
    void WriteSessionBytes(sessionId, b64encode(bytes));
  });
  entry = {
    term,
    fit,
    search,
    appliedSeq: 0,
    seeding: true,
    pending: [],
    dataDisposable,
    protocolGuard,
  };
  entries.set(sessionId, entry);

  void (async () => {
    try {
      const snap = (await GetScrollback(sessionId)) as { data?: string; seq?: number };
      const cur = entries.get(sessionId);
      if (!cur) return;
      const seq = Number(snap?.seq || 0);
      // Reset parser state so a cut mid-sequence from a prior session
      // doesn't paint the next restore as literal garbage.
      cur.term.reset();
      const finishSeed = () => {
        // Scrollback may replay DECSET focus/mouse; keep shell modes clean.
        if (cur.term.buffer.active.type === "normal") clearLeakingDecModes(cur.term);
        cur.appliedSeq = Math.max(cur.appliedSeq, seq);
        cur.seeding = false;
        const pending = cur.pending;
        cur.pending = [];
        for (const p of pending) applyChunk(cur, p.data, p.seq);
      };
      if (snap?.data) {
        const bytes = b64decode(snap.data);
        if (bytes.length) {
          cur.term.write(bytes, finishSeed);
          return;
        }
      }
      finishSeed();
    } catch {
      const cur = entries.get(sessionId);
      if (!cur) return;
      if (cur.term.buffer.active.type === "normal") clearLeakingDecModes(cur.term);
      cur.seeding = false;
      const pending = cur.pending;
      cur.pending = [];
      for (const p of pending) applyChunk(cur, p.data, p.seq);
    }
  })();

  return entry;
}

export function attachTerminal(sessionId: string, host: HTMLElement, opts: { fontSize: number }) {
  const entry = getOrCreateTerminal(sessionId, opts);
  const { term, fit } = entry;
  if (!term.element) {
    term.open(host);
  } else if (term.element.parentElement !== host) {
    host.appendChild(term.element);
  }
  term.options.theme = terminalThemeFromCss();
  term.options.fontSize = opts.fontSize;
  term.options.overviewRuler = { width: 4 };
  if (term.buffer.active.type === "normal") clearLeakingDecModes(term);
  requestAnimationFrame(() => {
    fit.fit();
    void ResizeSession(sessionId, term.cols, term.rows);
  });
  return entry;
}

export function detachTerminal(sessionId: string, host: HTMLElement) {
  const entry = entries.get(sessionId);
  if (!entry?.term.element) return;
  if (entry.term.element.parentElement === host) {
    host.removeChild(entry.term.element);
  }
}

export function disposeSession(sessionId: string) {
  const entry = entries.get(sessionId);
  if (!entry) return;
  entry.dataDisposable.dispose();
  entry.protocolGuard.dispose();
  entry.search.dispose();
  entry.term.dispose();
  entries.delete(sessionId);
}

export function focusTerminal(sessionId: string) {
  entries.get(sessionId)?.term.focus();
}

export function refreshAllTerminalThemes() {
  const theme = terminalThemeFromCss();
  for (const entry of entries.values()) {
    entry.term.options.theme = theme;
    entry.term.options.overviewRuler = { width: 4 };
  }
}

/** Find next/previous match in a session's live xterm buffer. */
export function findInSession(
  sessionId: string,
  term: string,
  direction: "next" | "prev",
  incremental = false
): boolean {
  const entry = entries.get(sessionId);
  if (!entry || !term) {
    entry?.search.clearDecorations();
    return false;
  }
  const opts: ISearchOptions = {
    caseSensitive: false,
    incremental,
    decorations: FIND_DECORATIONS,
  };
  return direction === "next" ? entry.search.findNext(term, opts) : entry.search.findPrevious(term, opts);
}

export function clearSessionFind(sessionId: string) {
  entries.get(sessionId)?.search.clearDecorations();
}

export function onSessionFindResults(
  sessionId: string,
  cb: (ev: { resultIndex: number; resultCount: number }) => void
): (() => void) | undefined {
  const entry = entries.get(sessionId);
  if (!entry) return undefined;
  const sub = entry.search.onDidChangeResults(cb);
  return () => sub.dispose();
}
