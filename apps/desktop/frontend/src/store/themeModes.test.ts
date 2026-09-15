import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isThemeMode, THEME_MODES } from "./types.ts";

describe("theme modes", () => {
  it("includes modern-dark", () => {
    assert.ok(THEME_MODES.includes("modern-dark"));
  });

  it("accepts known theme ids", () => {
    assert.equal(isThemeMode("modern-dark"), true);
    assert.equal(isThemeMode("dark"), true);
    assert.equal(isThemeMode("light"), true);
    assert.equal(isThemeMode("system"), true);
  });

  it("rejects unknown theme ids", () => {
    assert.equal(isThemeMode("vscode"), false);
    assert.equal(isThemeMode(""), false);
    assert.equal(isThemeMode("Modern Dark"), false);
  });
});
