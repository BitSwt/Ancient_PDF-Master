// ── Language / Config Getters ──

function getSelectedLanguages() {
  const langs = [];
  // Core languages
  const langCheckboxes = [
    ["grc", "lang-grc"], ["lat", "lang-lat"], ["eng", "lang-eng"],
    ["ell", "lang-ell"], ["heb", "lang-heb"], ["ara", "lang-ara"],
    ["syr", "lang-syr"], ["san", "lang-san"], ["deu", "lang-deu"],
    ["fra", "lang-fra"], ["ita", "lang-ita"], ["spa", "lang-spa"],
  ];
  for (const [code, id] of langCheckboxes) {
    const el = document.getElementById(id);
    if (el && el.checked) langs.push(code);
  }
  // Include custom-trained models
  document.querySelectorAll(".custom-lang-cb:checked").forEach((cb) => {
    if (!langs.includes(cb.value)) langs.push(cb.value);
  });
  return langs.length > 0 ? langs.join("+") : "eng";
}

function getZoneConfig() {
  const preset = zonePreset.value;
  if (preset === "full_page") return {};
  if (preset === "auto_column") return { zone_preset: "auto_column" };
  if (preset === "two_column") {
    const m = getMarginValues();
    return { zone_preset: "two_column", zone_params: { body_margin_top: m.top, body_margin_bottom: m.bottom } };
  }
  if (preset === "auto_detect") {
    // Collect all detected regions across pages as custom zones
    const allRegions = [];
    for (const pageIdx in detectedRegions) {
      for (const r of detectedRegions[pageIdx]) {
        allRegions.push({
          type: "body",
          x_start: r.x_start,
          y_start: r.y_start,
          x_end: r.x_end,
          y_end: r.y_end,
          psm: 3,
        });
      }
    }
    if (allRegions.length === 0) return {}; // fallback to full page
    return { zone_preset: "custom", zones: allRegions };
  }
  if (preset === "body_only") {
    const m = parseInt(zoneBodyMargin.value) / 100;
    return {
      zone_preset: "custom",
      zones: [{ type: "body", x_start: m, y_start: m, x_end: 1 - m, y_end: 1 - m, psm: 3 }],
    };
  }
  if (preset === "custom") {
    const rows = zoneCustomEntries.querySelectorAll(".zone-row");
    const zones = [];
    rows.forEach((row) => {
      zones.push({
        type: "body",
        x_start: parseInt(row.querySelector(".zr-x1").value) / 100,
        y_start: parseInt(row.querySelector(".zr-y1").value) / 100,
        x_end: parseInt(row.querySelector(".zr-x2").value) / 100,
        y_end: parseInt(row.querySelector(".zr-y2").value) / 100,
        psm: parseInt(row.querySelector(".zr-psm").value),
      });
    });
    return { zone_preset: "custom", zones };
  }
  const m = getMarginValues();
  const zoneParamsObj = { body_margin_top: m.top, body_margin_bottom: m.bottom };
  if (preset === "left_margin") zoneParamsObj.margin_width = m.lr;
  else if (preset === "both_margins") { zoneParamsObj.left_margin = m.lr; zoneParamsObj.right_margin = m.lr; }
  return { zone_preset: preset, zone_params: zoneParamsObj };
}

function getPreprocessConfig() {
  if (!preprocessEnabled.checked) return null;
  return {
    deskew: ppDeskew.checked,
    grayscale: ppGrayscale.checked,
    bw: ppBw.checked,
    bw_threshold: parseInt(ppBwThreshold.value),
    denoise: ppDenoise.checked,
    autocontrast: ppAutocontrast.checked,
  };
}

function getPageLabels() {
  if (!pagelabelsEnabled.checked) return null;
  if (pagelabelsPreset.value === "roman-arabic") {
    const bodyStart = parseInt(pagelabelsBodyStart.value) || 1;
    const ranges = [{ start_page: 0, style: "roman_lower", start_number: 1 }];
    if (bodyStart > 1) ranges.push({ start_page: bodyStart - 1, style: "arabic", start_number: 1 });
    return ranges;
  }
  const rows = pagelabelsRanges.querySelectorAll(".pagelabel-row");
  const ranges = [];
  rows.forEach((row) => {
    ranges.push({ start_page: (parseInt(row.querySelector(".pl-start").value) || 1) - 1, style: row.querySelector(".pl-style").value, start_number: parseInt(row.querySelector(".pl-startnum").value) || 1 });
  });
  return ranges.length > 0 ? ranges : null;
}

function addPageLabelRow(startPage = 1, style = "arabic", startNum = 1) {
  const row = document.createElement("div");
  row.className = "pagelabel-row";
  row.innerHTML = `
    <span style="color:var(--text-secondary);font-size:11px;">Page</span>
    <input type="number" class="text-input pl-start" value="${startPage}" min="1" style="width:50px;">
    <select class="select-input pl-style">
      <option value="roman_lower" ${style === "roman_lower" ? "selected" : ""}>i,ii,iii</option>
      <option value="roman_upper" ${style === "roman_upper" ? "selected" : ""}>I,II,III</option>
      <option value="arabic" ${style === "arabic" ? "selected" : ""}>1,2,3</option>
    </select>
    <span style="color:var(--text-secondary);font-size:11px;">from</span>
    <input type="number" class="text-input pl-startnum" value="${startNum}" min="1" style="width:45px;">
    <button class="pagelabel-delete">&times;</button>
  `;
  row.querySelector(".pagelabel-delete").addEventListener("click", () => row.remove());
  pagelabelsRanges.appendChild(row);
}
btnAddPagelabel.addEventListener("click", () => addPageLabelRow());

// ── TOC Editor ──

function getTocEntries() {
  if (!tocEnabled.checked) return null;
  const rows = tocEntries.querySelectorAll(".toc-entry-row");
  const entries = [];
  rows.forEach((row) => {
    const title = row.querySelector(".toc-title").value.trim();
    const page = parseInt(row.querySelector(".toc-page").value) || 1;
    const level = parseInt(row.dataset.level) || 0;
    if (title) entries.push({ title, page: page - 1, level });
  });
  return entries.length > 0 ? entries : null;
}

function addTocEntry(title = "", page = 1, level = 0) {
  const row = document.createElement("div");
  row.className = "toc-entry-row";
  row.dataset.level = level;
  row.style.paddingLeft = `${level * 16}px`;
  row.innerHTML = `
    <button class="toc-indent-btn toc-outdent" title="Outdent">&lt;</button>
    <button class="toc-indent-btn toc-indent" title="Indent">&gt;</button>
    <span class="toc-level-indicator">L${level}</span>
    <input type="text" class="text-input toc-title" placeholder="Title" value="${escapeHtml(title)}">
    <input type="number" class="text-input toc-page" placeholder="Pg" value="${page}" min="1" style="width:50px;">
    <button class="toc-delete">&times;</button>
  `;
  const updateLevel = (n) => { const c = Math.max(0, Math.min(3, n)); row.dataset.level = c; row.style.paddingLeft = `${c * 16}px`; row.querySelector(".toc-level-indicator").textContent = `L${c}`; };
  row.querySelector(".toc-outdent").addEventListener("click", () => updateLevel(parseInt(row.dataset.level) - 1));
  row.querySelector(".toc-indent").addEventListener("click", () => updateLevel(parseInt(row.dataset.level) + 1));
  row.querySelector(".toc-delete").addEventListener("click", () => row.remove());
  tocEntries.appendChild(row);
}

const btnDetectToc = document.getElementById("btn-detect-toc");

btnDetectToc.addEventListener("click", async () => {
  if (!inputPath.value) { log("[WARN] No file loaded", "warn"); return; }
  btnDetectToc.disabled = true;
  btnDetectToc.textContent = "Detecting...";
  log("[INFO] Scanning pages for TOC entries...", "info");

  try {
    const lang = getSelectedLanguages();
    const result = await window.api.detectToc({
      input: inputPath.value,
      dpi: 200,
      lang,
    });

    if (result.entries.length === 0) {
      log("[WARN] No TOC entries detected. Try importing manually.", "warn");
    } else {
      // Clear existing entries and add detected ones
      tocEntries.innerHTML = "";
      for (const e of result.entries) {
        addTocEntry(e.title, e.page, e.level);
      }
      tocEnabled.checked = true;
      tocSettings.classList.remove("hidden");
      log(`[OK] Detected ${result.total} TOC entries`, "ok");
    }
  } catch (err) {
    log(`[ERROR] TOC detection failed: ${err.message}`, "error");
  } finally {
    btnDetectToc.disabled = false;
    btnDetectToc.textContent = "Auto Detect";
  }
});

btnAddToc.addEventListener("click", () => addTocEntry());
btnImportToc.addEventListener("click", () => tocImportArea.classList.toggle("hidden"));

btnParseToc.addEventListener("click", () => {
  const text = tocImportText.value;
  if (!text.trim()) return;
  const lines = text.split("\n");
  for (const line of lines) {
    if (!line.trim()) continue;
    const stripped = line.replace(/^\s+/, "");
    const indent = line.length - stripped.length;
    const level = Math.min(3, Math.floor(indent / 2));
    const match = stripped.match(/^(.+?)[\s.…·\-_]+(\d+)\s*$/) || stripped.match(/^(.+?)\t+(\d+)\s*$/);
    if (match) addTocEntry(match[1].trim(), parseInt(match[2]), level);
    else addTocEntry(stripped.trim(), 1, level);
  }
  tocImportArea.classList.add("hidden");
  tocImportText.value = "";
  log(`[OK] Imported ${lines.filter((l) => l.trim()).length} TOC entries`, "ok");
});

// ── OCR Processing ──

function setupProgressListener() {
  removeProgressListener = window.api.onOcrProgress((data) => {
    if (data.current != null && data.total > 0) {
      progressBar.style.width = `${Math.round((data.current / data.total) * 100)}%`;
    }
    if (data.message) { progressText.textContent = data.message; log(data.message); }
    if (data.page_result) {
      const r = data.page_result;
      log(`  Page ${r.page}: ${r.words} words, confidence: ${r.confidence.toFixed(1)}%`, "ok");
    }
  });
}

function cleanupProgress() {
  btnStart.disabled = false;
  btnCancel.disabled = true;
  if (removeProgressListener) { removeProgressListener(); removeProgressListener = null; }
}

btnStart.addEventListener("click", async () => {
  const input = inputPath.value;
  if (!input) return;

  let output = outputPath.value;
  if (!output) { const { dir, baseName } = getBasePath(input); output = `${dir}/${baseName}_ocr.pdf`; outputPath.value = output; }

  const lang = getSelectedLanguages();
  const dpi = parseInt(dpiSelect.value);
  const isSplit = splitEnabled.checked;

  log("", "");
  log(`Starting OCR: lang=${lang}, dpi=${dpi}${isSplit ? " [split]" : ""}`, "info");

  btnStart.disabled = true;
  btnCancel.disabled = false;
  progressSection.classList.remove("hidden");
  progressBar.style.width = "0%";
  progressText.textContent = "Loading...";
  setupProgressListener();

  try {
    if (isSplit) {
      const langAPages = splitPattern.value === "custom" ? splitLangAPages.value || "odd" : "odd";
      const langBPages = splitPattern.value === "custom" ? splitLangBPages.value || "even" : "even";
      const outputA = splitOutputA.value || `${getBasePath(input).dir}/${getBasePath(input).baseName}_lang_a.pdf`;
      const outputB = splitOutputB.value || `${getBasePath(input).dir}/${getBasePath(input).baseName}_lang_b.pdf`;

      const result = await window.api.splitBilingual({
        input, output_a: outputA, output_b: outputB, lang, dpi,
        lang_a_pages: langAPages, lang_b_pages: langBPages, common_pages: splitCommonPages.value || "",
      });

      progressBar.style.width = "100%";
      progressText.textContent = "Complete!";
      log(`[DONE] A: ${result.output_a} (${result.pages_a} pages)`, "ok");
      log(`[DONE] B: ${result.output_b} (${result.pages_b} pages)`, "ok");
      currentOutputPath = result.output_a;
      modalMessage.textContent = `A: ${result.output_a}\nB: ${result.output_b}`;
      modalOverlay.classList.remove("hidden");
    } else {
      const params = { input, output, lang, dpi };
      if (autoDeskew.checked) params.auto_deskew = true;
      if (confidenceRetry.checked) params.min_confidence = 95.0;
      if (pageRangeInput.value.trim()) params.page_range = pageRangeInput.value.trim();
      if (cropEnabled.checked && Object.keys(cropAreas).length > 0) params.crop = cropAreas;
      Object.assign(params, getZoneConfig());
      const preprocess = getPreprocessConfig();
      if (preprocess) params.preprocess = preprocess;
      const pageLabels = getPageLabels();
      if (pageLabels) params.page_labels = pageLabels;
      const toc = getTocEntries();
      if (toc) params.toc = toc;

      const result = await window.api.startOcr(params);
      progressBar.style.width = "100%";
      progressText.textContent = "Complete!";
      log(`[DONE] ${result.output_path}`, "ok");
      currentOutputPath = result.output_path;
      modalMessage.textContent = result.output_path;
      modalOverlay.classList.remove("hidden");
    }
  } catch (err) {
    log(`[ERROR] ${err.message}`, "error");
    progressText.textContent = "Error";
  } finally {
    cleanupProgress();
  }
});

btnCancel.addEventListener("click", async () => {
  try { await window.api.cancelOcr(); log("[CANCELLED]", "warn"); } catch (err) { log(`[ERROR] ${err.message}`, "error"); }
  cleanupProgress();
  progressText.textContent = "Cancelled";
});

// ── Modal ──

btnOpenFile.addEventListener("click", () => { window.api.openFile(currentOutputPath); modalOverlay.classList.add("hidden"); });
btnShowFolder.addEventListener("click", () => { window.api.showInFolder(currentOutputPath); modalOverlay.classList.add("hidden"); });
btnModalClose.addEventListener("click", () => modalOverlay.classList.add("hidden"));
modalOverlay.addEventListener("click", (e) => { if (e.target === modalOverlay) modalOverlay.classList.add("hidden"); });

// ── Clear Log ──

btnClearLog.addEventListener("click", () => { logOutput.innerHTML = ""; });

// ── Auto-Updater ──

const updateBanner = document.getElementById("update-banner");
const updateMessage = document.getElementById("update-message");
const updateProgressBar = document.getElementById("update-progress-bar");
const updateProgressFill = document.getElementById("update-progress-fill");
const btnUpdateDownload = document.getElementById("btn-update-download");
const btnUpdateInstall = document.getElementById("btn-update-install");
const btnUpdateDismiss = document.getElementById("btn-update-dismiss");

window.api.onUpdaterStatus((data) => {
  switch (data.status) {
    case "available":
      updateBanner.classList.remove("hidden", "update-ready");
      updateMessage.textContent = `Update: v${data.version}`;
      btnUpdateDownload.classList.remove("hidden");
      btnUpdateInstall.classList.add("hidden");
      updateProgressBar.classList.add("hidden");
      break;
    case "downloading":
      updateMessage.textContent = `Downloading ${Math.round(data.percent)}%`;
      updateProgressBar.classList.remove("hidden");
      updateProgressFill.style.width = `${data.percent}%`;
      btnUpdateDownload.classList.add("hidden");
      break;
    case "ready":
      updateBanner.classList.add("update-ready");
      updateMessage.textContent = `v${data.version} ready`;
      updateProgressBar.classList.add("hidden");
      btnUpdateDownload.classList.add("hidden");
      btnUpdateInstall.classList.remove("hidden");
      break;
    case "up-to-date":
      log(`[OK] ${data.message}`, "ok");
      break;
    case "error":
      log(`[UPDATE] ${data.message}`, "warn");
      break;
  }
});

btnUpdateDownload.addEventListener("click", async () => { btnUpdateDownload.disabled = true; btnUpdateDownload.textContent = "..."; await window.api.updaterDownload(); });
btnUpdateInstall.addEventListener("click", async () => { await window.api.updaterInstall(); });
btnUpdateDismiss.addEventListener("click", () => { updateBanner.classList.add("hidden"); });

// ── Zoom ──

let zoomLevel = 1.0;

function applyZoom() {
  previewImage.style.maxWidth = zoomLevel === 1.0 ? "100%" : "none";
  previewImage.style.maxHeight = zoomLevel === 1.0 ? "100%" : "none";
  previewImage.style.width = zoomLevel === 1.0 ? "" : `${zoomLevel * 100}%`;
  zoomLabel.textContent = `${Math.round(zoomLevel * 100)}%`;
  // Redraw overlay at new zoom size
  setTimeout(drawZoneOverlay, 50);
}

btnZoomIn.addEventListener("click", () => {
  zoomLevel = Math.min(5.0, zoomLevel + 0.25);
  applyZoom();
});

btnZoomOut.addEventListener("click", () => {
  zoomLevel = Math.max(0.25, zoomLevel - 0.25);
  applyZoom();
});

btnZoomFit.addEventListener("click", () => {
  zoomLevel = 1.0;
  applyZoom();
});

// Mouse wheel zoom on preview
previewOverlay.addEventListener("wheel", (e) => {
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    zoomLevel = Math.max(0.25, Math.min(5.0, zoomLevel + delta));
    applyZoom();
  }
}, { passive: false });

// ── Window resize → redraw overlay + re-apply zoom ──

window.addEventListener("resize", () => {
  applyZoom();
});

// ── Model Training ──

const trainingEnabled = document.getElementById("training-enabled");
const trainingSettings = document.getElementById("training-settings");
const trainBaseLang = document.getElementById("train-base-lang");
const trainModelName = document.getElementById("train-model-name");
const trainDataDir = document.getElementById("train-data-dir");
const trainDataStatus = document.getElementById("train-data-status");
const trainIterations = document.getElementById("train-iterations");
const trainIterationsLabel = document.getElementById("train-iterations-label");
const trainLearningRate = document.getElementById("train-learning-rate");
const btnTrainBrowse = document.getElementById("btn-train-browse");
const btnStartTraining = document.getElementById("btn-start-training");
const trainProgress = document.getElementById("train-progress");
const trainProgressBar = document.getElementById("train-progress-bar");
const trainProgressText = document.getElementById("train-progress-text");
const customModelList = document.getElementById("custom-model-list");
const btnRefreshModels = document.getElementById("btn-refresh-models");
const btnGenerateLines = document.getElementById("btn-generate-lines");
const generateLinesStatus = document.getElementById("generate-lines-status");
const trainToolsWarning = document.getElementById("train-tools-warning");
const customLangRow = document.getElementById("custom-lang-row");

trainingEnabled.addEventListener("change", () => {
  trainingSettings.classList.toggle("hidden", !trainingEnabled.checked);
  if (trainingEnabled.checked) {
    checkTrainingTools();
    refreshCustomModels();
  }
});

trainIterations.addEventListener("input", () => {
  trainIterationsLabel.textContent = trainIterations.value;
});

btnTrainBrowse.addEventListener("click", async () => {
  const dir = await window.api.selectTrainingDir();
  if (dir) {
    trainDataDir.value = dir;
    // Validate
    trainDataStatus.textContent = "Validating...";
    try {
      const result = await window.api.validateTrainingData({ data_dir: dir });
      if (result.valid) {
        trainDataStatus.textContent = `Valid: ${result.pairs} image+text pairs`;
        trainDataStatus.style.color = "#4ecdc4";
        btnStartTraining.disabled = false;
      } else {
        const msgs = [...result.errors, ...result.warnings];
        trainDataStatus.textContent = msgs.join("; ") || `Found ${result.pairs} pairs (need ≥ 5)`;
        trainDataStatus.style.color = "#ff6b6b";
        btnStartTraining.disabled = true;
      }
    } catch (err) {
      trainDataStatus.textContent = err.message;
      trainDataStatus.style.color = "#ff6b6b";
    }
  }
});

btnStartTraining.addEventListener("click", async () => {
  const dataDir = trainDataDir.value;
  if (!dataDir) return;

  btnStartTraining.disabled = true;
  trainProgress.classList.remove("hidden");
  trainProgressBar.style.width = "0%";
  trainProgressText.textContent = "Starting...";
  log("[TRAIN] Starting fine-tuning...", "info");

  setupProgressListener();

  try {
    const result = await window.api.startTraining({
      base_lang: trainBaseLang.value,
      model_name: trainModelName.value || "grc_manuscript",
      max_iterations: parseInt(trainIterations.value, 10),
      learning_rate: parseFloat(trainLearningRate.value),
      data_dir: dataDir,
    });

    trainProgressBar.style.width = "100%";
    trainProgressText.textContent = "Training complete!";
    log(`[TRAIN] Model saved: ${result.model_name} (error rate: ${result.error_rate.toFixed(1)}%)`, "ok");

    // Refresh model list and language checkboxes
    refreshCustomModels();
  } catch (err) {
    log(`[TRAIN ERROR] ${err.message}`, "error");
    trainProgressText.textContent = "Error";
  } finally {
    btnStartTraining.disabled = false;
    cleanupProgress();
  }
});

async function checkTrainingTools() {
  try {
    const result = await window.api.checkTrainingTools();
    if (!result.available) {
      trainToolsWarning.classList.remove("hidden");
      trainToolsWarning.textContent = result.message;
      btnStartTraining.disabled = true;
    } else {
      trainToolsWarning.classList.add("hidden");
    }
  } catch (err) {
    trainToolsWarning.classList.remove("hidden");
    trainToolsWarning.textContent = `Cannot check training tools: ${err.message}`;
  }
}

async function refreshCustomModels() {
  try {
    const result = await window.api.listCustomModels();
    const models = result.models || [];

    if (models.length === 0) {
      customModelList.innerHTML = "<em>No custom models</em>";
      customLangRow.classList.add("hidden");
      customLangRow.innerHTML = "";
      return;
    }

    // Model list in training section
    customModelList.innerHTML = models.map((m) =>
      `<div style="display:flex;align-items:center;gap:6px;margin:3px 0;">
        <span style="flex:1;">${m.name} (${m.size_mb} MB)</span>
        <button class="btn-small btn-delete-model" data-name="${m.name}" title="Delete">&times;</button>
      </div>`
    ).join("");

    // Add click handlers for delete buttons
    customModelList.querySelectorAll(".btn-delete-model").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const name = btn.dataset.name;
        try {
          await window.api.deleteCustomModel({ name });
          log(`[TRAIN] Deleted model: ${name}`, "info");
          refreshCustomModels();
        } catch (err) {
          log(`[ERROR] ${err.message}`, "error");
        }
      });
    });

    // Add custom language checkboxes in OCR Settings
    customLangRow.classList.remove("hidden");
    customLangRow.innerHTML = models.map((m) =>
      `<label class="checkbox-item">
        <input type="checkbox" class="custom-lang-cb" value="${m.name}">
        <span>${m.name} (custom)</span>
      </label>`
    ).join("");

  } catch (err) {
    customModelList.innerHTML = `<em>Error: ${err.message}</em>`;
  }
}

btnRefreshModels.addEventListener("click", refreshCustomModels);

btnGenerateLines.addEventListener("click", async () => {
  if (!inputPath.value) {
    generateLinesStatus.textContent = "Load an input file first.";
    generateLinesStatus.style.color = "#ff6b6b";
    return;
  }

  const dir = await window.api.selectTrainingDir();
  if (!dir) return;

  generateLinesStatus.textContent = "Splitting page into lines...";
  generateLinesStatus.style.color = "";

  try {
    const result = await window.api.generateLineImages({
      image_path: inputPath.value,
      output_dir: dir,
      lang: trainBaseLang.value,
    });

    generateLinesStatus.textContent = `Generated ${result.total} line images in: ${dir}`;
    generateLinesStatus.style.color = "#4ecdc4";
    log(`[TRAIN] Split into ${result.total} line images → ${dir}`, "ok");

    // Auto-set as training data dir
    trainDataDir.value = dir;
    trainDataStatus.textContent = `${result.total} lines generated. Edit .gt.txt files to correct ground truth, then click "Start Training".`;
    trainDataStatus.style.color = "#e8c364";
  } catch (err) {
    generateLinesStatus.textContent = err.message;
    generateLinesStatus.style.color = "#ff6b6b";
    log(`[ERROR] ${err.message}`, "error");
  }
});

// ── Start ──

init();
// Load custom models on startup (if any)
refreshCustomModels();
