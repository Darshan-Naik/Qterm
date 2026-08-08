/**
 * Keep xterm auto-replies (focus, DA, CPR, mouse, DECRPM) from reaching the
 * shell PTY while the normal buffer is active.
 *
 * Root cause: TUIs leave DEC modes on / leave queries in the stream. xterm
 * then emits replies into onData, which we used to forward blindly. Clearing
 * modes via term.write() is racy — WriteBuffer is async — so sendFocus stays
 * true across focus events until the next tick.
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

function coreOf(term: Terminal): XtermCore | undefined {
  return (term as unknown as { _core?: XtermCore })._core;
}

function onNormalBuffer(term: Terminal): boolean {
  return term.buffer.active.type === "normal";
}

/**
 * Synchronously clear focus-report + mouse tracking in the emulator.
 * Prefer this over term.write(DECRST…): write is async and races focus events.
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

/** Full-payload mouse reports xterm emits when mouse tracking is on. */
export function isMouseReport(data: string): boolean {
  return (
    /^\x1b\[<\d+;\d+;\d+[Mm]$/.test(data) ||
    /^\x1b\[\d+;\d+;\d+[Mm]$/.test(data) ||
    /^\x1b\[M[\s\S]{3}$/.test(data)
  );
}

/**
 * True when `data` is an entire xterm auto-reply (not user input / paste).
 * Exact payload match only — never mid-string strip (that left `1;2c` crumbs).
 */
export function isXtermAutoReply(data: string): boolean {
  if (!data) return false;
  if (data === "\x1b[I" || data === "\x1b[O") return true;
  if (data === "\x1b[0n") return true;
  if (/^\x1b\[\?\d+(?:;\d+)*c$/.test(data)) return true;
  if (/^\x1b\[>\d+(?:;\d+)*c$/.test(data)) return true;
  if (/^\x1b\[\d+;\d+R$/.test(data)) return true;
  if (/^\x1b\[\?\d+;\d+R$/.test(data)) return true;
  if (/^\x1b\[\??\d+;\d+\$y$/.test(data)) return true;
  return isMouseReport(data);
}

/**
 * Whether onData bytes should be forwarded to the PTY.
 * Alternate buffer: always (TUIs need protocol replies).
 * Normal buffer: drop auto-replies; ensure leaking modes stay off.
 */
export function shouldForwardToPty(term: Terminal, data: string): boolean {
  if (!onNormalBuffer(term)) return true;

  if (term.modes.sendFocusMode || term.modes.mouseTrackingMode !== "none") {
    clearLeakingDecModes(term);
  }
  return !isXtermAutoReply(data);
}

/** Install buffer-change mode clear + query suppression for a terminal lifetime. */
export function installShellProtocolGuard(term: Terminal): IDisposable {
  clearLeakingDecModes(term);
  const queries = installShellQuerySuppression(term);
  const bufferChange = term.buffer.onBufferChange((buf) => {
    if (buf.type === "normal") clearLeakingDecModes(term);
  });
  return {
    dispose() {
      queries.dispose();
      bufferChange.dispose();
    },
  };
}
