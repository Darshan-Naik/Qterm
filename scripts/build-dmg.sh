#!/usr/bin/env bash
# Build Qterm.app (Wails) and package a macOS DMG.
#
# Usage:
#   ./scripts/build-dmg.sh              # native arch (arm64 or amd64)
#   ./scripts/build-dmg.sh arm64        # Apple Silicon
#   ./scripts/build-dmg.sh amd64        # Intel
#   ./scripts/build-dmg.sh universal    # both (lipo) — requires Go + Wails setup for both
#
# Outputs:
#   build/bin/Qterm.app
#   build/bin/Qterm-<version>-<arch>.dmg
#   build/bin/Qterm.dmg                 (same file, stable name)

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
    x86_64|amd64)  ARCH=amd64 ;;
    *)
      echo "error: unsupported machine $(uname -m); pass arm64 or amd64" >&2
      exit 1
      ;;
  esac
fi

VERSION="$(python3 -c "import json; print(json.load(open('wails.json'))['info']['productVersion'])")"
APP_NAME="Qterm"
BIN_DIR="$ROOT/build/bin"
APP="$BIN_DIR/${APP_NAME}.app"
DMG_VERSIONED="$BIN_DIR/${APP_NAME}-${VERSION}-${ARCH}.dmg"
DMG_STABLE="$BIN_DIR/${APP_NAME}.dmg"

echo "==> Building ${APP_NAME} v${VERSION} (darwin/${ARCH})"
case "$ARCH" in
  arm64|amd64)
    wails build -clean -platform "darwin/${ARCH}" -v 1
    ;;
  universal)
    echo "error: universal builds not wired yet — use arm64 or amd64" >&2
    exit 1
    ;;
  *)
    echo "error: arch must be arm64 or amd64 (got: $ARCH)" >&2
    exit 1
    ;;
esac

if [[ ! -d "$APP" ]]; then
  echo "error: expected app bundle missing: $APP" >&2
  exit 1
fi

echo "==> Packaging DMG"
STAGE="$(mktemp -d "${TMPDIR:-/tmp}/qterm-dmg.XXXXXX")"
cleanup() { rm -rf "$STAGE"; }
trap cleanup EXIT

cp -R "$APP" "$STAGE/"
ln -s /Applications "$STAGE/Applications"

rm -f "$DMG_VERSIONED" "$DMG_STABLE"
hdiutil create \
  -volname "$APP_NAME" \
  -srcfolder "$STAGE" \
  -ov \
  -format UDZO \
  "$DMG_VERSIONED"

cp "$DMG_VERSIONED" "$DMG_STABLE"

echo
echo "Done."
echo "  App:  $APP"
echo "  DMG:  $DMG_VERSIONED"
echo "  Also: $DMG_STABLE"
ls -lh "$DMG_VERSIONED" "$APP/Contents/MacOS/"* 2>/dev/null | sed 's/^/  /'
