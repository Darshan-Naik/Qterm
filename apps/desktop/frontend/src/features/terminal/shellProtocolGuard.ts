/**
 * Keep mouse/focus protocol noise off the shell PTY on the normal buffer.
 *
 * Capability replies (DA, CPR, OSC colors) must reach the shell — themes need
 * them. Latency for those is handled on the Go side (in-process answers +
 * urgent coalesce flush). Swallowing DA/CPR on the live normal buffer is wrong.
 *
 * Native-like rules:
 *   1. Block mouse/focus DECSET on the normal buffer (do not apply-then-undo).
 *   2. Patch CoreMouseService.prototype.triggerMouseEvent once: on normal →
 *      reset + return false (no encode, no emit). Instance wraps are wrong —
 *      dispose/reinstall shadows the live method and open/bindMouse must always
 *      hit the guard via the prototype.
 *   3. While muted (scrollback seed / display-only), drop all non-user-input
 *      (and mouse/focus even if marked user-input) so seed cannot feed the PTY.
 *   4. On live normal: core intercept still drops mouse/focus; forward DA/CPR/OSC.
 *   5. onBufferChange→normal sync-clears mouse — xterm itself leaves tracking
 *      armed after 1049l unless DECRST mouse was also sent.
 *   6. Scrollback seed finish: if history left the emulator on alt (truncated
 *      1049l), force primary for display state, then disarm mouse — live PTY
 *      apps that need alt re-send 1049h in pending/live chunks after seed.
 *
 * Alternate-screen TUIs keep full mouse/focus/DA behavior.
 *
 * Never mid-string strip mixed user+protocol data (that left `1;2c` orphans).
 */

import type { IDisposable, Terminal } from "@xterm/xterm";

/** DEC modes that make xterm synthesize input toward the PTY. */
type DecPrivateModes = { sendFocus: boolean };
type CoreMouseService = {
  reset: () => void;
  activeProtocol: string;
  activeEncoding: string;
  triggerMouseEvent?: (e: {
    col: number;
    row: number;
    x: number;
    y: number;
    button: number;
    action: number;
    ctrl?: boolean;
    alt?: boolean;
    shift?: boolean;
  }) => boolean;
  _bufferService?: {
    buffer: object;
    buffers: { normal: object; alt: object };
  };
};
type CoreService = {
  decPrivateModes?: DecPrivateModes;
  triggerDataEvent?: (data: string, wasUserInput?: boolean) => void;
  triggerBinaryEvent?: (data: string) => void;
};
type BufferSet = {
  activateNormalBuffer?: () => void;
};
type BufferService = {
  buffers?: BufferSet;
};
type XtermCore = {
  coreService?: CoreService;
  coreMouseService?: CoreMouseService;
  /** xterm private field — sync alt→primary without async CSI. */
  _bufferService?: BufferService;
};

/**
 * DEC private modes that arm focus reporting or mouse tracking.
 * Blocked on the normal buffer so xterm never generates reports there.
 */
const LEAKING_DECSET_MODES = new Set([
  9, // X10 mouse
  1000, // VT200 mouse
  1001, // highlight mouse (unused by xterm.js but still a mouse mode)
  1002, // button-event mouse
  1003, // any-event mouse
  1004, // focus in/out
  1005, // UTF-8 mouse (removed; still block)
  1006, // SGR mouse
  1015, // urxvt mouse (removed; still block)
  1016, // SGR-pixels mouse
]);

/**
 * Mouse + focus reports only (not DA/CPR — shells need those on the live path).
 * Used as `(?:…)+` against the entire onData chunk.
 */
const MOUSE_OR_FOCUS_REPLY =
  "(?:" +
  "\\x1b\\[I|" +
  "\\x1b\\[O|" +
  "\\x1b\\[<\\d+;\\d+;\\d+[Mm]|" +
  "\\x1b\\[\\d+;\\d+;\\d+[Mm]|" +
  "\\x1b\\[M[\\s\\S]{3}" +
  ")";

const ENTIRE_CHUNK_MOUSE_OR_FOCUS = new RegExp(`^(?:${MOUSE_OR_FOCUS_REPLY})+$`);

/**
 * Full xterm auto-reply set (tests / diagnostics). Includes DA/CPR/DECRPM.
 * Do not use this to gate live PTY forwarding — themes need DA/CPR.
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

const devLog =
  typeof import.meta !== "undefined" &&
  Boolean((import.meta as { env?: { DEV?: boolean } }).env?.DEV);

let mouseProtoPatched = false;
let mouseProtoOrig: CoreMouseService["triggerMouseEvent"] | undefined;
let loggedInstall = false;
let loggedBlock = false;

function coreOf(term: Terminal): XtermCore | undefined {
  return (term as unknown as { _core?: XtermCore })._core;
}

function onNormalBuffer(term: Terminal): boolean {
  return term.buffer.active.type === "normal";
}

function mouseServiceOnNormal(mouse: CoreMouseService): boolean {
  const bs = mouse._bufferService;
  if (!bs?.buffers) return false;
  return bs.buffer === bs.buffers.normal;
}

function flattenCsiParams(params: (number | number[])[]): number[] {
  const out: number[] = [];
  for (const p of params) {
    out.push(typeof p === "number" ? p : p[0]);
  }
  return out;
}

/**
 * Force the emulator onto the primary screen (display state only).
 *
 * After scrollback seed, history may end mid-alt (`1049h` without `1049l`) while
 * the live PTY is already a normal shell. Leaving the emulator on alt keeps the
 * prototype mouse guard from firing (it only blocks on normal) → motion storms.
 *
 * Prefer xterm's sync `buffers.activateNormalBuffer()` so seed finish can clear
 * mouse and flush pending live chunks in order. Live TUIs re-enter via `1049h`
 * in those pending/live writes. Returns true when primary is active now; false
 * if only an async CSI fallback was queued (caller should wait on its callback).
 */
export function forcePrimaryScreen(term: Terminal, whenReady?: () => void): boolean {
  if (onNormalBuffer(term)) {
    whenReady?.();
    return true;
  }

  const buffers = coreOf(term)?._bufferService?.buffers;
  if (buffers?.activateNormalBuffer) {
    buffers.activateNormalBuffer();
    whenReady?.();
    return true;
  }

  // Last resort: async CSI — preserve caller ordering via whenReady.
  term.write("\x1b[?1049l", whenReady);
  return false;
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
 * Patch CoreMouseService.prototype once for every terminal.
 *
 * Instance assignment is unsafe: ensureShellProtocolPipeline dispose() restores
 * a bound original onto the instance, which shadows any later prototype patch,
 * and a dispose→reinstall gap can emit with no guard. Prototype lookup always
 * hits this patch; open()/reset() do not replace the service class.
 */
function ensureMousePrototypePatch(sample: CoreMouseService): void {
  if (mouseProtoPatched) return;
  const proto = Object.getPrototypeOf(sample) as CoreMouseService;
  if (!proto?.triggerMouseEvent) return;

  mouseProtoOrig = proto.triggerMouseEvent;
  const orig = mouseProtoOrig;
  proto.triggerMouseEvent = function (this: CoreMouseService, e) {
    if (mouseServiceOnNormal(this)) {
      this.reset();
      if (devLog && !loggedBlock) {
        loggedBlock = true;
        console.info("[qterm] shell mouse guard blocked report on normal buffer");
      }
      return false;
    }
    return orig!.call(this, e);
  };
  mouseProtoPatched = true;
  if (devLog && !loggedInstall) {
    loggedInstall = true;
    console.info("[qterm] shell mouse guard: CoreMouseService.prototype patched");
  }
}

/**
 * On the normal buffer, refuse mouse/focus DECSET so tracking never becomes
 * active (apply-then-microtask-undo races: reports can fire while modes are on).
 * Non-leaking modes in the same CSI (e.g. bracketed paste) are re-issued.
 * Alt-screen DECSET is left alone.
 */
export function installNormalBufferDecSetGuard(term: Terminal): IDisposable {
  return term.parser.registerCsiHandler({ prefix: "?", final: "h" }, (params) => {
    if (!onNormalBuffer(term)) return false;

    const modes = flattenCsiParams(params);
    const allowed: number[] = [];
    let blocked = false;
    for (const m of modes) {
      if (LEAKING_DECSET_MODES.has(m)) blocked = true;
      else allowed.push(m);
    }
    if (!blocked) return false;

    // Swallow the original CSI (default setModePrivate never runs).
    if (allowed.length > 0) {
      // Re-enter parser with only safe modes; this handler returns false then.
      term.write(`\x1b[?${allowed.join(";")}h`);
    }
    // Modes must stay off synchronously — do not rely on a microtask clear.
    clearLeakingDecModes(term);
    return true;
  });
}

export type CoreInterceptOptions = {
  /** When true, drop every non-user-input emit (seed / display-only writes). */
  isMuted?: () => boolean;
};

/**
 * Stop mouse-report *generation* on the normal buffer.
 *
 * Uses a process-wide CoreMouseService.prototype patch (see
 * ensureMousePrototypePatch). Also strips any leftover instance own-property
 * from older instance-wrap installs so the prototype guard is reachable.
 */
export function installMouseEventGuard(term: Terminal): IDisposable {
  const mouse = coreOf(term)?.coreMouseService;
  if (!mouse?.triggerMouseEvent) return { dispose() {} };

  ensureMousePrototypePatch(mouse);

  // Older builds assigned an instance own-property wrap; that shadows the
  // prototype and dispose() can put the real method back on the instance.
  if (Object.prototype.hasOwnProperty.call(mouse, "triggerMouseEvent")) {
    delete (mouse as { triggerMouseEvent?: unknown }).triggerMouseEvent;
  }

  if (onNormalBuffer(term)) clearLeakingDecModes(term);

  return {
    dispose() {
      // Keep the prototype patch for other / future terminals. Only ensure this
      // instance does not shadow it with a stale own-property.
      if (Object.prototype.hasOwnProperty.call(mouse, "triggerMouseEvent")) {
        delete (mouse as { triggerMouseEvent?: unknown }).triggerMouseEvent;
      }
    },
  };
}

/**
 * Intercept core emits:
 * - muted: drop all !wasUserInput (scrollback replay must not feed the live PTY)
 * - live normal: drop mouse/focus reports only; DA/CPR/OSC pass through
 * - alternate: unchanged
 *
 * Belt-and-suspenders behind installMouseEventGuard: if anything still emits
 * `\x1b[<35;…M`, this drops it before onData/onBinary listeners.
 */
export function installCoreDataIntercept(
  term: Terminal,
  opts?: CoreInterceptOptions
): IDisposable {
  const cs = coreOf(term)?.coreService;
  if (!cs?.triggerDataEvent) return { dispose() {} };

  const origData = cs.triggerDataEvent.bind(cs);
  const origBinary = cs.triggerBinaryEvent?.bind(cs);
  const muted = () => opts?.isMuted?.() === true;

  cs.triggerDataEvent = (data: string, wasUserInput?: boolean) => {
    if (muted()) {
      // Mouse reports are emitted with wasUserInput=true — still drop them when
      // muted so seed/HMR cannot feed the live PTY.
      if (!wasUserInput || isMouseOrFocusReport(data)) return;
      origData(data, wasUserInput);
      return;
    }
    if (onNormalBuffer(term)) {
      clearLeakingDecModes(term);
      if (isMouseOrFocusReport(data)) return;
    }
    origData(data, wasUserInput);
  };

  if (origBinary && cs.triggerBinaryEvent) {
    cs.triggerBinaryEvent = (data: string) => {
      if (muted()) return;
      if (onNormalBuffer(term)) {
        clearLeakingDecModes(term);
        if (isMouseOrFocusReport(data)) return;
      }
      origBinary(data);
    };
  }

  return {
    dispose() {
      cs.triggerDataEvent = origData;
      if (origBinary && cs.triggerBinaryEvent) {
        cs.triggerBinaryEvent = origBinary;
      }
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

/** True when the entire chunk is mouse and/or focus reports (not DA/CPR). */
export function isMouseOrFocusReport(data: string): boolean {
  if (!data) return false;
  return ENTIRE_CHUNK_MOUSE_OR_FOCUS.test(data);
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
 * Whether onData/onBinary bytes should be forwarded to the PTY.
 * Alternate buffer: always (TUIs need protocol replies).
 * Normal buffer: drop mouse/focus; keep DA/CPR/OSC; keep leaking modes off.
 */
export function shouldForwardToPty(term: Terminal, data: string): boolean {
  if (!onNormalBuffer(term)) return true;

  // Always sync-clear on the shell buffer so mouse/focus cannot stay armed.
  clearLeakingDecModes(term);
  return !isMouseOrFocusReport(data);
}

export type ShellProtocolGuardOptions = {
  /** Seed / display-only: drop emulator→PTY non-user-input. */
  isMuted?: () => boolean;
};

/** Install DECSET mouse/focus block + mouse wrap + core intercept for a terminal lifetime. */
export function installShellProtocolGuard(
  term: Terminal,
  opts?: ShellProtocolGuardOptions
): IDisposable {
  clearLeakingDecModes(term);
  const decSet = installNormalBufferDecSetGuard(term);
  // Prototype patch + strip instance shadows. Safe across dispose/reinstall and
  // across term.open()/reset() (service instance is not replaced).
  const mouseGuard = installMouseEventGuard(term);
  const coreIntercept = installCoreDataIntercept(term, { isMuted: opts?.isMuted });
  // xterm leaves mouse armed after 1049l unless the app also DECRST mouse —
  // clear as soon as we return to the normal buffer.
  const bufferChange = term.buffer.onBufferChange((buf) => {
    if (buf.type === "normal") clearLeakingDecModes(term);
  });
  return {
    dispose() {
      decSet.dispose();
      mouseGuard.dispose();
      coreIntercept.dispose();
      bufferChange.dispose();
    },
  };
}
