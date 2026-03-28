"""py2app setup script for macOS .app bundle."""

from setuptools import setup

APP = ["src/ancient_pdf_master/app.py"]

DATA_FILES = []

OPTIONS = {
    "argv_emulation": False,
    "iconfile": "assets/icon.icns",
    "plist": {
        "CFBundleName": "Ancient PDF Master",
        "CFBundleDisplayName": "Ancient PDF Master",
        "CFBundleIdentifier": "com.ancientpdfmaster.app",
        "CFBundleVersion": "1.0.0",
        "CFBundleShortVersionString": "1.0.0",
        "NSHumanReadableCopyright": "MIT License",
        "CFBundleDocumentTypes": [
            {
                "CFBundleTypeName": "PDF Document",
                "CFBundleTypeRole": "Editor",
                "LSItemContentTypes": ["com.adobe.pdf"],
                "CFBundleTypeExtensions": ["pdf"],
            },
            {
                "CFBundleTypeName": "Image",
                "CFBundleTypeRole": "Editor",
                "CFBundleTypeExtensions": ["png", "jpg", "jpeg", "tif", "tiff"],
            },
        ],
        "NSRequiresAquaSystemAppearance": False,  # Support dark mode
    },
    "packages": [
        "ancient_pdf_master",
        "PySide6",
        "pytesseract",
        "PIL",
        "pdf2image",
        "pikepdf",
        "reportlab",
    ],
    "includes": [
        "PySide6.QtCore",
        "PySide6.QtGui",
        "PySide6.QtWidgets",
    ],
    "excludes": [
        "tkinter",
        "matplotlib",
        "numpy.testing",
        "pytest",
    ],
    "frameworks": [],
}

setup(
    app=APP,
    data_files=DATA_FILES,
    options={"py2app": OPTIONS},
    setup_requires=["py2app"],
)
