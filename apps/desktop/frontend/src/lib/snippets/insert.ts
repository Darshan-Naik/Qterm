import { toast } from "sonner";
import { WriteSession } from "../../../wailsjs/go/main/App";
import { uiStore } from "@/store/store";
import { expandSnippetBody, snippetWriteText } from "./expand";
import type { Snippet } from "./types";

/** Insert a snippet into the focused terminal. */
export async function insertSnippet(snippet: Snippet): Promise<boolean> {
  const { focusedSessionId, sessions } = uiStore.get();
  if (!focusedSessionId) {
    toast.error("Focus a terminal first");
    return false;
  }
  const session = sessions.find((s) => s.id === focusedSessionId);
  const body = expandSnippetBody(snippet.body, { cwd: session?.cwd });
  const text = snippetWriteText(body, snippet.send === true);
  if (!text) {
    toast.error("This snippet is empty");
    return false;
  }
  try {
    await WriteSession(focusedSessionId, text);
  } catch {
    toast.error("Could not insert snippet");
    return false;
  }
  const id = focusedSessionId;
  void import("@/features/terminal/sessionTerminals").then((m) => {
    m.focusTerminal(id);
  });
  return true;
}
