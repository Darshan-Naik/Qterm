import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { countAgentTasks, updateInstallWarning } from "./updateInstallWarning.ts";

describe("updateInstallWarning", () => {
  it("is silent when nothing is open", () => {
    assert.equal(updateInstallWarning({ sessionCount: 0, busy: [], agentTasks: 0 }), null);
  });

  it("warns about idle open terminals", () => {
    const w = updateInstallWarning({ sessionCount: 2, busy: [], agentTasks: 0 });
    assert.equal(w?.title, "Open terminals will close");
    assert.match(w?.description || "", /2 open terminals/);
    assert.equal(w?.destructive, false);
  });

  it("warns that running commands will be killed", () => {
    const w = updateInstallWarning({
      sessionCount: 3,
      busy: [{ name: "Alpha", commands: ["claude", "npm"] }],
      agentTasks: 0,
    });
    assert.equal(w?.title, "Running work will be killed");
    assert.match(w?.description || "", /claude and npm are still running/);
    assert.match(w?.description || "", /kill that work/);
    assert.equal(w?.destructive, true);
  });

  it("warns about an in-progress agent when no OS children were found", () => {
    const w = updateInstallWarning({ sessionCount: 1, busy: [], agentTasks: 1 });
    assert.equal(w?.destructive, true);
    assert.match(w?.description || "", /An agent is still working/);
  });
});

describe("countAgentTasks", () => {
  it("counts thinking and needs-input panes", () => {
    assert.equal(
      countAgentTasks({ a: "thinking", b: "action_required", c: "idle", d: "none" }),
      2,
    );
    assert.equal(countAgentTasks(undefined), 0);
  });
});
