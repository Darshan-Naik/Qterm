const DRAG_CLASS = "drag-resize";

export function beginDragResize(cursor: string) {
  document.documentElement.classList.add(DRAG_CLASS);
  document.body.style.cursor = cursor;
  window.getSelection()?.removeAllRanges();
}

export function endDragResize() {
  document.documentElement.classList.remove(DRAG_CLASS);
  document.body.style.cursor = "";
  window.getSelection()?.removeAllRanges();
}
