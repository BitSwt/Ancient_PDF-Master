#!/bin/bash
# Build macOS .app and .dmg for Ancient PDF Master
# Usage: ./scripts/build_dmg.sh

set -e

APP_NAME="Ancient PDF Master"
DMG_NAME="AncientPDFMaster"
VERSION="1.0.0"
BUILD_DIR="build"
DIST_DIR="dist"

echo "=== Ancient PDF Master - macOS Build ==="
echo ""

# Check dependencies
echo "[1/5] Checking dependencies..."
if ! command -v python3 &> /dev/null; then
    echo "ERROR: python3 not found"
    exit 1
fi

if ! command -v tesseract &> /dev/null; then
    echo "WARNING: tesseract not found. Install with: brew install tesseract"
fi

# Clean previous builds
echo "[2/5] Cleaning previous builds..."
rm -rf "$BUILD_DIR" "$DIST_DIR"

# Install dependencies
echo "[3/5] Installing Python dependencies..."
pip3 install -e ".[packaging]" --quiet

# Build .app bundle with py2app
echo "[4/5] Building .app bundle..."
python3 setup_mac.py py2app

# Create DMG
echo "[5/5] Creating DMG..."
if command -v create-dmg &> /dev/null; then
    create-dmg \
        --volname "$APP_NAME" \
        --volicon "assets/icon.icns" \
        --window-pos 200 120 \
        --window-size 600 400 \
        --icon-size 100 \
        --icon "$APP_NAME.app" 175 190 \
        --hide-extension "$APP_NAME.app" \
        --app-drop-link 425 190 \
        --no-internet-enable \
        "$DIST_DIR/${DMG_NAME}-${VERSION}.dmg" \
        "$DIST_DIR/"
else
    echo "create-dmg not found, using hdiutil fallback..."
    echo "(Install create-dmg for prettier DMGs: brew install create-dmg)"

    # Fallback: create DMG with hdiutil
    DMG_TMP="$DIST_DIR/${DMG_NAME}-tmp.dmg"
    DMG_FINAL="$DIST_DIR/${DMG_NAME}-${VERSION}.dmg"

    hdiutil create -volname "$APP_NAME" \
        -srcfolder "$DIST_DIR/$APP_NAME.app" \
        -ov -format UDBZ \
        "$DMG_FINAL"
fi

echo ""
echo "=== Build complete! ==="
echo "DMG: $DIST_DIR/${DMG_NAME}-${VERSION}.dmg"
echo ""
echo "To install Tesseract language packs on macOS:"
echo "  brew install tesseract-lang"
echo "  (This installs all language packs including Ancient Greek and Latin)"
