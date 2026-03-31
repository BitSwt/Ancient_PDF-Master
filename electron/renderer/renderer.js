// ── DOM Elements ──

const inputPath = document.getElementById("input-path");
const outputPath = document.getElementById("output-path");
const btnBrowseInput = document.getElementById("btn-browse-input");
const btnBrowseOutput = document.getElementById("btn-browse-output");
const btnStart = document.getElementById("btn-start");
const btnCancel = document.getElementById("btn-cancel");
const btnClearLog = document.getElementById("btn-clear-log");
const progressSection = document.getElementById("progress-section");
const progressBar = document.getElementById("progress-bar");
const progressText = document.getElementById("progress-text");
const logOutput = document.getElementById("log-output");
const tesseractStatus = document.getElementById("tesseract-status");
const statusIcon = document.getElementById("status-icon");
const statusMessage = document.getElementById("status-message");

const modalOverlay = document.getElementById("modal-overlay");
const modalMessage = document.getElementById("modal-message");
const btnOpenFile = document.getElementById("btn-open-file");
const btnShowFolder = document.getElementById("btn-show-folder");
const btnModalClose = document.getElementById("btn-modal-close");

const langGrc = document.getElementById("lang-grc");
const langLat = document.getElementById("lang-lat");
const langEng = document.getElementById("lang-eng");
const dpiSelect = document.getElementById("dpi-select");

const splitEnabled = document.getElementById("split-enabled");
const splitSettings = document.getElementById("split-settings");
const splitPattern = document.getElementById("split-pattern");
const splitCustom = document.getElementById("split-custom");
const splitLangAPages = document.getElementById("split-lang-a-pages");
const splitLangBPages = document.getElementById("split-lang-b-pages");
const splitCommonPages = document.getElementById("split-common-pages");
const splitOutputA = document.getElementById("split-output-a");
const splitOutputB = document.getElementById("split-output-b");

const pagelabelsEnabled = document.getElementById("pagelabels-enabled");
const pagelabelsSettings = document.getElementById("pagelabels-settings");
const pagelabelsPreset = document.getElementById("pagelabels-preset");
const pagelabelsSimple = document.getElementById("pagelabels-simple");
const pagelabelsCustom = document.getElementById("pagelabels-custom");
const pagelabelsBodyStart = document.getElementById("pagelabels-body-start");
const pagelabelsRanges = document.getElementById("pagelabels-ranges");
const btnAddPagelabel = document.getElementById("btn-add-pagelabel");

const tocEnabled = document.getElementById("toc-enabled");
const tocSettings = document.getElementById("toc-settings");
const tocEntries = document.getElementById("toc-entries");
const btnAddToc = document.getElementById("btn-add-toc");
const btnImportToc = document.getElementById("btn-import-toc");
const tocImportArea = document.getElementById("toc-import-area");
const tocImportText = document.getElementById("toc-import-text");
const btnParseToc = document.getElementById("btn-parse-toc");

const autoDeskew = document.getElementById("auto-deskew");
const confidenceRetry = document.getElementById("confidence-retry");
const pageRangeInput = document.getElementById("page-range");
const zonePreset = document.getElementById("zone-preset");
const zoneHint = document.getElementById("zone-hint");
const zoneParams = document.getElementById("zone-params");
const zoneCustom = document.getElementById("zone-custom");
const zoneMarginWidth = document.getElementById("zone-margin-width");
const zoneMarginLabel = document.getElementById("zone-margin-label");
const zoneMarginTop = document.getElementById("zone-margin-top");
const zoneMarginTopLabel = document.getElementById("zone-margin-top-label");
const zoneMarginBottom = document.getElementById("zone-margin-bottom");
const zoneMarginBottomLabel = document.getElementById("zone-margin-bottom-label");
const zoneCustomEntries = document.getElementById("zone-custom-entries");
const zoneAutoDetect = document.getElementById("zone-auto-detect");
const btnDetectRegions = document.getElementById("btn-detect-regions");
const detectStatus = document.getElementById("detect-status");
const detectedRegionList = document.getElementById("detected-region-list");
const zoneBodyOnly = document.getElementById("zone-body-only");
const zoneBodyMargin = document.getElementById("zone-body-margin");
const zoneBodyMarginLabel = document.getElementById("zone-body-margin-label");
const btnAddZone = document.getElementById("btn-add-zone");

// Preprocessing elements
const preprocessEnabled = document.getElementById("preprocess-enabled");
const preprocessSettings = document.getElementById("preprocess-settings");
const ppDeskew = document.getElementById("pp-deskew");
const ppAutocontrast = document.getElementById("pp-autocontrast");
const ppDenoise = document.getElementById("pp-denoise");
const ppGrayscale = document.getElementById("pp-grayscale");
const ppBw = document.getElementById("pp-bw");
const ppBwSettings = document.getElementById("pp-bw-settings");
const ppBwThreshold = document.getElementById("pp-bw-threshold");
const ppBwLabel = document.getElementById("pp-bw-label");

// Preview elements
const previewPanel = document.getElementById("preview-panel");
const previewEmpty = document.getElementById("preview-empty");
const previewContent = document.getElementById("preview-content");
const previewImage = document.getElementById("preview-image");
const previewOverlay = document.getElementById("preview-overlay");
const previewPageInfo = document.getElementById("preview-page-info");
const btnPrevPage = document.getElementById("btn-prev-page");
const btnNextPage = document.getElementById("btn-next-page");
const pvShowZones = document.getElementById("pv-show-zones");
const pvShowCrop = document.getElementById("pv-show-crop");
const pvShowPreprocess = document.getElementById("pv-show-preprocess");

// Crop elements
const cropEnabled = document.getElementById("crop-enabled");
const cropSettings = document.getElementById("crop-settings");
const btnCropSet = document.getElementById("btn-crop-set");
const btnCropReset = document.getElementById("btn-crop-reset");
const btnCropApplyAll = document.getElementById("btn-crop-apply-all");
const cropInfo = document.getElementById("crop-info");

// Zoom controls
const btnZoomIn = document.getElementById("btn-zoom-in");
const btnZoomOut = document.getElementById("btn-zoom-out");
const btnZoomFit = document.getElementById("btn-zoom-fit");
const zoomLabel = document.getElementById("zoom-label");

// Drop zone
const dropZone = document.getElementById("drop-zone");
const dropArea = document.getElementById("drop-area");

let currentOutputPath = "";
let removeProgressListener = null;

// Preview state
let previewPages = [];
let currentPage = 0;
let totalPages = 0;

// Detected text regions (per page): { pageIndex: [{x_start, y_start, x_end, y_end, ...}] }
let detectedRegions = {};
// Currently selected region index for resizing
let regionDragState = null;
// Crop areas per page: { pageIndex: {x_start, y_start, x_end, y_end} }
let cropAreas = {};
let cropDragState = null;

// ── Logging ──

function log(message, type = "") {
  const line = document.createElement("div");
  line.className = `log-line ${type ? `log-${type}` : ""}`;
  line.textContent = message;
  logOutput.appendChild(line);
  logOutput.scrollTop = logOutput.scrollHeight;
}

// ── Helpers ──

function getBasePath(filePath) {
  const parts = filePath.split(/[\\/]/);
  const fileName = parts.pop();
  const dir = parts.join("/");
  const baseName = fileName.replace(/\.[^.]+$/, "");
  return { dir, baseName };
}

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ── Initialization ──

async function init() {
  tesseractStatus.classList.remove("hidden");
  statusIcon.textContent = "⟳";
  statusMessage.textContent = "Starting Python backend...";
  log("[INFO] Initializing (may install packages on first run)...", "info");

  try {
    const result = await window.api.checkTesseract();

    if (result.available) {
      tesseractStatus.className = "status-banner success";
      statusIcon.textContent = "✓";
      statusMessage.textContent = result.message;
      log(`[OK] ${result.message}`, "ok");

      const langResult = await window.api.getLanguages();
      const installed = langResult.installed || [];

      // Check all language checkboxes against installed languages
      const allLangs = [
        ["grc", "lang-grc", "Ancient Greek"], ["lat", "lang-lat", "Latin"], ["eng", "lang-eng", "English"],
        ["ell", "lang-ell", "Greek Modern"], ["heb", "lang-heb", "Hebrew"], ["ara", "lang-ara", "Arabic"],
        ["syr", "lang-syr", "Syriac"], ["san", "lang-san", "Sanskrit"], ["deu", "lang-deu", "German"],
        ["fra", "lang-fra", "French"], ["ita", "lang-ita", "Italian"], ["spa", "lang-spa", "Spanish"],
      ];

      const coreOk = [];
      for (const [code, id, name] of allLangs) {
        const checkbox = document.getElementById(id);
        if (!checkbox) continue;
        if (installed.includes(code)) {
          if (["grc", "lat", "eng"].includes(code)) coreOk.push(code);
        } else {
          checkbox.checked = false;
          checkbox.disabled = true;
          checkbox.parentElement.style.opacity = "0.5";
        }
      }
      log(`  [OK] ${installed.length} languages available (${coreOk.join(", ")})`, "ok");
    } else {
      tesseractStatus.className = "status-banner error";
      statusIcon.textContent = "✗";
      statusMessage.textContent = result.message;
      log(`[ERROR] ${result.message}`, "error");
    }
  } catch (err) {
    tesseractStatus.className = "status-banner error";
    statusIcon.textContent = "✗";
    const msg = err.message || "Unknown error";

    if (msg.includes("Missing Python packages")) {
      statusMessage.textContent = "Python packages not installed";
      log("[ERROR] " + msg, "error");
      log("[FIX] Run: ./scripts/run-dev.sh", "warn");
    } else if (msg.includes("Failed to start") || msg.includes("ENOENT")) {
      statusMessage.textContent = "Python not found";
      log("[ERROR] " + msg, "error");
      log("[FIX] Run: ./scripts/install-mac.sh", "warn");
    } else {
      statusMessage.textContent = "Python backend error";
      log("[ERROR] " + msg, "error");
    }
  }
}

// ── Drag & Drop ──

function handleFileInput(filePath) {
  inputPath.value = filePath;
  btnStart.disabled = false;

  const { dir, baseName } = getBasePath(filePath);
  outputPath.value = `${dir}/${baseName}_ocr.pdf`;
  splitOutputA.value = `${dir}/${baseName}_lang_a.pdf`;
  splitOutputB.value = `${dir}/${baseName}_lang_b.pdf`;

  log(`Input: ${filePath}`, "info");
  loadPreview(filePath);
}

// Drag & drop on the drop area
dropArea.addEventListener("click", () => btnBrowseInput.click());

document.addEventListener("dragover", (e) => {
  e.preventDefault();
  e.stopPropagation();
  dropArea.classList.add("drag-over");
});

document.addEventListener("dragleave", (e) => {
  e.preventDefault();
  e.stopPropagation();
  if (!e.relatedTarget || !document.contains(e.relatedTarget)) {
    dropArea.classList.remove("drag-over");
  }
});

document.addEventListener("drop", (e) => {
  e.preventDefault();
  e.stopPropagation();
  dropArea.classList.remove("drag-over");

  const files = Array.from(e.dataTransfer.files);
  if (files.length > 0) {
    const file = files[0];
    const ext = file.name.split(".").pop().toLowerCase();
    const supported = ["pdf", "png", "jpg", "jpeg", "tif", "tiff", "bmp", "webp"];
    if (supported.includes(ext)) {
      // Use webUtils.getPathForFile (Electron 33+) with fallback
      const filePath = window.api.getPathForFile
        ? window.api.getPathForFile(file)
        : file.path;
      if (filePath) {
        handleFileInput(filePath);
      } else {
        log("[WARN] Could not get file path from drop", "warn");
      }
    } else {
      log(`[WARN] Unsupported file type: .${ext}`, "warn");
    }
  }
});

// ── File Selection ──

btnBrowseInput.addEventListener("click", async () => {
  const filePath = await window.api.selectInputFile();
  if (filePath) handleFileInput(filePath);
});

btnBrowseOutput.addEventListener("click", async () => {
  const filePath = await window.api.selectOutputFile(outputPath.value);
  if (filePath) outputPath.value = filePath;
});

// ── Preview ──

async function loadPreview(filePath) {
  previewEmpty.classList.add("hidden");
  previewContent.classList.remove("hidden");
  previewPageInfo.textContent = "Loading...";

  try {
    const result = await window.api.loadPreview({ input: filePath, dpi: 72, max_width: 600 });
    previewPages = result.pages;
    totalPages = result.total;
    currentPage = 0;
    showPage(0);
    log(`[OK] Loaded ${totalPages} page(s) for preview`, "ok");
  } catch (err) {
    log(`[WARN] Preview failed: ${err.message}`, "warn");
    previewEmpty.classList.remove("hidden");
    previewContent.classList.add("hidden");
  }
}

function showPage(index) {
  if (index < 0 || index >= totalPages) return;
  currentPage = index;
  previewPageInfo.textContent = `${index + 1} / ${totalPages}`;
  updateCropInfo();

  if (pvShowPreprocess.checked && preprocessEnabled.checked) {
    loadPreprocessedPage(index);
  } else {
    const page = previewPages[index];
    previewImage.src = page.data;
    previewImage.onload = () => drawZoneOverlay();
  }
}

async function loadPreprocessedPage(index) {
  previewPageInfo.textContent = `${index + 1} / ${totalPages} (processing...)`;
  try {
    const result = await window.api.previewPreprocess({
      input: inputPath.value,
      page: index,
      dpi: 150,
      max_width: 600,
      deskew: ppDeskew.checked,
      grayscale: ppGrayscale.checked,
      bw: ppBw.checked,
      bw_threshold: parseInt(ppBwThreshold.value),
      denoise: ppDenoise.checked,
      autocontrast: ppAutocontrast.checked,
    });
    previewImage.src = result.data;
    previewImage.onload = () => drawZoneOverlay();
    previewPageInfo.textContent = `${index + 1} / ${totalPages}`;
  } catch (err) {
    log(`[WARN] Preprocess preview failed: ${err.message}`, "warn");
    // Fallback to original
    const page = previewPages[index];
    if (page) previewImage.src = page.data;
    previewPageInfo.textContent = `${index + 1} / ${totalPages}`;
  }
}

// ── Interactive Margin Drag State ──
let marginDragState = null; // { edge: "left"|"right", startX, startMargin }
const DRAG_HANDLE_WIDTH = 8; // px hit area for drag handles

function getMarginValues() {
  return {
    lr: parseInt(zoneMarginWidth.value) / 100,
    top: parseInt(zoneMarginTop.value) / 100,
    bottom: parseInt(zoneMarginBottom.value) / 100,
  };
}

function getMarginZones() {
  const preset = zonePreset.value;
  const m = getMarginValues();
  if (preset === "left_margin") {
    return [
      { x: 0, y: m.top, w: m.lr, h: 1 - m.top - m.bottom, label: "Margin" },
      { x: m.lr, y: m.top, w: 1 - m.lr, h: 1 - m.top - m.bottom, label: "Body" },
    ];
  } else if (preset === "both_margins") {
    const isEvenPage = (currentPage % 2 === 1);
    if (isEvenPage) {
      return [
        { x: 0, y: m.top, w: 1 - m.lr, h: 1 - m.top - m.bottom, label: "Body" },
        { x: 1 - m.lr, y: m.top, w: m.lr, h: 1 - m.top - m.bottom, label: "Margin" },
      ];
    }
    return [
      { x: 0, y: m.top, w: m.lr, h: 1 - m.top - m.bottom, label: "L.Margin" },
      { x: m.lr, y: m.top, w: 1 - 2 * m.lr, h: 1 - m.top - m.bottom, label: "Body" },
      { x: 1 - m.lr, y: m.top, w: m.lr, h: 1 - m.top - m.bottom, label: "R.Margin" },
    ];
  }
  return null;
}

function getDraggableEdges() {
  const preset = zonePreset.value;
  const m = getMarginValues();
  const edges = [];

  // Top/bottom edges (common to both presets)
  if (preset === "left_margin" || preset === "both_margins") {
    edges.push({ edge: "top", yFrac: m.top, axis: "h" });
    edges.push({ edge: "bottom", yFrac: 1 - m.bottom, axis: "h" });
  }

  if (preset === "left_margin") {
    edges.push({ edge: "right-of-left", xFrac: m.lr, axis: "v" });
  } else if (preset === "both_margins") {
    const isEvenPage = (currentPage % 2 === 1);
    if (isEvenPage) {
      edges.push({ edge: "left-of-right", xFrac: 1 - m.lr, axis: "v" });
    } else {
      edges.push({ edge: "right-of-left", xFrac: m.lr, axis: "v" });
      edges.push({ edge: "left-of-right", xFrac: 1 - m.lr, axis: "v" });
    }
  }
  return edges;
}

function drawZoneOverlay() {
  const cvs = previewOverlay;
  const img = previewImage;

  cvs.width = img.clientWidth;
  cvs.height = img.clientHeight;
  cvs.style.width = img.clientWidth + "px";
  cvs.style.height = img.clientHeight + "px";

  const wrapper = document.getElementById("preview-image-wrapper");
  const imgRect = img.getBoundingClientRect();
  const wrapperRect = wrapper.getBoundingClientRect();
  cvs.style.left = (imgRect.left - wrapperRect.left) + "px";
  cvs.style.top = (imgRect.top - wrapperRect.top) + "px";

  const ctx = cvs.getContext("2d");
  ctx.clearRect(0, 0, cvs.width, cvs.height);

  const w = cvs.width;
  const h = cvs.height;

  // Always draw crop overlay (independent of zones)
  _drawCropOverlay(ctx, w, h);

  if (!pvShowZones.checked) return;

  const preset = zonePreset.value;
  if (preset === "full_page") return;

  const colors = ["rgba(52, 208, 88, 0.2)", "rgba(88, 166, 255, 0.2)", "rgba(248, 81, 73, 0.2)"];
  const borders = ["rgba(52, 208, 88, 0.6)", "rgba(88, 166, 255, 0.6)", "rgba(248, 81, 73, 0.6)"];

  let zones = [];
  if (preset === "auto_column") {
    // Show a hint text
    ctx.fillStyle = "rgba(52, 208, 88, 0.3)";
    ctx.font = "13px -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Auto column detection (1 or 2 cols per page)", w / 2, 20);
    ctx.textAlign = "left";
    return;
  } else if (preset === "two_column") {
    const m = getMarginValues();
    zones = [
      { x: 0, y: m.top, w: 0.48, h: 1 - m.top - m.bottom, label: "Left Column" },
      { x: 0.52, y: m.top, w: 0.48, h: 1 - m.top - m.bottom, label: "Right Column" },
    ];
    if (m.top > 0) { ctx.fillStyle = "rgba(248, 81, 73, 0.1)"; ctx.fillRect(0, 0, w, m.top * h); }
    if (m.bottom > 0) { ctx.fillStyle = "rgba(248, 81, 73, 0.1)"; ctx.fillRect(0, (1 - m.bottom) * h, w, m.bottom * h); }
  } else if (preset === "left_margin" || preset === "both_margins") {
    zones = getMarginZones() || [];
    // Dim excluded top/bottom margins
    const m = getMarginValues();
    if (m.top > 0) {
      ctx.fillStyle = "rgba(248, 81, 73, 0.1)";
      ctx.fillRect(0, 0, w, m.top * h);
    }
    if (m.bottom > 0) {
      ctx.fillStyle = "rgba(248, 81, 73, 0.1)";
      ctx.fillRect(0, (1 - m.bottom) * h, w, m.bottom * h);
    }
  } else if (preset === "body_only") {
    const m = parseInt(zoneBodyMargin.value) / 100;
    zones = [
      { x: m, y: m, w: 1 - 2 * m, h: 1 - 2 * m, label: "Body" },
    ];
    // Dim the excluded margins
    ctx.fillStyle = "rgba(248, 81, 73, 0.15)";
    ctx.fillRect(0, 0, w, m * h);                     // top
    ctx.fillRect(0, (1 - m) * h, w, m * h);           // bottom
    ctx.fillRect(0, m * h, m * w, (1 - 2 * m) * h);   // left
    ctx.fillRect((1 - m) * w, m * h, m * w, (1 - 2 * m) * h); // right
  } else if (preset === "auto_detect") {
    const regions = detectedRegions[currentPage] || [];
    regions.forEach((r, i) => {
      const ci = i % colors.length;
      const rx = r.x_start * w;
      const ry = r.y_start * h;
      const rw = (r.x_end - r.x_start) * w;
      const rh = (r.y_end - r.y_start) * h;

      ctx.fillStyle = colors[ci];
      ctx.fillRect(rx, ry, rw, rh);
      ctx.strokeStyle = borders[ci];
      ctx.lineWidth = 2;
      ctx.strokeRect(rx, ry, rw, rh);

      // Label
      ctx.fillStyle = borders[ci];
      ctx.font = "11px -apple-system, sans-serif";
      ctx.fillText(`R${i + 1}`, rx + 4, ry + 14);

      // Draw resize handles (small squares at corners and edges)
      const handleSize = 6;
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      // Corners
      for (const [hx, hy] of [[rx, ry], [rx + rw, ry], [rx, ry + rh], [rx + rw, ry + rh]]) {
        ctx.fillRect(hx - handleSize / 2, hy - handleSize / 2, handleSize, handleSize);
        ctx.strokeStyle = borders[ci];
        ctx.lineWidth = 1;
        ctx.strokeRect(hx - handleSize / 2, hy - handleSize / 2, handleSize, handleSize);
      }
    });
    return; // Skip margin-specific drawing below
  } else if (preset === "custom") {
    const rows = zoneCustomEntries.querySelectorAll(".zone-row");
    rows.forEach((row) => {
      zones.push({
        x: parseInt(row.querySelector(".zr-x1").value) / 100,
        y: parseInt(row.querySelector(".zr-y1").value) / 100,
        w: (parseInt(row.querySelector(".zr-x2").value) - parseInt(row.querySelector(".zr-x1").value)) / 100,
        h: (parseInt(row.querySelector(".zr-y2").value) - parseInt(row.querySelector(".zr-y1").value)) / 100,
        label: `PSM ${row.querySelector(".zr-psm").value}`,
      });
    });
  }

  zones.forEach((zone, i) => {
    const ci = i % colors.length;
    ctx.fillStyle = colors[ci];
    ctx.fillRect(zone.x * w, zone.y * h, zone.w * w, zone.h * h);
    ctx.strokeStyle = borders[ci];
    ctx.lineWidth = 2;
    ctx.strokeRect(zone.x * w, zone.y * h, zone.w * w, zone.h * h);
    ctx.fillStyle = borders[ci];
    ctx.font = "11px -apple-system, sans-serif";
    ctx.fillText(zone.label, zone.x * w + 4, zone.y * h + 14);
  });

  // Draw drag handles on all edges (for margin presets)
  const edges = getDraggableEdges();
  edges.forEach((e) => {
    ctx.fillStyle = "rgba(52, 208, 88, 0.7)";
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "center";
    if (e.axis === "v") {
      // Vertical edge (left/right margin boundary)
      const xPx = e.xFrac * w;
      ctx.fillRect(xPx - 2, h * 0.35, 4, h * 0.3);
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.fillText("⇔", xPx, h * 0.5 + 5);
    } else {
      // Horizontal edge (top/bottom margin boundary)
      const yPx = e.yFrac * h;
      ctx.fillRect(w * 0.35, yPx - 2, w * 0.3, 4);
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.fillText("⇕", w * 0.5, yPx + 5);
    }
    ctx.textAlign = "left";
  });
}

function _drawCropOverlay(ctx, w, h) {
  if (!cropEnabled.checked || !pvShowCrop.checked) return;
  const crop = cropAreas[currentPage];
  if (!crop) return;

  const cx1 = crop.x_start * w;
  const cy1 = crop.y_start * h;
  const cx2 = crop.x_end * w;
  const cy2 = crop.y_end * h;
  const cw = cx2 - cx1;
  const ch = cy2 - cy1;

  // Dim outside crop area
  ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
  ctx.fillRect(0, 0, w, cy1);                      // top
  ctx.fillRect(0, cy2, w, h - cy2);                // bottom
  ctx.fillRect(0, cy1, cx1, ch);                    // left
  ctx.fillRect(cx2, cy1, w - cx2, ch);             // right

  // Crop border
  ctx.strokeStyle = "rgba(255, 200, 50, 0.9)";
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 3]);
  ctx.strokeRect(cx1, cy1, cw, ch);
  ctx.setLineDash([]);

  // Corner handles
  const hs = 7;
  ctx.fillStyle = "rgba(255, 200, 50, 0.95)";
  for (const [hx, hy] of [[cx1, cy1], [cx2, cy1], [cx1, cy2], [cx2, cy2]]) {
    ctx.fillRect(hx - hs / 2, hy - hs / 2, hs, hs);
  }
  // Edge midpoint handles
  const ms = 5;
  ctx.fillStyle = "rgba(255, 200, 50, 0.8)";
  for (const [hx, hy] of [[(cx1+cx2)/2, cy1], [(cx1+cx2)/2, cy2], [cx1, (cy1+cy2)/2], [cx2, (cy1+cy2)/2]]) {
    ctx.fillRect(hx - ms / 2, hy - ms / 2, ms, ms);
  }

  // Label
  ctx.fillStyle = "rgba(255, 200, 50, 0.9)";
  ctx.font = "bold 11px -apple-system, sans-serif";
  ctx.fillText("CROP", cx1 + 4, cy1 - 4);
}
