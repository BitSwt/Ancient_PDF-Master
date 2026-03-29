"""Tesseract fine-tuning pipeline for custom OCR models.

Enables fine-tuning from a base Tesseract model (e.g. grc) using
user-provided ground truth images + text pairs. The pipeline:

1. Validate training data (image + .gt.txt pairs)
2. Generate .lstmf training files via Tesseract
3. Extract LSTM starter from base model
4. Run lstmtraining for fine-tuning
5. Package result as .traineddata

Requires Tesseract 4+ training tools: lstmtraining, combine_tessdata.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
from dataclasses import dataclass, field
from pathlib import Path

from PIL import Image


@dataclass
class TrainingConfig:
    """Configuration for a fine-tuning job."""

    base_lang: str = "grc"  # base model to fine-tune from
    model_name: str = "grc_manuscript"  # output model name
    max_iterations: int = 400
    learning_rate: float = 0.001
    data_dir: str = ""  # directory with image + .gt.txt pairs
    output_dir: str = ""  # where to save the model
    target_error_rate: float = 1.0  # stop if BCER reaches this (%)


@dataclass
class TrainingStatus:
    """Current status of a training job."""

    phase: str = "idle"  # idle, validating, generating, extracting, training, packaging, done, error
    progress: float = 0.0  # 0.0 – 1.0
    iteration: int = 0
    max_iterations: int = 0
    error_rate: float = 100.0
    message: str = ""
    model_path: str = ""


def check_training_tools() -> tuple[bool, str]:
    """Check if Tesseract training tools are available."""
    tools = ["lstmtraining", "combine_tessdata", "tesseract"]
    missing = []
    for tool in tools:
        if shutil.which(tool) is None:
            missing.append(tool)
    if missing:
        return False, (
            f"Missing training tools: {', '.join(missing)}.\n"
            f"macOS: brew install tesseract\n"
            f"Linux: sudo apt install tesseract-ocr libtesseract-dev"
        )
    return True, "All training tools available"


def find_tessdata_dir() -> Path | None:
    """Find the tessdata directory on the system."""
    candidates = [
        # Environment variable
        os.environ.get("TESSDATA_PREFIX", ""),
        # macOS Homebrew
        "/opt/homebrew/share/tessdata",
        "/usr/local/share/tessdata",
        # Linux
        "/usr/share/tesseract-ocr/5/tessdata",
        "/usr/share/tesseract-ocr/4.00/tessdata",
        "/usr/share/tessdata",
    ]
    for c in candidates:
        if c and Path(c).is_dir():
            return Path(c)

    # Try asking tesseract
    try:
        result = subprocess.run(
            ["tesseract", "--print-parameters"],
            capture_output=True, text=True, timeout=5,
        )
        for line in result.stdout.splitlines():
            if "tessdata" in line.lower():
                parts = line.split()
                for p in parts:
                    path = Path(p)
                    if path.is_dir():
                        return path
    except Exception:
        pass

    return None


def get_custom_models_dir() -> Path:
    """Get the directory for custom-trained models.

    Creates it if it doesn't exist. Location:
    - macOS: ~/Library/Application Support/Ancient PDF Master/models/
    - Linux: ~/.local/share/Ancient PDF Master/models/
    """
    if os.name == "nt":
        base = Path(os.environ.get("APPDATA", Path.home() / "AppData" / "Roaming"))
    elif os.uname().sysname == "Darwin":
        base = Path.home() / "Library" / "Application Support"
    else:
        base = Path(os.environ.get("XDG_DATA_HOME", Path.home() / ".local" / "share"))

    models_dir = base / "Ancient PDF Master" / "models"
    models_dir.mkdir(parents=True, exist_ok=True)
    return models_dir


def list_custom_models() -> list[dict]:
    """List all custom-trained .traineddata files."""
    models_dir = get_custom_models_dir()
    models = []
    for f in sorted(models_dir.glob("*.traineddata")):
        stat = f.stat()
        models.append({
            "name": f.stem,
            "path": str(f),
            "size_mb": round(stat.st_size / (1024 * 1024), 1),
            "modified": stat.st_mtime,
        })
    return models


def delete_custom_model(model_name: str) -> bool:
    """Delete a custom model by name."""
    models_dir = get_custom_models_dir()
    path = models_dir / f"{model_name}.traineddata"
    if path.exists():
        path.unlink()
        return True
    return False


def validate_training_data(data_dir: str) -> dict:
    """Validate a directory of training data.

    Expects pairs of files:
    - image.png / image.jpg / image.tif  +  image.gt.txt
    Each .gt.txt contains the ground truth text for that line image.

    Returns:
        dict with keys: valid, pairs, errors, warnings
    """
    data_path = Path(data_dir)
    if not data_path.is_dir():
        return {"valid": False, "pairs": 0, "errors": [f"Directory not found: {data_dir}"], "warnings": []}

    image_exts = {".png", ".jpg", ".jpeg", ".tif", ".tiff", ".bmp"}
    images = {}
    gt_files = {}

    for f in data_path.iterdir():
        if f.suffix.lower() in image_exts:
            stem = f.stem
            images[stem] = f
        elif f.name.endswith(".gt.txt"):
            stem = f.name[:-7]  # remove .gt.txt
            gt_files[stem] = f

    errors = []
    warnings = []
    pairs = []

    # Check for matching pairs
    for stem, img_path in sorted(images.items()):
        if stem not in gt_files:
            warnings.append(f"No ground truth for: {img_path.name}")
            continue
        gt_path = gt_files[stem]
        gt_text = gt_path.read_text(encoding="utf-8").strip()
        if not gt_text:
            warnings.append(f"Empty ground truth: {gt_path.name}")
            continue
        pairs.append({"image": str(img_path), "text": gt_text, "stem": stem})

    for stem in gt_files:
        if stem not in images:
            warnings.append(f"No image for ground truth: {stem}.gt.txt")

    if len(pairs) < 5:
        errors.append(f"Need at least 5 image+text pairs, found {len(pairs)}")

    return {
        "valid": len(errors) == 0 and len(pairs) >= 5,
        "pairs": len(pairs),
        "errors": errors,
        "warnings": warnings,
    }


def run_fine_tuning(
    config: TrainingConfig,
    progress_callback=None,
) -> TrainingStatus:
    """Run the full fine-tuning pipeline.

    Args:
        config: Training configuration.
        progress_callback: Called with TrainingStatus on each update.

    Returns:
        Final TrainingStatus.
    """
    status = TrainingStatus(max_iterations=config.max_iterations)

    def _update(phase: str, progress: float, message: str, **kwargs):
        status.phase = phase
        status.progress = progress
        status.message = message
        for k, v in kwargs.items():
            setattr(status, k, v)
        if progress_callback:
            progress_callback(status)

    try:
        return _run_fine_tuning_impl(config, status, _update)
    except Exception as e:
        _update("error", status.progress, str(e))
        return status


def _run_fine_tuning_impl(config, status, _update):
    """Internal implementation of fine-tuning pipeline."""

    data_path = Path(config.data_dir)
    output_path = Path(config.output_dir) if config.output_dir else get_custom_models_dir()
    output_path.mkdir(parents=True, exist_ok=True)

    # ── Phase 1: Validate ──
    _update("validating", 0.0, "Validating training data...")
    validation = validate_training_data(config.data_dir)
    if not validation["valid"]:
        _update("error", 0.0, f"Validation failed: {'; '.join(validation['errors'])}")
        return status

    num_pairs = validation["pairs"]
    _update("validating", 0.05, f"Found {num_pairs} training pairs")

    # ── Phase 2: Find base model ──
    tessdata_dir = find_tessdata_dir()
    if not tessdata_dir:
        _update("error", 0.05, "Cannot find tessdata directory")
        return status

    base_model = tessdata_dir / f"{config.base_lang}.traineddata"
    if not base_model.exists():
        _update("error", 0.05, f"Base model not found: {base_model}")
        return status

    # Work in a temp directory
    with tempfile.TemporaryDirectory(prefix="tess_train_") as tmpdir:
        tmp = Path(tmpdir)

        # ── Phase 3: Generate .lstmf files ──
        _update("generating", 0.1, "Generating training files...")

        lstmf_files = []
        image_exts = {".png", ".jpg", ".jpeg", ".tif", ".tiff", ".bmp"}

        # Collect pairs
        pairs = []
        for f in sorted(data_path.iterdir()):
            if f.suffix.lower() in image_exts:
                gt = data_path / f"{f.stem}.gt.txt"
                if gt.exists() and gt.read_text(encoding="utf-8").strip():
                    pairs.append((f, gt))

        for i, (img_file, gt_file) in enumerate(pairs):
            stem = img_file.stem
            progress = 0.1 + (0.3 * i / len(pairs))
            _update("generating", progress, f"Processing {i + 1}/{len(pairs)}: {stem}")

            # Tesseract needs the image and a box/lstmf file
            # Copy image to tmpdir
            work_img = tmp / f"{stem}{img_file.suffix}"
            shutil.copy2(img_file, work_img)

            # Copy ground truth
            work_gt = tmp / f"{stem}.gt.txt"
            shutil.copy2(gt_file, work_gt)

            # Generate .lstmf using tesseract
            try:
                result = subprocess.run(
                    [
                        "tesseract", str(work_img), str(tmp / stem),
                        "--psm", "7",  # single line
                        "lstm.train",
                    ],
                    capture_output=True, text=True, timeout=30,
                    env={**os.environ, "TESSDATA_PREFIX": str(tessdata_dir.parent)
                         if tessdata_dir.name == "tessdata" else str(tessdata_dir)},
                )
                lstmf = tmp / f"{stem}.lstmf"
                if lstmf.exists():
                    lstmf_files.append(str(lstmf))
                else:
                    # Try alternative: use base lang for better feature extraction
                    result2 = subprocess.run(
                        [
                            "tesseract", str(work_img), str(tmp / stem),
                            "-l", config.base_lang,
                            "--psm", "7",
                            "lstm.train",
                        ],
                        capture_output=True, text=True, timeout=30,
                        env={**os.environ, "TESSDATA_PREFIX": str(tessdata_dir.parent)
                             if tessdata_dir.name == "tessdata" else str(tessdata_dir)},
                    )
                    if lstmf.exists():
                        lstmf_files.append(str(lstmf))
            except subprocess.TimeoutExpired:
                continue

        if not lstmf_files:
            _update("error", 0.4, "Failed to generate any training files")
            return status

        _update("generating", 0.4, f"Generated {len(lstmf_files)} training files")

        # Write list file
        list_file = tmp / "training_files.txt"
        list_file.write_text("\n".join(lstmf_files))

        # ── Phase 4: Extract LSTM from base model ──
        _update("extracting", 0.45, f"Extracting LSTM from {config.base_lang} model...")

        # Copy base traineddata to tmp
        tmp_base = tmp / f"{config.base_lang}.traineddata"
        shutil.copy2(base_model, tmp_base)

        result = subprocess.run(
            ["combine_tessdata", "-e", str(tmp_base), str(tmp / f"{config.base_lang}.lstm")],
            capture_output=True, text=True, timeout=30,
        )

        lstm_file = tmp / f"{config.base_lang}.lstm"
        if not lstm_file.exists():
            _update("error", 0.45, f"Failed to extract LSTM: {result.stderr}")
            return status

        # ── Phase 5: Fine-tune with lstmtraining ──
        _update("training", 0.5, "Starting LSTM training...")

        checkpoint_prefix = str(tmp / config.model_name)

        # Build training command
        cmd = [
            "lstmtraining",
            f"--continue_from={lstm_file}",
            f"--model_output={checkpoint_prefix}",
            f"--traineddata={tmp_base}",
            f"--train_listfile={list_file}",
            f"--max_iterations={config.max_iterations}",
            f"--learning_rate={config.learning_rate}",
            "--debug_interval=-1",
        ]

        if config.target_error_rate > 0:
            cmd.append(f"--target_error_rate={config.target_error_rate / 100}")

        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
        )

        # Parse training output for progress
        for line in proc.stdout:
            line = line.strip()
            if not line:
                continue

            # Parse iteration progress: "At iteration 50/400..."
            if "iteration" in line.lower():
                parts = line.split()
                for j, p in enumerate(parts):
                    if "/" in p:
                        try:
                            current, total = p.split("/")
                            it = int(current)
                            status.iteration = it
                            train_progress = 0.5 + (0.4 * it / config.max_iterations)
                            _update("training", min(train_progress, 0.9),
                                    f"Iteration {it}/{config.max_iterations}",
                                    iteration=it)
                        except ValueError:
                            pass

            # Parse error rate: "BCER train=12.34%..."
            if "bcer" in line.lower() or "char error" in line.lower():
                for part in line.replace("=", " ").replace("%", " ").split():
                    try:
                        val = float(part)
                        if 0 <= val <= 100:
                            status.error_rate = val
                            break
                    except ValueError:
                        continue

        proc.wait()

        if proc.returncode != 0:
            _update("error", status.progress, f"Training failed (exit code {proc.returncode})")
            return status

        # ── Phase 6: Package as .traineddata ──
        _update("packaging", 0.92, "Packaging model...")

        # Find the checkpoint file
        checkpoint = None
        for suffix in ["_checkpoint", f"_{config.max_iterations}.checkpoint"]:
            candidate = Path(f"{checkpoint_prefix}{suffix}")
            if candidate.exists():
                checkpoint = candidate
                break

        if not checkpoint:
            # Try any checkpoint file
            checkpoints = list(tmp.glob(f"{config.model_name}*checkpoint*"))
            if checkpoints:
                checkpoint = max(checkpoints, key=lambda p: p.stat().st_mtime)

        if not checkpoint:
            _update("error", 0.92, "No checkpoint found after training")
            return status

        # Combine into .traineddata
        final_model = output_path / f"{config.model_name}.traineddata"
        result = subprocess.run(
            [
                "lstmtraining",
                "--stop_training",
                f"--continue_from={checkpoint}",
                f"--traineddata={tmp_base}",
                f"--model_output={final_model}",
            ],
            capture_output=True, text=True, timeout=60,
        )

        if not final_model.exists():
            _update("error", 0.95, f"Failed to package model: {result.stderr}")
            return status

        status.model_path = str(final_model)
        _update("done", 1.0,
                f"Model saved: {final_model.name} "
                f"(error rate: {status.error_rate:.1f}%)",
                model_path=str(final_model))

    return status


def generate_line_images(
    page_image_path: str,
    output_dir: str,
    lang: str = "grc",
    dpi: int = 300,
) -> list[dict]:
    """Split a page image into individual line images using Tesseract.

    This helps users prepare training data from scanned pages.
    Each line is saved as a separate image file.

    Args:
        page_image_path: Path to the page image.
        output_dir: Directory to save line images.
        lang: Language for initial OCR (to detect lines).
        dpi: DPI of the source image.

    Returns:
        List of dicts with keys: image_path, text (initial OCR), index
    """
    import pytesseract
    from pytesseract import Output

    out_path = Path(output_dir)
    out_path.mkdir(parents=True, exist_ok=True)

    img = Image.open(page_image_path)
    data = pytesseract.image_to_data(
        img, lang=lang, config="--psm 3", output_type=Output.DICT,
    )

    # Group by (block, par, line)
    line_groups: dict[tuple, list[int]] = {}
    for i in range(len(data["text"])):
        key = (data["block_num"][i], data["par_num"][i], data["line_num"][i])
        line_groups.setdefault(key, []).append(i)

    results = []
    line_idx = 0

    for key in sorted(line_groups.keys()):
        indices = line_groups[key]
        # Get line bounding box
        valid = [i for i in indices if data["text"][i].strip() and float(data["conf"][i]) >= 0]
        if not valid:
            continue

        x1 = min(data["left"][i] for i in valid)
        y1 = min(data["top"][i] for i in valid)
        x2 = max(data["left"][i] + data["width"][i] for i in valid)
        y2 = max(data["top"][i] + data["height"][i] for i in valid)

        # Add padding
        pad = 5
        x1 = max(0, x1 - pad)
        y1 = max(0, y1 - pad)
        x2 = min(img.width, x2 + pad)
        y2 = min(img.height, y2 + pad)

        if x2 <= x1 or y2 <= y1:
            continue

        # Crop and save
        line_img = img.crop((x1, y1, x2, y2))
        stem = f"line_{line_idx:04d}"
        img_path = out_path / f"{stem}.png"
        line_img.save(str(img_path))

        # Initial OCR text as starting ground truth
        line_text = " ".join(data["text"][i].strip() for i in valid if data["text"][i].strip())

        # Save initial ground truth
        gt_path = out_path / f"{stem}.gt.txt"
        gt_path.write_text(line_text, encoding="utf-8")

        results.append({
            "image_path": str(img_path),
            "text": line_text,
            "index": line_idx,
        })
        line_idx += 1

    return results
