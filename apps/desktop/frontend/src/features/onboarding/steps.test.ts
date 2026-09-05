import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { nextSetupStep, prevSetupStep, SETUP_STEPS, setupStepIndex } from "./steps.ts";

describe("setup steps", () => {
  it("walks welcome → theme → agents → ready", () => {
    assert.deepEqual(SETUP_STEPS, ["welcome", "theme", "agents", "ready"]);
    assert.equal(nextSetupStep("welcome"), "theme");
    assert.equal(nextSetupStep("theme"), "agents");
    assert.equal(nextSetupStep("agents"), "ready");
    assert.equal(nextSetupStep("ready"), null);
  });

  it("walks back without leaving welcome", () => {
    assert.equal(prevSetupStep("welcome"), null);
    assert.equal(prevSetupStep("theme"), "welcome");
    assert.equal(prevSetupStep("ready"), "agents");
  });

  it("indexes steps for progress dots", () => {
    assert.equal(setupStepIndex("welcome"), 0);
    assert.equal(setupStepIndex("ready"), 3);
  });
});
