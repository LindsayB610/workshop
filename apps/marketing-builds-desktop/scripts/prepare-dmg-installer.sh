#!/usr/bin/env bash

# A headless CI runner cannot ask Finder to save DMG presentation state. Copy a
# reviewed, public `.DS_Store` layout into the writable image and remove
# Tauri's implementation-only volume icon before the final DMG is signed.
set -euo pipefail

if [ "$#" -ne 3 ]; then
  echo "Usage: $0 path/to/Workshop.dmg path/to/Workshop.DS_Store path/to/installer-background.png" >&2
  exit 64
fi

DMG_PATH="$1"
LAYOUT_PATH="$2"
BACKGROUND_PATH="$3"
BACKGROUND_NAME="$(basename "$BACKGROUND_PATH")"
if [ ! -f "$DMG_PATH" ]; then
  echo "DMG not found: $DMG_PATH" >&2
  exit 66
fi
if [ ! -f "$LAYOUT_PATH" ]; then
  echo "Finder layout not found: $LAYOUT_PATH" >&2
  exit 66
fi
if [ ! -f "$BACKGROUND_PATH" ]; then
  echo "Finder background not found: $BACKGROUND_PATH" >&2
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
mkdir -p "$MOUNT_DIR/.background"
cp "$LAYOUT_PATH" "$MOUNT_DIR/.DS_Store"
cp "$BACKGROUND_PATH" "$MOUNT_DIR/.background/$BACKGROUND_NAME"
hdiutil detach "$DEVICE" -quiet
DEVICE=""

hdiutil convert "$RW_DMG" -format UDZO -imagekey zlib-level=9 -o "$REBUILT_DMG" -quiet
mv "$REBUILT_DMG" "$DMG_PATH"
