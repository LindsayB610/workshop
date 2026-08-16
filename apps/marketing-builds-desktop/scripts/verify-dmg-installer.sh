#!/usr/bin/env bash

# Verify the public installer contains only the intended Finder presentation
# state. This runs in CI after the deterministic layout has been injected.
set -euo pipefail

if [ "$#" -ne 3 ]; then
  echo "Usage: $0 path/to/Workshop.dmg path/to/Workshop.DS_Store path/to/installer-background.png" >&2
  exit 64
fi

DMG_PATH="$1"
LAYOUT_PATH="$2"
BACKGROUND_PATH="$3"
BACKGROUND_NAME="$(basename "$BACKGROUND_PATH")"
if [ ! -f "$DMG_PATH" ] || [ ! -f "$LAYOUT_PATH" ] || [ ! -f "$BACKGROUND_PATH" ]; then
  echo "DMG, Finder layout, or Finder background is missing." >&2
  exit 66
fi

DEVICE=""
cleanup() {
  if [ -n "$DEVICE" ]; then
    hdiutil detach "$DEVICE" -quiet || true
  fi
}
trap cleanup EXIT

ATTACH_OUTPUT="$(hdiutil attach "$DMG_PATH" -readonly -noverify -nobrowse)"
DEVICE="$(printf '%s\n' "$ATTACH_OUTPUT" | awk '/^\/dev\// { print $1; exit }')"
MOUNT_DIR="$(printf '%s\n' "$ATTACH_OUTPUT" | awk '$3 ~ /^\/Volumes\// { print $3; exit }')"

if [ -z "$DEVICE" ] || [ -z "$MOUNT_DIR" ]; then
  echo "Could not mount DMG for verification." >&2
  exit 1
fi
if [ ! -d "$MOUNT_DIR/Workshop.app" ] || [ ! -L "$MOUNT_DIR/Applications" ]; then
  echo "DMG is missing the app bundle or Applications link." >&2
  exit 1
fi
if [ -e "$MOUNT_DIR/.VolumeIcon.icns" ]; then
  echo "DMG still exposes Tauri's .VolumeIcon.icns implementation file." >&2
  exit 1
fi
if ! cmp -s "$LAYOUT_PATH" "$MOUNT_DIR/.DS_Store"; then
  echo "DMG Finder layout does not match the reviewed layout asset." >&2
  exit 1
fi
if ! cmp -s "$BACKGROUND_PATH" "$MOUNT_DIR/.background/$BACKGROUND_NAME"; then
  echo "DMG Finder background does not match the reviewed background asset." >&2
  exit 1
fi
