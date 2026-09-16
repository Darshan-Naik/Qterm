#!/usr/bin/env bash
# Build GitHub Release notes: download blurb + auto changelog since the prior tag.
# Usage: release-notes.sh <tag> <version> [target_commitish]
# Writes markdown to stdout. Requires gh + network (GITHUB_TOKEN / GH_TOKEN).
set -euo pipefail

TAG="${1:-}"
VERSION="${2:-}"
TARGET="${3:-${GITHUB_SHA:-}}"
if [[ -z "$TAG" || -z "$VERSION" ]]; then
  echo "usage: $0 <tag> <version> [target_commitish]" >&2
  exit 2
fi

REPO="${GITHUB_REPOSITORY:-}"
if [[ -z "$REPO" ]]; then
  REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || true)"
fi
if [[ -z "$REPO" ]]; then
  echo "GITHUB_REPOSITORY is unset and gh could not resolve the repo" >&2
  exit 1
fi

# Newest published release that is not this tag (gh lists newest first).
PREV_TAG="$(
  gh release list \
    --repo "$REPO" \
    --exclude-drafts \
    --exclude-pre-releases \
    --limit 50 \
    --json tagName \
    -q '.[].tagName' \
    | grep -vxF "$TAG" \
    | head -n 1 \
    || true
)"

ARGS=(-f "tag_name=${TAG}")
if [[ -n "$TARGET" ]]; then
  ARGS+=(-f "target_commitish=${TARGET}")
fi
if [[ -n "$PREV_TAG" ]]; then
  ARGS+=(-f "previous_tag_name=${PREV_TAG}")
fi

CHANGELOG="$(gh api "repos/${REPO}/releases/generate-notes" "${ARGS[@]}" --jq .body)"

{
  printf '%s\n' \
    "Qterm ${VERSION} for Mac (Apple Silicon)." \
    "" \
    "Download Qterm-macos-arm64.dmg." \
    "If macOS blocks the app, open System Settings, Privacy and Security, and allow it."
  if [[ -n "${CHANGELOG//[[:space:]]/}" ]]; then
    printf '\n%s\n' "$CHANGELOG"
  fi
}
