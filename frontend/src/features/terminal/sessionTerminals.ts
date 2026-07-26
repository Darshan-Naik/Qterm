/** Long-lived xterm instances so switching panes/scopes does not wipe content. */

import { Terminal, type ITheme } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { EventsOn } from "../../../wailsjs/runtime/runtime";
import { GetScrollback, ResizeSession, WriteSessionBytes } from "../../../wailsjs/go/main/App";
import { isAppShortcut } from "@/app/appShortcuts";

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
  return {
    background: cssColor("--background", "#252525"),
    foreground: cssColor("--foreground", "#fafafa"),
    cursor: cssColor("--primary", "#7c6cf0"),
    cursorAccent: cssColor("--primary-foreground", "#fafafa"),
    selectionBackground: cssColor("--accent", "#3a3480"),
    selectionForeground: cssColor("--accent-foreground", "#fafafa"),
  };
}

/** SGR / X10 / urxvt mouse reports that xterm emits when mouse tracking is on. */
function isMouseReport(data: string): boolean {
  // ESC [ < btn ; col ; row M/m   (SGR 1006)
  // ESC [ btn ; col ; row M/m     (urxvt 1015)
  // ESC M btn col row             (X10 1000)
  return (
    /^\x1b\[<\d+;\d+;\d+[Mm]/.test(data) ||
    /^\x1b\[\d+;\d+;\d+[Mm]/.test(data) ||
    /^\x1b\[M[\s\S]{3}/.test(data)
  );
}

/**
 * Auto replies xterm.js sends to the PTY (focus, DA, DECRQM). When a TUI exits
 * without consuming them, they land in the shell as garbage like
 * `^[[I^[[?1;2c^[[?2026;2$y`.
 */
function isTerminalProtocolNoise(data: string): boolean {
  if (!data) return false;
  // Focus in/out (DECSET 1004)
  if (data === "\x1b[I" || data === "\x1b[O") return true;
  // CSI ? … c  (Primary/Secondary Device Attributes)
  if (/^\x1b\[\?[\d;]*c$/.test(data)) return true;
  // CSI ? Pn ; Pn $ y  or colon form (DECRQM / mode status)
  if (/^\x1b\[\?\d+[;:]\d+\$y$/.test(data)) return true;
  // Burst of the above (common right after an agent TUI exits)
  if (/^(?:\x1b\[[IO]|\x1b\[\?[\d;]*c|\x1b\[\?\d+[;:]\d+\$y)+$/.test(data)) return true;
  // Same burst with stray printable crumbs left from partial parses (* bm etc.)
  const stripped = data.replace(
    /(?:\x1b\[[IO]|\x1b\[\?[\d;]*c|\x1b\[\?\d+[;:]\d+\$y)+/g,
    ""
  );
  if (stripped !== data && /^[\x00-\x1f\s*]*$/.test(stripped)) return true;
  return false;
}

/** Turn off DEC mouse modes in the emulator only (does not write to the PTY). */
function disableMouseTracking(term: Terminal) {
  // Apps sometimes leave ?1000h/?1003h/?1006h on after exit; clear them locally.
  term.write(
    "\x1b[?1000l\x1b[?1001l\x1b[?1002l\x1b[?1003l\x1b[?1005l\x1b[?1006l\x1b[?1015l"
  );
}

/** Clear focus-report / mouse modes TUIs often leave enabled on the shell. */
function disableShellLeakingModes(term: Terminal) {
  disableMouseTracking(term);
  term.write("\x1b[?1004l"); // focus in/out reports
}

type Pending = { data: string; seq: number };

type Entry = {
  term: Terminal;
  fit: FitAddon;
  appliedSeq: number;
  seeding: boolean;
  pending: Pending[];
  dataDisposable: { dispose: () => void };
};

const entries = new Map<string, Entry>();
let listening = false;

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
  });
  const fit = new FitAddon();
  term.loadAddon(fit);
  // Let app chords (⌘K, ⌘P, …) skip xterm so the capture-phase window
  // handler can open palettes instead of feeding the PTY.
  term.attachCustomKeyEventHandler((ev) => {
    if (ev.type !== "keydown") return true;
    return !isAppShortcut(ev);
  });
  const dataDisposable = term.onData((data) => {
    // Shell (normal buffer) only: drop auto protocol replies / mouse reports that
    // TUIs leave pending so they don't type into the prompt. Keep them on the
    // alternate screen (vim, Claude, Antigravity, etc.).
    if (term.buffer.active.type === "normal") {
      if (isMouseReport(data) || isTerminalProtocolNoise(data)) {
        disableShellLeakingModes(term);
        return;
      }
    }
    const bytes = new TextEncoder().encode(data);
    void WriteSessionBytes(sessionId, b64encode(bytes));
  });
  entry = {
    term,
    fit,
    appliedSeq: 0,
    seeding: true,
    pending: [],
    dataDisposable,
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
      if (snap?.data) {
        const bytes = b64decode(snap.data);
        if (bytes.length) cur.term.write(bytes);
      }
      cur.appliedSeq = Math.max(cur.appliedSeq, seq);
      cur.seeding = false;
      const pending = cur.pending;
      cur.pending = [];
      for (const p of pending) applyChunk(cur, p.data, p.seq);
    } catch {
      const cur = entries.get(sessionId);
      if (!cur) return;
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
  }
}
