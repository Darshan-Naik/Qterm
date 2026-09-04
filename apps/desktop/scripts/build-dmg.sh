#!/usr/bin/env bash
# Build Qterm.app (Wails) and package a macOS DMG for Apple Silicon.
#
# Usage (from apps/desktop):
#   ./scripts/build-dmg.sh
#   ./scripts/build-dmg.sh arm64
#
# Output:
#   build/bin/*.app
#   build/bin/Qterm-macos-arm64.dmg

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v wails >/dev/null 2>&1; then
  echo "error: wails CLI not found (install: go install github.com/wailsapp/wails/v2/cmd/wails@latest)" >&2
  exit 1
fi

ARCH="${1:-}"
if [[ -z "$ARCH" ]]; then
  case "$(uname -m)" in
    arm64|aarch64) ARCH=arm64 ;;
    *)
      echo "error: Qterm ships Apple Silicon only (got $(uname -m))" >&2
      exit 1
      ;;
  esac
fi

if [[ "$ARCH" != "arm64" ]]; then
  echo "error: arch must be arm64 (Apple Silicon). Intel builds are not shipped." >&2
  exit 1
fi

VERSION="$(python3 -c "import json; print(json.load(open('wails.json'))['info']['productVersion'])")"
APP_NAME="Qterm"
BIN_DIR="$ROOT/build/bin"
DMG_DOWNLOAD="$BIN_DIR/${APP_NAME}-macos-arm64.dmg"

echo "==> Building ${APP_NAME} v${VERSION} (darwin/arm64)"
wails build -clean -platform "darwin/arm64" -v 1

shopt -s nullglob
apps=("$BIN_DIR"/*.app)
APP="${apps[0]-}"
if [[ -z "$APP" || ! -d "$APP" ]]; then
  echo "error: expected app bundle missing under $BIN_DIR" >&2
  ls -la "$BIN_DIR" >&2 || true
  exit 1
fi

echo "==> Packaging DMG"
STAGE="$(mktemp -d "${TMPDIR:-/tmp}/qterm-dmg.XXXXXX")"
cleanup() { rm -rf "$STAGE"; }
trap cleanup EXIT

cp -R "$APP" "$STAGE/${APP_NAME}.app"
ln -s /Applications "$STAGE/Applications"

rm -f "$DMG_DOWNLOAD"
hdiutil create \
  -volname "$APP_NAME" \
  -srcfolder "$STAGE" \
  -ov \
  -format UDZO \
  "$DMG_DOWNLOAD"

echo
echo "Done."
echo "  App:  $APP"
echo "  DMG:  $DMG_DOWNLOAD"
ls -lh "$DMG_DOWNLOAD" "$APP/Contents/MacOS/"* 2>/dev/null | sed 's/^/  /'
