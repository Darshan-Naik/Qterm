/**
 * Utilities for managing terminal state during scrollback restore.
 *
 * Following VS Code and Hyper's approach: we do NOT filter mouse events.
 * These utilities are only used for cleaning up state after scrollback restore,
 * not for ongoing event filtering.
 */

import type { Terminal } from "@xterm/xterm";

type DecPrivateModes = { sendFocus: boolean };
type CoreMouseService = {
  reset: () => void;
  activeProtocol: string;
  activeEncoding: string;
};
type BufferSet = {
  activateNormalBuffer?: () => void;
};
type BufferService = {
  buffers?: BufferSet;
};
type XtermCore = {
  coreService?: { decPrivateModes?: DecPrivateModes };
  coreMouseService?: CoreMouseService;
  _bufferService?: BufferService;
};

function coreOf(term: Terminal): XtermCore | undefined {
  return (term as unknown as { _core?: XtermCore })._core;
}

function onNormalBuffer(term: Terminal): boolean {
  return term.buffer.active.type === "normal";
}

/**
 * Force the emulator onto the primary screen (display state only).
 *
 * After scrollback restore, history may end mid-alt (`1049h` without `1049l`)
 * while the live PTY is already a normal shell. This synchronously switches
 * to the primary buffer so pending live chunks can be flushed correctly.
 *
 * Returns true when primary is active now; false if only an async CSI fallback
 * was queued (caller should wait on its callback).
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

  // Last resort: async CSI
  term.write("\x1b[?1049l", whenReady);
  return false;
}

/**
 * Synchronously clear focus-report + mouse tracking in the emulator.
 *
 * Used after scrollback restore to clean up any mouse modes that may have
 * been left enabled by the restored history. This is a one-time cleanup,
 * not continuous filtering.
 *
 * xterm v6 paths (verified against @xterm/xterm 6.0.0):
 *   term._core.coreService.decPrivateModes.sendFocus
 *   term._core.coreMouseService.reset() / activeProtocol / activeEncoding
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

  // Fallback to async write if internals are unavailable
  if (!dm && !mouse) {
    term.write(
      "\x1b[?1000l\x1b[?1001l\x1b[?1002l\x1b[?1003l\x1b[?1004l\x1b[?1005l\x1b[?1006l\x1b[?1015l\x1b[?1016l"
    );
  }
}
