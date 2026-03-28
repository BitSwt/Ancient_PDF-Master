# Ancient PDF Master

OCR tool for Ancient Greek, Latin, and English texts. Creates searchable PDFs from scanned images and documents using Tesseract OCR.

## Features

- **Multi-language OCR**: Ancient Greek (grc), Latin (lat), English (eng)
- **Searchable PDF output**: Invisible text layer overlay for search and copy
- **Multiple input formats**: PNG, JPG, TIFF, PDF
- **Native macOS GUI**: PySide6-based interface with dark mode support
- **Batch processing ready**: Process multiple files via GUI
- **Confidence reporting**: Per-page OCR confidence scores

## Requirements

### System Dependencies

```bash
# macOS
brew install tesseract tesseract-lang poppler

# Linux (Debian/Ubuntu)
sudo apt install tesseract-ocr tesseract-ocr-grc tesseract-ocr-lat poppler-utils
```

### Python

Python 3.10+

## Installation

```bash
# Clone and install
git clone https://github.com/bitswt/Ancient_PDF-Master.git
cd Ancient_PDF-Master
pip install -e .
```

## Usage

```bash
# Launch GUI
ancient-pdf-master
```

Or run directly:

```bash
python -m ancient_pdf_master.app
```

## Building macOS DMG

```bash
# Install packaging dependencies
pip install -e ".[packaging]"

# Optional: install create-dmg for a polished DMG
brew install create-dmg

# Build
./scripts/build_dmg.sh
```

The DMG will be created at `dist/AncientPDFMaster-1.0.0.dmg`.

## Development

```bash
pip install -e ".[dev]"
pytest
```

## Project Structure

```
src/ancient_pdf_master/
  app.py            # Application entry point
  gui.py            # PySide6 GUI (MainWindow)
  worker.py         # Background OCR worker thread
  ocr_engine.py     # Tesseract OCR wrapper
  pdf_builder.py    # Searchable PDF generation
  image_handler.py  # Image/PDF loading
  language.py       # Language config & validation
```

## License

MIT
