import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  clampNotifyCommandMinSec,
  clampSidebarWidth,
  NOTIFY_COMMAND_MIN_DEFAULT,
  NOTIFY_COMMAND_MIN_MIN,
  NOTIFY_COMMAND_MIN_MAX,
  SIDEBAR_DEFAULT,
  SIDEBAR_MIN,
  SIDEBAR_MAX,
} from "./defaults.ts";

describe("clampNotifyCommandMinSec", () => {
  it("uses the default for 0 or NaN", () => {
    assert.equal(clampNotifyCommandMinSec(0), NOTIFY_COMMAND_MIN_DEFAULT);
    assert.equal(clampNotifyCommandMinSec(Number.NaN), NOTIFY_COMMAND_MIN_DEFAULT);
  });

  it("clamps to min and max", () => {
    assert.equal(clampNotifyCommandMinSec(1), NOTIFY_COMMAND_MIN_MIN);
    assert.equal(clampNotifyCommandMinSec(999), NOTIFY_COMMAND_MIN_MAX);
    assert.equal(clampNotifyCommandMinSec(12), 12);
  });
});

describe("clampSidebarWidth", () => {
  it("keeps the sidebar clamp helper intact", () => {
    assert.equal(clampSidebarWidth(Number.NaN), SIDEBAR_DEFAULT);
    assert.equal(clampSidebarWidth(10), SIDEBAR_MIN);
    assert.equal(clampSidebarWidth(900), SIDEBAR_MAX);
    assert.equal(clampSidebarWidth(240), 240);
  });
});
