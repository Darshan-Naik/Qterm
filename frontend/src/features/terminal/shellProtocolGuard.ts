/**
 * Keep xterm auto-replies (focus, DA, CPR, mouse, DECRPM) from reaching the
 * shell PTY while the normal buffer is active.
 *
 * Root cause: TUIs leave DEC modes on / leave queries in the stream. xterm
 * then emits replies into onData, which we used to forward blindly. Clearing
 * modes via term.write() is racy — WriteBuffer is async — so sendFocus stays
 * true across focus events until the next tick.
 *
 * Forward gate must accept an entire onData chunk of one or more concatenated
 * auto-replies (mousemove storms). Exact single-reply `$` match let batches
 * through. Never mid-string strip mixed user+protocol data (that left `1;2c`
 * orphans).
 */

import type { IDisposable, Terminal } from "@xterm/xterm";

/** DEC modes that make xterm synthesize input toward the PTY. */
type DecPrivateModes = { sendFocus: boolean };
type CoreMouseService = {
  reset: () => void;
  activeProtocol: string;
  activeEncoding: string;
};
type XtermCore = {
  coreService?: { decPrivateModes?: DecPrivateModes };
  coreMouseService?: CoreMouseService;
};

/**
 * One full xterm auto-reply. Used as `(?:…)+` against the entire onData chunk.
 * Covers focus, DA, CPR, DECRPM, and mouse (SGR / urxvt-style / X10).
 */
const XTERM_AUTO_REPLY =
  "(?:" +
  "\\x1b\\[I|" +
  "\\x1b\\[O|" +
  "\\x1b\\[0n|" +
  "\\x1b\\[\\?\\d+(?:;\\d+)*c|" +
  "\\x1b\\[>\\d+(?:;\\d+)*c|" +
  "\\x1b\\[\\d+;\\d+R|" +
  "\\x1b\\[\\?\\d+;\\d+R|" +
  "\\x1b\\[\\??\\d+;\\d+\\$y|" +
  "\\x1b\\[<\\d+;\\d+;\\d+[Mm]|" +
  "\\x1b\\[\\d+;\\d+;\\d+[Mm]|" +
  "\\x1b\\[M[\\s\\S]{3}" +
  ")";

const ENTIRE_CHUNK_AUTO_REPLIES = new RegExp(`^(?:${XTERM_AUTO_REPLY})+$`);

function coreOf(term: Terminal): XtermCore | undefined {
  return (term as unknown as { _core?: XtermCore })._core;
}

function onNormalBuffer(term: Terminal): boolean {
  return term.buffer.active.type === "normal";
}

/**
 * Synchronously clear focus-report + mouse tracking in the emulator.
 * Prefer this over term.write(DECRST…): write is async and races focus events.
 *
 * xterm v6 paths (verified against @xterm/xterm 6.0.0):
 *   term._core.coreService.decPrivateModes.sendFocus
 *   term._core.coreMouseService.reset() / activeProtocol / activeEncoding
 * Public term.modes mirrors those; use it for reads, not as the clear target.
 */
export function clearLeakingDecModes(term: Terminal): void {
  const core = coreOf(term);
  const dm = core?.coreService?.decPrivateModes;
  if (dm) dm.sendFocus = false;

  const mouse = core?.coreMouseService;
  if (mouse?.reset) {
    mouse.reset();
  } else if (mouse) {
    mouse.activeProtocol = "NONE";
    mouse.activeEncoding = "DEFAULT";
  }

  // Public modes mirror core; if internals are unavailable, fall back to async write.
  if (!dm && !mouse) {
    term.write(
      "\x1b[?1000l\x1b[?1001l\x1b[?1002l\x1b[?1003l\x1b[?1004l\x1b[?1005l\x1b[?1006l\x1b[?1015l\x1b[?1016l"
    );
  }
}

/**
 * Swallow DA / DSR(CPR) / DECRQM queries on the normal buffer so xterm never
 * generates the corresponding onData replies. Alternate-screen TUIs still get
 * default handling (handler returns false → fall through).
 */
export function installShellQuerySuppression(term: Terminal): IDisposable {
  const suppress = () => onNormalBuffer(term);
  const disposables = [
    term.parser.registerCsiHandler({ final: "c" }, suppress),
    term.parser.registerCsiHandler({ prefix: ">", final: "c" }, suppress),
    term.parser.registerCsiHandler({ final: "n" }, suppress),
    term.parser.registerCsiHandler({ prefix: "?", final: "n" }, suppress),
    term.parser.registerCsiHandler({ intermediates: "$", final: "y" }, suppress),
    term.parser.registerCsiHandler({ prefix: "?", intermediates: "$", final: "y" }, suppress),
  ];
  return {
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}

/**
 * After DECSET on the normal buffer, undo focus/mouse so PTY replay cannot
 * leave tracking on (applyChunk write is async; buffer-change alone misses
 * same-buffer DECSET). Alt-screen DECSET is left alone.
 */
export function installNormalBufferDecSetGuard(term: Terminal): IDisposable {
  return term.parser.registerCsiHandler({ prefix: "?", final: "h" }, () => {
    if (!onNormalBuffer(term)) return false;
    queueMicrotask(() => {
      if (onNormalBuffer(term)) clearLeakingDecModes(term);
    });
    return false;
  });
}

/** Full-payload mouse reports xterm emits when mouse tracking is on. */
export function isMouseReport(data: string): boolean {
  return (
    /^\x1b\[<\d+;\d+;\d+[Mm]$/.test(data) ||
    /^\x1b\[\d+;\d+;\d+[Mm]$/.test(data) ||
    /^\x1b\[M[\s\S]{3}$/.test(data)
  );
}

/**
 * True when `data` is an entire onData chunk of one or more xterm auto-replies
 * (not user input / paste). Full-chunk match only — never mid-string strip.
 */
export function isXtermAutoReply(data: string): boolean {
  if (!data) return false;
  return ENTIRE_CHUNK_AUTO_REPLIES.test(data);
}

/**
 * Whether onData bytes should be forwarded to the PTY.
 * Alternate buffer: always (TUIs need protocol replies).
 * Normal buffer: drop auto-replies; keep leaking modes off.
 */
export function shouldForwardToPty(term: Terminal, data: string): boolean {
  if (!onNormalBuffer(term)) return true;

  // Always sync-clear on the shell buffer so mouse/focus cannot stay armed.
  clearLeakingDecModes(term);
  return !isXtermAutoReply(data);
}

/** Install buffer-change mode clear + query suppression for a terminal lifetime. */
export function installShellProtocolGuard(term: Terminal): IDisposable {
  clearLeakingDecModes(term);
  const queries = installShellQuerySuppression(term);
  const decSet = installNormalBufferDecSetGuard(term);
  const bufferChange = term.buffer.onBufferChange((buf) => {
    if (buf.type === "normal") clearLeakingDecModes(term);
  });
  return {
    dispose() {
      queries.dispose();
      decSet.dispose();
      bufferChange.dispose();
    },
  };
}
