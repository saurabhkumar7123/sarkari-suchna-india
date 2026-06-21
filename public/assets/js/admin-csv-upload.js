(function () {
  const csvInput = document.getElementById("csvInput");
  const uploadBtn = document.getElementById("uploadBtn");
  const refreshBtn = document.getElementById("refreshImportsBtn");
  const listContainer = document.getElementById("importListContainer");
  const listMeta = document.getElementById("importListMeta");
  let importRowsAll = [];
  let importSearchQuery = "";

  if (!csvInput || !uploadBtn) return;

  function setStatus(message, isError = false) {
    const statusEl = document.getElementById("csvUploadStatus");
    if (!statusEl) return;
    statusEl.textContent = String(message || "");
    statusEl.style.color = isError ? "#dc2626" : "#16a34a";
  }

  function updateSelectedFile(file) {
    const nameEl = document.getElementById("csvFileName");
    const sizeEl = document.getElementById("csvFileSize");
    if (nameEl) nameEl.textContent = file ? file.name : "No file selected";
    if (sizeEl) sizeEl.textContent = file ? `${(file.size / 1024).toFixed(1)} KB` : "—";
  }

  function isCsvFile(file) {
    if (!file) return false;
    if (file.type === "text/csv" || file.type === "application/vnd.ms-excel") return true;
    return /\.csv$/i.test(file.name || "");
  }

  function validateSelection(file) {
    if (!file) {
      setStatus("Please select a CSV file", true);
      uploadBtn.disabled = true;
      hideDryRunPreview();
      return false;
    }
    if (!isCsvFile(file)) {
      setStatus("Only .csv files are supported", true);
      uploadBtn.disabled = true;
      hideDryRunPreview();
      return false;
    }
    setStatus("CSV selected — review dry-run preview before import");
    uploadBtn.disabled = false;
    runDryRunPreview(file);
    return true;
  }

  function hideDryRunPreview() {
    const box = document.getElementById("csvDryRunPreview");
    if (box) box.hidden = true;
  }

  async function runDryRunPreview(file) {
    const box = document.getElementById("csvDryRunPreview");
    const summary = document.getElementById("csvDryRunSummary");
    const sample = document.getElementById("csvDryRunSample");
    if (!box || !summary || !sample || !file) return hideDryRunPreview();
    try {
      const text = await file.slice(0, 8192).text();
      const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
      const header = lines[0] || "";
      const cols = header.split(",").length;
      const dataRows = Math.max(0, lines.length - 1);
      const emptyRows = lines.slice(1).filter((l) => !String(l).trim()).length;
      summary.textContent = `Dry-run: ~${dataRows} data row(s), ${cols} column(s)${emptyRows ? `, ${emptyRows} empty row(s) will be skipped` : ""}.`;
      sample.textContent = lines.slice(0, Math.min(5, lines.length)).join("\n");
      box.hidden = false;
    } catch {
      hideDryRunPreview();
    }
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatDate(value) {
    if (!value) return "—";
    try {
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return String(value);
      return d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
    } catch {
      return String(value);
    }
  }

  function previewLabel(row) {
    const preview = String(row.content_preview || "").replace(/\s+/g, " ").trim();
    if (preview) return preview.slice(0, 200);
    return `Import #${row.id}`;
  }

  function statusClass(status) {
    const s = String(status || "pending").toLowerCase();
    if (s === "opened" || s === "published") return `import-queue-status--${s}`;
    return "import-queue-status--pending";
  }

  async function adminFetch(url, options = {}) {
    const hdrs = { ...(options.headers || {}) };
    if (typeof window.getAdminCsrfToken === "function") {
      hdrs["X-CSRF-Token"] = await window.getAdminCsrfToken();
    }
    const res = await fetch(url, { credentials: "include", ...options, headers: hdrs });
    const ct = res.headers.get("content-type") || "";
    let body = null;
    if (ct.includes("application/json")) {
      try {
        body = await res.json();
      } catch {
        body = null;
      }
    } else {
      body = await res.text();
    }
    return { ok: res.ok, status: res.status, body };
  }

  function getFilteredImports() {
    const q = importSearchQuery.trim().toLowerCase();
    if (!q) return importRowsAll.slice();
    return importRowsAll.filter((row) => {
      const preview = String(row.content_preview || "").toLowerCase();
      const file = String(row.source_file || "").toLowerCase();
      const status = String(row.status || "").toLowerCase();
      return preview.includes(q) || file.includes(q) || status.includes(q) || String(row.id).includes(q);
    });
  }

  function renderImportStats(filteredCount) {
    const el = document.getElementById("importStats");
    if (!el) return;
    const total = importRowsAll.length;
    if (!total) {
      el.hidden = true;
      return;
    }
    const pending = importRowsAll.filter((r) => String(r.status || "pending").toLowerCase() === "pending").length;
    const q = importSearchQuery.trim();
    el.hidden = false;
    el.innerHTML = `
      <span class="saas-stat"><strong>${total}</strong> imports</span>
      <span class="saas-stat saas-stat--accent"><strong>${pending}</strong> pending</span>
      ${q ? `<span class="saas-stat saas-stat--accent"><strong>${filteredCount}</strong> matching</span>` : ""}
    `;
  }

  function syncImportSearchClear() {
    const input = document.getElementById("importSearch");
    const btn = document.getElementById("importSearchClear");
    if (!input || !btn) return;
    btn.classList.toggle("is-hidden", !input.value.trim());
  }

  function renderImportList(rows) {
    if (!listContainer) return;
    const list = Array.isArray(rows) ? rows : getFilteredImports();
    renderImportStats(list.length);
    if (!importRowsAll.length) {
      listContainer.innerHTML =
        '<p class="import-queue-empty">No imports yet. Upload a CSV with a <strong>content</strong> column.</p>';
      return;
    }
    if (!list.length) {
      listContainer.innerHTML = '<div class="saas-empty-state"><div class="icon">🔍</div><h4>No matching imports</h4></div>';
      return;
    }

    listContainer.innerHTML = list
      .map((row) => {
        const href = `/generator?importId=${encodeURIComponent(row.id)}`;
        const status = escapeHtml(row.status || "pending");
        const file = escapeHtml(row.source_file || "—");
        const label = escapeHtml(previewLabel(row));
        const rowNum =
          row.row_index != null && row.row_index !== "" ? escapeHtml(row.row_index) : "—";
        return `
          <article class="import-queue-item" role="listitem" data-import-id="${escapeHtml(row.id)}">
            <div class="import-queue-item__top">
              <span class="import-queue-item__id">#${escapeHtml(row.id)}</span>
              <span class="import-queue-status ${statusClass(row.status)}">${status}</span>
            </div>
            <p class="import-queue-preview">${label}</p>
            <p class="import-queue-item__details">File: ${file} · Row: ${rowNum} · ${formatDate(row.created_at)}</p>
            <div class="import-queue-item__actions">
              <a class="import-queue-btn import-queue-btn--primary" href="${href}">Open in generator</a>
              <button type="button" class="import-queue-btn import-queue-btn--danger js-delete-import" data-import-id="${escapeHtml(row.id)}">Delete</button>
            </div>
          </article>
        `;
      })
      .join("");
  }

  async function deleteImport(id, buttonEl) {
    const importId = parseInt(String(id), 10);
    if (!Number.isInteger(importId) || importId < 1) return;

    const preview =
      buttonEl &&
      buttonEl.closest(".import-queue-item") &&
      buttonEl.closest(".import-queue-item").querySelector(".import-queue-preview");
    const hint = preview ? preview.textContent.trim().slice(0, 80) : "";
    const msg = hint
      ? `Delete import #${importId}?\n\n"${hint}${hint.length >= 80 ? "…" : ""}"\n\nThis removes only this queue draft. Published pages are not affected.`
      : `Delete import #${importId}?\n\nThis removes only this queue draft. Published pages are not affected.`;

    if (!window.confirm(msg)) return;

    if (buttonEl) buttonEl.disabled = true;

    try {
      const res = await adminFetch(`/api/admin/content-imports/${encodeURIComponent(importId)}`, {
        method: "DELETE"
      });
      if (res.ok && res.body && res.body.success) {
        window.AdminUI?.toastSuccess(`Import #${importId} deleted`);
        await loadImportList();
      } else {
        const errMsg = (res.body && res.body.message) || "Failed to delete import";
        window.AdminUI?.toastError(errMsg);
        if (buttonEl) buttonEl.disabled = false;
      }
    } catch (err) {
      console.error("Delete import error:", err);
      window.AdminUI?.toastError("Network error while deleting");
      if (buttonEl) buttonEl.disabled = false;
    }
  }

  async function loadImportList() {
    if (!listContainer) return;
    if (listMeta) listMeta.textContent = "Loading…";
    try {
      const res = await adminFetch("/api/admin/content-imports?page=1&limit=50");
      if (!res.ok || !res.body || !res.body.success) {
        const msg =
          (res.body && res.body.message) ||
          (res.status === 503
            ? "Import queue unavailable — run migration and set CONTENT_IMPORT_ENABLED=1"
            : "Failed to load imports");
        if (listMeta) listMeta.textContent = msg;
        listContainer.innerHTML = `<p class="import-queue-error">${escapeHtml(msg)}</p>`;
        return;
      }
      const rows = res.body.data || [];
      importRowsAll = rows;
      const total =
        res.body.pagination && res.body.pagination.total != null
          ? res.body.pagination.total
          : rows.length;
      if (listMeta) listMeta.textContent = `${total} import(s) in queue`;
      renderImportList(getFilteredImports());
      window.AdminPageToolbar?.markUpdated?.();
    } catch (err) {
      console.error("Import list error:", err);
      if (listMeta) listMeta.textContent = "Failed to load imports";
      listContainer.innerHTML =
        '<p class="import-queue-error">Network error loading imports</p>';
    }
  }

  if (listContainer) {
    listContainer.addEventListener("click", (e) => {
      const btn = e.target.closest(".js-delete-import");
      if (!btn) return;
      e.preventDefault();
      const id = btn.getAttribute("data-import-id");
      deleteImport(id, btn);
    });
  }

  csvInput.addEventListener("change", () => {
    const file = csvInput.files && csvInput.files[0] ? csvInput.files[0] : null;
    updateSelectedFile(file);
    validateSelection(file);
  });

  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => loadImportList());
  }

  let importSearchDebounce = null;
  document.getElementById("importSearch")?.addEventListener("input", (e) => {
    importSearchQuery = e.target.value;
    syncImportSearchClear();
    if (importSearchDebounce) clearTimeout(importSearchDebounce);
    importSearchDebounce = setTimeout(() => renderImportList(getFilteredImports()), 180);
  });
  document.getElementById("importSearchClear")?.addEventListener("click", () => {
    const input = document.getElementById("importSearch");
    if (!input) return;
    input.value = "";
    importSearchQuery = "";
    syncImportSearchClear();
    renderImportList(getFilteredImports());
  });

  uploadBtn.addEventListener("click", async () => {
    const file = csvInput.files && csvInput.files[0] ? csvInput.files[0] : null;
    if (!validateSelection(file)) return;
    const formData = new FormData();
    formData.append("csvfile", file);

    const runImport = async () => {
      setStatus("Importing…");
      const res = await adminFetch("/api/admin/upload-csv", {
        method: "POST",
        body: formData
      });
      if (res.ok && res.body && (res.body.success || res.body.status === "success")) {
        const n = res.body.imported != null ? res.body.imported : "";
        const skipped = res.body.skipped != null ? res.body.skipped : 0;
        setStatus(
          n !== ""
            ? `Imported ${n} row(s)${skipped ? `, skipped ${skipped} empty row(s)` : ""}`
            : "Import successful"
        );
        window.AdminUI?.toastSuccess("Content imported to queue");
        await loadImportList();
      } else {
        const msg = (res.body && (res.body.message || res.body.error)) || "Import failed";
        setStatus(msg, true);
        window.AdminUI?.toastError(msg);
      }
    };

    try {
      if (window.AdminUI && window.AdminUI.withLoading) {
        await window.AdminUI.withLoading(uploadBtn, runImport, "Importing…");
      } else {
        uploadBtn.disabled = true;
        uploadBtn.textContent = "Importing…";
        await runImport();
      }
    } catch (err) {
      console.error("CSV upload error:", err);
      setStatus("Network error during import", true);
      window.AdminUI?.toastError("Something went wrong");
    } finally {
      uploadBtn.disabled = !csvInput.files || !csvInput.files[0];
      if (!window.AdminUI || !window.AdminUI.withLoading) {
        uploadBtn.textContent = "Import CSV";
      }
    }
  });

  window.adminPageRefreshHandler = loadImportList;

  loadImportList();
})();
