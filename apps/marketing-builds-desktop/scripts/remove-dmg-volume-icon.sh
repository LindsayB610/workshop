#!/usr/bin/env bash

# Tauri's DMG builder adds .VolumeIcon.icns by default. It is normally hidden,
# but Finder can reveal it, turning a two-item installer into a cluttered window.
# Rebuild the image without that implementation file before it is notarized.
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 path/to/Workshop.dmg" >&2
  exit 64
fi

DMG_PATH="$1"
if [ ! -f "$DMG_PATH" ]; then
  echo "DMG not found: $DMG_PATH" >&2
  exit 66
fi

WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/workshop-dmg.XXXXXX")"
RW_DMG="$WORK_DIR/installer-rw.dmg"
REBUILT_DMG="$WORK_DIR/Workshop-rebuilt.dmg"
DEVICE=""

cleanup() {
  if [ -n "$DEVICE" ]; then
    hdiutil detach "$DEVICE" -quiet || true
  fi
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT

hdiutil convert "$DMG_PATH" -format UDRW -o "$RW_DMG" -quiet
ATTACH_OUTPUT="$(hdiutil attach "$RW_DMG" -readwrite -noverify -nobrowse)"
DEVICE="$(printf '%s\n' "$ATTACH_OUTPUT" | awk '/^\/dev\// { print $1; exit }')"
MOUNT_DIR="$(printf '%s\n' "$ATTACH_OUTPUT" | awk '$3 ~ /^\/Volumes\// { print $3; exit }')"

if [ -z "$DEVICE" ] || [ -z "$MOUNT_DIR" ]; then
  echo "Could not mount DMG for final cleanup." >&2
  exit 1
fi

rm -f "$MOUNT_DIR/.VolumeIcon.icns"
hdiutil detach "$DEVICE" -quiet
DEVICE=""

hdiutil convert "$RW_DMG" -format UDZO -imagekey zlib-level=9 -o "$REBUILT_DMG" -quiet
mv "$REBUILT_DMG" "$DMG_PATH"
