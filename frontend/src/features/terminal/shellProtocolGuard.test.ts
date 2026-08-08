import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { describe, it } from "node:test";
import type { Terminal as TerminalType } from "@xterm/xterm";
import {
  clearLeakingDecModes,
  installShellProtocolGuard,
  isXtermAutoReply,
  shouldForwardToPty,
} from "./shellProtocolGuard.ts";

const require = createRequire(import.meta.url);
const { Terminal } = require("@xterm/xterm") as {
  Terminal: new (options?: object) => TerminalType;
};

function write(term: TerminalType, data: string): Promise<void> {
  return new Promise((resolve) => term.write(data, resolve));
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

  it("does not emit DA/CPR into onData on normal buffer", async () => {
    const term = new Terminal({ allowProposedApi: true, cols: 80, rows: 24 });
    const guard = installShellProtocolGuard(term);
    const got: string[] = [];
    term.onData((d) => got.push(d));

    await write(term, "\x1b[c");
    await write(term, "\x1b[6n");
    assert.deepEqual(got, []);

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

  it("forwards keystrokes on normal and drops focus/DA/mouse replies", async () => {
    const term = new Terminal({ allowProposedApi: true, cols: 80, rows: 24 });
    installShellProtocolGuard(term);

    assert.equal(shouldForwardToPty(term, "a"), true);
    assert.equal(shouldForwardToPty(term, "\t"), true);
    assert.equal(shouldForwardToPty(term, "\r"), true);
    assert.equal(shouldForwardToPty(term, "\x03"), true);
    assert.equal(shouldForwardToPty(term, "hello\n"), true);
    assert.equal(shouldForwardToPty(term, "\x1b[I"), false);
    assert.equal(shouldForwardToPty(term, "\x1b[?1;2c"), false);
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

  it("undoes mouse DECSET on normal buffer so tracking cannot stick", async () => {
    const term = new Terminal({ allowProposedApi: true, cols: 80, rows: 24 });
    installShellProtocolGuard(term);

    await write(term, "\x1b[?1003h\x1b[?1006h");
    // DECSET applies then microtask guard clears.
    await new Promise<void>((r) => queueMicrotask(r));
    assert.equal(term.modes.mouseTrackingMode, "none");
    assert.equal(term.modes.sendFocusMode, false);

    // Alt buffer may still enable mouse for TUIs.
    await write(term, "\x1b[?1049h\x1b[?1003h\x1b[?1006h");
    await new Promise<void>((r) => queueMicrotask(r));
    assert.equal(term.buffer.active.type, "alternate");
    assert.notEqual(term.modes.mouseTrackingMode, "none");
    term.dispose();
  });
});
