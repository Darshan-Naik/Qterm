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

/** CSI tokens xterm may auto-reply; TUIs often leave these pending on exit. */
const PROTOCOL_NOISE_TOKEN =
  // Focus in/out (DECSET 1004)
  String.raw`\x1b\[[IO]|` +
  // CSI ? … c  (Primary/Secondary Device Attributes)
  String.raw`\x1b\[\?[\d;]*c|` +
  // CSI ? Pn ; Pn $ y  (DECRQM / mode status)
  String.raw`\x1b\[\?\d+[;:]\d+\$y|` +
  // Cursor Position Report — reply to CSI 6 n (shows up as ;1R;1R… at the prompt)
  String.raw`\x1b\[\d+;\d+R`;

const PROTOCOL_NOISE_ONE = new RegExp(`^(?:${PROTOCOL_NOISE_TOKEN})$`);
const PROTOCOL_NOISE_BURST = new RegExp(`^(?:${PROTOCOL_NOISE_TOKEN})+$`);
const PROTOCOL_NOISE_STRIP = new RegExp(`(?:${PROTOCOL_NOISE_TOKEN})+`, "g");

/**
 * Auto replies xterm.js sends to the PTY (focus, DA, DECRQM, CPR). When a TUI
 * exits without consuming them, they land in the shell as garbage like
 * `^[[I^[[?1;2c^[[1;1R` or echoed crumbs `;1R;1R`.
 */
function isTerminalProtocolNoise(data: string): boolean {
  if (!data) return false;
  if (PROTOCOL_NOISE_ONE.test(data) || PROTOCOL_NOISE_BURST.test(data)) return true;
  // Burst with stray printable crumbs left from partial parses (* bm etc.)
  const stripped = data.replace(PROTOCOL_NOISE_STRIP, "");
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
    // Drives custom scrollbar width (defaults to 14px — looks bulky).
    overviewRuler: { width: 4 },
  });
  const fit = new FitAddon();
  term.loadAddon(fit);
  // Let app chords (⌘K, ⌘P, …) skip xterm so the capture-phase window
  // handler can open palettes instead of feeding the PTY.
  term.attachCustomKeyEventHandler((ev) => {
    if (ev.type !== "keydown") return true;
    return !isAppShortcut(ev);
  });
  // When a TUI leaves the alternate screen, clear focus/mouse modes it may
  // have left on so later focus/CPR replies don't type into the shell.
  term.buffer.onBufferChange((buf) => {
    if (buf.type === "normal") disableShellLeakingModes(term);
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
  term.options.overviewRuler = { width: 4 };
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
    entry.term.options.overviewRuler = { width: 4 };
  }
}
