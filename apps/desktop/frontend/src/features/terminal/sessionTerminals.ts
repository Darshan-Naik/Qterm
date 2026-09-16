/**
 * Long-lived xterm instances with minimal state manipulation.
 *
 * Follows VS Code and Hyper terminal patterns:
 * - Terminal elements are preserved across mount/unmount (no destroy on tab switch)
 * - PTY data flows directly through without filtering
 * - No terminal state manipulation during normal operation
 * - Scrollback restore is simple write + flush pending data
 */

import { Terminal, type ILinkHandler, type IMarker, type ITheme } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { SearchAddon, type ISearchOptions } from "@xterm/addon-search";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { EventsOn } from "../../../wailsjs/runtime/runtime";
import { GetScrollback, ResizeSession, WriteSession, WriteSessionBytes } from "../../../wailsjs/go/main/App";
import { isAppShortcut } from "@/app/appShortcuts";
import { keywordExpandPayload } from "@/lib/snippets";
import { uiStore } from "@/store/ui";
import { openTerminalLink } from "@/features/terminal/openTerminalLink";

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

function lineBeforeCursor(term: Terminal): string | null {
  if (term.buffer.active !== term.buffer.normal) return null;
  const buf = term.buffer.active;
  const line = buf.getLine(buf.baseY + buf.cursorY);
  if (!line) return "";
  return line.translateToString(false).slice(0, Math.max(0, buf.cursorX));
}

/** Enter expands a snippet keyword. Off the PTY read path. Normal buffer only. */
function tryExpandSnippetKeyword(term: Terminal, sessionId: string): boolean {
  const snippets = uiStore.get().snippets;
  if (snippets.length === 0) return false;
  const line = lineBeforeCursor(term);
  if (line == null) return false;
  const sessions = uiStore.get().sessions;
  let cwd: string | undefined;
  for (let i = 0; i < sessions.length; i++) {
    if (sessions[i].id === sessionId) {
      cwd = sessions[i].cwd;
      break;
    }
  }
  const payload = keywordExpandPayload(line, snippets, cwd);
  if (!payload) return false;
  void WriteSession(sessionId, payload);
  return true;
}

type Pending = { data: string; seq: number };

type Entry = {
  term: Terminal;
  fit: FitAddon;
  search: SearchAddon;
  links: WebLinksAddon;
  appliedSeq: number;
  seeding: boolean;
  pending: Pending[];
  dataDisposable: { dispose: () => void };
  binaryDisposable: { dispose: () => void };
  osc133: { dispose: () => void };
  commandMarks: IMarker[];
  commandMarkIdx: number;
};

const OSC8_LINK_HANDLER: ILinkHandler = {
  activate(event, text) {
    openTerminalLink(event, text);
  },
  allowNonHttpProtocols: true,
};

/**
 * Forward xterm→PTY bytes.
 *
 * Following VS Code and Hyper's approach: forward all data directly without filtering.
 * Mouse events are handled naturally by xterm.js. Only block during scrollback seed
 * (display-only writes) to prevent replayed sequences from feeding the live PTY.
 */
function bindPtyWriters(entry: Entry, sessionId: string) {
  entry.dataDisposable.dispose();
  entry.binaryDisposable.dispose();

  entry.dataDisposable = entry.term.onData((data) => {
    // During seed, don't forward anything to PTY
    if (entry.seeding) return;
    const bytes = new TextEncoder().encode(data);
    void WriteSessionBytes(sessionId, b64encode(bytes));
  });

  entry.binaryDisposable = entry.term.onBinary((data) => {
    // During seed, don't forward anything to PTY
    if (entry.seeding) return;
    const bytes = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i++) bytes[i] = data.charCodeAt(i) & 0xff;
    void WriteSessionBytes(sessionId, b64encode(bytes));
  });
}

/**
 * Bind PTY writers. Called after term.open() and after term.reset().
 */
function ensurePtyWriters(entry: Entry, sessionId: string) {
  bindPtyWriters(entry, sessionId);
}

const entries = new Map<string, Entry>();
let listening = false;

const MAX_MARKS = 80;

function installOsc133(entry: Entry) {
  entry.osc133.dispose();
  for (const m of entry.commandMarks) m.dispose();
  entry.commandMarks = [];
  entry.commandMarkIdx = 0;
  entry.osc133 = entry.term.parser.registerOscHandler(133, (data) => {
    const kind = data.charAt(0);
    if (kind === "A" || kind === "C") {
      const marker = entry.term.registerMarker(0);
      if (marker) {
        entry.commandMarks.push(marker);
        if (entry.commandMarks.length > MAX_MARKS) entry.commandMarks.shift()?.dispose();
        entry.commandMarkIdx = entry.commandMarks.length - 1;
      }
    }
    return true;
  });
}

const FIND_DECORATIONS: NonNullable<ISearchOptions["decorations"]> = {
  matchBackground: "#5c4b1f",
  matchBorder: "#b58900",
  matchOverviewRuler: "#b58900",
  activeMatchBackground: "#cb4b16",
  activeMatchBorder: "#ff6b2d",
  activeMatchColorOverviewRuler: "#cb4b16",
};

/**
 * Write PTY data to terminal.
 *
 * Following VS Code's approach: just write the data directly, no mode clearing.
 * Let xterm.js and the application handle terminal state naturally.
 */
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
    // OSC 8 hyperlinks (Claude/file URLs). window.open is a no-op in Wails.
    linkHandler: OSC8_LINK_HANDLER,
    // Drives custom scrollbar width (defaults to 14px — looks bulky).
    overviewRuler: { width: 4 },
  });
  const fit = new FitAddon();
  term.loadAddon(fit);
  const search = new SearchAddon();
  term.loadAddon(search);
  const links = new WebLinksAddon(openTerminalLink);
  term.loadAddon(links);
  // Let app chords (⌘K, ⌘P, …) skip xterm so the capture-phase window
  // handler can open palettes instead of feeding the PTY.
  term.attachCustomKeyEventHandler((ev) => {
    if (ev.type !== "keydown") return true;
    if (isAppShortcut(ev)) return false;
    if (ev.key === "Enter" && !ev.metaKey && !ev.ctrlKey && !ev.altKey && tryExpandSnippetKeyword(term, sessionId)) {
      return false;
    }
    return true;
  });

  const noop = { dispose() {} };
  entry = {
    term,
    fit,
    search,
    links,
    appliedSeq: 0,
    seeding: true,
    pending: [],
    dataDisposable: noop,
    binaryDisposable: noop,
    osc133: noop,
    commandMarks: [],
    commandMarkIdx: -1,
  };
  ensurePtyWriters(entry, sessionId);
  installOsc133(entry);
  entries.set(sessionId, entry);

  // Restore scrollback asynchronously
  // Following VS Code/Hyper: simple write without state manipulation
  void (async () => {
    try {
      const snap = (await GetScrollback(sessionId)) as { data?: string; seq?: number };
      const cur = entries.get(sessionId);
      if (!cur) return;
      const seq = Number(snap?.seq || 0);

      // Reset parser state so incomplete sequences from prior session
      // don't corrupt the restore
      cur.term.reset();
      ensurePtyWriters(cur, sessionId);
      installOsc133(cur);

      const finishSeed = () => {
        cur.appliedSeq = Math.max(cur.appliedSeq, seq);
        cur.seeding = false;
        // Flush any PTY data that arrived during restore
        const pending = cur.pending;
        cur.pending = [];
        for (const p of pending) applyChunk(cur, p.data, p.seq);
        // Scroll to bottom so user sees the prompt
        cur.term.scrollToBottom();
      };

      if (snap?.data) {
        const bytes = b64decode(snap.data);
        if (bytes.length) {
          // Write scrollback, then finish
          cur.term.write(bytes, finishSeed);
          return;
        }
      }
      finishSeed();
    } catch {
      // On error, just finish seeding so terminal is usable
      const cur = entries.get(sessionId);
      if (!cur) return;
      cur.seeding = false;
      const pending = cur.pending;
      cur.pending = [];
      for (const p of pending) applyChunk(cur, p.data, p.seq);
      cur.term.scrollToBottom();
    }
  })();

  return entry;
}

/**
 * Attach terminal to a DOM host element.
 *
 * Following VS Code and Hyper's approach:
 * 1. Terminal element is preserved across mount/unmount cycles (Hyper pattern)
 * 2. Tab switching just moves the DOM element without altering terminal state
 * 3. No terminal state manipulation during attach (VS Code pattern)
 *
 * This ensures TUI apps (Claude CLI, vim, etc.) continue working correctly
 * when switching tabs or reloading the window.
 */
export function attachTerminal(sessionId: string, host: HTMLElement, opts: { fontSize: number }) {
  const entry = getOrCreateTerminal(sessionId, opts);
  const { term, fit } = entry;

  // First time: open the terminal in the DOM
  if (!term.element) {
    term.open(host);
  } else if (term.element.parentElement !== host) {
    // Tab switch: just move the element (Hyper pattern)
    // Do NOT touch terminal state - TUI apps depend on it being preserved
    host.appendChild(term.element);
  }

  // Ensure PTY writers are connected (idempotent)
  ensurePtyWriters(entry, sessionId);

  // Apply visual settings only (theme/font/ruler)
  term.options.theme = terminalThemeFromCss();
  term.options.fontSize = opts.fontSize;
  term.options.overviewRuler = { width: 4 };

  // Fit to container size after layout settles
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
  entry.osc133.dispose();
  entry.search.dispose();
  entry.links.dispose();
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

export function jumpSessionCommand(sessionId: string, dir: -1 | 1): boolean {
  const entry = entries.get(sessionId);
  if (!entry) return false;
  entry.commandMarks = entry.commandMarks.filter((m) => m.line >= 0);
  if (entry.commandMarks.length === 0) return false;
  const next = Math.min(
    entry.commandMarks.length - 1,
    Math.max(0, entry.commandMarkIdx + dir),
  );
  entry.commandMarkIdx = next;
  const line = entry.commandMarks[next]?.line;
  if (line == null || line < 0) return false;
  entry.term.scrollToLine(line);
  return true;
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
