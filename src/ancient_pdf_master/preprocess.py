"""Image preprocessing: deskew, B&W conversion, denoising."""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

from PIL import Image, ImageFilter, ImageOps


class PreprocessStep(str, Enum):
    DESKEW = "deskew"
    GRAYSCALE = "grayscale"
    BW = "bw"
    DENOISE = "denoise"
    AUTOCONTRAST = "autocontrast"


@dataclass
class PreprocessConfig:
    deskew: bool = False
    grayscale: bool = False
    bw: bool = False
    bw_threshold: int = 128
    denoise: bool = False
    autocontrast: bool = False


def preprocess_image(image: Image.Image, config: PreprocessConfig) -> Image.Image:
    """Apply preprocessing steps to an image before OCR."""
    img = image.copy()

    if config.autocontrast:
        if img.mode != "L":
            img = ImageOps.autocontrast(img.convert("RGB"))
        else:
            img = ImageOps.autocontrast(img)

    if config.deskew:
        img = _deskew(img)

    if config.denoise:
        img = _denoise(img)

    if config.bw:
        # Convert to black & white (1-bit)
        if img.mode != "L":
            img = img.convert("L")
        img = img.point(lambda x: 255 if x > config.bw_threshold else 0, "1")
    elif config.grayscale:
        img = img.convert("L")

    return img


def _projection_variance(bw_image: Image.Image, angle: float) -> float:
    """Compute variance of horizontal projection for a given rotation angle.

    Higher variance means sharper text line peaks = better alignment.
    Uses bytes-level processing for speed instead of per-pixel access.
    """
    rotated = bw_image.rotate(angle, resample=Image.BICUBIC, expand=False, fillcolor=255)
    width, height = rotated.size

    # Convert to bytes: 0=black, 255=white in mode "L"
    data = rotated.tobytes()

    # Sum black pixels per row (value 0 = black text)
    projections = []
    for y in range(height):
        row_start = y * width
        row_bytes = data[row_start : row_start + width]
        row_sum = sum(1 for b in row_bytes if b == 0)
        projections.append(row_sum)

    if len(projections) < 2:
        return 0.0

    mean = sum(projections) / len(projections)
    return sum((p - mean) ** 2 for p in projections) / len(projections)


def _deskew(image: Image.Image) -> Image.Image:
    """Deskew an image by detecting the dominant text angle.

    Uses a two-pass projection-profile approach:
      1. Coarse search: -10° to +10° in 1° steps
      2. Fine search: best ± 1° in 0.1° steps

    Works on a downscaled binarized copy for speed.
    """
    # Downscale for faster angle detection (max 800px wide)
    gray = image.convert("L")
    scale = 1.0
    if gray.width > 800:
        scale = 800 / gray.width
        gray = gray.resize((800, int(gray.height * scale)), Image.BILINEAR)

    # Binarize: black text on white background
    bw = gray.point(lambda x: 0 if x > 128 else 255)

    # Pass 1: coarse search -10° to +10° in 1° steps
    best_angle = 0.0
    best_score = -1.0

    for angle in range(-10, 11):
        score = _projection_variance(bw, float(angle))
        if score > best_score:
            best_score = score
            best_angle = float(angle)

    # Pass 2: fine search around best ± 1° in 0.1° steps
    fine_best = best_angle
    fine_score = best_score

    for step in range(-10, 11):
        angle = best_angle + step * 0.1
        score = _projection_variance(bw, angle)
        if score > fine_score:
            fine_score = score
            fine_best = angle

    if abs(fine_best) < 0.05:
        return image  # No significant skew

    # Apply to the original full-resolution image (keep original dimensions)
    fill = "white" if image.mode in ("RGB", "RGBA", "L") else 255
    return image.rotate(fine_best, resample=Image.BICUBIC, expand=False, fillcolor=fill)


def _denoise(image: Image.Image) -> Image.Image:
    """Apply median filter to reduce noise."""
    return image.filter(ImageFilter.MedianFilter(size=3))
