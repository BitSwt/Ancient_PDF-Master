"""PySide6 GUI for Ancient PDF Master."""

from __future__ import annotations

import sys
from pathlib import Path

from PySide6.QtCore import QThread, Qt
from PySide6.QtGui import QAction, QFont, QIcon
from PySide6.QtWidgets import (
    QApplication,
    QCheckBox,
    QComboBox,
    QFileDialog,
    QGroupBox,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QMainWindow,
    QMessageBox,
    QProgressBar,
    QPushButton,
    QSizePolicy,
    QSpinBox,
    QStatusBar,
    QTextEdit,
    QVBoxLayout,
    QWidget,
)

from .image_handler import get_supported_filter
from .language import SUPPORTED_LANGUAGES, check_tesseract_available
from .worker import OcrWorker


class MainWindow(QMainWindow):
    """Main application window."""

    def __init__(self):
        super().__init__()
        self.setWindowTitle("Ancient PDF Master")
        self.setMinimumSize(700, 600)
        self.resize(800, 650)

        self._worker: OcrWorker | None = None
        self._thread: QThread | None = None

        self._setup_ui()
        self._setup_menu()
        self._check_tesseract()

    def _setup_ui(self):
        central = QWidget()
        self.setCentralWidget(central)
        layout = QVBoxLayout(central)
        layout.setSpacing(12)
        layout.setContentsMargins(16, 16, 16, 16)

        # --- Input file section ---
        input_group = QGroupBox("Input")
        input_layout = QHBoxLayout(input_group)
        self.input_path = QLineEdit()
        self.input_path.setPlaceholderText("Select an image or PDF file...")
        self.input_path.setReadOnly(True)
        input_browse = QPushButton("Browse...")
        input_browse.setFixedWidth(100)
        input_browse.clicked.connect(self._browse_input)
        input_layout.addWidget(self.input_path)
        input_layout.addWidget(input_browse)
        layout.addWidget(input_group)

        # --- Output file section ---
        output_group = QGroupBox("Output")
        output_layout = QHBoxLayout(output_group)
        self.output_path = QLineEdit()
        self.output_path.setPlaceholderText("Output path (auto-generated if empty)")
        output_browse = QPushButton("Browse...")
        output_browse.setFixedWidth(100)
        output_browse.clicked.connect(self._browse_output)
        output_layout.addWidget(self.output_path)
        output_layout.addWidget(output_browse)
        layout.addWidget(output_group)

        # --- Settings section ---
        settings_group = QGroupBox("OCR Settings")
        settings_layout = QVBoxLayout(settings_group)

        # Language checkboxes
        lang_label = QLabel("Languages:")
        lang_layout = QHBoxLayout()
        self.lang_checks: dict[str, QCheckBox] = {}
        for code, name in SUPPORTED_LANGUAGES.items():
            cb = QCheckBox(name)
            cb.setChecked(True)
            self.lang_checks[code] = cb
            lang_layout.addWidget(cb)
        lang_layout.addStretch()

        settings_layout.addWidget(lang_label)
        settings_layout.addLayout(lang_layout)

        # DPI setting
        dpi_layout = QHBoxLayout()
        dpi_label = QLabel("DPI (for PDF input):")
        self.dpi_spin = QSpinBox()
        self.dpi_spin.setRange(72, 600)
        self.dpi_spin.setValue(300)
        self.dpi_spin.setSingleStep(50)
        dpi_layout.addWidget(dpi_label)
        dpi_layout.addWidget(self.dpi_spin)
        dpi_layout.addStretch()
        settings_layout.addLayout(dpi_layout)

        layout.addWidget(settings_group)

        # --- Action buttons ---
        btn_layout = QHBoxLayout()
        self.start_btn = QPushButton("Start OCR")
        self.start_btn.setFixedHeight(40)
        self.start_btn.setEnabled(False)
        self.start_btn.clicked.connect(self._start_ocr)

        self.cancel_btn = QPushButton("Cancel")
        self.cancel_btn.setFixedHeight(40)
        self.cancel_btn.setEnabled(False)
        self.cancel_btn.clicked.connect(self._cancel_ocr)

        btn_layout.addWidget(self.start_btn)
        btn_layout.addWidget(self.cancel_btn)
        layout.addLayout(btn_layout)

        # --- Progress ---
        self.progress_bar = QProgressBar()
        self.progress_bar.setTextVisible(True)
        self.progress_bar.setValue(0)
        layout.addWidget(self.progress_bar)

        # --- Log output ---
        log_group = QGroupBox("Log")
        log_layout = QVBoxLayout(log_group)
        self.log_text = QTextEdit()
        self.log_text.setReadOnly(True)
        self.log_text.setFont(QFont("Menlo", 11))
        self.log_text.setMinimumHeight(150)
        log_layout.addWidget(self.log_text)
        layout.addWidget(log_group)

        # --- Status bar ---
        self.status_bar = QStatusBar()
        self.setStatusBar(self.status_bar)
        self.status_bar.showMessage("Ready")

    def _setup_menu(self):
        menubar = self.menuBar()

        # File menu
        file_menu = menubar.addMenu("File")
        open_action = QAction("Open...", self)
        open_action.setShortcut("Ctrl+O")
        open_action.triggered.connect(self._browse_input)
        file_menu.addAction(open_action)

        file_menu.addSeparator()

        quit_action = QAction("Quit", self)
        quit_action.setShortcut("Ctrl+Q")
        quit_action.triggered.connect(self.close)
        file_menu.addAction(quit_action)

        # Help menu
        help_menu = menubar.addMenu("Help")
        about_action = QAction("About", self)
        about_action.triggered.connect(self._show_about)
        help_menu.addAction(about_action)

    def _check_tesseract(self):
        available, message = check_tesseract_available()
        if available:
            self._log(f"[OK] {message}")
            self.status_bar.showMessage(message)
        else:
            self._log(f"[ERROR] {message}")
            self.status_bar.showMessage("Tesseract not found")
            QMessageBox.warning(self, "Tesseract Not Found", message)

    def _log(self, message: str):
        self.log_text.append(message)

    def _get_lang_string(self) -> str:
        selected = [
            code for code, cb in self.lang_checks.items() if cb.isChecked()
        ]
        if not selected:
            return "eng"
        return "+".join(selected)

    def _browse_input(self):
        path, _ = QFileDialog.getOpenFileName(
            self, "Select Input File", "", get_supported_filter()
        )
        if path:
            self.input_path.setText(path)
            self.start_btn.setEnabled(True)

            # Auto-generate output path
            p = Path(path)
            default_output = p.parent / f"{p.stem}_ocr.pdf"
            self.output_path.setText(str(default_output))
            self._log(f"Input: {path}")

    def _browse_output(self):
        path, _ = QFileDialog.getSaveFileName(
            self, "Save Output PDF", "", "PDF Files (*.pdf)"
        )
        if path:
            if not path.endswith(".pdf"):
                path += ".pdf"
            self.output_path.setText(path)

    def _start_ocr(self):
        input_path = self.input_path.text()
        output_path = self.output_path.text()

        if not input_path:
            QMessageBox.warning(self, "No Input", "Please select an input file.")
            return
        if not output_path:
            p = Path(input_path)
            output_path = str(p.parent / f"{p.stem}_ocr.pdf")
            self.output_path.setText(output_path)

        lang = self._get_lang_string()
        dpi = self.dpi_spin.value()

        self._log(f"\nStarting OCR: lang={lang}, dpi={dpi}")
        self._log(f"Output: {output_path}")

        # Disable UI
        self.start_btn.setEnabled(False)
        self.cancel_btn.setEnabled(True)
        self.progress_bar.setValue(0)

        # Create worker and thread
        self._thread = QThread()
        self._worker = OcrWorker(input_path, output_path, lang, dpi)
        self._worker.moveToThread(self._thread)

        # Connect signals
        self._thread.started.connect(self._worker.run)
        self._worker.progress.connect(self._on_progress)
        self._worker.page_completed.connect(self._on_page_completed)
        self._worker.finished.connect(self._on_finished)
        self._worker.error.connect(self._on_error)
        self._worker.finished.connect(self._thread.quit)
        self._worker.error.connect(self._thread.quit)

        self._thread.start()

    def _cancel_ocr(self):
        if self._worker:
            self._worker.cancel()
            self._log("[CANCELLED] OCR processing cancelled.")
        self._reset_ui()

    def _on_progress(self, current: int, total: int, message: str):
        if total > 0:
            self.progress_bar.setMaximum(total)
            self.progress_bar.setValue(current)
        self.status_bar.showMessage(message)
        self._log(message)

    def _on_page_completed(self, page_num: int, result):
        conf = result.page_confidence
        words = result.word_count
        self._log(
            f"  Page {page_num}: {words} words, "
            f"confidence: {conf:.1f}%"
        )

    def _on_finished(self, output_path: str):
        self._log(f"\n[DONE] Searchable PDF saved: {output_path}")
        self.status_bar.showMessage("Done!")
        self.progress_bar.setValue(self.progress_bar.maximum())
        self._reset_ui()

        QMessageBox.information(
            self,
            "OCR Complete",
            f"Searchable PDF saved:\n{output_path}",
        )

    def _on_error(self, message: str):
        self._log(f"[ERROR] {message}")
        self.status_bar.showMessage("Error")
        self._reset_ui()
        QMessageBox.critical(self, "Error", message)

    def _reset_ui(self):
        self.start_btn.setEnabled(bool(self.input_path.text()))
        self.cancel_btn.setEnabled(False)

    def _show_about(self):
        QMessageBox.about(
            self,
            "About Ancient PDF Master",
            "<h3>Ancient PDF Master v1.0.0</h3>"
            "<p>OCR tool for Ancient Greek, Latin, and English texts.</p>"
            "<p>Uses Tesseract OCR to create searchable PDFs from "
            "scanned images and documents.</p>"
            "<p>Supported languages:</p>"
            "<ul>"
            "<li>Ancient Greek (grc)</li>"
            "<li>Latin (lat)</li>"
            "<li>English (eng)</li>"
            "</ul>",
        )
