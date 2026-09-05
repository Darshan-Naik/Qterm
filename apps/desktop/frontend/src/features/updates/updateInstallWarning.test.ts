import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  closeUpdateLabel,
  countAgentTasks,
  downloadPercent,
  remindLaterLabel,
  restartUpdateLabel,
  sidebarUpdateLabel,
  tryAgainLabel,
  updateDialogCopy,
  updateInstallWarning,
} from "./updateInstallWarning.ts";

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

describe("downloadPercent", () => {
  it("returns null until the total size is known", () => {
    assert.equal(downloadPercent(12, 0), null);
    assert.equal(downloadPercent(-1, 10), null);
  });

  it("clamps to 0–100", () => {
    assert.equal(downloadPercent(0, 100), 0);
    assert.equal(downloadPercent(50, 100), 50);
    assert.equal(downloadPercent(200, 100), 100);
  });
});

describe("sidebarUpdateLabel", () => {
  it("stays a simple Update chip even while a download is in progress", () => {
    assert.equal(sidebarUpdateLabel("1.7.0"), "Update 1.7.0");
    assert.equal(sidebarUpdateLabel(""), "Update");
    assert.doesNotMatch(sidebarUpdateLabel("1.7.0"), /download|%|progress/i);
  });
});

describe("updateDialogCopy", () => {
  it("shows download progress and keeps Restart disabled until the file is ready", () => {
    const copy = updateDialogCopy({
      version: "1.7.0",
      state: "downloading",
      error: "",
      available: true,
    });
    assert.equal(copy.title, "Downloading Qterm 1.7.0");
    assert.equal(copy.showProgress, true);
    assert.equal(copy.progressLabel, "Downloading");
    assert.equal(copy.primaryLabel, restartUpdateLabel);
    assert.equal(copy.primaryDisabled, true);
  });

  it("enables Restart to update when the download is ready", () => {
    const copy = updateDialogCopy({
      version: "1.7.0",
      state: "ready",
      error: "",
      available: true,
    });
    assert.equal(copy.title, "Qterm 1.7.0 is ready");
    assert.equal(copy.showProgress, true);
    assert.equal(copy.primaryLabel, restartUpdateLabel);
    assert.equal(copy.primaryDisabled, false);
  });

  it("offers Try again after a download error", () => {
    const copy = updateDialogCopy({
      version: "1.7.0",
      state: "error",
      error: "network down",
      available: true,
    });
    assert.equal(copy.primaryLabel, tryAgainLabel);
    assert.equal(copy.primaryDisabled, false);
    assert.equal(copy.showProgress, false);
    assert.match(copy.description, /network down/);
  });

  it("exposes Close and Remind me later labels for the dialog actions", () => {
    assert.equal(closeUpdateLabel, "Close");
    assert.equal(remindLaterLabel, "Remind me later");
  });
});
