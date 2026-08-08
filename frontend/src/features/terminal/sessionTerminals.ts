/** Long-lived xterm instances so switching panes/scopes does not wipe content. */

import { Terminal, type ITheme } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { SearchAddon, type ISearchOptions } from "@xterm/addon-search";
import { EventsOn } from "../../../wailsjs/runtime/runtime";
import { GetScrollback, ResizeSession, WriteSessionBytes } from "../../../wailsjs/go/main/App";
import { isAppShortcut } from "@/app/appShortcuts";
import {
  clearLeakingDecModes,
  forcePrimaryScreen,
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
  binaryDisposable: { dispose: () => void };
  protocolGuard: { dispose: () => void };
};

/** Forward xterm→PTY bytes only when the shell-protocol gate allows it. */
function bindPtyWriters(entry: Entry, sessionId: string) {
  entry.dataDisposable.dispose();
  entry.binaryDisposable.dispose();
  entry.dataDisposable = entry.term.onData((data) => {
    // Display-only writes (scrollback seed) must never feed the live PTY —
    // replayed DA/OSC/CPR queries would regenerate late "keystrokes".
    if (entry.seeding) return;
    if (!shouldForwardToPty(entry.term, data)) return;
    const bytes = new TextEncoder().encode(data);
    void WriteSessionBytes(sessionId, b64encode(bytes));
  });
  // DEFAULT mouse encoding uses onBinary (not onData). Gate it the same way so
  // normal-buffer storms cannot bypass onData-only filtering; alt-screen TUIs
  // still receive reports via shouldForwardToPty → true.
  entry.binaryDisposable = entry.term.onBinary((data) => {
    if (entry.seeding) return;
    if (!shouldForwardToPty(entry.term, data)) return;
    const bytes = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i++) bytes[i] = data.charCodeAt(i) & 0xff;
    void WriteSessionBytes(sessionId, b64encode(bytes));
  });
}

/**
 * Reinstall protocol guard + PTY writers. Long-lived `entries` survive Vite HMR
 * of other modules; without this, attach can keep a terminal that never got the
 * CSI handlers / core intercept (or whose patches were from an older guard).
 * Always call after term.open() and after term.reset() so instance shadows are
 * stripped and the prototype mouse guard stays reachable.
 */
function ensureShellProtocolPipeline(entry: Entry, sessionId: string) {
  entry.protocolGuard.dispose();
  entry.protocolGuard = installShellProtocolGuard(entry.term, {
    isMuted: () => entry.seeding,
  });
  bindPtyWriters(entry, sessionId);
  if (entry.term.buffer.active.type === "normal") clearLeakingDecModes(entry.term);
}

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
  // DECSET guard blocks mouse/focus on normal during parse; still sync-clear
  // after write in case modes were armed on alt and the chunk switches back.
  entry.term.write(b64decode(data), () => {
    if (entry.term.buffer.active.type === "normal") clearLeakingDecModes(entry.term);
  });
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
  // Block mouse/focus DECSET on normal; mute emulator→PTY while seeding so
  // scrollback queries cannot write replies into the live shell. DA/CPR/OSC
  // are answered on the Go side (or flushed urgently) for live prompts.
  const noop = { dispose() {} };
  entry = {
    term,
    fit,
    search,
    appliedSeq: 0,
    seeding: true,
    pending: [],
    dataDisposable: noop,
    binaryDisposable: noop,
    protocolGuard: noop,
  };
  ensureShellProtocolPipeline(entry, sessionId);
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
      // reset() may clear CSI handlers / core patches — reinstall while still muted.
      ensureShellProtocolPipeline(cur, sessionId);
      const finishSeed = () => {
        // Scrollback may end mid-alt with mouse still armed (truncated 1049l)
        // while the live PTY is already a normal shell. Order matters:
        // force-primary → clear mouse → flush pending (live TUI may 1049h again).
        const flushAfterPrimary = () => {
          clearLeakingDecModes(cur.term);
          cur.appliedSeq = Math.max(cur.appliedSeq, seq);
          cur.seeding = false;
          const pending = cur.pending;
          cur.pending = [];
          for (const p of pending) applyChunk(cur, p.data, p.seq);
        };
        forcePrimaryScreen(cur.term, flushAfterPrimary);
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
      forcePrimaryScreen(cur.term, () => {
        clearLeakingDecModes(cur.term);
        cur.seeding = false;
        const pending = cur.pending;
        cur.pending = [];
        for (const p of pending) applyChunk(cur, p.data, p.seq);
      });
    }
  })();

  return entry;
}

export function attachTerminal(sessionId: string, host: HTMLElement, opts: { fontSize: number }) {
  const entry = getOrCreateTerminal(sessionId, opts);
  const { term, fit } = entry;
  // open() binds DOM mouse handlers that call coreMouseService.triggerMouseEvent.
  // Guard must be live after open (prototype patch is global; still reinstall so
  // instance shadows from older builds are stripped and writers rebound).
  if (!term.element) {
    term.open(host);
  } else if (term.element.parentElement !== host) {
    host.appendChild(term.element);
  }
  ensureShellProtocolPipeline(entry, sessionId);
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
  entry.binaryDisposable.dispose();
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
