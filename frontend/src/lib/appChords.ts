/**
 * App chords that must work even when an xterm textarea has focus,
 * and must not be forwarded into the PTY (e.g. Ctrl+P = previous history).
 */
export function isAppChord(e: KeyboardEvent): boolean {
  if (e.isComposing) return false;
  const mod = e.metaKey || e.ctrlKey;
  if (!mod) return false;

  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  const code = e.code;

  // ⌘/Ctrl alone chords
  if (!e.shiftKey && !e.altKey) {
    if (key === "k" || code === "KeyK") return true; // command palette
    if (key === "p" || code === "KeyP") return true; // quick open
    if (key === "t" || code === "KeyT") return true; // new terminal
    if (key === "b" || code === "KeyB") return true; // sidebar
    if (key === "," || code === "Comma") return true; // settings
    if (key === "]" || code === "BracketRight") return true;
    if (key === "[" || code === "BracketLeft") return true;
    if (code === "Equal" || code === "NumpadAdd") return true; // zoom
    if (code === "Minus" || code === "NumpadSubtract") return true;
    if (code === "Digit0" || code === "Numpad0") return true;
    return false;
  }

  // ⌘/Ctrl+Shift…
  if (e.shiftKey && !e.altKey) {
    if (key === "l" || code === "KeyL") return true; // split right
    if (key === "j" || code === "KeyJ") return true; // split down
    if (key === "w" || code === "KeyW") return true; // close
    if (key === "r" || code === "KeyR") return true; // rename terminal
    if (key === "t" || code === "KeyT") return true; // new in project
    if (key === "e" || code === "KeyE") return true; // rename project
    if (key === "o" || code === "KeyO") return true; // reveal
    if (key === "d" || code === "KeyD") return true; // theme
    if (key === "Backspace" || code === "Backspace") return true; // delete terminal
    return false;
  }

  // ⌘/Ctrl+Alt+Shift+Backspace — remove project
  if (e.shiftKey && e.altKey && (key === "Backspace" || code === "Backspace")) {
    return true;
  }

  return false;
}

/** Shared options so hotkeys fire while focus is in xterm's textarea. */
export const appHotkeyOptions = {
  enableOnFormTags: true as const,
  enableOnContentEditable: true as const,
  preventDefault: true as const,
};
