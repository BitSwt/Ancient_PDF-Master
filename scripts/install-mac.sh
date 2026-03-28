#!/bin/bash
# Install Ancient PDF Master as a macOS .app
# Usage: ./scripts/install-mac.sh
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

echo "=== Ancient PDF Master - macOS Install ==="
echo ""

# ── 1. Check system dependencies ──
echo "[1/5] Checking system dependencies..."

# Check Homebrew
if ! command -v brew &>/dev/null; then
  echo "ERROR: Homebrew is required."
  echo "Install: /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
  exit 1
fi

# Check Node.js
if ! command -v node &>/dev/null; then
  echo "Installing Node.js..."
  brew install node
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  echo "ERROR: Node.js 18+ is required (found v$NODE_VERSION)."
  echo "Run: brew upgrade node"
  exit 1
fi
echo "  [OK] Node.js $(node -v)"

# Check Python 3 — prefer Homebrew Python over Xcode bundled Python
# Xcode Python has pip 21.x which can't do pyproject.toml editable installs
PYTHON3=""
BREW_PYTHON="$(brew --prefix)/bin/python3"
if [ -x "$BREW_PYTHON" ]; then
  PYTHON3="$BREW_PYTHON"
elif command -v python3 &>/dev/null; then
  PY_PATH="$(which python3)"
  if [[ "$PY_PATH" == *"Xcode"* || "$PY_PATH" == *"CommandLineTools"* ]]; then
    echo "  Xcode Python detected ($PY_PATH) — installing Homebrew Python..."
    brew install python3
    PYTHON3="$(brew --prefix)/bin/python3"
  else
    PYTHON3="python3"
  fi
else
  echo "Installing Python 3..."
  brew install python3
  PYTHON3="$(brew --prefix)/bin/python3"
fi
echo "  [OK] Python $($PYTHON3 --version)"

# Check Tesseract
if ! command -v tesseract &>/dev/null; then
  echo "Installing Tesseract OCR..."
  brew install tesseract
fi
echo "  [OK] Tesseract $(tesseract --version 2>&1 | head -1)"

# Check Poppler (required by pdf2image for PDF input)
if ! command -v pdftoppm &>/dev/null; then
  echo "Installing Poppler (PDF rendering)..."
  brew install poppler
fi
echo "  [OK] Poppler installed"

# Check Tesseract language packs
TESS_LANGS=$(tesseract --list-langs 2>&1)
NEED_LANG=false
for LANG_CODE in grc lat; do
  if ! echo "$TESS_LANGS" | grep -q "$LANG_CODE"; then
    NEED_LANG=true
    break
  fi
done

if [ "$NEED_LANG" = true ]; then
  echo "Installing Tesseract language packs (Ancient Greek, Latin)..."
  brew install tesseract-lang
fi
echo "  [OK] Language packs: grc, lat, eng"

echo ""

# ── 2. Install Python backend (using venv) ──
echo "[2/5] Installing Python backend..."
VENV_DIR="$PROJECT_DIR/.venv"

if [ ! -d "$VENV_DIR" ]; then
  echo "  Creating virtual environment with $PYTHON3..."
  "$PYTHON3" -m venv "$VENV_DIR"
  if [ $? -ne 0 ]; then
    echo "ERROR: Failed to create virtual environment."
    echo "Try: brew install python3"
    exit 1
  fi
fi

source "$VENV_DIR/bin/activate"

echo "  Upgrading pip..."
pip install --upgrade pip setuptools wheel --quiet 2>&1 || {
  echo "WARNING: pip upgrade failed, continuing with existing version..."
}

echo "  Installing Python packages..."
if ! pip install -e . --quiet 2>&1; then
  echo ""
  echo "ERROR: pip install failed."
  echo ""
  echo "Common fixes:"
  echo "  1. Upgrade pip:   $VENV_DIR/bin/pip install --upgrade pip"
  echo "  2. Install qpdf:  brew install qpdf   (needed if pikepdf build fails)"
  echo "  3. Retry:         $VENV_DIR/bin/pip install -e ."
  echo ""
  echo "If the error persists, try installing dependencies individually:"
  echo "  $VENV_DIR/bin/pip install pytesseract Pillow pdf2image pikepdf reportlab"
  exit 1
fi
echo "  [OK] Python packages installed (venv: .venv)"
echo ""

# ── 3. Install Node.js dependencies ──
echo "[3/5] Installing Node.js dependencies..."
if ! npm install 2>&1 | tail -5; then
  echo "ERROR: npm install failed."
  echo "Try: rm -rf node_modules && npm install"
  exit 1
fi
echo "  [OK] Node.js packages installed"
echo ""

# ── 4. Build .app bundle ──
echo "[4/5] Building .app bundle..."
# --config.mac.identity=null skips code signing for local install
if ! npx electron-builder --mac dir --config.mac.identity=null 2>&1 | tail -5; then
  echo ""
  echo "WARNING: .app build failed. You can still run in dev mode: npm start"
  echo ""
fi

# ── 5. Copy to /Applications ──
APP_NAME="Ancient PDF Master"
APP_SRC=$(find dist -name "*.app" -maxdepth 3 -type d 2>/dev/null | head -1)

if [ -z "$APP_SRC" ]; then
  echo "WARNING: .app bundle not found in dist/"
  echo ""
  echo "You can run in development mode instead:"
  echo "  npm start"
  echo ""
  echo "Or retry the build:"
  echo "  npx electron-builder --mac dir --config.mac.identity=null"
  exit 0
fi

echo "[5/5] Installing to /Applications..."
if [ -d "/Applications/$APP_NAME.app" ]; then
  echo "  Removing previous installation..."
  rm -rf "/Applications/$APP_NAME.app"
fi

cp -R "$APP_SRC" "/Applications/$APP_NAME.app"

echo ""
echo "==========================================="
echo "  Installation Complete!"
echo "==========================================="
echo ""
echo "  Launch:"
echo "    - Spotlight: Cmd+Space → 'Ancient PDF Master'"
echo "    - Finder:    /Applications/Ancient PDF Master.app"
echo "    - Terminal:   open '/Applications/Ancient PDF Master.app'"
echo ""
echo "  If macOS blocks the app:"
echo "    System Settings → Privacy & Security → Open Anyway"
echo ""
