#!/usr/bin/env bash
# Build the Flutter Android APK and publish it into the Next.js public/apk
# directory so the web dashboard "ดาวน์โหลดแอป" button can serve it.
#
# Usage:
#   API_KEY=xxxx API_BASE_URL=https://spare.birdsphichitchai.dev ./scripts/build-apk.sh
#
# Requires: flutter SDK on PATH, android toolchain configured.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$ROOT_DIR/mobile/sparepart_mobile"
RELEASE_DIR="$ROOT_DIR/public/apk"

API_KEY="${API_KEY:-}"
API_BASE_URL="${API_BASE_URL:-https://spare.birdsphichitchai.dev}"

if [ -z "$API_KEY" ]; then
  echo "ERROR: set API_KEY env (the MOBILE_API_KEY value)." >&2
  exit 1
fi

if ! command -v flutter >/dev/null 2>&1; then
  echo "ERROR: flutter not found on PATH." >&2
  exit 1
fi

echo "==> flutter pub get"
( cd "$APP_DIR" && flutter pub get )

echo "==> flutter build apk --release"
( cd "$APP_DIR" && flutter build apk --release \
    --dart-define=API_KEY="$API_KEY" \
    --dart-define=API_BASE_URL="$API_BASE_URL" )

SRC="$APP_DIR/build/app/outputs/flutter-apk/app-release.apk"
if [ ! -f "$SRC" ]; then
  echo "ERROR: built APK not found at $SRC" >&2
  exit 1
fi

mkdir -p "$RELEASE_DIR"
DEST="$RELEASE_DIR/sparepart_mobile.apk"
cp "$SRC" "$DEST"

# Parse version + build number from pubspec.yaml (version: X.Y.Z+N)
VERSION_LINE=$(grep -E '^version:' "$APP_DIR/pubspec.yaml" | head -1)
VERSION="${VERSION_LINE#version: }"
BUILD_NUMBER="${VERSION#*+}"
VERSION="${VERSION%%+*}"

SIZE=$(stat -c%s "$DEST" 2>/dev/null || stat -f%z "$DEST")
DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

cat > "$RELEASE_DIR/version.json" <<EOF
{
  "version": "$VERSION",
  "buildNumber": "$BUILD_NUMBER",
  "filename": "sparepart_mobile.apk",
  "buildDate": "$DATE",
  "sizeBytes": $SIZE
}
EOF

echo "==> published: $DEST (v$VERSION+$BUILD_NUMBER, $SIZE bytes)"
