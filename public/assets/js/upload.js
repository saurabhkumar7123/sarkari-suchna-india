"use strict";

const FILES_API = "/api/admin/files";
const FILES_CACHE_MS = 20000;
const UPLOAD_PAGE_SIZE = 12;
const UPLOAD_MAX_BYTES = 10 * 1024 * 1024;
const UPLOAD_ALLOWED_EXT = [".pdf", ".jpg", ".jpeg", ".png"];

let filesCache = null;
let filesCacheTime = 0;
let uploadFilesPage = 1;
let uploadFilesTotalPages = 1;
let uploadFilterType = "all";
let uploadSearchTerm = "";
let uploadSort = "newest";
let uploadViewMode = "grid";
let uploadFilesLoading = false;

function invalidateFilesCache() {
  filesCache = null;
  filesCacheTime = 0;
}

async function fetchFileListJson(forceRefresh) {
  const now = Date.now();
  if (!forceRefresh && filesCache && now - filesCacheTime < FILES_CACHE_MS) {
    return { success: true, data: filesCache };
  }
  try {
    const res = await fetch(FILES_API, { credentials: "include", cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const body = await res.json();
    const files = (body && body.data) || [];
    filesCache = files;
    filesCacheTime = Date.now();
    return { success: true, data: files };
  } catch (e) {
    console.error("[upload] file list", e);
    return { success: false, data: [] };
  }
}

function setUploadProgress(pct) {
  const wrap = document.getElementById("uploadProgressWrap");
  const fill = document.getElementById("uploadProgressFill");
  const label = document.getElementById("uploadProgressText");
  if (!wrap || !fill || !label) return;
  const n = Math.max(0, Math.min(100, Math.round(pct)));
  wrap.hidden = n <= 0 || n >= 100;
  fill.style.width = n + "%";
  label.textContent = n + "%";
  if (n >= 100) {
    setTimeout(() => {
      wrap.hidden = true;
      fill.style.width = "0%";
    }, 600);
  }
}

function setUploadState(message, isError = false) {
  const el = document.getElementById("uploadState");
  if (!el) return;
  el.textContent = String(message || "").trim();
  el.classList.toggle("is-error", isError);
}

function formatSize(bytes) {
  const n = Number(bytes) || 0;
  if (n > 1024 * 1024) return (n / (1024 * 1024)).toFixed(1) + " MB";
  return (n / 1024).toFixed(1) + " KB";
}

function formatRelativeUploadDate(dateStr) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 60 * 1000) return "Just now";
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / (60 * 1000))}m ago`;
  if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / (60 * 60 * 1000))}h ago`;
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return "";
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/"/g, "&quot;");
}

function highlight(text, term) {
  const safe = escapeHtml(text);
  if (!term) return safe;
  const regex = new RegExp(`(${escapeRegex(term)})`, "gi");
  return safe.replace(regex, "<mark>$1</mark>");
}

function toAbsoluteUrl(url) {
  const raw = String(url || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("/")) return `${window.location.origin}${raw}`;
  return raw;
}

function validateUploadFile(file) {
  if (!file) return "No file selected";
  const ext = String(file.name || "").toLowerCase().match(/\.[^.]+$/)?.[0] || "";
  if (!UPLOAD_ALLOWED_EXT.includes(ext)) {
    return "Only PDF, JPG, JPEG, PNG allowed";
  }
  if (file.size > UPLOAD_MAX_BYTES) {
    return "File exceeds 10 MB limit";
  }
  return "";
}

function updateSelectedUploadFile(file) {
  const el = document.getElementById("uploadSelectedName");
  if (!el) return;
  if (!file) {
    el.textContent = "No file selected";
    el.classList.remove("has-file");
    return;
  }
  el.textContent = `${file.name} (${formatSize(file.size || 0)})`;
  el.classList.add("has-file");
}

function showUploadLoadingSkeleton() {
  const host = document.getElementById("fileList");
  if (!host) return;
  const count = uploadViewMode === "list" ? 6 : 8;
  const cells = Array.from({ length: count }, () => '<div class="upload-file-skeleton"></div>').join("");
  host.innerHTML = `<div class="upload-files-loading" aria-busy="true">${cells}</div>`;
}

function renderUploadStats() {
  const el = document.getElementById("uploadStats");
  if (!el) return;
  const files = filesCache || [];
  if (!files.length) {
    el.hidden = true;
    el.innerHTML = "";
    return;
  }
  const pdfs = files.filter((f) => f.type === "pdf").length;
  const images = files.filter((f) => f.type === "image").length;
  const totalBytes = files.reduce((sum, f) => sum + (Number(f.size) || 0), 0);
  el.hidden = false;
  el.innerHTML = `
    <span class="upload-stat"><strong>${files.length}</strong> total</span>
    <span class="upload-stat"><strong>${pdfs}</strong> PDF</span>
    <span class="upload-stat"><strong>${images}</strong> images</span>
    <span class="upload-stat upload-stat--storage"><strong>${formatSize(totalBytes)}</strong> storage</span>
  `;
}

function sortUploadFiles(files) {
  const list = files.slice();
  switch (uploadSort) {
    case "oldest":
      list.sort((a, b) => new Date(a.date) - new Date(b.date));
      break;
    case "name-asc":
      list.sort((a, b) => String(a.name).localeCompare(String(b.name)));
      break;
    case "name-desc":
      list.sort((a, b) => String(b.name).localeCompare(String(a.name)));
      break;
    case "size-desc":
      list.sort((a, b) => (Number(b.size) || 0) - (Number(a.size) || 0));
      break;
    case "newest":
    default:
      list.sort((a, b) => new Date(b.date) - new Date(a.date));
  }
  return list;
}

function getFilteredUploadFiles() {
  let files = (filesCache || []).slice();
  if (uploadFilterType !== "all") {
    files = files.filter((f) => f.type === uploadFilterType);
  }
  const term = uploadSearchTerm.trim().toLowerCase();
  if (term) {
    files = files.filter((f) => String(f.name || "").toLowerCase().includes(term));
  }
  return sortUploadFiles(files);
}

function setupUploadDropZone() {
  const input = document.getElementById("fileInput");
  const zone = document.getElementById("uploadDropZone");
  if (!input || !zone) return;

  function handleSelectedFile(file) {
    const err = validateUploadFile(file);
    if (err) {
      updateSelectedUploadFile(null);
      input.value = "";
      setUploadState(err, true);
      window.AdminUI?.toastError(err);
      return;
    }
    updateSelectedUploadFile(file);
    setUploadState("Ready to upload");
  }

  input.addEventListener("change", () => {
    const file = input.files && input.files[0] ? input.files[0] : null;
    if (!file) {
      updateSelectedUploadFile(null);
      setUploadState("");
      return;
    }
    handleSelectedFile(file);
  });

  ["dragenter", "dragover"].forEach((evt) => {
    zone.addEventListener(evt, (e) => {
      e.preventDefault();
      zone.classList.add("drag-active");
    });
  });
  ["dragleave", "drop"].forEach((evt) => {
    zone.addEventListener(evt, (e) => {
      e.preventDefault();
      zone.classList.remove("drag-active");
    });
  });

  zone.addEventListener("drop", (e) => {
    const dt = e.dataTransfer;
    if (!dt || !dt.files || !dt.files.length) return;
    const file = dt.files[0];
    const err = validateUploadFile(file);
    if (err) {
      setUploadState(err, true);
      window.AdminUI?.toastError(err);
      return;
    }
    const transfer = new DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
    handleSelectedFile(file);
  });
}

document.getElementById("uploadForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const uploadBtn = document.getElementById("uploadSubmitBtn");
  const input = document.getElementById("fileInput");
  const file = input?.files?.[0];
  const validationErr = validateUploadFile(file);
  if (validationErr) {
    setUploadState(validationErr, true);
    window.AdminUI?.toastError(validationErr);
    return;
  }

  const formData = new FormData(e.target);
  const xhr = new XMLHttpRequest();
  xhr.open("POST", "/api/admin/pdf", true);
  xhr.withCredentials = true;
  if (typeof window.getAdminCsrfToken === "function") {
    try {
      xhr.setRequestHeader("X-CSRF-Token", await window.getAdminCsrfToken());
    } catch (err) {
      console.error(err);
      setUploadState("Session error — refresh the page", true);
      window.AdminUI?.toastError("Something went wrong");
      return;
    }
  }

  xhr.upload.onprogress = (ev) => {
    if (!ev.lengthComputable) return;
    setUploadProgress((ev.loaded / ev.total) * 100);
  };

  function uploadFailureMessage(status, data) {
    const msg = String((data && (data.message || data.error)) || "").trim();
    if (msg) return msg;
    if (status === 413) return "File exceeds maximum upload size (10 MB)";
    if (status === 403) return "Session expired — refresh the page and try again";
    if (status === 401) return "Please log in again";
    return "Upload failed";
  }

  xhr.onload = () => {
    setUploadProgress(100);
    try {
      const data = JSON.parse(xhr.responseText || "{}");
      const filePath = String(data.path || data.url || "").trim();
      const absoluteUrl = String(data.absoluteUrl || "").trim() || toAbsoluteUrl(filePath);
      if (xhr.status >= 200 && xhr.status < 300 && filePath) {
        const safePath = escapeAttr(filePath);
        const safeAbsoluteUrl = escapeAttr(absoluteUrl);
        const isPdf = filePath.toLowerCase().endsWith(".pdf");
        const output = `
        <div class="upload-success-box">
          <div class="upload-success-head">
            <span class="upload-success-label">${isPdf ? "PDF" : "Image"} uploaded successfully</span>
            <button type="button" class="upload-success-dismiss" data-action="dismiss-success" aria-label="Dismiss">×</button>
          </div>
          <div class="upload-success-actions">
            ${isPdf ? `<button type="button" class="upload-success-btn" data-action="preview-pdf" data-url="${safePath}">Preview</button>` : `<img src="${safePath}" class="upload-success-thumb" loading="lazy" decoding="async" alt="">`}
            <input type="text" class="upload-success-url" value="${safeAbsoluteUrl}" readonly>
            <button type="button" class="upload-success-btn upload-success-btn--copy" data-action="copy-success-url" data-url="${safeAbsoluteUrl}">Copy link</button>
          </div>
        </div>
      `;
        const msgEl = document.getElementById("msg");
        if (msgEl) {
          msgEl.innerHTML = window.DOMPurify ? window.DOMPurify.sanitize(output) : output;
        }
        setUploadState("Upload completed");
        window.AdminUI?.toastSuccess("File uploaded");
        e.target.reset();
        updateSelectedUploadFile(null);
        invalidateFilesCache();
        loadFiles(true, { resetPage: true });
      } else {
        const reason = uploadFailureMessage(xhr.status, data);
        throw new Error(reason);
      }
    } catch (err) {
      const reason = String(err && err.message ? err.message : "Upload failed");
      setUploadState(reason, true);
      window.AdminUI?.toastError(reason);
      console.error(err);
    }
    if (uploadBtn) {
      uploadBtn.disabled = false;
      uploadBtn.textContent = "Upload File";
    }
  };

  xhr.onerror = () => {
    setUploadProgress(0);
    const reason = "Network error — upload could not reach the server";
    setUploadState(reason, true);
    window.AdminUI?.toastError(reason);
    if (uploadBtn) {
      uploadBtn.disabled = false;
      uploadBtn.textContent = "Upload File";
    }
  };

  if (uploadBtn) {
    uploadBtn.disabled = true;
    uploadBtn.textContent = "Uploading...";
  }
  setUploadState("Uploading...");
  setUploadProgress(1);
  xhr.send(formData);
});

function previewPDF(url) {
  openLightbox(url);
}

async function loadFiles(forceRefresh, opts = {}) {
  if (uploadFilesLoading) return;
  uploadFilesLoading = true;
  const refreshBtn = document.getElementById("uploadRefreshBtn");
  if (refreshBtn) refreshBtn.classList.add("is-loading");

  showUploadLoadingSkeleton();
  await fetchFileListJson(!!forceRefresh);
  if (opts.resetPage !== false) uploadFilesPage = 1;

  uploadFilesLoading = false;
  if (refreshBtn) refreshBtn.classList.remove("is-loading");
  renderUploadStats();
  renderUploadFileView({ skipScroll: true });
}

function renderUploadPagination(total) {
  const nav = document.getElementById("uploadPagination");
  const summary = document.getElementById("uploadPaginationSummary");
  const prev = document.getElementById("uploadPrevBtn");
  const next = document.getElementById("uploadNextBtn");
  const nums = document.getElementById("uploadPageNumbers");
  const catalogTotal = (filesCache || []).length;
  const hasCatalog = catalogTotal > 0;
  const term = uploadSearchTerm.trim();

  if (nav) nav.classList.toggle("is-hidden", !hasCatalog);

  if (summary) {
    if (!hasCatalog) {
      summary.textContent = "No files uploaded yet.";
    } else if (!total && (term || uploadFilterType !== "all")) {
      summary.textContent = `No results${term ? ` for "${term}"` : ""}.`;
    } else {
      const start = (uploadFilesPage - 1) * UPLOAD_PAGE_SIZE + 1;
      const end = Math.min(uploadFilesPage * UPLOAD_PAGE_SIZE, total);
      const filterNote = term || uploadFilterType !== "all" ? ` · filtered from ${catalogTotal}` : "";
      summary.textContent = `Showing ${start}–${end} of ${total}${filterNote} · Page ${uploadFilesPage} of ${uploadFilesTotalPages}`;
    }
  }

  if (prev) prev.disabled = uploadFilesPage <= 1 || total === 0;
  if (next) next.disabled = uploadFilesPage >= uploadFilesTotalPages || total === 0;

  if (!nums) return;
  nums.innerHTML = "";
  if (total === 0 || uploadFilesTotalPages <= 1) return;

  const maxButtons = 7;
  let startPage = Math.max(1, uploadFilesPage - 3);
  let endPage = Math.min(uploadFilesTotalPages, startPage + maxButtons - 1);
  startPage = Math.max(1, endPage - maxButtons + 1);

  for (let i = startPage; i <= endPage; i++) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = String(i);
    if (i === uploadFilesPage) b.classList.add("is-active");
    b.addEventListener("click", () => {
      if (uploadFilesPage === i) return;
      uploadFilesPage = i;
      renderUploadFileView({ skipScroll: false });
    });
    nums.appendChild(b);
  }
}

function renderUploadFileView(opts = {}) {
  const filtered = getFilteredUploadFiles();
  const total = filtered.length;
  const term = uploadSearchTerm.trim();

  uploadFilesTotalPages = Math.max(1, Math.ceil(total / UPLOAD_PAGE_SIZE) || 1);
  if (uploadFilesPage > uploadFilesTotalPages) uploadFilesPage = uploadFilesTotalPages;

  renderUploadStats();
  syncUploadFilterPills();
  syncUploadViewToggle();

  if (!filesCache || !filesCache.length) {
    displayFiles([], term);
    renderUploadPagination(0);
    return;
  }

  if (!total && (term || uploadFilterType !== "all")) {
    displayFiles([], term);
    renderUploadPagination(0);
    return;
  }

  const start = (uploadFilesPage - 1) * UPLOAD_PAGE_SIZE;
  const slice = filtered.slice(start, start + UPLOAD_PAGE_SIZE);
  displayFiles(slice, term);
  renderUploadPagination(total);

  if (!opts.skipScroll) {
    document.getElementById("fileList")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}

function buildFileCardHtml(f, term) {
  const relativeUrl = String(f.url || "").trim();
  const absoluteUrl = String(f.absoluteUrl || "").trim() || toAbsoluteUrl(relativeUrl);
  const u = escapeAttr(relativeUrl);
  const abs = escapeAttr(absoluteUrl);
  const rel = formatRelativeUploadDate(f.date);
  const dateStr = new Date(f.date).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
  const dateLabel = rel ? `${dateStr} · ${rel}` : dateStr;

  const preview = f.type === "image"
    ? `<img src="${u}" class="thumb" loading="lazy" decoding="async" alt="">`
    : `<div class="pdf-box" title="PDF file"><span class="pdf-box-icon">PDF</span></div>`;

  return `
    <div class="file-card">
      ${preview}
      <div class="file-name">${highlight(f.name, term)}</div>
      <span class="type-badge type-badge--${escapeAttr(f.type || "file")}">${String(f.type || "file").toUpperCase()}</span>
      <div class="meta">${formatSize(f.size)} · ${escapeHtml(dateLabel)}</div>
      <div class="actions">
        <button type="button" data-action="copy-url" data-url="${abs}">Copy</button>
        <button type="button" data-action="open-lightbox" data-url="${u}">View</button>
        <button type="button" data-action="delete-file" data-url="${u}">Delete</button>
      </div>
    </div>
  `;
}

function buildFileRowHtml(f, term) {
  const relativeUrl = String(f.url || "").trim();
  const absoluteUrl = String(f.absoluteUrl || "").trim() || toAbsoluteUrl(relativeUrl);
  const u = escapeAttr(relativeUrl);
  const abs = escapeAttr(absoluteUrl);
  const rel = formatRelativeUploadDate(f.date);
  const icon = f.type === "image"
    ? `<img src="${u}" class="file-row-thumb" loading="lazy" decoding="async" alt="">`
    : `<span class="file-row-icon">PDF</span>`;

  return `
    <div class="file-row">
      <div class="file-row-main">
        ${icon}
        <div class="file-row-text">
          <div class="file-row-name">${highlight(f.name, term)}</div>
          <div class="file-row-meta">${formatSize(f.size)} · ${escapeHtml(rel || new Date(f.date).toLocaleDateString("en-IN"))}</div>
        </div>
      </div>
      <span class="type-badge type-badge--${escapeAttr(f.type || "file")}">${String(f.type || "file").toUpperCase()}</span>
      <div class="file-row-actions">
        <button type="button" data-action="copy-url" data-url="${abs}">Copy</button>
        <button type="button" data-action="open-lightbox" data-url="${u}">View</button>
        <button type="button" data-action="delete-file" data-url="${u}">Delete</button>
      </div>
    </div>
  `;
}

function displayFiles(files, term = "") {
  const host = document.getElementById("fileList");
  if (!host) return;

  if (!Array.isArray(files) || files.length === 0) {
    const isFiltered = Boolean(term) || uploadFilterType !== "all";
    const empty = isFiltered
      ? `<div class="empty-state"><div class="icon">🔍</div><h4>No matching files</h4><p>Try another search or filter.</p></div>`
      : `<div class="empty-state"><div class="icon">📂</div><h4>No files uploaded</h4><p>Drag a file above to get started.</p></div>`;
    host.innerHTML = window.DOMPurify ? window.DOMPurify.sanitize(empty) : empty;
    return;
  }

  const builder = uploadViewMode === "list" ? buildFileRowHtml : buildFileCardHtml;
  const wrapClass = uploadViewMode === "list" ? "file-list-table" : "gallery";
  let html = `<div class="${wrapClass}">`;
  files.forEach((f) => {
    html += builder(f, term);
  });
  html += `</div>`;
  host.innerHTML = window.DOMPurify ? window.DOMPurify.sanitize(html) : html;
}

function syncUploadSearchClear() {
  const input = document.getElementById("searchFile");
  const clearBtn = document.getElementById("uploadSearchClear");
  if (!input || !clearBtn) return;
  clearBtn.classList.toggle("is-hidden", !input.value.trim());
}

function syncUploadFilterPills() {
  document.querySelectorAll(".upload-filter-pill").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.filter === uploadFilterType);
  });
}

function syncUploadViewToggle() {
  const gridBtn = document.getElementById("uploadViewGrid");
  const listBtn = document.getElementById("uploadViewList");
  if (!gridBtn || !listBtn) return;
  const isGrid = uploadViewMode === "grid";
  gridBtn.classList.toggle("is-active", isGrid);
  listBtn.classList.toggle("is-active", !isGrid);
  gridBtn.setAttribute("aria-pressed", String(isGrid));
  listBtn.setAttribute("aria-pressed", String(!isGrid));
}

function wireUploadPagination() {
  document.getElementById("uploadPrevBtn")?.addEventListener("click", () => {
    if (uploadFilesPage <= 1) return;
    uploadFilesPage -= 1;
    renderUploadFileView();
  });
  document.getElementById("uploadNextBtn")?.addEventListener("click", () => {
    if (uploadFilesPage >= uploadFilesTotalPages) return;
    uploadFilesPage += 1;
    renderUploadFileView();
  });
}

function wireUploadManagerControls() {
  let debounceTimer = null;
  const searchInput = document.getElementById("searchFile");
  searchInput?.addEventListener("input", function () {
    uploadSearchTerm = this.value;
    uploadFilesPage = 1;
    syncUploadSearchClear();
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      renderUploadFileView({ skipScroll: true });
    }, 180);
  });
  searchInput?.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && searchInput.value) {
      searchInput.value = "";
      uploadSearchTerm = "";
      uploadFilesPage = 1;
      syncUploadSearchClear();
      renderUploadFileView({ skipScroll: true });
    }
  });
  document.getElementById("uploadSearchClear")?.addEventListener("click", () => {
    if (!searchInput) return;
    searchInput.value = "";
    uploadSearchTerm = "";
    uploadFilesPage = 1;
    syncUploadSearchClear();
    searchInput.focus();
    renderUploadFileView({ skipScroll: true });
  });

  document.getElementById("uploadSort")?.addEventListener("change", (e) => {
    uploadSort = e.target.value || "newest";
    uploadFilesPage = 1;
    renderUploadFileView({ skipScroll: true });
  });

  document.querySelectorAll(".upload-filter-pill").forEach((btn) => {
    btn.addEventListener("click", () => {
      uploadFilterType = btn.dataset.filter || "all";
      uploadFilesPage = 1;
      renderUploadFileView({ skipScroll: true });
    });
  });

  document.getElementById("uploadViewGrid")?.addEventListener("click", () => {
    if (uploadViewMode === "grid") return;
    uploadViewMode = "grid";
    renderUploadFileView({ skipScroll: true });
  });
  document.getElementById("uploadViewList")?.addEventListener("click", () => {
    if (uploadViewMode === "list") return;
    uploadViewMode = "list";
    renderUploadFileView({ skipScroll: true });
  });

  document.getElementById("uploadRefreshBtn")?.addEventListener("click", () => {
    loadFiles(true, { resetPage: false });
  });
}

async function copyLink(url, triggerBtn) {
  const value = String(url || "").trim();
  if (!value) return;
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = value;
    ta.setAttribute("readonly", "");
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  }
  setUploadState("Link copied");
  if (triggerBtn) {
    const prev = triggerBtn.textContent;
    triggerBtn.textContent = "Copied!";
    setTimeout(() => {
      triggerBtn.textContent = prev;
    }, 1400);
  }
  window.AdminUI?.toastSuccess("Link copied");
}

async function deleteFile(url, triggerBtn) {
  const confirmDelete = await (window.AdminUI && window.AdminUI.confirmDelete
    ? window.AdminUI.confirmDelete({ title: "Delete file", count: 1 })
    : Promise.resolve(confirm("Are you sure you want to delete this file?")));
  if (!confirmDelete) return;

  const filePath = String(url).replace(/^\/+/, "");
  const hdrs = {};
  if (typeof window.getAdminCsrfToken === "function") {
    try {
      hdrs["X-CSRF-Token"] = await window.getAdminCsrfToken();
    } catch (err) {
      console.error(err);
    }
  }
  const runDelete = async () => {
    const res = await fetch(`/api/admin/files?file=${encodeURIComponent(filePath)}`, {
      method: "DELETE",
      credentials: "include",
      headers: hdrs
    });
    let data = {};
    try {
      data = await res.json();
    } catch {
      /* ignore */
    }
    if (res.ok && data.success) {
      setUploadState("File deleted");
      window.AdminUI?.toastSuccess("File deleted");
      invalidateFilesCache();
      loadFiles(true, { resetPage: false });
    } else {
      setUploadState("Error deleting file", true);
      window.AdminUI?.toastError("Something went wrong");
    }
  };
  if (window.AdminUI && window.AdminUI.withLoading && triggerBtn) {
    await window.AdminUI.withLoading(triggerBtn, runDelete, "Deleting...");
  } else {
    await runDelete();
  }
}

function openLightbox(url) {
  const box = document.getElementById("lightbox");
  const content = document.getElementById("lightboxContent");
  if (!box || !content) return;
  content.innerHTML = `<div class="file-list-loading">Loading…</div>`;
  box.style.display = "flex";
  box.dataset.open = "1";

  if (url.endsWith(".pdf")) {
    content.innerHTML = `<iframe src="${escapeAttr(url)}" title="PDF preview"></iframe>`;
  } else {
    const img = new Image();
    img.onload = () => {
      content.innerHTML = "";
      content.appendChild(img);
    };
    img.onerror = () => {
      content.innerHTML = "<p class=\"modal-error\">Could not load image</p>";
    };
    img.src = url;
    img.alt = "";
  }
}

function closeLightbox() {
  const box = document.getElementById("lightbox");
  if (!box) return;
  box.style.display = "none";
  box.dataset.open = "0";
  const content = document.getElementById("lightboxContent");
  if (content) content.innerHTML = "";
}

function wireModalDismiss() {
  document.getElementById("lightboxCloseBtn")?.addEventListener("click", closeLightbox);
  document.getElementById("lightbox")?.addEventListener("click", (e) => {
    if (e.target?.id === "lightbox") closeLightbox();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (document.getElementById("lightbox")?.dataset.open === "1") closeLightbox();
  });
}

document.addEventListener("click", (e) => {
  const t = e.target;
  if (!(t instanceof HTMLElement)) return;

  if (t.closest?.("[data-action='dismiss-success']")) {
    e.preventDefault();
    const msgEl = document.getElementById("msg");
    if (msgEl) msgEl.innerHTML = "";
    return;
  }

  const preview = t.closest?.("[data-action='preview-pdf']");
  if (preview && preview.dataset.url) {
    e.preventDefault();
    previewPDF(preview.dataset.url);
    return;
  }

  const copySuccess = t.closest?.("[data-action='copy-success-url']");
  if (copySuccess && copySuccess.dataset.url) {
    e.preventDefault();
    copyLink(copySuccess.dataset.url, copySuccess);
    return;
  }

  const copyB = t.closest?.("[data-action='copy-url']");
  if (copyB && copyB.dataset.url) {
    e.preventDefault();
    copyLink(copyB.dataset.url, copyB);
    return;
  }

  const viewB = t.closest?.("[data-action='open-lightbox']");
  if (viewB && viewB.dataset.url) {
    e.preventDefault();
    openLightbox(viewB.dataset.url);
    return;
  }

  const delB = t.closest?.("[data-action='delete-file']");
  if (delB && delB.dataset.url) {
    e.preventDefault();
    deleteFile(delB.dataset.url, delB);
  }
});

loadFiles(true);
setupUploadDropZone();
wireUploadPagination();
wireUploadManagerControls();
wireModalDismiss();
