import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { expandSnippetBody, snippetWriteText, keywordExpandPayload, canSaveSnippet, snippetsEqual } from "./expand.ts";

describe("expandSnippetBody", () => {
  it("replaces {cwd}", () => {
    assert.equal(expandSnippetBody("cd {cwd}", { cwd: "/tmp/app" }), "cd /tmp/app");
    assert.equal(expandSnippetBody("echo {CWD}", { cwd: "/x" }), "echo /x");
    assert.equal(expandSnippetBody("pwd", { cwd: "/x" }), "pwd");
  });
});

describe("snippetWriteText", () => {
  it("appends a newline only when sending", () => {
    assert.equal(snippetWriteText("ls", false), "ls");
    assert.equal(snippetWriteText("ls", true), "ls\n");
    assert.equal(snippetWriteText("ls\n", true), "ls\n");
  });
});

describe("keywordExpandPayload", () => {
  const gs = { id: "1", name: "Git status", body: "git status", keyword: "gs", send: true };

  it("expands gs plus Return to git status", () => {
    const got = keywordExpandPayload("% gs", [gs]);
    assert.equal(got, "\x7f\x7fgit status\n");
  });

  it("does not expand idle text", () => {
    assert.equal(keywordExpandPayload("% git status", [gs]), null);
    assert.equal(keywordExpandPayload("% ", [gs]), null);
  });

  it("deletes trailing spaces after the keyword", () => {
    const got = keywordExpandPayload("% gs  ", [gs]);
    assert.equal(got, "\x7f\x7f\x7f\x7fgit status\n");
  });

  it("skips Return when send is off", () => {
    const got = keywordExpandPayload("gs", [{ ...gs, send: false }]);
    assert.equal(got, "\x7f\x7fgit status");
  });
});

describe("canSaveSnippet", () => {
  it("requires a command body", () => {
    assert.equal(canSaveSnippet({ id: "1", name: "Git", body: "" }), false);
    assert.equal(canSaveSnippet({ id: "1", name: "", body: "   " }), false);
    assert.equal(canSaveSnippet({ id: "1", name: "", body: "git status" }), true);
  });
});

describe("snippetsEqual", () => {
  it("treats missing keyword and send false as equal", () => {
    const a = { id: "1", name: "A", body: "ls" };
    const b = { id: "1", name: "A", body: "ls", keyword: "", send: false };
    assert.equal(snippetsEqual(a, b), true);
    assert.equal(snippetsEqual(a, { ...b, send: true }), false);
  });
});
