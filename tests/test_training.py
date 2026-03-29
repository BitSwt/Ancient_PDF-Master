"""Tests for training module."""

import tempfile
from pathlib import Path

from PIL import Image

from ancient_pdf_master.training import (
    TrainingConfig,
    get_custom_models_dir,
    list_custom_models,
    validate_training_data,
)


def test_validate_training_data_empty_dir():
    with tempfile.TemporaryDirectory() as tmpdir:
        result = validate_training_data(tmpdir)
        assert not result["valid"]
        assert result["pairs"] == 0


def test_validate_training_data_missing_dir():
    result = validate_training_data("/nonexistent/path")
    assert not result["valid"]
    assert "not found" in result["errors"][0].lower()


def test_validate_training_data_valid():
    with tempfile.TemporaryDirectory() as tmpdir:
        # Create 6 valid pairs
        for i in range(6):
            img = Image.new("L", (200, 40), "white")
            img.save(Path(tmpdir) / f"line_{i:04d}.png")
            (Path(tmpdir) / f"line_{i:04d}.gt.txt").write_text(f"test word {i}")

        result = validate_training_data(tmpdir)
        assert result["valid"]
        assert result["pairs"] == 6
        assert len(result["errors"]) == 0


def test_validate_training_data_too_few():
    with tempfile.TemporaryDirectory() as tmpdir:
        # Create only 3 pairs (need >= 5)
        for i in range(3):
            img = Image.new("L", (200, 40), "white")
            img.save(Path(tmpdir) / f"line_{i:04d}.png")
            (Path(tmpdir) / f"line_{i:04d}.gt.txt").write_text(f"text {i}")

        result = validate_training_data(tmpdir)
        assert not result["valid"]
        assert result["pairs"] == 3


def test_validate_training_data_warnings():
    with tempfile.TemporaryDirectory() as tmpdir:
        # 6 valid pairs + 1 orphan image + 1 empty gt
        for i in range(6):
            img = Image.new("L", (200, 40), "white")
            img.save(Path(tmpdir) / f"line_{i:04d}.png")
            (Path(tmpdir) / f"line_{i:04d}.gt.txt").write_text(f"text {i}")

        # Orphan image (no .gt.txt)
        Image.new("L", (200, 40), "white").save(Path(tmpdir) / "orphan.png")
        # Empty ground truth
        Image.new("L", (200, 40), "white").save(Path(tmpdir) / "empty.png")
        (Path(tmpdir) / "empty.gt.txt").write_text("")

        result = validate_training_data(tmpdir)
        assert result["valid"]
        assert result["pairs"] == 6
        assert len(result["warnings"]) >= 2


def test_custom_models_dir_exists():
    d = get_custom_models_dir()
    assert d.is_dir()


def test_list_custom_models_empty():
    models = list_custom_models()
    assert isinstance(models, list)


def test_training_config_defaults():
    config = TrainingConfig()
    assert config.base_lang == "grc"
    assert config.max_iterations == 400
    assert config.learning_rate == 0.001
