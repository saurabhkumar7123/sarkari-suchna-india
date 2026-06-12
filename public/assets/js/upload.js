"use strict";

const FILES_API = "/api/admin/files";
const FILES_CACHE_MS = 20000;

let filesCache = null;
let filesCacheTime = 0;

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
  el.style.color = isError ? "#b91c1c" : "#15803d";
}

function updateSelectedUploadFile(file) {
  const el = document.getElementById("uploadSelectedName");
  if (!el) return;
  if (!file) {
    el.textContent = "No file selected";
    return;
  }
  el.textContent = `${file.name} (${formatSize(file.size || 0)})`;
}

function setupUploadDropZone() {
  const input = document.getElementById("fileInput");
  const zone = document.getElementById("uploadDropZone");
  if (!input || !zone) return;

  input.addEventListener("change", () => {
    const file = input.files && input.files[0] ? input.files[0] : null;
    updateSelectedUploadFile(file);
    setUploadState(file ? "File selected" : "");
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
    input.files = dt.files;
    const file = dt.files[0];
    updateSelectedUploadFile(file);
    setUploadState("File selected");
  });
}

document.getElementById("uploadForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const uploadBtn = document.getElementById("uploadSubmitBtn");
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
        let output = `<p><b>Uploaded Successfully</b></p>`;
        const safePath = escapeAttr(filePath);
        const safeAbsoluteUrl = escapeAttr(absoluteUrl);
        if (filePath.endsWith(".pdf")) {
          output += `
        <p>PDF File</p>
        <button type="button" data-action="preview-pdf" data-url="${safePath}">Preview PDF</button>
        <br><br>
        <input type="text" value="${safeAbsoluteUrl}" style="width:300px" readonly>
      `;
        } else {
          output += `
        <p>Image Preview</p>
        <img src="${safePath}" width="250" loading="lazy" decoding="async" alt="">
        <br><br>
        <input type="text" value="${safeAbsoluteUrl}" style="width:300px" readonly>
      `;
        }
        const msgEl = document.getElementById("msg");
        if (msgEl) {
          msgEl.innerHTML = window.DOMPurify ? window.DOMPurify.sanitize(output) : output;
        }
        setUploadState("Upload completed");
        window.AdminUI?.toastSuccess("Action completed successfully");
        e.target.reset();
        updateSelectedUploadFile(null);
        invalidateFilesCache();
        loadFiles(true);
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
  const win = window.open("", "PDF Preview", "width=800,height=600");
  win.document.write(`
    <iframe src="${url}" width="100%" height="100%"></iframe>
  `);
}

async function loadFiles(forceRefresh) {
  const host = document.getElementById("fileList");
  if (!host) return;
  host.innerHTML = `<div class="file-list-loading">Loading files…</div>`;

  const body = await fetchFileListJson(!!forceRefresh);
  const files = body.data || [];
  displayFiles(files);
}

document.getElementById("filter").addEventListener("change", async (e) => {
  const type = e.target.value;
  const host = document.getElementById("fileList");
  if (host) host.innerHTML = `<div class="file-list-loading">Filtering…</div>`;

  const body = await fetchFileListJson(false);
  let files = body.data || [];
  if (type !== "all") {
    files = files.filter((f) => f.type === type);
  }
  displayFiles(files);
});

function formatSize(bytes) {
  if (bytes > 1024 * 1024) {
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }
  return (bytes / 1024).toFixed(1) + " KB";
}

function highlight(text, term) {
  if (!term) return text;
  const regex = new RegExp(`(${term})`, "gi");
  return text.replace(regex, `<mark>$1</mark>`);
}

function escapeAttr(s) {
  return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function toAbsoluteUrl(url) {
  const raw = String(url || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("/")) return `${window.location.origin}${raw}`;
  return raw;
}

function displayFiles(files, term = "") {
  if (!Array.isArray(files) || files.length === 0) {
    const empty = `
      <div class="empty-state">
        <div class="icon">📂</div>
        <h4>No files uploaded</h4>
        <p>Upload files to see and manage them here.</p>
      </div>
    `;
    const el = document.getElementById("fileList");
    if (el) el.innerHTML = window.DOMPurify ? window.DOMPurify.sanitize(empty) : empty;
    return;
  }

  let html = `<div class="gallery">`;

  files.forEach((f) => {
    html += `<div class="file-card">`;

    if (f.type === "image") {
      html += `<img src="${escapeAttr(f.url)}" class="thumb" loading="lazy" decoding="async" alt="">`;
    } else {
      html += `<div class="pdf-box">📄 PDF</div>`;
    }

    html += `<div class="file-name">${highlight(f.name, term)}</div>`;
    html += `<span class="type-badge">${String(f.type || "file").toUpperCase()}</span>`;

    html += `
      <div class="meta">
        📦 ${formatSize(f.size)} <br>
        🕒 ${new Date(f.date).toLocaleString()}
      </div>
    `;

    const relativeUrl = String(f.url || "").trim();
    const absoluteUrl = String(f.absoluteUrl || "").trim() || toAbsoluteUrl(relativeUrl);
    const u = escapeAttr(relativeUrl);
    const abs = escapeAttr(absoluteUrl);
    html += `
      <div class="actions">
        <button type="button" data-action="copy-url" data-url="${abs}">Copy</button>
        <button type="button" data-action="open-lightbox" data-url="${u}">View</button>
        <button type="button" data-action="delete-file" data-url="${u}">Delete</button>
      </div>
    `;

    html += `</div>`;
  });

  html += `</div>`;

  const host = document.getElementById("fileList");
  if (host) {
    host.innerHTML = window.DOMPurify ? window.DOMPurify.sanitize(html) : html;
  }
}

function copyLink(url) {
  navigator.clipboard.writeText(url);
  setUploadState("Link copied");
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
      window.AdminUI?.toastSuccess("Action completed successfully");
      invalidateFilesCache();
      loadFiles(true);
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

function openModal(url) {
  const modal = document.getElementById("previewModal");
  const content = document.getElementById("modalContent");
  content.innerHTML = `<div class="file-list-loading">Loading preview…</div>`;
  modal.style.display = "flex";

  if (url.endsWith(".pdf")) {
    content.innerHTML = `<iframe src="${url}" title="PDF preview"></iframe>`;
  } else {
    const img = new Image();
    img.onload = () => {
      content.innerHTML = "";
      content.appendChild(img);
    };
    img.onerror = () => {
      content.innerHTML = "<p>Could not load image</p>";
    };
    img.src = url;
    img.alt = "";
  }
}

function closeModal() {
  document.getElementById("previewModal").style.display = "none";
}

document.getElementById("searchFile").addEventListener("input", async function () {
  const term = this.value.toLowerCase();
  const body = await fetchFileListJson(false);
  let files = body.data || [];
  files = files.filter((f) => f.name.toLowerCase().includes(term));
  displayFiles(files, term);
});

function openLightbox(url) {
  const box = document.getElementById("lightbox");
  const content = document.getElementById("lightboxContent");
  content.innerHTML = `<div class="file-list-loading">Loading…</div>`;
  box.style.display = "flex";

  if (url.endsWith(".pdf")) {
    content.innerHTML = `<iframe src="${url}"></iframe>`;
  } else {
    const img = new Image();
    img.onload = () => {
      content.innerHTML = "";
      content.appendChild(img);
    };
    img.onerror = () => {
      content.innerHTML = "<p>Could not load image</p>";
    };
    img.src = url;
    img.alt = "";
  }
}

function closeLightbox() {
  document.getElementById("lightbox").style.display = "none";
}

document.getElementById("lightboxCloseBtn")?.addEventListener("click", closeLightbox);
document.getElementById("previewModalCloseBtn")?.addEventListener("click", closeModal);

/* Event delegation for dynamically rendered file cards (CSP: no inline onclick) */
document.addEventListener("click", (e) => {
  const t = e.target;
  if (!(t instanceof HTMLElement)) return;
  const preview = t.closest?.("[data-action='preview-pdf']");
  if (preview && preview.dataset.url) {
    e.preventDefault();
    previewPDF(preview.dataset.url);
    return;
  }
  const copyB = t.closest?.("[data-action='copy-url']");
  if (copyB && copyB.dataset.url) {
    e.preventDefault();
    copyLink(copyB.dataset.url);
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
