#!/usr/bin/env bash
# Cloud Agent install for Qterm — a Wails (Go + TypeScript) desktop terminal.
# Idempotent: safe to re-run against a cached or partially prepared VM.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# Pinned to the Wails version required by go.mod.
WAILS_VERSION="v2.13.0"

# --- System packages ---------------------------------------------------------
# GTK3 + WebKitGTK 4.1 back the Wails webview on Linux (Ubuntu ships 4.1, so the
# app is built with the `webkit2_41` tag below). The remaining packages let the
# GUI run and be inspected headlessly (virtual display, window manager, tooling)
# and provide zsh, which the Go PTY tests spawn directly at /bin/zsh.
export DEBIAN_FRONTEND=noninteractive
sudo apt-get update
sudo apt-get install -y --no-install-recommends \
  build-essential \
  pkg-config \
  libgtk-3-dev \
  libwebkit2gtk-4.1-dev \
  zsh \
  xvfb \
  openbox \
  dbus-x11 \
  x11-utils \
  wmctrl \
  xdotool \
  ffmpeg

# --- Wails CLI ---------------------------------------------------------------
# ~/go/bin is already on PATH in the default image.
if ! command -v wails >/dev/null 2>&1 || ! wails version 2>/dev/null | grep -q "${WAILS_VERSION#v}"; then
  go install "github.com/wailsapp/wails/v2/cmd/wails@${WAILS_VERSION}"
fi
export PATH="$PATH:$(go env GOPATH)/bin"

# --- Go modules --------------------------------------------------------------
go mod download

# --- Frontend dependencies ---------------------------------------------------
# Reproducible install from the committed lockfile (also enables `npm run dev`
# and `npm test` independent of a full Wails build).
(cd frontend && npm ci)

# --- Build ------------------------------------------------------------------
# Exercises the whole pipeline (binding generation, Vite build, Go compile,
# packaging) and produces ./build/bin/q-term for the `qterm-app` terminal.
wails build -tags webkit2_41

echo "Qterm install complete — $(wails version 2>/dev/null | head -1)"
