const CWD = /\{cwd\}/gi;
const KEYWORD_TAIL = /[A-Za-z0-9_-]+$/;

export function expandSnippetBody(body: string, ctx: { cwd?: string }): string {
  const cwd = ctx.cwd?.trim() || "";
  return body.replace(CWD, cwd);
}

/** PTY Enter is a newline, matching other Qterm command inserts. */
export function snippetWriteText(body: string, send: boolean): string {
  if (!send) return body;
  if (body.endsWith("\n") || body.endsWith("\r")) return body;
  return `${body}\n`;
}

type SnippetFields = {
  id: string;
  name: string;
  body: string;
  keyword?: string;
  send?: boolean;
  chord?: { key: string; metaOrCtrl?: boolean; ctrlOnly?: boolean; alt?: boolean; shift?: boolean };
};

export function snippetsEqual(a: SnippetFields, b: SnippetFields): boolean {
  return (
    a.id === b.id &&
    a.name === b.name &&
    a.body === b.body &&
    (a.keyword || "") === (b.keyword || "") &&
    (a.send === true) === (b.send === true) &&
    chordKey(a.chord) === chordKey(b.chord)
  );
}

function chordKey(c: SnippetFields["chord"]): string {
  if (!c) return "";
  return [
    c.ctrlOnly ? "ctrlOnly" : c.metaOrCtrl ? "mod" : "",
    c.alt ? "alt" : "",
    c.shift ? "shift" : "",
    c.key.toLowerCase(),
  ]
    .filter(Boolean)
    .join("+");
}

/** A snippet can be saved when it has a command to insert. */
export function canSaveSnippet(s: { body: string }): boolean {
  return s.body.trim().length > 0;
}

/** Last keyword-shaped token at the end of the line (spaces after it are ignored). */
export function lastKeywordToken(lineBeforeCursor: string): { token: string; deleteCount: number } | null {
  const pad = lineBeforeCursor.match(/[ \t]+$/);
  const trimmed = pad ? lineBeforeCursor.slice(0, -pad[0].length) : lineBeforeCursor;
  const m = trimmed.match(KEYWORD_TAIL);
  if (!m) return null;
  return { token: m[0], deleteCount: m[0].length + (pad ? pad[0].length : 0) };
}

export function matchSnippetKeyword(token: string, snippets: SnippetFields[]): SnippetFields | null {
  if (!token) return null;
  const key = token.toLowerCase();
  for (const snippet of snippets) {
    if (snippet.keyword && snippet.keyword.toLowerCase() === key) return snippet;
  }
  return null;
}

/**
 * PTY payload that deletes the typed keyword and inserts the snippet.
 * Null when the line should be sent as typed.
 */
export function keywordExpandPayload(
  lineBeforeCursor: string,
  snippets: SnippetFields[],
  cwd?: string,
): string | null {
  const hit = lastKeywordToken(lineBeforeCursor);
  if (!hit) return null;
  const snippet = matchSnippetKeyword(hit.token, snippets);
  if (!snippet) return null;
  const body = expandSnippetBody(snippet.body, { cwd });
  const text = snippetWriteText(body, snippet.send === true);
  if (!text) return null;
  return "\x7f".repeat(hit.deleteCount) + text;
}
