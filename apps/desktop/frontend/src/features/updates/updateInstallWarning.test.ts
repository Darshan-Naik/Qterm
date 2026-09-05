import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { countAgentTasks, updateInstallWarning } from "./updateInstallWarning.ts";

describe("updateInstallWarning", () => {
  it("is silent when nothing is running, even with idle terminals", () => {
    assert.equal(updateInstallWarning({ sessionCount: 11, busy: [], agentTasks: 0 }), null);
    assert.equal(updateInstallWarning({ sessionCount: 0, busy: [], agentTasks: 0 }), null);
  });

  it("warns that a running command will be terminated", () => {
    const w = updateInstallWarning({
      sessionCount: 11,
      busy: [{ name: "Alpha", commands: ["npm"] }],
      agentTasks: 0,
    });
    assert.equal(w?.title, "A process is still running");
    assert.match(w?.description || "", /npm is still running/);
    assert.match(w?.description || "", /will terminate it/);
    assert.doesNotMatch(w?.description || "", /open terminal/);
    assert.equal(w?.destructive, true);
  });

  it("warns that several commands will be killed", () => {
    const w = updateInstallWarning({
      sessionCount: 3,
      busy: [{ name: "Alpha", commands: ["claude", "npm"] }],
      agentTasks: 0,
    });
    assert.equal(w?.title, "Running work will be killed");
    assert.match(w?.description || "", /claude and npm are still running/);
    assert.match(w?.description || "", /terminate that work/);
  });

  it("warns about an in-progress agent when no OS children were found", () => {
    const w = updateInstallWarning({ sessionCount: 1, busy: [], agentTasks: 1 });
    assert.equal(w?.destructive, true);
    assert.equal(w?.title, "Running work will be killed");
    assert.match(w?.description || "", /An agent is still working/);
    assert.match(w?.description || "", /terminate that work/);
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
