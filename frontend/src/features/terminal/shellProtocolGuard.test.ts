import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { describe, it } from "node:test";
import type { Terminal as TerminalType } from "@xterm/xterm";
import {
  clearLeakingDecModes,
  installShellProtocolGuard,
  isMouseOrFocusReport,
  isXtermAutoReply,
  shouldForwardToPty,
} from "./shellProtocolGuard.ts";

const require = createRequire(import.meta.url);
const { Terminal } = require("@xterm/xterm") as {
  Terminal: new (options?: object) => TerminalType;
};

/** CoreMouseButton.NONE / CoreMouseAction.MOVE — from @xterm/xterm Types. */
const MOUSE_NONE = 3;
const MOUSE_MOVE = 32;

function write(term: TerminalType, data: string): Promise<void> {
  return new Promise((resolve) => term.write(data, resolve));
}

function coreMouse(term: TerminalType) {
  return (
    term as unknown as {
      _core: {
        coreMouseService: {
          activeProtocol: string;
          activeEncoding: string;
          triggerMouseEvent: (e: {
            col: number;
            row: number;
            x: number;
            y: number;
            button: number;
            action: number;
            ctrl: boolean;
            alt: boolean;
            shift: boolean;
          }) => boolean;
        };
        coreService: {
          triggerDataEvent: (data: string, wasUserInput?: boolean) => void;
        };
      };
    }
  )._core.coreMouseService;
}

function coreService(term: TerminalType) {
  return (
    term as unknown as {
      _core: { coreService: { triggerDataEvent: (data: string, wasUserInput?: boolean) => void } };
    }
  )._core.coreService;
}

function triggerMotion(term: TerminalType, col = 6, row = 12): boolean {
  return coreMouse(term).triggerMouseEvent({
    col,
    row,
    x: 0,
    y: 0,
    button: MOUSE_NONE,
    action: MOUSE_MOVE,
    ctrl: false,
    alt: false,
    shift: false,
  });
}

describe("isXtermAutoReply", () => {
  it("matches focus / DA / CPR / mouse full payloads", () => {
    assert.equal(isXtermAutoReply("\x1b[I"), true);
    assert.equal(isXtermAutoReply("\x1b[O"), true);
    assert.equal(isXtermAutoReply("\x1b[?1;2c"), true);
    assert.equal(isXtermAutoReply("\x1b[>0;276;0c"), true);
    assert.equal(isXtermAutoReply("\x1b[1;1R"), true);
    assert.equal(isXtermAutoReply("\x1b[?1;1R"), true);
    assert.equal(isXtermAutoReply("\x1b[?1004;1$y"), true);
    assert.equal(isXtermAutoReply("\x1b[<0;1;1M"), true);
    assert.equal(isXtermAutoReply("\x1b[<35;67;41M"), true);
    assert.equal(isXtermAutoReply("\x1b[35;67;41M"), true);
  });

  it("matches batched concatenated auto-replies as one chunk", () => {
    const batchedMouse =
      "\x1b[<35;67;41M\x1b[<35;6;28M\x1b[<35;58;28M\x1b[<35;10;12M";
    assert.equal(isXtermAutoReply(batchedMouse), true);

    const batchedFocusDa = "\x1b[I\x1b[?1;2c\x1b[O\x1b[?1;2c";
    assert.equal(isXtermAutoReply(batchedFocusDa), true);

    const mixedSgrUrxvt = "\x1b[<35;1;1M\x1b[35;2;2M\x1b[I";
    assert.equal(isXtermAutoReply(mixedSgrUrxvt), true);
  });

  it("does not match real keystrokes or paste", () => {
    assert.equal(isXtermAutoReply("a"), false);
    assert.equal(isXtermAutoReply("\t"), false);
    assert.equal(isXtermAutoReply("\r"), false);
    assert.equal(isXtermAutoReply("\x03"), false);
    assert.equal(isXtermAutoReply("\x1b[A"), false); // up arrow
    assert.equal(isXtermAutoReply("hello\n"), false);
    // Orphan crumbs must NOT be treated as auto-replies — never strip mid-string.
    assert.equal(isXtermAutoReply("1;2c"), false);
    assert.equal(isXtermAutoReply("ls 1;2c"), false);
    // Mixed user + protocol: forward whole chunk (do not strip).
    assert.equal(isXtermAutoReply("ls\x1b[<35;1;1M"), false);
    assert.equal(isXtermAutoReply("\x1b[Ihello"), false);
  });
});

describe("isMouseOrFocusReport", () => {
  it("matches mouse and focus only — not DA/CPR", () => {
    assert.equal(isMouseOrFocusReport("\x1b[I"), true);
    assert.equal(isMouseOrFocusReport("\x1b[O"), true);
    assert.equal(isMouseOrFocusReport("\x1b[<35;67;41M"), true);
    assert.equal(isMouseOrFocusReport("\x1b[?1;2c"), false);
    assert.equal(isMouseOrFocusReport("\x1b[1;1R"), false);
    assert.equal(isMouseOrFocusReport("\x1b]11;rgb:0a0a/0a0a/0a0a\x1b\\"), false);
  });
});

describe("shell protocol guard (xterm)", () => {
  it("clears sendFocus synchronously (unlike term.write)", async () => {
    const term = new Terminal({ allowProposedApi: true, cols: 80, rows: 24 });
    await write(term, "\x1b[?1004h\x1b[?1000h");
    assert.equal(term.modes.sendFocusMode, true);
    assert.notEqual(term.modes.mouseTrackingMode, "none");

    term.write("\x1b[?1004l\x1b[?1000l");
    assert.equal(term.modes.sendFocusMode, true, "async write must not clear yet");

    clearLeakingDecModes(term);
    assert.equal(term.modes.sendFocusMode, false);
    assert.equal(term.modes.mouseTrackingMode, "none");
    term.dispose();
  });

  it("emits DA/CPR on normal buffer (themes need answers; Go handles latency)", async () => {
    const term = new Terminal({ allowProposedApi: true, cols: 80, rows: 24 });
    const guard = installShellProtocolGuard(term);
    const got: string[] = [];
    term.onData((d) => got.push(d));

    await write(term, "\x1b[c");
    await write(term, "\x1b[6n");
    assert.ok(got.some((d) => d === "\x1b[?1;2c"));
    assert.ok(got.some((d) => /^\x1b\[\d+;\d+R$/.test(d)));

    guard.dispose();
    term.dispose();
  });

  it("still emits DA/CPR on alternate buffer", async () => {
    const term = new Terminal({ allowProposedApi: true, cols: 80, rows: 24 });
    const guard = installShellProtocolGuard(term);
    const got: string[] = [];
    term.onData((d) => got.push(d));

    await write(term, "\x1b[?1049h");
    assert.equal(term.buffer.active.type, "alternate");
    await write(term, "\x1b[c");
    await write(term, "\x1b[6n");
    assert.ok(got.some((d) => d === "\x1b[?1;2c"));
    assert.ok(got.some((d) => /^\x1b\[\d+;\d+R$/.test(d)));

    guard.dispose();
    term.dispose();
  });

  it("forwards keystrokes and DA on normal; drops mouse/focus only", async () => {
    const term = new Terminal({ allowProposedApi: true, cols: 80, rows: 24 });
    installShellProtocolGuard(term);

    assert.equal(shouldForwardToPty(term, "a"), true);
    assert.equal(shouldForwardToPty(term, "\t"), true);
    assert.equal(shouldForwardToPty(term, "\r"), true);
    assert.equal(shouldForwardToPty(term, "\x03"), true);
    assert.equal(shouldForwardToPty(term, "hello\n"), true);
    // DA/CPR must reach the shell on the live path.
    assert.equal(shouldForwardToPty(term, "\x1b[?1;2c"), true);
    assert.equal(shouldForwardToPty(term, "\x1b[1;1R"), true);
    assert.equal(shouldForwardToPty(term, "\x1b[I"), false);
    assert.equal(shouldForwardToPty(term, "\x1b[<35;67;41M"), false);
    assert.equal(
      shouldForwardToPty(term, "\x1b[<35;67;41M\x1b[<35;6;28M\x1b[<35;58;28M"),
      false
    );

    await write(term, "\x1b[?1049h");
    assert.equal(shouldForwardToPty(term, "\x1b[I"), true);
    assert.equal(shouldForwardToPty(term, "\x1b[?1;2c"), true);
    assert.equal(shouldForwardToPty(term, "\x1b[<35;67;41M"), true);
    term.dispose();
  });

  it("while muted, drops non-user-input (seed must not write to live PTY)", async () => {
    const term = new Terminal({ allowProposedApi: true, cols: 80, rows: 24 });
    let muted = true;
    installShellProtocolGuard(term, { isMuted: () => muted });

    const got: string[] = [];
    term.onData((d) => got.push(d));

    // Seed-like write containing the queries that used to leak as prompt garbage.
    await write(term, "\x1b]11;?\x07\x1b[c\x1b[6n");
    assert.deepEqual(got, [], "muted seed must not emit auto-replies to onData");

    // Direct core emit with wasUserInput=false is also dropped.
    coreService(term).triggerDataEvent("\x1b[?1;2c", false);
    assert.deepEqual(got, []);

    // User input still flows while muted (typing during seed is rare but valid).
    coreService(term).triggerDataEvent("x", true);
    assert.deepEqual(got, ["x"]);

    muted = false;
    got.length = 0;
    await write(term, "\x1b[c");
    assert.ok(got.some((d) => d === "\x1b[?1;2c"));

    term.dispose();
  });

  it("clears leaking modes when returning to normal buffer", async () => {
    const term = new Terminal({ allowProposedApi: true, cols: 80, rows: 24 });
    installShellProtocolGuard(term);

    await write(term, "\x1b[?1049h\x1b[?1004h\x1b[?1000h");
    assert.equal(term.buffer.active.type, "alternate");
    assert.equal(term.modes.sendFocusMode, true);

    await write(term, "\x1b[?1049l");
    assert.equal(term.buffer.active.type, "normal");
    assert.equal(term.modes.sendFocusMode, false);
    assert.equal(term.modes.mouseTrackingMode, "none");
    term.dispose();
  });

  it("blocks mouse DECSET on normal synchronously (no microtask)", async () => {
    const term = new Terminal({ allowProposedApi: true, cols: 80, rows: 24 });
    installShellProtocolGuard(term);

    await write(term, "\x1b[?1003h\x1b[?1006h");
    // Must be off as soon as write completes — not only after a microtask.
    assert.equal(term.modes.mouseTrackingMode, "none");
    assert.equal(coreMouse(term).activeProtocol, "NONE");
    assert.equal(term.modes.sendFocusMode, false);

    // Mixed DECSET: leak modes blocked, safe modes still apply (async re-issue).
    await write(term, "\x1b[?1000;2004h");
    assert.equal(term.modes.mouseTrackingMode, "none");
    await new Promise<void>((r) => queueMicrotask(r));
    await new Promise<void>((r) => setTimeout(r, 0));
    assert.equal(term.modes.bracketedPasteMode, true);
    assert.equal(term.modes.mouseTrackingMode, "none");

    // Alt buffer may still enable mouse for TUIs.
    await write(term, "\x1b[?1049h\x1b[?1003h\x1b[?1006h");
    assert.equal(term.buffer.active.type, "alternate");
    assert.notEqual(term.modes.mouseTrackingMode, "none");
    term.dispose();
  });

  it("never generates mouse reports on normal — even if force-armed", async () => {
    const term = new Terminal({ allowProposedApi: true, cols: 80, rows: 24 });
    installShellProtocolGuard(term);

    const forwarded: string[] = [];
    const rawData: string[] = [];
    const rawBinary: string[] = [];
    // Same pattern as sessionTerminals.ts
    term.onData((data) => {
      rawData.push(data);
      if (!shouldForwardToPty(term, data)) return;
      forwarded.push(data);
    });
    const onBinary = (
      term as unknown as { onBinary: (cb: (d: string) => void) => { dispose(): void } }
    ).onBinary;
    onBinary((data) => {
      rawBinary.push(data);
      if (!shouldForwardToPty(term, data)) return;
      forwarded.push(data);
    });

    // Attempt to arm mouse via DECSET on normal — must stay disarmed.
    await write(term, "\x1b[?1003h\x1b[?1006h");
    assert.equal(term.modes.mouseTrackingMode, "none");
    assert.equal(triggerMotion(term), false);
    assert.deepEqual(rawData, []);
    assert.deepEqual(rawBinary, []);
    assert.deepEqual(forwarded, []);

    // Force-arm tracking the way a buggy path might (bypass DECSET).
    // Generation must still stop: triggerMouseEvent returns false, emits nothing.
    const mouse = coreMouse(term);
    mouse.activeProtocol = "ANY";
    mouse.activeEncoding = "SGR";
    assert.equal(triggerMotion(term, 14, 13), false, "normal buffer must not encode mouse");
    assert.deepEqual(rawData, [], `expected zero onData, got ${JSON.stringify(rawData)}`);
    assert.deepEqual(rawBinary, [], `expected zero onBinary, got ${JSON.stringify(rawBinary)}`);
    assert.deepEqual(forwarded, []);
    assert.equal(term.modes.mouseTrackingMode, "none");
    assert.equal(mouse.activeProtocol, "NONE");

    term.dispose();
  });

  it("allows mouse on alternate, then blocks after return to normal", async () => {
    const term = new Terminal({ allowProposedApi: true, cols: 80, rows: 24 });
    installShellProtocolGuard(term);

    const got: string[] = [];
    term.onData((d) => got.push(d));

    // Alt screen: mouse reports must still flow (TUI).
    await write(term, "\x1b[?1049h\x1b[?1003h\x1b[?1006h");
    assert.equal(term.buffer.active.type, "alternate");
    assert.notEqual(term.modes.mouseTrackingMode, "none");
    assert.equal(triggerMotion(term, 2, 3), true);
    assert.ok(
      got.some((d) => d.startsWith("\x1b[<") && d.endsWith("M")),
      `expected SGR mouse on alt, got ${JSON.stringify(got)}`
    );

    // Leave alt → shell: modes cleared, motion must emit nothing.
    got.length = 0;
    await write(term, "\x1b[?1049l");
    assert.equal(term.buffer.active.type, "normal");
    assert.equal(term.modes.mouseTrackingMode, "none");

    // Even force-arm after leave-alt must not emit.
    const mouse = coreMouse(term);
    mouse.activeProtocol = "ANY";
    mouse.activeEncoding = "SGR";
    assert.equal(triggerMotion(term, 45, 27), false);
    assert.deepEqual(got, [], `motion on normal must not emit, got ${JSON.stringify(got)}`);
    assert.equal(term.modes.mouseTrackingMode, "none");
    assert.equal(mouse.activeProtocol, "NONE");

    term.dispose();
  });

  it("restores original triggerMouseEvent on dispose", async () => {
    const term = new Terminal({ allowProposedApi: true, cols: 80, rows: 24 });
    const before = coreMouse(term).triggerMouseEvent;
    const guard = installShellProtocolGuard(term);
    assert.notEqual(coreMouse(term).triggerMouseEvent, before);
    guard.dispose();
    // After dispose, force-arm + motion can emit again (no guard).
    const mouse = coreMouse(term);
    mouse.activeProtocol = "ANY";
    mouse.activeEncoding = "SGR";
    const got: string[] = [];
    term.onData((d) => got.push(d));
    assert.equal(triggerMotion(term, 1, 1), true);
    assert.ok(got.some((d) => d.startsWith("\x1b[<")));
    term.dispose();
  });
});
