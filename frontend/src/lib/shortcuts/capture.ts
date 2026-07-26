/** True while Settings → Shortcuts is recording a new chord. */
let capturing = false;

export function setKeybindingCapturing(on: boolean) {
  capturing = on;
}

export function isKeybindingCapturing() {
  return capturing;
}
