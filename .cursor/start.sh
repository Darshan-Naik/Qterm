#!/usr/bin/env bash
# Cloud Agent start for Qterm — bring up a headless display for the GUI.
# Idempotent: detects an already-running display/WM and never duplicates them.
set -euo pipefail

DISPLAY_NUM=":99"

# --- Virtual display ---------------------------------------------------------
if ! xdpyinfo -display "$DISPLAY_NUM" >/dev/null 2>&1; then
  Xvfb "$DISPLAY_NUM" -screen 0 1280x800x24 -ac +extension GLX +render -noreset \
    >/tmp/xvfb.log 2>&1 &
  for _ in $(seq 1 50); do
    xdpyinfo -display "$DISPLAY_NUM" >/dev/null 2>&1 && break
    sleep 0.2
  done
fi

if ! xdpyinfo -display "$DISPLAY_NUM" >/dev/null 2>&1; then
  echo "ERROR: Xvfb did not come up on $DISPLAY_NUM" >&2
  cat /tmp/xvfb.log >&2 || true
  exit 1
fi

# --- Window manager ----------------------------------------------------------
# Maps and sizes top-level windows so the Wails/GTK window renders full-size.
if ! pgrep -x openbox >/dev/null 2>&1; then
  DISPLAY="$DISPLAY_NUM" openbox >/tmp/openbox.log 2>&1 &
fi

echo "Virtual display ready on $DISPLAY_NUM (Xvfb + openbox). Run GUI apps with DISPLAY=$DISPLAY_NUM."
