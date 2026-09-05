import type { KeyChord } from "@/lib/shortcuts/types";

export type Snippet = {
  id: string;
  name: string;
  body: string;
  keyword?: string;
  chord?: KeyChord;
  send?: boolean;
};

export const MAX_SNIPPETS = 100;
export const MAX_SNIPPET_NAME = 80;
export const MAX_SNIPPET_BODY = 8 * 1024;
export const MAX_SNIPPET_KEYWORD = 32;
