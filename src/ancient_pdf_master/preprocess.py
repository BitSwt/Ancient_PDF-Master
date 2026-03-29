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


def _deskew(image: Image.Image) -> Image.Image:
    """Deskew an image by detecting the dominant text angle.

    Uses a projection-profile approach on the binarized image:
    rotate by small angles and find the angle that maximizes
    the variance of horizontal projection (= straightest text lines).
    """
    gray = image.convert("L")
    # Binarize for angle detection
    bw = gray.point(lambda x: 0 if x > 128 else 255)

    best_angle = 0
    best_score = -1

    # Search -5 to +5 degrees in 0.25 steps
    import math

    width, height = bw.size
    for angle_10x in range(-20, 21, 1):  # -2.0 to +2.0 in 0.1 steps
        angle = angle_10x / 10.0
        rotated = bw.rotate(angle, resample=Image.BICUBIC, expand=False, fillcolor=255)

        # Horizontal projection: sum of black pixels per row
        pixels = rotated.load()
        projections = []
        for y in range(height):
            row_sum = sum(1 for x in range(width) if pixels[x, y] == 0)
            projections.append(row_sum)

        # Score = variance of projection (sharp peaks = well-aligned text)
        if len(projections) < 2:
            continue
        mean = sum(projections) / len(projections)
        variance = sum((p - mean) ** 2 for p in projections) / len(projections)

        if variance > best_score:
            best_score = variance
            best_angle = angle

    if abs(best_angle) < 0.05:
        return image  # No significant skew

    return image.rotate(best_angle, resample=Image.BICUBIC, expand=False, fillcolor="white")


def _denoise(image: Image.Image) -> Image.Image:
    """Apply median filter to reduce noise."""
    return image.filter(ImageFilter.MedianFilter(size=3))
