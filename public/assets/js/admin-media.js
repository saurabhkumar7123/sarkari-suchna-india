/**
 * Media Library — list / detail (RRQ-style chrome), upload, copy URL, safe delete.
 */
(function () {
  "use strict";

  const FILES_API = "/api/admin/media";
  const UPLOAD_API = "/api/admin/pdf";
  const DETAIL_API = "/api/admin/media/detail";
  const MAX_BYTES = 10 * 1024 * 1024;
  const ALLOWED_EXT = [".pdf", ".jpg", ".jpeg", ".png", ".webp"];

  let filesCache = [];
  let selectedId = null;
  let typeFilter = "all";
  let searchTerm = "";

  const el = (id) => document.getElementById(id);

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatSize(bytes) {
    const n = Number(bytes) || 0;
    if (n > 1024 * 1024) return (n / (1024 * 1024)).toFixed(1) + " MB";
    if (n > 1024) return (n / 1024).toFixed(1) + " KB";
    return n + " B";
  }

  function formatDate(d) {
    if (!d) return "—";
    try {
      return new Date(d).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch {
      return String(d);
    }
  }

  function toAbsoluteUrl(url) {
    const raw = String(url || "").trim();
    if (!raw) return "";
    if (/^https?:\/\//i.test(raw)) return raw;
    if (raw.startsWith("/")) return `${window.location.origin}${raw}`;
    return raw;
  }

  function displayName(file) {
    return String(file.title || file.originalName || file.name || "").trim() || "Untitled";
  }

  function syncListDetailChrome(detailVisible) {
    const layout = el("mediaLayout");
    if (!layout) return;
    layout.classList.toggle("ml-layout--list-only", !detailVisible);
    layout.classList.toggle("ml-layout--detail-only", detailVisible);
    document.body.classList.toggle("ml-detail-active", detailVisible);
    document.querySelectorAll(".media-list-only").forEach((node) => {
      node.hidden = detailVisible;
    });
    const listPanel = el("mediaListPanel");
    const detailPanel = el("mediaDetailPanel");
    if (listPanel) listPanel.hidden = detailVisible;
    if (detailPanel) detailPanel.hidden = !detailVisible;
  }

  function mediaIdFromFile(file) {
    return file.id || `${file.type === "pdf" ? "pdf" : "image"}/${file.name}`;
  }

  function syncMediaUrl(fileId, { replace } = {}) {
    const url = new URL(window.location.href);
    if (fileId) url.searchParams.set("file", fileId);
    else url.searchParams.delete("file");
    const next = url.pathname + url.search;
    if (replace) history.replaceState({ mediaFile: fileId || null }, "", next);
    else history.pushState({ mediaFile: fileId || null }, "", next);
  }

  function readFileFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return String(params.get("file") || "").trim() || null;
  }

  async function fetchFiles(force) {
    if (!force && filesCache.length) return filesCache;
    const res = await fetch(FILES_API, { credentials: "include", cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const body = await res.json();
    filesCache = (body && body.data) || [];
    return filesCache;
  }

  function filteredFiles() {
    const q = searchTerm.trim().toLowerCase();
    return filesCache.filter((f) => {
      if (typeFilter !== "all" && f.type !== typeFilter) return false;
      if (!q) return true;
      const hay = `${displayName(f)} ${f.name} ${f.url}`.toLowerCase();
      return hay.includes(q);
    });
  }

  function renderList() {
    const tbody = el("mediaTableBody");
    const meta = el("mediaListMeta");
    if (!tbody) return;
    const list = filteredFiles();
    if (meta) meta.textContent = `${list.length} file${list.length === 1 ? "" : "s"}`;
    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="ml-empty">No media found. Upload a PDF or image to get started.</td></tr>`;
      return;
    }
    tbody.innerHTML = list
      .map((f) => {
        const id = mediaIdFromFile(f);
        return `<tr class="ml-row" data-media-id="${escapeHtml(id)}" tabindex="0">
          <td>
            <div class="ml-name">${escapeHtml(displayName(f))}</div>
            <div class="ml-filename">${escapeHtml(f.name)}</div>
          </td>
          <td><span class="ml-type ml-type--${escapeHtml(f.type)}">${escapeHtml(f.type.toUpperCase())}</span></td>
          <td>${escapeHtml(formatSize(f.size))}</td>
          <td>${escapeHtml(formatDate(f.date))}</td>
          <td class="ml-actions-cell">
            <button type="button" class="ml-action" data-act="open" data-id="${escapeHtml(id)}">Open</button>
            <button type="button" class="ml-action" data-act="copy" data-url="${escapeHtml(f.absoluteUrl || toAbsoluteUrl(f.url))}">Copy URL</button>
          </td>
        </tr>`;
      })
      .join("");
  }

  async function copyText(text) {
    const t = String(text || "");
    try {
      await navigator.clipboard.writeText(t);
      window.AdminUI?.toastSuccess?.("URL copied");
    } catch {
      window.prompt("Copy URL:", t);
    }
  }

  async function openDetail(fileId, { pushUrl } = { pushUrl: true }) {
    selectedId = fileId;
    syncListDetailChrome(true);
    if (pushUrl) syncMediaUrl(fileId);
    const msg = el("mediaDetailMessage");
    const body = el("mediaDetailBody");
    if (msg) {
      msg.hidden = true;
      msg.textContent = "";
    }
    if (body) body.innerHTML = `<p class="ml-empty">Loading…</p>`;

    try {
      const res = await fetch(`${DETAIL_API}?file=${encodeURIComponent(fileId)}`, {
        credentials: "include",
        cache: "no-store"
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.data) throw new Error(json.message || json.error || "Failed to load");
      renderDetail(json.data);
    } catch (err) {
      if (body) body.innerHTML = "";
      if (msg) {
        msg.hidden = false;
        msg.textContent = err.message || "Failed to load media";
        msg.classList.add("is-error");
      }
    }
  }

  function renderDetail(data) {
    const body = el("mediaDetailBody");
    if (!body) return;
    const abs = data.absoluteUrl || toAbsoluteUrl(data.url);
    const usage = Array.isArray(data.usage) ? data.usage : [];
    const preview =
      data.type === "image"
        ? `<img class="ml-preview-img" src="${escapeHtml(data.url)}" alt="">`
        : `<iframe class="ml-preview-pdf" src="${escapeHtml(data.url)}" title="PDF preview"></iframe>`;

    const usageHtml = usage.length
      ? `<ul class="ml-usage-list">${usage
          .map(
            (u) =>
              `<li><span class="ml-usage-kind">${escapeHtml(u.kind)}</span> ${escapeHtml(u.title)} ${
                u.href ? `<a href="${escapeHtml(u.href)}" target="_blank" rel="noopener">Open</a>` : ""
              }</li>`
          )
          .join("")}</ul>`
      : `<p class="manager-hint">No published page or draft references found.</p>`;

    body.innerHTML = `
      <div class="ml-detail-grid">
        <div class="ml-preview">${preview}</div>
        <div class="ml-detail-meta">
          <dl>
            <dt>Title</dt><dd id="mediaDetailTitleText">${escapeHtml(data.title || "—")}</dd>
            <dt>Filename</dt><dd>${escapeHtml(data.name)}</dd>
            <dt>Type</dt><dd>${escapeHtml((data.type || "").toUpperCase())}</dd>
            <dt>Size</dt><dd>${escapeHtml(formatSize(data.size))}</dd>
            <dt>Uploaded</dt><dd>${escapeHtml(formatDate(data.uploadedAt || data.date))}</dd>
            <dt>Public URL</dt>
            <dd class="ml-url-row">
              <input type="text" readonly value="${escapeHtml(abs)}" id="mediaDetailUrl">
              <button type="button" class="header-action-btn" id="mediaCopyUrlBtn">Copy URL</button>
              <a class="header-action-btn header-action-btn--ghost" href="${escapeHtml(data.url)}" target="_blank" rel="noopener">View</a>
            </dd>
          </dl>
          <form id="mediaMetaForm" class="ml-meta-form">
            <label>Display title
              <input type="text" id="mediaMetaTitle" maxlength="240" value="${escapeHtml(data.title || "")}" placeholder="Optional title">
            </label>
            <button type="submit" class="header-action-btn header-action-btn--ghost">Save title</button>
          </form>
          <div class="ml-detail-actions">
            <button type="button" class="header-action-btn header-action-btn--danger" id="mediaDeleteBtn" data-file="${escapeHtml(data.id)}" data-in-use="${usage.length ? "1" : "0"}">Delete</button>
          </div>
          <section class="ml-usage">
            <h3>Used by</h3>
            ${usageHtml}
          </section>
        </div>
      </div>
    `;

    el("mediaCopyUrlBtn")?.addEventListener("click", () => copyText(abs));
    el("mediaMetaForm")?.addEventListener("submit", onSaveMeta);
    el("mediaDeleteBtn")?.addEventListener("click", onDeleteClick);
  }

  async function onSaveMeta(ev) {
    ev.preventDefault();
    if (!selectedId) return;
    const title = el("mediaMetaTitle")?.value || "";
    try {
      const headers = { "Content-Type": "application/json" };
      if (typeof window.getAdminCsrfToken === "function") {
        headers["X-CSRF-Token"] = await window.getAdminCsrfToken();
      }
      const res = await fetch("/api/admin/media", {
        method: "PATCH",
        credentials: "include",
        headers,
        body: JSON.stringify({ file: selectedId, title })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || "Save failed");
      window.AdminUI?.toastSuccess?.("Title saved");
      filesCache = [];
      await fetchFiles(true);
      const titleEl = el("mediaDetailTitleText");
      if (titleEl) titleEl.textContent = title.trim() || "—";
    } catch (err) {
      window.AdminUI?.toastError?.(err.message || "Save failed");
    }
  }

  async function onDeleteClick(ev) {
    const btn = ev.currentTarget;
    const file = btn.getAttribute("data-file");
    const inUse = btn.getAttribute("data-in-use") === "1";
    if (!file) return;

    if (inUse) {
      const ok = window.confirm(
        "This file is referenced by pages or drafts.\nDeleting will break those links.\n\nForce delete anyway?"
      );
      if (!ok) return;
      await deleteMedia(file, true);
      return;
    }

    const ok = window.confirm("Delete this media file? This cannot be undone.");
    if (!ok) return;
    await deleteMedia(file, false);
  }

  async function deleteMedia(file, force) {
    try {
      const headers = {};
      if (typeof window.getAdminCsrfToken === "function") {
        headers["X-CSRF-Token"] = await window.getAdminCsrfToken();
      }
      const qs = `file=${encodeURIComponent(file)}${force ? "&force=1" : ""}`;
      const res = await fetch(`/api/admin/media?${qs}`, {
        method: "DELETE",
        credentials: "include",
        headers
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 409) {
        const forceOk = window.confirm(
          `${json.message || "File is in use."}\n\nForce delete?`
        );
        if (forceOk) return deleteMedia(file, true);
        return;
      }
      if (!res.ok) throw new Error(json.message || json.error || "Delete failed");
      window.AdminUI?.toastSuccess?.("Deleted");
      filesCache = [];
      closeDetail({ replaceUrl: true });
      await loadList();
    } catch (err) {
      window.AdminUI?.toastError?.(err.message || "Delete failed");
    }
  }

  function closeDetail({ replaceUrl } = {}) {
    selectedId = null;
    syncListDetailChrome(false);
    if (replaceUrl) syncMediaUrl(null, { replace: true });
    else syncMediaUrl(null);
  }

  async function loadList() {
    const msg = el("mediaListMessage");
    try {
      await fetchFiles(true);
      renderList();
      if (msg) msg.hidden = true;
    } catch (err) {
      if (msg) {
        msg.hidden = false;
        msg.textContent = "Failed to load media list";
        msg.classList.add("is-error");
      }
    }
  }

  function validateFile(file) {
    if (!file) return "No file selected";
    const ext = String(file.name || "").toLowerCase().match(/\.[^.]+$/)?.[0] || "";
    if (!ALLOWED_EXT.includes(ext)) return "Only PDF, JPG, JPEG, PNG, WebP allowed";
    if (file.size > MAX_BYTES) return "File exceeds 10 MB limit";
    return "";
  }

  function setUploadPanel(open) {
    const panel = el("mediaUploadPanel");
    if (panel) panel.hidden = !open;
  }

  function bindUpload() {
    const form = el("mediaUploadForm");
    const input = el("mediaFileInput");
    const drop = el("mediaDropZone");
    const nameEl = el("mediaSelectedName");

    el("mediaUploadOpenBtn")?.addEventListener("click", () => setUploadPanel(true));
    el("mediaUploadCancel")?.addEventListener("click", () => {
      setUploadPanel(false);
      if (form) form.reset();
      if (nameEl) nameEl.textContent = "No file selected";
    });

    input?.addEventListener("change", () => {
      const f = input.files?.[0];
      if (nameEl) nameEl.textContent = f ? `${f.name} (${formatSize(f.size)})` : "No file selected";
    });

    ["dragenter", "dragover"].forEach((evt) => {
      drop?.addEventListener(evt, (e) => {
        e.preventDefault();
        drop.classList.add("is-drag");
      });
    });
    ["dragleave", "drop"].forEach((evt) => {
      drop?.addEventListener(evt, (e) => {
        e.preventDefault();
        drop.classList.remove("is-drag");
      });
    });
    drop?.addEventListener("drop", (e) => {
      const f = e.dataTransfer?.files?.[0];
      if (!f || !input) return;
      const transfer = new DataTransfer();
      transfer.items.add(f);
      input.files = transfer.files;
      if (nameEl) nameEl.textContent = `${f.name} (${formatSize(f.size)})`;
    });

    form?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const file = input?.files?.[0];
      const err = validateFile(file);
      const status = el("mediaUploadStatus");
      if (err) {
        if (status) {
          status.textContent = err;
          status.classList.add("is-error");
        }
        window.AdminUI?.toastError?.(err);
        return;
      }

      const fd = new FormData();
      fd.append("pdf", file);
      const title = el("mediaTitleInput")?.value || "";
      if (title.trim()) fd.append("title", title.trim());

      const xhr = new XMLHttpRequest();
      xhr.open("POST", UPLOAD_API, true);
      xhr.withCredentials = true;
      if (typeof window.getAdminCsrfToken === "function") {
        try {
          xhr.setRequestHeader("X-CSRF-Token", await window.getAdminCsrfToken());
        } catch {
          window.AdminUI?.toastError?.("Session error — refresh the page");
          return;
        }
      }

      const progress = el("mediaUploadProgress");
      const fill = el("mediaUploadProgressFill");
      if (progress) progress.hidden = false;

      xhr.upload.onprogress = (ev) => {
        if (!ev.lengthComputable || !fill) return;
        fill.style.width = Math.round((ev.loaded / ev.total) * 100) + "%";
      };

      xhr.onload = async () => {
        if (progress) progress.hidden = true;
        let data = {};
        try {
          data = JSON.parse(xhr.responseText || "{}");
        } catch {
          /* ignore */
        }
        if (xhr.status >= 200 && xhr.status < 300 && (data.path || data.url)) {
          const path = data.path || data.url;
          const id = path.replace(/^\//, "");
          window.AdminUI?.toastSuccess?.("Upload successful");
          if (status) {
            status.textContent = "Uploaded: " + (data.absoluteUrl || toAbsoluteUrl(path));
            status.classList.remove("is-error");
          }
          setUploadPanel(false);
          form.reset();
          if (nameEl) nameEl.textContent = "No file selected";
          filesCache = [];
          await loadList();
          openDetail(id, { pushUrl: true });
        } else {
          const message = data.message || data.error || "Upload failed";
          if (status) {
            status.textContent = message;
            status.classList.add("is-error");
          }
          window.AdminUI?.toastError?.(message);
        }
      };

      xhr.onerror = () => {
        if (progress) progress.hidden = true;
        window.AdminUI?.toastError?.("Upload failed");
      };

      xhr.send(fd);
    });
  }

  function bindListActions() {
    el("mediaTableBody")?.addEventListener("click", (ev) => {
      const actBtn = ev.target.closest("[data-act]");
      if (actBtn) {
        const act = actBtn.getAttribute("data-act");
        if (act === "copy") {
          ev.stopPropagation();
          copyText(actBtn.getAttribute("data-url"));
          return;
        }
        if (act === "open") {
          ev.stopPropagation();
          openDetail(actBtn.getAttribute("data-id"), { pushUrl: true });
          return;
        }
      }
      const row = ev.target.closest("[data-media-id]");
      if (row) openDetail(row.getAttribute("data-media-id"), { pushUrl: true });
    });

    el("mediaTableBody")?.addEventListener("keydown", (ev) => {
      if (ev.key !== "Enter") return;
      const row = ev.target.closest("[data-media-id]");
      if (row) openDetail(row.getAttribute("data-media-id"), { pushUrl: true });
    });

    el("mediaSearch")?.addEventListener("input", (ev) => {
      searchTerm = ev.target.value || "";
      renderList();
    });
    el("mediaTypeFilter")?.addEventListener("change", (ev) => {
      typeFilter = ev.target.value || "all";
      renderList();
    });
    el("mediaRefreshBtn")?.addEventListener("click", () => loadList());
    el("mediaBackBtn")?.addEventListener("click", () => closeDetail({ replaceUrl: true }));

    window.addEventListener("popstate", () => {
      const id = readFileFromUrl();
      if (id) openDetail(id, { pushUrl: false });
      else {
        selectedId = null;
        syncListDetailChrome(false);
      }
    });
  }

  async function init() {
    syncListDetailChrome(false);
    bindUpload();
    bindListActions();
    await loadList();
    const deep = readFileFromUrl();
    if (deep) await openDetail(deep, { pushUrl: false });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
