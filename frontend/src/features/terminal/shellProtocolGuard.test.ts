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

  it("forwards keystrokes on normal and drops focus/DA replies", async () => {
    const term = new Terminal({ allowProposedApi: true, cols: 80, rows: 24 });
    installShellProtocolGuard(term);

    assert.equal(shouldForwardToPty(term, "a"), true);
    assert.equal(shouldForwardToPty(term, "\t"), true);
    assert.equal(shouldForwardToPty(term, "\r"), true);
    assert.equal(shouldForwardToPty(term, "\x03"), true);
    assert.equal(shouldForwardToPty(term, "\x1b[I"), false);
    assert.equal(shouldForwardToPty(term, "\x1b[?1;2c"), false);

    await write(term, "\x1b[?1049h");
    assert.equal(shouldForwardToPty(term, "\x1b[I"), true);
    assert.equal(shouldForwardToPty(term, "\x1b[?1;2c"), true);
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
});
