#!/bin/bash
# Quick-start for development (no .app build needed)
# Usage: ./scripts/run-dev.sh
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

echo "=== Ancient PDF Master - Dev Mode ==="

# Check critical dependencies
for cmd in python3 node tesseract; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "ERROR: $cmd not found."
    echo ""
    if [ "$cmd" = "tesseract" ]; then
      echo "Install: brew install tesseract tesseract-lang"
    elif [ "$cmd" = "node" ]; then
      echo "Install: brew install node"
    elif [ "$cmd" = "python3" ]; then
      echo "Install: brew install python3"
    fi
    echo ""
    echo "Or run the full installer: ./scripts/install-mac.sh"
    exit 1
  fi
done

# Setup venv if needed
VENV_DIR="$PROJECT_DIR/.venv"
if [ ! -d "$VENV_DIR" ]; then
  echo "Creating virtual environment..."
  python3 -m venv "$VENV_DIR"
fi
source "$VENV_DIR/bin/activate"

# Ensure pip is up to date
pip install --upgrade pip setuptools wheel --quiet 2>/dev/null || true

# Ensure Python deps are installed
if ! python3 -c "import pytesseract" 2>/dev/null; then
  echo "Installing Python dependencies..."
  if ! pip install -e . --quiet 2>&1; then
    echo ""
    echo "ERROR: pip install failed."
    echo "Try manually: $VENV_DIR/bin/pip install -e ."
    echo "If pikepdf fails: brew install qpdf"
    exit 1
  fi
fi

# Ensure Node deps are installed
if [ ! -d "node_modules" ]; then
  echo "Installing Node.js dependencies..."
  npm install
fi

echo "Launching..."
npm start
