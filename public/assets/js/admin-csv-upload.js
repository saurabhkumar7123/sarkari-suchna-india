(function () {
  const csvInput = document.getElementById("csvInput");
  const uploadBtn = document.getElementById("uploadBtn");
  const refreshBtn = document.getElementById("refreshImportsBtn");
  const listContainer = document.getElementById("importListContainer");
  const listMeta = document.getElementById("importListMeta");

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
      return false;
    }
    if (!isCsvFile(file)) {
      setStatus("Only .csv files are supported", true);
      uploadBtn.disabled = true;
      return false;
    }
    setStatus("CSV selected");
    uploadBtn.disabled = false;
    return true;
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
    if (preview) return preview.slice(0, 120);
    return `Import #${row.id}`;
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

  function renderImportList(rows, pagination) {
    if (!listContainer) return;
    if (!rows || !rows.length) {
      listContainer.innerHTML =
        '<p class="manager-hint">No imports yet. Upload a CSV with a <strong>content</strong> column.</p>';
      return;
    }

    listContainer.innerHTML = rows
      .map((row) => {
        const href = `/generator?importId=${encodeURIComponent(row.id)}`;
        const status = escapeHtml(row.status || "pending");
        const file = escapeHtml(row.source_file || "—");
        const label = escapeHtml(previewLabel(row));
        return `
          <div class="page-item" role="listitem" style="flex-direction:column;align-items:flex-start;gap:8px;">
            <div style="display:flex;width:100%;justify-content:space-between;gap:12px;flex-wrap:wrap;">
              <div>
                <strong>#${escapeHtml(row.id)}</strong>
                <span class="manager-hint" style="margin-left:8px;">${status}</span>
              </div>
              <a class="header-action-btn" href="${href}" style="text-decoration:none;">Open in generator</a>
            </div>
            <div class="manager-hint" style="margin:0;">${label}</div>
            <div class="manager-hint" style="margin:0;">File: ${file} · Row: ${escapeHtml(row.row_index != null ? row.row_index : "—")} · ${formatDate(row.created_at)}</div>
          </div>
        `;
      })
      .join("");
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
        listContainer.innerHTML = `<p class="manager-hint" style="color:#dc2626;">${escapeHtml(msg)}</p>`;
        return;
      }
      const rows = res.body.data || [];
      const total = res.body.pagination && res.body.pagination.total != null ? res.body.pagination.total : rows.length;
      if (listMeta) listMeta.textContent = `${total} import(s) in queue`;
      renderImportList(rows, res.body.pagination);
    } catch (err) {
      console.error("Import list error:", err);
      if (listMeta) listMeta.textContent = "Failed to load imports";
      listContainer.innerHTML = '<p class="manager-hint" style="color:#dc2626;">Network error loading imports</p>';
    }
  }

  csvInput.addEventListener("change", () => {
    const file = csvInput.files && csvInput.files[0] ? csvInput.files[0] : null;
    updateSelectedFile(file);
    validateSelection(file);
  });

  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => loadImportList());
  }

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

  loadImportList();
})();
