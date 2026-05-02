(() => {
  const upload = document.getElementById("upload");
  const dropZone = document.getElementById("dropZone");
  const canvas = document.getElementById("previewCanvas");
  const ctx = canvas ? canvas.getContext("2d") : null;
  if (!upload || !dropZone || !canvas || !ctx) return;

  const ui = {
    metaInfo: document.getElementById("metaInfo"),
    previewContainer: document.getElementById("previewContainer"),
    loadingState: document.getElementById("loadingState"),
    zoomSlider: document.getElementById("zoomSlider"),
    zoomInfo: document.getElementById("zoomInfo"),
    resetViewBtn: document.getElementById("resetViewBtn"),
    widthInput: document.getElementById("widthInput"),
    heightInput: document.getElementById("heightInput"),
    percentInput: document.getElementById("percentInput"),
    percentButtons: Array.from(document.querySelectorAll(".img-tool__pct-btn")),
    lockAspect: document.getElementById("lockAspect"),
    applyResizeBtn: document.getElementById("applyResizeBtn"),
    cropPreset: document.getElementById("cropPreset"),
    rotateLeftBtn: document.getElementById("rotateLeftBtn"),
    rotateRightBtn: document.getElementById("rotateRightBtn"),
    flipHBtn: document.getElementById("flipHBtn"),
    flipVBtn: document.getElementById("flipVBtn"),
    targetSizeInput: document.getElementById("targetSizeInput"),
    targetUnitSelect: document.getElementById("targetUnitSelect"),
    formatSelect: document.getElementById("formatSelect"),
    qualityRange: document.getElementById("qualityRange"),
    compressionRange: document.getElementById("compressionRange"),
    bgSelect: document.getElementById("bgSelect"),
    bgColor: document.getElementById("bgColor"),
    estimateInfo: document.getElementById("estimateInfo"),
    undoBtn: document.getElementById("undoBtn"),
    resetBtn: document.getElementById("resetBtn"),
    downloadBtn: document.getElementById("downloadBtn"),
    canvasWrap: document.getElementById("canvasWrap")
  };

  const state = {
    originalFileSize: 0,
    originalDataUrl: "",
    image: null,
    history: [],
    maxHistory: 5,
    baseWidth: 0,
    baseHeight: 0,
    fitScale: 1,
    viewW: 0,
    viewH: 0,
    scale: 1,
    minScale: 0.5,
    maxScale: 3.5,
    offsetX: 0,
    offsetY: 0,
    drag: { active: false, x: 0, y: 0 },
    touch: { active: false, startDist: 0, startScale: 1 },
    renderQueued: false
  };
  let isLoading = false;

  const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
  const EXT_BY_MIME = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

  function showLoadingOverlay() {
    isLoading = true;
    if (ui.loadingState) ui.loadingState.classList.remove("hidden");
    console.log("Loading started");
  }

  function hideLoadingOverlay() {
    isLoading = false;
    if (ui.loadingState) ui.loadingState.classList.add("hidden");
    console.log("Loading hidden");
  }

  function queueRender() {
    if (state.renderQueued) return;
    state.renderQueued = true;
    requestAnimationFrame(() => {
      state.renderQueued = false;
      render();
    });
  }

  function getViewportRatio() {
    const preset = ui.cropPreset.value;
    if (preset === "free") return ui.canvasWrap.clientWidth / Math.max(1, ui.canvasWrap.clientHeight);
    const [w, h] = preset.split(":").map(Number);
    return w / h;
  }

  function updateViewportSize() {
    const cw = ui.canvasWrap.clientWidth || 1;
    const ch = ui.canvasWrap.clientHeight || 1;
    const ratio = getViewportRatio();
    let vw = cw;
    let vh = cw / ratio;
    if (vh > ch) {
      vh = ch;
      vw = ch * ratio;
    }
    state.viewW = Math.max(1, Math.floor(vw));
    state.viewH = Math.max(1, Math.floor(vh));
    canvas.width = state.viewW;
    canvas.height = state.viewH;
    canvas.style.width = `${state.viewW}px`;
    canvas.style.height = `${state.viewH}px`;
    ui.zoomInfo.textContent = `Zoom: ${Math.round(state.scale * 100)}%`;
  }

  function baseFitScale() {
    if (!state.baseWidth || !state.baseHeight || !state.viewW || !state.viewH) return 1;
    return Math.min(state.viewW / state.baseWidth, state.viewH / state.baseHeight);
  }

  function minAllowedScale() {
    return Math.max(0.01, state.fitScale * 0.5);
  }

  function maxAllowedScale() {
    return Math.max(minAllowedScale(), state.fitScale * 3.5);
  }

  function syncZoomUiFromScale() {
    const pct = state.fitScale > 0 ? Math.round((state.scale / state.fitScale) * 100) : 100;
    const safePct = clamp(pct, 50, 350);
    ui.zoomSlider.value = String(safePct);
    ui.zoomInfo.textContent = `Zoom: ${safePct}%`;
  }

  function clampPan() {
    const drawW = state.baseWidth * state.scale;
    const drawH = state.baseHeight * state.scale;
    if (drawW <= state.viewW) {
      state.offsetX = (state.viewW - drawW) / 2;
    } else {
      state.offsetX = clamp(state.offsetX, state.viewW - drawW, 0);
    }
    if (drawH <= state.viewH) {
      state.offsetY = (state.viewH - drawH) / 2;
    } else {
      state.offsetY = clamp(state.offsetY, state.viewH - drawH, 0);
    }
  }

  function render() {
    if (!state.image) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.setTransform(state.scale, 0, 0, state.scale, state.offsetX, state.offsetY);
    ctx.drawImage(state.image, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    syncMeta();
    debounceEstimate();
  }

  function pushHistory() {
    if (!state.image) return;
    state.history.push({
      src: state.image.src,
      baseWidth: state.baseWidth,
      baseHeight: state.baseHeight
    });
    if (state.history.length > state.maxHistory) state.history.shift();
  }

  function loadImageFromUrl(url) {
    showLoadingOverlay();
    const img = new Image();
    img.onload = () => {
      // Always reset transform state for a new image.
      state.scale = 1;
      state.offsetX = 0;
      state.offsetY = 0;
      state.image = img;
      state.baseWidth = img.width;
      state.baseHeight = img.height;
      ui.percentInput.value = "100";
      if (!state.originalDataUrl) state.originalDataUrl = url;
      state.fitScale = baseFitScale();
      state.scale = state.fitScale;
      state.offsetX = (state.viewW - state.baseWidth * state.scale) / 2;
      state.offsetY = (state.viewH - state.baseHeight * state.scale) / 2;
      clampPan();
      syncZoomUiFromScale();
      hideLoadingOverlay();
      queueRender();
      console.log("Image loaded");
      ui.previewContainer?.scrollIntoView({ behavior: "smooth", block: "center" });
      resizeByPercent();
    };
    img.onerror = () => {
      hideLoadingOverlay();
      ui.metaInfo.textContent = "Failed to load image preview.";
    };
    img.src = url;
  }

  function readFile(file) {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      ui.metaInfo.textContent = "Unsupported file. Use JPG, PNG, or WEBP.";
      return;
    }
    state.originalFileSize = file.size;
    const url = URL.createObjectURL(file);
    state.originalDataUrl = "";
    state.history = [];
    updateViewportSize();
    loadImageFromUrl(url);
  }

  function getBgColor() {
    if (ui.bgSelect.value === "custom") return ui.bgColor.value;
    return ui.bgSelect.value;
  }

  function getCroppedCanvas() {
    const out = document.createElement("canvas");
    out.width = state.viewW;
    out.height = state.viewH;
    const octx = out.getContext("2d");
    octx.fillStyle = getBgColor() === "transparent" ? "rgba(0,0,0,0)" : getBgColor();
    octx.fillRect(0, 0, out.width, out.height);
    octx.drawImage(state.image, state.offsetX, state.offsetY, state.baseWidth * state.scale, state.baseHeight * state.scale);
    return out;
  }

  function getResizedCanvas() {
    const cropped = getCroppedCanvas();
    const nw = Number(ui.widthInput.value);
    const nh = Number(ui.heightInput.value);
    const nextW = Number.isFinite(nw) && nw > 0 ? Math.max(1, Math.round(nw)) : cropped.width;
    const nextH = Number.isFinite(nh) && nh > 0 ? Math.max(1, Math.round(nh)) : cropped.height;
    const out = document.createElement("canvas");
    out.width = nextW;
    out.height = nextH;
    out.getContext("2d").drawImage(cropped, 0, 0, nextW, nextH);
    return out;
  }

  function syncMeta() {
    if (!state.image) {
      ui.metaInfo.textContent = "No image selected";
      return;
    }
    ui.metaInfo.textContent =
      `Source: ${state.baseWidth} x ${state.baseHeight}px | ` +
      `Viewport: ${state.viewW} x ${state.viewH}px | Original: ${Math.round(state.originalFileSize / 1024)} KB`;
  }

  function applyCurrentPipelineToState() {
    if (!state.image) return;
    pushHistory();
    const out = getResizedCanvas();
    loadImageFromUrl(out.toDataURL("image/png"));
  }

  function applyScaleAtPoint(newScale, clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    const prev = state.scale;
    const next = clamp(newScale, minAllowedScale(), maxAllowedScale());
    if (Math.abs(next - prev) < 0.0001) return;
    const worldX = (px - state.offsetX) / prev;
    const worldY = (py - state.offsetY) / prev;
    state.scale = next;
    state.offsetX = px - worldX * next;
    state.offsetY = py - worldY * next;
    clampPan();
    syncZoomUiFromScale();
    queueRender();
  }

  function rotate(deg) {
    if (!state.image) return;
    pushHistory();
    const src = getCroppedCanvas();
    const out = document.createElement("canvas");
    const radians = (deg * Math.PI) / 180;
    out.width = src.height;
    out.height = src.width;
    const octx = out.getContext("2d");
    octx.translate(out.width / 2, out.height / 2);
    octx.rotate(radians);
    octx.drawImage(src, -src.width / 2, -src.height / 2);
    loadImageFromUrl(out.toDataURL("image/png"));
  }

  function flip(horizontal) {
    if (!state.image) return;
    pushHistory();
    const src = getCroppedCanvas();
    const out = document.createElement("canvas");
    out.width = src.width;
    out.height = src.height;
    const octx = out.getContext("2d");
    octx.save();
    if (horizontal) {
      octx.scale(-1, 1);
      octx.drawImage(src, -out.width, 0);
    } else {
      octx.scale(1, -1);
      octx.drawImage(src, 0, -out.height);
    }
    octx.restore();
    loadImageFromUrl(out.toDataURL("image/png"));
  }

  function undo() {
    const prev = state.history.pop();
    if (!prev) return;
    loadImageFromUrl(prev.src);
  }

  function reset() {
    if (!state.originalDataUrl) return;
    state.history = [];
    loadImageFromUrl(state.originalDataUrl);
  }

  function resetView() {
    if (!state.image) return;
    updateViewportSize();
    state.fitScale = baseFitScale();
    state.scale = state.fitScale;
    state.offsetX = (state.viewW - state.baseWidth * state.scale) / 2;
    state.offsetY = (state.viewH - state.baseHeight * state.scale) / 2;
    syncZoomUiFromScale();
    queueRender();
  }

  function resizeByPercent() {
    if (!state.image) return;
    const p = Number(ui.percentInput.value) || 100;
    ui.widthInput.value = Math.max(1, Math.round((state.viewW * p) / 100));
    ui.heightInput.value = Math.max(1, Math.round((state.viewH * p) / 100));
    debounceEstimate();
  }

  function bytesToHuman(bytes) {
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    return `${Math.round(bytes / 1024)} KB`;
  }

  function toBlobAsync(targetCanvas, mime, quality) {
    return new Promise((resolve) => {
      targetCanvas.toBlob((b) => resolve(b), mime, quality);
    });
  }

  async function estimateBlob() {
    if (!state.image) {
      ui.estimateInfo.textContent = "Estimated file size: --";
      return;
    }
    const out = getResizedCanvas();
    const mime = ui.formatSelect.value;
    const quality = Number(ui.qualityRange.value) / 100;
    const blob = await toBlobAsync(out, mime, quality);
    if (!blob) {
      ui.estimateInfo.textContent = "Estimated file size: --";
      return;
    }
    ui.estimateInfo.textContent = `Estimated: ${bytesToHuman(blob.size)}`;
  }

  let estimateTimer = null;
  function debounceEstimate() {
    clearTimeout(estimateTimer);
    estimateTimer = setTimeout(estimateBlob, 180);
  }

  function targetBytes() {
    const val = Number(ui.targetSizeInput.value);
    if (!val || val <= 0) return 0;
    return ui.targetUnitSelect.value === "MB" ? val * 1024 * 1024 : val * 1024;
  }

  async function exportBlobWithTarget(canvasOut, mime, qualityInitial) {
    if (mime === "image/png") {
      const blob = await toBlobAsync(canvasOut, mime);
      return { blob, warning: targetBytes() ? "Target size may not be achievable for PNG." : "" };
    }
    const target = targetBytes();
    if (!target) {
      const blob = await toBlobAsync(canvasOut, mime, qualityInitial);
      return { blob, warning: "" };
    }
    let low = 0.1;
    let high = Math.max(0.1, Math.min(1, qualityInitial));
    let bestBlob = null;
    let bestDiff = Infinity;
    for (let i = 0; i < 9; i++) {
      const q = (low + high) / 2;
      const blob = await toBlobAsync(canvasOut, mime, q);
      if (!blob) continue;
      const diff = Math.abs(blob.size - target);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestBlob = blob;
      }
      if (blob.size > target) {
        high = q;
      } else {
        low = q;
      }
    }
    if (!bestBlob) return { blob: null, warning: "Unable to generate output file." };
    const warning = bestBlob.size > target ? "Target size not fully achievable at minimum quality." : "";
    return { blob: bestBlob, warning };
  }

  ui.widthInput.addEventListener("input", () => {
    if (!ui.lockAspect.checked || !state.viewW || !state.viewH) return;
    const w = Number(ui.widthInput.value);
    if (!w) return;
    ui.heightInput.value = Math.max(1, Math.round(w / (state.viewW / state.viewH)));
    debounceEstimate();
  });

  ui.heightInput.addEventListener("input", () => {
    if (!ui.lockAspect.checked || !state.viewW || !state.viewH) return;
    const h = Number(ui.heightInput.value);
    if (!h) return;
    ui.widthInput.value = Math.max(1, Math.round(h * (state.viewW / state.viewH)));
    debounceEstimate();
  });

  ui.percentInput.addEventListener("input", resizeByPercent);
  ui.percentButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const p = Number(btn.getAttribute("data-percent")) || 100;
      ui.percentInput.value = String(p);
      resizeByPercent();
    });
  });
  ui.zoomSlider.addEventListener("input", () => {
    if (!state.image) return;
    const rect = canvas.getBoundingClientRect();
    const relative = Number(ui.zoomSlider.value) / 100;
    applyScaleAtPoint(state.fitScale * relative, rect.left + rect.width / 2, rect.top + rect.height / 2);
  });

  ui.applyResizeBtn.addEventListener("click", applyCurrentPipelineToState);
  ui.rotateLeftBtn.addEventListener("click", () => rotate(-90));
  ui.rotateRightBtn.addEventListener("click", () => rotate(90));
  ui.flipHBtn.addEventListener("click", () => flip(true));
  ui.flipVBtn.addEventListener("click", () => flip(false));
  ui.undoBtn.addEventListener("click", undo);
  ui.resetBtn.addEventListener("click", reset);
  ui.resetViewBtn.addEventListener("click", resetView);
  ui.cropPreset.addEventListener("change", () => {
    updateViewportSize();
    resetView();
  });
  ui.formatSelect.addEventListener("change", debounceEstimate);
  ui.qualityRange.addEventListener("input", () => {
    ui.compressionRange.value = ui.qualityRange.value;
    debounceEstimate();
  });
  ui.compressionRange.addEventListener("input", () => {
    ui.qualityRange.value = ui.compressionRange.value;
    debounceEstimate();
  });
  ui.bgSelect.addEventListener("change", debounceEstimate);
  ui.bgColor.addEventListener("input", debounceEstimate);
  ui.targetSizeInput.addEventListener("input", debounceEstimate);
  ui.targetUnitSelect.addEventListener("change", debounceEstimate);

  ui.downloadBtn.addEventListener("click", async () => {
    if (!state.image) return;
    const out = getResizedCanvas();
    const mime = ui.formatSelect.value;
    const quality = Number(ui.qualityRange.value) / 100;
    const { blob, warning } = await exportBlobWithTarget(out, mime, quality);
    if (!blob) return;
    ui.estimateInfo.textContent = warning
      ? `Estimated: ${bytesToHuman(blob.size)} | ${warning}`
      : `Estimated: ${bytesToHuman(blob.size)}`;
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `image-resized.${EXT_BY_MIME[mime] || "jpg"}`;
    link.click();
  });

  upload.addEventListener("change", (e) => readFile(e.target.files && e.target.files[0]));

  ["dragenter", "dragover"].forEach((evt) => {
    dropZone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropZone.classList.add("is-active");
    });
  });
  ["dragleave", "drop"].forEach((evt) => {
    dropZone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropZone.classList.remove("is-active");
    });
  });
  dropZone.addEventListener("drop", (e) => readFile(e.dataTransfer.files && e.dataTransfer.files[0]));

  ui.canvasWrap.addEventListener("mousedown", (e) => {
    if (!state.image) return;
    state.drag.active = true;
    state.drag.x = e.clientX;
    state.drag.y = e.clientY;
    ui.canvasWrap.classList.add("is-dragging");
  });

  ui.canvasWrap.addEventListener(
    "wheel",
    (e) => {
      if (!state.image) return;
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.08 : 0.92;
      applyScaleAtPoint(state.scale * factor, e.clientX, e.clientY);
    },
    { passive: false }
  );

  ui.canvasWrap.addEventListener("touchstart", (e) => {
    if (!state.image) return;
    if (e.touches.length === 1) {
      state.drag.active = true;
      state.drag.x = e.touches[0].clientX;
      state.drag.y = e.touches[0].clientY;
      ui.canvasWrap.classList.add("is-dragging");
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      state.touch.active = true;
      state.touch.startDist = Math.hypot(dx, dy);
      state.touch.startScale = state.scale;
    }
  });

  ui.canvasWrap.addEventListener(
    "touchmove",
    (e) => {
      if (!state.image) return;
      if (e.touches.length === 2 && state.touch.active) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy) || state.touch.startDist;
        const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        applyScaleAtPoint((dist / state.touch.startDist) * state.touch.startScale, centerX, centerY);
        return;
      }
      if (e.touches.length === 1 && state.drag.active) {
        e.preventDefault();
        const nx = e.touches[0].clientX;
        const ny = e.touches[0].clientY;
        state.offsetX += nx - state.drag.x;
        state.offsetY += ny - state.drag.y;
        state.drag.x = nx;
        state.drag.y = ny;
        clampPan();
        queueRender();
      }
    },
    { passive: false }
  );

  ui.canvasWrap.addEventListener("touchend", () => {
    state.drag.active = false;
    state.touch.active = false;
    ui.canvasWrap.classList.remove("is-dragging");
  });

  window.addEventListener("mousemove", (e) => {
    if (!state.drag.active || !state.image) return;
    state.offsetX += e.clientX - state.drag.x;
    state.offsetY += e.clientY - state.drag.y;
    state.drag.x = e.clientX;
    state.drag.y = e.clientY;
    clampPan();
    queueRender();
  });

  window.addEventListener("mouseup", () => {
    state.drag.active = false;
    ui.canvasWrap.classList.remove("is-dragging");
  });

  window.addEventListener("resize", () => {
    if (!state.image) return;
    updateViewportSize();
    clampPan();
    resizeByPercent();
    queueRender();
  });
})();