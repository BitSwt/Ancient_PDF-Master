// ── Margin Drag Interaction ──

previewOverlay.addEventListener("mousedown", (e) => {
  const rect = previewOverlay.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  const w = previewOverlay.width;
  const h = previewOverlay.height;

  // Crop drag (takes priority)
  if (cropEnabled.checked && pvShowCrop.checked && cropAreas[currentPage]) {
    const crop = cropAreas[currentPage];
    const HANDLE = 10;
    const cx1 = crop.x_start * w, cy1 = crop.y_start * h;
    const cx2 = crop.x_end * w, cy2 = crop.y_end * h;

    const handles = [
      { side: "nw", x: cx1, y: cy1 }, { side: "ne", x: cx2, y: cy1 },
      { side: "sw", x: cx1, y: cy2 }, { side: "se", x: cx2, y: cy2 },
      { side: "n", x: (cx1+cx2)/2, y: cy1 }, { side: "s", x: (cx1+cx2)/2, y: cy2 },
      { side: "w", x: cx1, y: (cy1+cy2)/2 }, { side: "e", x: cx2, y: (cy1+cy2)/2 },
    ];

    for (const handle of handles) {
      if (Math.abs(mouseX - handle.x) < HANDLE && Math.abs(mouseY - handle.y) < HANDLE) {
        cropDragState = { side: handle.side, orig: { ...crop } };
        e.preventDefault();
        return;
      }
    }

    // Move entire crop box
    if (mouseX >= cx1 && mouseX <= cx2 && mouseY >= cy1 && mouseY <= cy2) {
      cropDragState = { side: "move", orig: { ...crop }, startX: mouseX, startY: mouseY };
      previewOverlay.style.cursor = "move";
      e.preventDefault();
      return;
    }
  }

  const preset = zonePreset.value;
  if (!pvShowZones.checked) return;

  // Auto-detect: check region handles
  if (preset === "auto_detect") {
    const regions = detectedRegions[currentPage] || [];
    const HANDLE = 10;
    for (let i = 0; i < regions.length; i++) {
      const r = regions[i];
      const rx1 = r.x_start * w, ry1 = r.y_start * h;
      const rx2 = r.x_end * w, ry2 = r.y_end * h;

      // Check corners and edges for resize
      const handles = [
        { side: "nw", x: rx1, y: ry1 }, { side: "ne", x: rx2, y: ry1 },
        { side: "sw", x: rx1, y: ry2 }, { side: "se", x: rx2, y: ry2 },
        { side: "n", x: (rx1 + rx2) / 2, y: ry1 }, { side: "s", x: (rx1 + rx2) / 2, y: ry2 },
        { side: "w", x: rx1, y: (ry1 + ry2) / 2 }, { side: "e", x: rx2, y: (ry1 + ry2) / 2 },
      ];

      for (const handle of handles) {
        if (Math.abs(mouseX - handle.x) < HANDLE && Math.abs(mouseY - handle.y) < HANDLE) {
          regionDragState = { index: i, side: handle.side, origRegion: { ...r } };
          e.preventDefault();
          return;
        }
      }

      // Check if inside the box → move the whole region
      if (mouseX >= rx1 && mouseX <= rx2 && mouseY >= ry1 && mouseY <= ry2) {
        regionDragState = { index: i, side: "move", origRegion: { ...r }, startX: mouseX, startY: mouseY };
        previewOverlay.style.cursor = "move";
        e.preventDefault();
        return;
      }
    }
    return;
  }

  // Body only: drag margin edge
  if (preset === "body_only") {
    const m = parseInt(zoneBodyMargin.value) / 100;
    const edgesBody = [
      { edge: "left", pos: m * w }, { edge: "right", pos: (1 - m) * w },
      { edge: "top", pos: m * h }, { edge: "bottom", pos: (1 - m) * h },
    ];
    for (const eb of edgesBody) {
      const isHoriz = (eb.edge === "top" || eb.edge === "bottom");
      const dist = isHoriz ? Math.abs(mouseY - eb.pos) : Math.abs(mouseX - eb.pos);
      if (dist < DRAG_HANDLE_WIDTH) {
        marginDragState = { edge: "body-" + eb.edge, startMargin: parseInt(zoneBodyMargin.value) };
        previewOverlay.style.cursor = isHoriz ? "row-resize" : "col-resize";
        e.preventDefault();
        return;
      }
    }
    return;
  }

  // Margin presets (left_margin, both_margins)
  if (preset !== "left_margin" && preset !== "both_margins") return;

  const edges = getDraggableEdges();
  for (const edge of edges) {
    if (edge.axis === "v") {
      const edgePx = edge.xFrac * w;
      if (Math.abs(mouseX - edgePx) < DRAG_HANDLE_WIDTH) {
        marginDragState = { edge: edge.edge, axis: "v" };
        previewOverlay.style.cursor = "col-resize";
        e.preventDefault();
        return;
      }
    } else {
      const edgePx = edge.yFrac * h;
      if (Math.abs(mouseY - edgePx) < DRAG_HANDLE_WIDTH) {
        marginDragState = { edge: edge.edge, axis: "h" };
        previewOverlay.style.cursor = "row-resize";
        e.preventDefault();
        return;
      }
    }
  }
});

document.addEventListener("mousemove", (e) => {
  const rect = previewOverlay.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  const w = previewOverlay.width;
  const h = previewOverlay.height;

  // Handle crop drag
  if (cropDragState) {
    const crop = cropAreas[currentPage];
    if (!crop) return;
    const orig = cropDragState.orig;
    const fracX = Math.max(0, Math.min(1, mouseX / w));
    const fracY = Math.max(0, Math.min(1, mouseY / h));

    switch (cropDragState.side) {
      case "nw": crop.x_start = fracX; crop.y_start = fracY; break;
      case "ne": crop.x_end = fracX; crop.y_start = fracY; break;
      case "sw": crop.x_start = fracX; crop.y_end = fracY; break;
      case "se": crop.x_end = fracX; crop.y_end = fracY; break;
      case "n": crop.y_start = fracY; break;
      case "s": crop.y_end = fracY; break;
      case "w": crop.x_start = fracX; break;
      case "e": crop.x_end = fracX; break;
      case "move": {
        const dx = (mouseX - cropDragState.startX) / w;
        const dy = (mouseY - cropDragState.startY) / h;
        const cw = orig.x_end - orig.x_start;
        const ch = orig.y_end - orig.y_start;
        crop.x_start = Math.max(0, Math.min(1 - cw, orig.x_start + dx));
        crop.y_start = Math.max(0, Math.min(1 - ch, orig.y_start + dy));
        crop.x_end = crop.x_start + cw;
        crop.y_end = crop.y_start + ch;
        break;
      }
    }
    if (crop.x_end < crop.x_start + 0.05) crop.x_end = crop.x_start + 0.05;
    if (crop.y_end < crop.y_start + 0.05) crop.y_end = crop.y_start + 0.05;
    drawZoneOverlay();
    updateCropInfo();
    return;
  }

  // Handle region drag (auto_detect)
  if (regionDragState) {
    const regions = detectedRegions[currentPage] || [];
    const r = regions[regionDragState.index];
    if (!r) return;

    const orig = regionDragState.origRegion;
    const fracX = mouseX / w;
    const fracY = mouseY / h;
    const clamp = (v) => Math.max(0, Math.min(1, v));

    switch (regionDragState.side) {
      case "nw": r.x_start = clamp(fracX); r.y_start = clamp(fracY); break;
      case "ne": r.x_end = clamp(fracX); r.y_start = clamp(fracY); break;
      case "sw": r.x_start = clamp(fracX); r.y_end = clamp(fracY); break;
      case "se": r.x_end = clamp(fracX); r.y_end = clamp(fracY); break;
      case "n": r.y_start = clamp(fracY); break;
      case "s": r.y_end = clamp(fracY); break;
      case "w": r.x_start = clamp(fracX); break;
      case "e": r.x_end = clamp(fracX); break;
      case "move": {
        const dx = (mouseX - regionDragState.startX) / w;
        const dy = (mouseY - regionDragState.startY) / h;
        const rw = orig.x_end - orig.x_start;
        const rh = orig.y_end - orig.y_start;
        r.x_start = clamp(orig.x_start + dx);
        r.y_start = clamp(orig.y_start + dy);
        r.x_end = clamp(r.x_start + rw);
        r.y_end = clamp(r.y_start + rh);
        break;
      }
    }

    // Ensure min size
    if (r.x_end < r.x_start + 0.02) r.x_end = r.x_start + 0.02;
    if (r.y_end < r.y_start + 0.02) r.y_end = r.y_start + 0.02;

    drawZoneOverlay();
    renderRegionList(currentPage);
    return;
  }

  // Handle margin/body drag
  if (marginDragState) {
    if (marginDragState.edge.startsWith("body-")) {
      const side = marginDragState.edge.replace("body-", "");
      let newM;
      if (side === "left") newM = mouseX / w;
      else if (side === "right") newM = 1 - mouseX / w;
      else if (side === "top") newM = mouseY / h;
      else newM = 1 - mouseY / h;
      const pct = Math.round(Math.max(3, Math.min(25, newM * 100)));
      zoneBodyMargin.value = pct;
      zoneBodyMarginLabel.textContent = `${pct}%`;
      drawZoneOverlay();
      return;
    }

    if (marginDragState.edge === "top") {
      const pct = Math.round(Math.max(0, Math.min(30, (mouseY / h) * 100)));
      zoneMarginTop.value = pct;
      zoneMarginTopLabel.textContent = `${pct}%`;
    } else if (marginDragState.edge === "bottom") {
      const pct = Math.round(Math.max(0, Math.min(30, (1 - mouseY / h) * 100)));
      zoneMarginBottom.value = pct;
      zoneMarginBottomLabel.textContent = `${pct}%`;
    } else {
      let newMarginFrac;
      if (marginDragState.edge === "right-of-left") {
        newMarginFrac = mouseX / w;
      } else {
        newMarginFrac = 1 - (mouseX / w);
      }
      const newMarginPct = Math.round(Math.max(3, Math.min(40, newMarginFrac * 100)));
      zoneMarginWidth.value = newMarginPct;
      zoneMarginLabel.textContent = `${newMarginPct}%`;
    }
    drawZoneOverlay();
    return;
  }

  // Hover cursor updates — crop first
  if (cropEnabled.checked && pvShowCrop.checked && cropAreas[currentPage]) {
    const crop = cropAreas[currentPage];
    const HANDLE = 10;
    const cx1 = crop.x_start * w, cy1 = crop.y_start * h;
    const cx2 = crop.x_end * w, cy2 = crop.y_end * h;
    let cc = "";
    if (Math.abs(mouseX - cx1) < HANDLE && Math.abs(mouseY - cy1) < HANDLE) cc = "nw-resize";
    else if (Math.abs(mouseX - cx2) < HANDLE && Math.abs(mouseY - cy1) < HANDLE) cc = "ne-resize";
    else if (Math.abs(mouseX - cx1) < HANDLE && Math.abs(mouseY - cy2) < HANDLE) cc = "sw-resize";
    else if (Math.abs(mouseX - cx2) < HANDLE && Math.abs(mouseY - cy2) < HANDLE) cc = "se-resize";
    else if (mouseX >= cx1 && mouseX <= cx2 && Math.abs(mouseY - cy1) < HANDLE) cc = "n-resize";
    else if (mouseX >= cx1 && mouseX <= cx2 && Math.abs(mouseY - cy2) < HANDLE) cc = "s-resize";
    else if (mouseY >= cy1 && mouseY <= cy2 && Math.abs(mouseX - cx1) < HANDLE) cc = "w-resize";
    else if (mouseY >= cy1 && mouseY <= cy2 && Math.abs(mouseX - cx2) < HANDLE) cc = "e-resize";
    else if (mouseX >= cx1 && mouseX <= cx2 && mouseY >= cy1 && mouseY <= cy2) cc = "move";
    if (cc) { previewOverlay.style.cursor = cc; return; }
  }

  const preset = zonePreset.value;
  if (!pvShowZones.checked) return;

  if (preset === "auto_detect") {
    const regions = detectedRegions[currentPage] || [];
    const HANDLE = 10;
    let cursor = "default";
    for (const r of regions) {
      const rx1 = r.x_start * w, ry1 = r.y_start * h;
      const rx2 = r.x_end * w, ry2 = r.y_end * h;
      // Check corners
      if (Math.abs(mouseX - rx1) < HANDLE && Math.abs(mouseY - ry1) < HANDLE) { cursor = "nw-resize"; break; }
      if (Math.abs(mouseX - rx2) < HANDLE && Math.abs(mouseY - ry1) < HANDLE) { cursor = "ne-resize"; break; }
      if (Math.abs(mouseX - rx1) < HANDLE && Math.abs(mouseY - ry2) < HANDLE) { cursor = "sw-resize"; break; }
      if (Math.abs(mouseX - rx2) < HANDLE && Math.abs(mouseY - ry2) < HANDLE) { cursor = "se-resize"; break; }
      // Edges
      if (mouseX >= rx1 && mouseX <= rx2 && Math.abs(mouseY - ry1) < HANDLE) { cursor = "n-resize"; break; }
      if (mouseX >= rx1 && mouseX <= rx2 && Math.abs(mouseY - ry2) < HANDLE) { cursor = "s-resize"; break; }
      if (mouseY >= ry1 && mouseY <= ry2 && Math.abs(mouseX - rx1) < HANDLE) { cursor = "w-resize"; break; }
      if (mouseY >= ry1 && mouseY <= ry2 && Math.abs(mouseX - rx2) < HANDLE) { cursor = "e-resize"; break; }
      // Inside
      if (mouseX >= rx1 && mouseX <= rx2 && mouseY >= ry1 && mouseY <= ry2) { cursor = "move"; break; }
    }
    previewOverlay.style.cursor = cursor;
  } else if (preset === "left_margin" || preset === "both_margins") {
    const edges = getDraggableEdges();
    let cursor = "default";
    for (const edge of edges) {
      if (edge.axis === "v" && Math.abs(mouseX - edge.xFrac * w) < DRAG_HANDLE_WIDTH) { cursor = "col-resize"; break; }
      if (edge.axis === "h" && Math.abs(mouseY - edge.yFrac * h) < DRAG_HANDLE_WIDTH) { cursor = "row-resize"; break; }
    }
    previewOverlay.style.cursor = cursor;
  } else {
    previewOverlay.style.cursor = "default";
  }
});

document.addEventListener("mouseup", () => {
  if (cropDragState) { cropDragState = null; previewOverlay.style.cursor = "default"; }
  if (marginDragState) { marginDragState = null; previewOverlay.style.cursor = "default"; }
  if (regionDragState) { regionDragState = null; previewOverlay.style.cursor = "default"; }
});

btnPrevPage.addEventListener("click", () => showPage(currentPage - 1));
btnNextPage.addEventListener("click", () => showPage(currentPage + 1));

pvShowZones.addEventListener("change", drawZoneOverlay);
pvShowPreprocess.addEventListener("change", () => showPage(currentPage));

// Redraw zones when zone settings change
zonePreset.addEventListener("change", () => {
  const val = zonePreset.value;
  zoneHint.textContent = {
    full_page: "Standard single-pass OCR.",
    auto_column: "Automatically detects 1 or 2 columns per page.",
    two_column: "Left column + right column. For bilingual or newspaper layouts.",
    auto_detect: "Automatically detect text regions. Click 'Detect' then adjust boxes.",
    body_only: "Exclude margins — OCR only the central body text area.",
    left_margin: "Left margin + body. For Loeb, OCT, Teubner editions.",
    both_margins: "Left margin + body + right margin.",
    custom: "Define custom zones. PSM 11 for margins, PSM 3 for body.",
  }[val] || "";
  zoneParams.classList.toggle("hidden", val !== "left_margin" && val !== "both_margins" && val !== "two_column");
  zoneCustom.classList.toggle("hidden", val !== "custom");
  zoneAutoDetect.classList.toggle("hidden", val !== "auto_detect");
  zoneBodyOnly.classList.toggle("hidden", val !== "body_only");
  drawZoneOverlay();
});

zoneMarginWidth.addEventListener("input", () => {
  zoneMarginLabel.textContent = `${zoneMarginWidth.value}%`;
  drawZoneOverlay();
});

zoneMarginTop.addEventListener("input", () => {
  zoneMarginTopLabel.textContent = `${zoneMarginTop.value}%`;
  drawZoneOverlay();
});

zoneMarginBottom.addEventListener("input", () => {
  zoneMarginBottomLabel.textContent = `${zoneMarginBottom.value}%`;
  drawZoneOverlay();
});

zoneBodyMargin.addEventListener("input", () => {
  zoneBodyMarginLabel.textContent = `${zoneBodyMargin.value}%`;
  drawZoneOverlay();
});

// ── Auto Detect Regions ──

btnDetectRegions.addEventListener("click", async () => {
  if (!inputPath.value) { log("[WARN] No file loaded", "warn"); return; }
  btnDetectRegions.disabled = true;
  btnDetectRegions.textContent = "Detecting...";
  detectStatus.textContent = "";

  try {
    const lang = getSelectedLanguages();
    const result = await window.api.detectRegions({
      input: inputPath.value,
      page: currentPage,
      dpi: 150,
      lang,
    });

    detectedRegions[currentPage] = result.regions;
    detectStatus.textContent = `Found ${result.total} text region(s). Drag edges to adjust.`;
    renderRegionList(currentPage);
    drawZoneOverlay();
    log(`[OK] Detected ${result.total} text regions on page ${currentPage + 1}`, "ok");
  } catch (err) {
    log(`[ERROR] Region detection failed: ${err.message}`, "error");
    detectStatus.textContent = "Detection failed.";
  } finally {
    btnDetectRegions.disabled = false;
    btnDetectRegions.textContent = "Detect Text Regions";
  }
});

function renderRegionList(pageIndex) {
  detectedRegionList.innerHTML = "";
  const regions = detectedRegions[pageIndex] || [];
  regions.forEach((r, i) => {
    const row = document.createElement("div");
    row.className = "zone-row";
    row.style.fontSize = "11px";
    const pct = (v) => Math.round(v * 100);
    row.innerHTML = `
      <span style="color:var(--green);min-width:18px;">R${i + 1}</span>
      <span style="color:var(--text-muted);">${pct(r.x_start)}%-${pct(r.x_end)}% × ${pct(r.y_start)}%-${pct(r.y_end)}%</span>
      <span style="color:var(--text-muted);margin-left:auto;">${r.word_count}w</span>
      <button class="zone-delete" data-idx="${i}">&times;</button>
    `;
    row.querySelector(".zone-delete").addEventListener("click", () => {
      regions.splice(i, 1);
      renderRegionList(pageIndex);
      drawZoneOverlay();
    });
    detectedRegionList.appendChild(row);
  });
}

// ── Toggle Sections ──

cropEnabled.addEventListener("change", () => {
  cropSettings.classList.toggle("hidden", !cropEnabled.checked);
  drawZoneOverlay();
});

btnCropSet.addEventListener("click", () => {
  if (totalPages === 0) return;
  // Default crop: 5% inset from all edges
  cropAreas[currentPage] = { x_start: 0.05, y_start: 0.05, x_end: 0.95, y_end: 0.95 };
  updateCropInfo();
  drawZoneOverlay();
  log(`[OK] Crop area set for page ${currentPage + 1}. Drag edges to adjust.`, "ok");
});

btnCropReset.addEventListener("click", () => {
  delete cropAreas[currentPage];
  updateCropInfo();
  drawZoneOverlay();
});

btnCropApplyAll.addEventListener("click", () => {
  const current = cropAreas[currentPage];
  if (!current) { log("[WARN] Set crop on current page first", "warn"); return; }
  for (let i = 0; i < totalPages; i++) {
    cropAreas[i] = { ...current };
  }
  updateCropInfo();
  log(`[OK] Crop applied to all ${totalPages} pages`, "ok");
});

pvShowCrop.addEventListener("change", drawZoneOverlay);

function updateCropInfo() {
  const c = cropAreas[currentPage];
  if (c) {
    const pct = (v) => Math.round(v * 100);
    cropInfo.textContent = `Page ${currentPage + 1}: ${pct(c.x_start)}%-${pct(c.x_end)}% × ${pct(c.y_start)}%-${pct(c.y_end)}%`;
  } else {
    cropInfo.textContent = "";
  }
}

preprocessEnabled.addEventListener("change", () => {
  preprocessSettings.classList.toggle("hidden", !preprocessEnabled.checked);
});

ppBw.addEventListener("change", () => {
  ppBwSettings.classList.toggle("hidden", !ppBw.checked);
  if (ppBw.checked) ppGrayscale.checked = false;
});

ppGrayscale.addEventListener("change", () => {
  if (ppGrayscale.checked) ppBw.checked = false;
  ppBwSettings.classList.add("hidden");
});

ppBwThreshold.addEventListener("input", () => {
  ppBwLabel.textContent = ppBwThreshold.value;
});

// Refresh preview on preprocess toggle changes
[ppDeskew, ppAutocontrast, ppDenoise, ppGrayscale, ppBw].forEach((el) => {
  el.addEventListener("change", () => {
    if (pvShowPreprocess.checked && preprocessEnabled.checked && totalPages > 0) {
      showPage(currentPage);
    }
  });
});
ppBwThreshold.addEventListener("change", () => {
  if (pvShowPreprocess.checked && ppBw.checked && totalPages > 0) {
    showPage(currentPage);
  }
});

splitEnabled.addEventListener("change", () => splitSettings.classList.toggle("hidden", !splitEnabled.checked));
splitPattern.addEventListener("change", () => splitCustom.classList.toggle("hidden", splitPattern.value !== "custom"));
pagelabelsEnabled.addEventListener("change", () => pagelabelsSettings.classList.toggle("hidden", !pagelabelsEnabled.checked));
pagelabelsPreset.addEventListener("change", () => {
  const isCustom = pagelabelsPreset.value === "custom";
  pagelabelsSimple.classList.toggle("hidden", isCustom);
  pagelabelsCustom.classList.toggle("hidden", !isCustom);
});
tocEnabled.addEventListener("change", () => tocSettings.classList.toggle("hidden", !tocEnabled.checked));

// ── Zone Custom Rows ──

function addCustomZoneRow(xStart = 0, yStart = 0, xEnd = 100, yEnd = 100, psm = 3) {
  const row = document.createElement("div");
  row.className = "zone-row";
  row.innerHTML = `
    <span style="color:var(--text-secondary)">x:</span>
    <input type="number" class="text-input zr-x1" value="${xStart}" min="0" max="100">
    <span>-</span>
    <input type="number" class="text-input zr-x2" value="${xEnd}" min="0" max="100">
    <span style="color:var(--text-secondary)">y:</span>
    <input type="number" class="text-input zr-y1" value="${yStart}" min="0" max="100">
    <span>-</span>
    <input type="number" class="text-input zr-y2" value="${yEnd}" min="0" max="100">
    <select class="select-input zr-psm">
      <option value="3" ${psm === 3 ? "selected" : ""}>PSM 3</option>
      <option value="11" ${psm === 11 ? "selected" : ""}>PSM 11</option>
      <option value="6" ${psm === 6 ? "selected" : ""}>PSM 6</option>
      <option value="4" ${psm === 4 ? "selected" : ""}>PSM 4</option>
    </select>
    <button class="zone-delete">&times;</button>
  `;
  row.querySelector(".zone-delete").addEventListener("click", () => { row.remove(); drawZoneOverlay(); });
  // Redraw on change
  row.querySelectorAll("input, select").forEach((el) => el.addEventListener("change", drawZoneOverlay));
  zoneCustomEntries.appendChild(row);
  drawZoneOverlay();
}

btnAddZone.addEventListener("click", () => addCustomZoneRow());
