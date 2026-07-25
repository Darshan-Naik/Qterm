/** Long-lived xterm instances so switching panes/scopes does not wipe content. */

import { Terminal, type ITheme } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { EventsOn } from "../../../wailsjs/runtime/runtime";
import { GetScrollback, ResizeSession, WriteSessionBytes } from "../../../wailsjs/go/main/App";

function b64encode(u8: Uint8Array) {
  let s = "";
  u8.forEach((b) => (s += String.fromCharCode(b)));
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
  const dataDisposable = term.onData((data) => {
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
