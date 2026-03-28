"""Application entry point."""

from __future__ import annotations

import sys


def main():
    """Launch the Ancient PDF Master GUI application."""
    from PySide6.QtWidgets import QApplication

    from .gui import MainWindow

    app = QApplication(sys.argv)
    app.setApplicationName("Ancient PDF Master")
    app.setOrganizationName("AncientPDFMaster")
    app.setApplicationVersion("1.0.0")

    # macOS-specific settings
    if sys.platform == "darwin":
        app.setStyle("macOS")

    window = MainWindow()
    window.show()

    sys.exit(app.exec())


if __name__ == "__main__":
    main()
