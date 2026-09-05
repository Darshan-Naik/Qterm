export type { Snippet } from "./types";
export { MAX_SNIPPETS, MAX_SNIPPET_BODY, MAX_SNIPPET_KEYWORD, MAX_SNIPPET_NAME } from "./types";
export { sanitizeSnippets } from "./sanitize";
export { expandSnippetBody, snippetWriteText } from "./expand";
export { matchSnippetChord } from "./match";
export { describeChordConflict } from "./conflicts";
export { insertSnippet } from "./insert";
