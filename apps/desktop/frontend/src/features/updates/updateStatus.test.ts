import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyUpdateProgress,
  applyUpdateStatus,
  compareVersions,
  updatedToastCopy,
} from "./updateStatus.ts";

function status(partial: Record<string, unknown> = {}) {
  return {
    available: true,
    currentVersion: "1.6.1",
    latestVersion: "1.6.2",
    downloadUrl: "https://ex/1.6.2.dmg",
    releaseUrl: "",
    skipped: false,
    state: "ready",
    bytes: 10,
    total: 10,
    error: "",
    ...partial,
  };
}

describe("compareVersions", () => {
  it("orders patch and minor releases", () => {
    assert.equal(compareVersions("1.6.1", "1.6.2"), -1);
    assert.equal(compareVersions("v1.7.0", "1.6.2"), 1);
    assert.equal(compareVersions("1.6.2", "v1.6.2"), 0);
  });
});

describe("applyUpdateStatus", () => {
  it("drops a ready older download when GitHub latest is newer", () => {
    const prev = status({ latestVersion: "1.6.2", state: "ready" });
    const next = status({
      latestVersion: "1.7.0",
      downloadUrl: "https://ex/1.7.0.dmg",
      state: "",
      bytes: 0,
      total: 0,
    });
    const got = applyUpdateStatus(prev, next);
    assert.equal(got.latestVersion, "1.7.0");
    assert.equal(got.state, "");
    assert.equal(got.bytes, 0);
  });

  it("keeps download progress when the latest version is unchanged", () => {
    const prev = status({ latestVersion: "1.7.0", state: "downloading", bytes: 4, total: 10 });
    const next = status({ latestVersion: "1.7.0", state: "", bytes: 0, total: 0 });
    const got = applyUpdateStatus(prev, next);
    assert.equal(got.state, "downloading");
    assert.equal(got.bytes, 4);
    assert.equal(got.total, 10);
  });
});

describe("applyUpdateProgress", () => {
  it("ignores progress for an older cached version", () => {
    const cur = status({ latestVersion: "1.7.0", state: "downloading", bytes: 1, total: 8 });
    const got = applyUpdateProgress(cur, {
      version: "1.6.2",
      state: "ready",
      bytes: 10,
      total: 10,
      error: "",
    });
    assert.equal(got?.latestVersion, "1.7.0");
    assert.equal(got?.state, "downloading");
  });

  it("adopts progress when the download is the newer release", () => {
    const cur = status({ latestVersion: "1.6.2", state: "ready" });
    const got = applyUpdateProgress(cur, {
      version: "1.7.0",
      state: "downloading",
      bytes: 2,
      total: 9,
      error: "",
    });
    assert.equal(got?.latestVersion, "1.7.0");
    assert.equal(got?.state, "downloading");
    assert.equal(got?.bytes, 2);
  });
});

describe("updatedToastCopy", () => {
  it("names the new version and the version we came from", () => {
    const copy = updatedToastCopy("1.6.1", "1.7.0");
    assert.equal(copy.title, "Qterm 1.7.0 is installed");
    assert.equal(copy.description, "Updated from 1.6.1.");
    assert.doesNotMatch(copy.title + copy.description, /\u2014/);
  });
});
