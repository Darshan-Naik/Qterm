import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { expandSnippetBody, snippetWriteText } from "./expand.ts";

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
