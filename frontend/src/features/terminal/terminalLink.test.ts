import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveTerminalLink } from "./terminalLink.ts";

describe("resolveTerminalLink", () => {
  it("accepts http(s) and mailto", () => {
    assert.deepEqual(resolveTerminalLink("https://example.com/x"), {
      kind: "url",
      href: "https://example.com/x",
    });
    assert.equal(resolveTerminalLink("http://example.com")?.kind, "url");
    assert.equal(resolveTerminalLink("mailto:hi@example.com")?.kind, "url");
  });

  it("maps local file URLs", () => {
    assert.deepEqual(resolveTerminalLink("file:///Users/me/src/app.ts"), {
      kind: "file",
      path: "/Users/me/src/app.ts",
    });
  });

  it("rejects javascript and unknown schemes", () => {
    assert.equal(resolveTerminalLink("javascript:alert(1)"), null);
    assert.equal(resolveTerminalLink("data:text/html,hi"), null);
    assert.equal(resolveTerminalLink("not a url"), null);
    assert.equal(resolveTerminalLink(""), null);
  });
});
