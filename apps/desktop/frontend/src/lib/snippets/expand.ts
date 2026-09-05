const CWD = /\{cwd\}/gi;

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
