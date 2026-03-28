"""Background worker threads for OCR processing."""

from __future__ import annotations

from pathlib import Path

from PySide6.QtCore import QObject, QThread, Signal

from .image_handler import load_images
from .ocr_engine import OcrPageResult, ocr_page
from .pdf_builder import build_searchable_pdf


class OcrWorker(QObject):
    """Worker that runs OCR processing in a background thread."""

    # Signals
    progress = Signal(int, int, str)  # current_page, total_pages, status_message
    page_completed = Signal(int, object)  # page_num, OcrPageResult
    finished = Signal(str)  # output_path
    error = Signal(str)  # error_message

    def __init__(
        self,
        input_path: str,
        output_path: str,
        lang: str,
        dpi: int = 300,
    ):
        super().__init__()
        self.input_path = input_path
        self.output_path = output_path
        self.lang = lang
        self.dpi = dpi
        self._cancelled = False

    def cancel(self):
        self._cancelled = True

    def run(self):
        """Execute the full OCR pipeline."""
        try:
            # Step 1: Load images
            self.progress.emit(0, 0, "Loading file...")
            images = load_images(self.input_path, dpi=self.dpi)
            total = len(images)

            if total == 0:
                self.error.emit("No pages found in the input file.")
                return

            # Step 2: OCR each page
            ocr_results: list[OcrPageResult] = []
            for i, image in enumerate(images):
                if self._cancelled:
                    self.error.emit("Processing cancelled.")
                    return

                self.progress.emit(i + 1, total, f"OCR page {i + 1}/{total}...")
                result = ocr_page(image, lang=self.lang)
                ocr_results.append(result)
                self.page_completed.emit(i + 1, result)

            if self._cancelled:
                return

            # Step 3: Build searchable PDF
            self.progress.emit(total, total, "Building searchable PDF...")
            output = build_searchable_pdf(
                images, ocr_results, self.output_path, dpi=self.dpi
            )

            self.finished.emit(str(output))

        except Exception as e:
            self.error.emit(str(e))
