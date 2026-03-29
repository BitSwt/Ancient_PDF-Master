"""Tests for image preprocessing module."""

from PIL import Image

from ancient_pdf_master.preprocess import PreprocessConfig, preprocess_image


def _make_test_image(width=200, height=100, color="white"):
    return Image.new("RGB", (width, height), color)


def test_grayscale():
    img = _make_test_image()
    config = PreprocessConfig(grayscale=True)
    result = preprocess_image(img, config)
    assert result.mode == "L"


def test_bw():
    img = _make_test_image(color=(128, 128, 128))
    config = PreprocessConfig(bw=True, bw_threshold=128)
    result = preprocess_image(img, config)
    assert result.mode == "1"


def test_bw_threshold_high():
    img = _make_test_image(color=(200, 200, 200))
    config = PreprocessConfig(bw=True, bw_threshold=128)
    result = preprocess_image(img, config)
    # 200 > 128 → white
    pixels = list(result.getdata())
    assert all(p == 255 for p in pixels)


def test_denoise():
    img = _make_test_image()
    config = PreprocessConfig(denoise=True)
    result = preprocess_image(img, config)
    assert result.size == img.size


def test_autocontrast():
    img = _make_test_image()
    config = PreprocessConfig(autocontrast=True)
    result = preprocess_image(img, config)
    assert result.size == img.size


def test_deskew():
    img = _make_test_image(width=100, height=100)
    config = PreprocessConfig(deskew=True)
    result = preprocess_image(img, config)
    assert result.size == img.size


def test_combined():
    img = _make_test_image()
    config = PreprocessConfig(deskew=True, denoise=True, autocontrast=True, grayscale=True)
    result = preprocess_image(img, config)
    assert result.mode == "L"
    assert result.size == img.size


def test_no_preprocessing():
    img = _make_test_image()
    config = PreprocessConfig()
    result = preprocess_image(img, config)
    assert result.mode == img.mode
    assert result.size == img.size
