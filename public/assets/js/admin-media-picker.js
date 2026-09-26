/**
 * Shared Media Library picker — viewport-level drawer/overlay.
 * Styles live in /css/admin/media-picker.css (CSP blocks injected <style>).
 */
(function () {
  "use strict";

  const MEDIA_API = "/api/admin/media";
  const UPLOAD_API = "/api/admin/pdf";
  const MAX_BYTES = 10 * 1024 * 1024;
  const ALLOWED_EXT = [".pdf", ".jpg", ".jpeg", ".png", ".webp"];

  let overlay = null;
  let targetInput = null;
  let typeFilter = "all";
  let onSelectCb = null;
  let filesCache = [];
  let lastFocus = null;
  let scrollY = 0;

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function toAbsoluteUrl(url) {
    const raw = String(url || "").trim();
    if (!raw) return "";
    if (/^https?:\/\//i.test(raw)) return raw;
    if (raw.startsWith("/")) return `${window.location.origin}${raw}`;
    return raw;
  }

  function displayName(f) {
    return String(f.title || f.originalName || f.name || "").trim() || "Untitled";
  }

  function formatSize(bytes) {
    const n = Number(bytes) || 0;
    if (n > 1024 * 1024) return (n / (1024 * 1024)).toFixed(1) + " MB";
    if (n > 1024) return (n / 1024).toFixed(1) + " KB";
    return n ? n + " B" : "";
  }

  function lockBody() {
    scrollY = window.scrollY || window.pageYOffset || 0;
    document.body.classList.add("amp-picker-open");
  }

  function unlockBody() {
    document.body.classList.remove("amp-picker-open");
    // Restore scroll without layout jump from position:fixed tricks.
    if (scrollY) window.scrollTo(0, scrollY);
  }

  function ensureOverlay() {
    if (overlay) return overlay;

    overlay = document.createElement("div");
    overlay.id = "adminMediaPickerOverlay";
    overlay.className = "amp-overlay";
    overlay.hidden = true;
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = `
      <div class="amp-panel" role="dialog" aria-modal="true" aria-labelledby="ampTitle">
        <div class="amp-head">
          <h3 id="ampTitle">Select Media</h3>
          <button type="button" class="amp-close" data-amp="close" aria-label="Close">×</button>
        </div>
        <div class="amp-body">
          <p class="amp-hint">Choose a site-hosted PDF or image for this field. Official source URLs can still be pasted manually.</p>
          <div class="amp-tabs" role="tablist">
            <button type="button" class="amp-tab is-active" data-amp-tab="library">Media Library</button>
            <button type="button" class="amp-tab" data-amp-tab="upload">Upload New Media</button>
          </div>
          <div data-amp-pane="library">
            <div class="amp-toolbar">
              <input type="search" id="ampSearch" placeholder="Search…" autocomplete="off" aria-label="Search media">
              <select id="ampType" aria-label="Filter by type">
                <option value="all">All types</option>
                <option value="pdf">PDF</option>
                <option value="image">Images</option>
              </select>
            </div>
            <ul class="amp-list" id="ampList"></ul>
          </div>
          <div data-amp-pane="upload" hidden>
            <div class="amp-upload">
              <label for="ampFile">File</label>
              <input type="file" id="ampFile" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/*">
              <label for="ampTitleInput">Optional title</label>
              <input type="text" id="ampTitleInput" maxlength="240" placeholder="Display title" autocomplete="off">
              <p class="amp-status" id="ampUploadStatus" role="status"></p>
            </div>
            <div class="amp-actions">
              <button type="button" class="amp-btn" data-amp="close">Cancel</button>
              <button type="button" class="amp-btn amp-btn--primary" data-amp="upload">Upload &amp; select</button>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.addEventListener("click", (ev) => {
      if (ev.target === overlay) close();
      if (ev.target.closest('[data-amp="close"]')) close();
    });

    overlay.querySelectorAll("[data-amp-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tab = btn.getAttribute("data-amp-tab");
        overlay.querySelectorAll("[data-amp-tab]").forEach((b) => b.classList.toggle("is-active", b === btn));
        overlay.querySelectorAll("[data-amp-pane]").forEach((pane) => {
          pane.hidden = pane.getAttribute("data-amp-pane") !== tab;
        });
      });
    });

    overlay.querySelector("#ampSearch")?.addEventListener("input", renderList);
    overlay.querySelector("#ampType")?.addEventListener("change", (ev) => {
      typeFilter = ev.target.value || "all";
      renderList();
    });
    overlay.querySelector("#ampList")?.addEventListener("click", (ev) => {
      const item = ev.target.closest("[data-url]");
      if (!item) return;
      selectUrl(item.getAttribute("data-url"));
    });
    overlay.querySelector("#ampList")?.addEventListener("keydown", (ev) => {
      if (ev.key !== "Enter") return;
      const item = ev.target.closest("[data-url]");
      if (!item) return;
      selectUrl(item.getAttribute("data-url"));
    });
    overlay.querySelector('[data-amp="upload"]')?.addEventListener("click", doUpload);

    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape" && overlay && !overlay.hidden) {
        ev.preventDefault();
        close();
      }
    });

    return overlay;
  }

  function renderList() {
    const list = overlay?.querySelector("#ampList");
    if (!list) return;
    const q = String(overlay.querySelector("#ampSearch")?.value || "")
      .trim()
      .toLowerCase();
    const filtered = filesCache.filter((f) => {
      if (typeFilter !== "all" && f.type !== typeFilter) return false;
      if (!q) return true;
      return `${displayName(f)} ${f.name} ${f.url}`.toLowerCase().includes(q);
    });
    if (!filtered.length) {
      list.innerHTML = `<li class="amp-empty">No matching media. Use Upload New Media or change filters.</li>`;
      return;
    }
    list.innerHTML = filtered
      .map((f) => {
        const abs = f.absoluteUrl || toAbsoluteUrl(f.url);
        const size = formatSize(f.size);
        return `<li class="amp-item" tabindex="0" data-url="${escapeHtml(abs)}">
          <div class="amp-item__meta">
            <strong>${escapeHtml(displayName(f))}</strong>
            <span><span class="amp-item__type">${escapeHtml((f.type || "").toUpperCase())}</span>${
              size ? ` · ${escapeHtml(size)}` : ""
            } · ${escapeHtml(f.name)}</span>
          </div>
          <button type="button" class="amp-btn amp-btn--primary">Select</button>
        </li>`;
      })
      .join("");
  }

  async function loadFiles() {
    const res = await fetch(MEDIA_API, { credentials: "include", cache: "no-store" });
    if (!res.ok) throw new Error("Failed to load media");
    const body = await res.json();
    filesCache = (body && body.data) || [];
    renderList();
  }

  function selectUrl(url) {
    const abs = toAbsoluteUrl(url);
    if (targetInput) {
      targetInput.value = abs;
      targetInput.dispatchEvent(new Event("input", { bubbles: true }));
      targetInput.dispatchEvent(new Event("change", { bubbles: true }));
    }
    if (typeof onSelectCb === "function") onSelectCb(abs);
    close();
  }

  async function doUpload() {
    const fileInput = overlay.querySelector("#ampFile");
    const status = overlay.querySelector("#ampUploadStatus");
    const file = fileInput?.files?.[0];
    if (!file) {
      if (status) {
        status.textContent = "Choose a file first";
        status.classList.add("is-error");
      }
      return;
    }
    const ext = String(file.name || "").toLowerCase().match(/\.[^.]+$/)?.[0] || "";
    if (!ALLOWED_EXT.includes(ext)) {
      if (status) {
        status.textContent = "Only PDF, JPG, PNG, WebP allowed";
        status.classList.add("is-error");
      }
      return;
    }
    if (file.size > MAX_BYTES) {
      if (status) {
        status.textContent = "File exceeds 10 MB";
        status.classList.add("is-error");
      }
      return;
    }

    const fd = new FormData();
    fd.append("pdf", file);
    const title = overlay.querySelector("#ampTitleInput")?.value || "";
    if (title.trim()) fd.append("title", title.trim());

    try {
      if (status) {
        status.textContent = "Uploading…";
        status.classList.remove("is-error");
      }
      const headers = {};
      if (typeof window.getAdminCsrfToken === "function") {
        headers["X-CSRF-Token"] = await window.getAdminCsrfToken();
      }
      const res = await fetch(UPLOAD_API, { method: "POST", credentials: "include", headers, body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !(data.path || data.url)) {
        throw new Error(data.message || data.error || "Upload failed");
      }
      const abs = data.absoluteUrl || toAbsoluteUrl(data.path || data.url);
      // Refresh cache so a re-open shows the new file; then select for current field.
      filesCache = [];
      selectUrl(abs);
    } catch (err) {
      if (status) {
        status.textContent = err.message || "Upload failed";
        status.classList.add("is-error");
      }
    }
  }

  function open(options) {
    const opts = options || {};
    targetInput = opts.input || null;
    onSelectCb = typeof opts.onSelect === "function" ? opts.onSelect : null;
    typeFilter = opts.type || "all";
    const initialTab = opts.initialTab === "upload" ? "upload" : "library";
    lastFocus = document.activeElement;
    ensureOverlay();
    overlay.hidden = false;
    overlay.classList.add("is-open");
    overlay.setAttribute("aria-hidden", "false");
    lockBody();

    const typeSel = overlay.querySelector("#ampType");
    if (typeSel) typeSel.value = typeFilter;
    overlay.querySelectorAll("[data-amp-tab]").forEach((b) => {
      b.classList.toggle("is-active", b.getAttribute("data-amp-tab") === initialTab);
    });
    overlay.querySelectorAll("[data-amp-pane]").forEach((pane) => {
      pane.hidden = pane.getAttribute("data-amp-pane") !== initialTab;
    });
    const status = overlay.querySelector("#ampUploadStatus");
    if (status) {
      status.textContent = "";
      status.classList.remove("is-error");
    }
    const fileInput = overlay.querySelector("#ampFile");
    if (fileInput) fileInput.value = "";
    const titleInput = overlay.querySelector("#ampTitleInput");
    if (titleInput) titleInput.value = "";

    loadFiles().catch(() => {
      const list = overlay.querySelector("#ampList");
      if (list) list.innerHTML = `<li class="amp-empty">Failed to load media library</li>`;
    });

    window.setTimeout(() => {
      const focusEl =
        initialTab === "upload"
          ? overlay.querySelector("#ampFile")
          : overlay.querySelector("#ampSearch");
      focusEl?.focus();
    }, 30);
  }

  function close() {
    if (!overlay) return;
    overlay.hidden = true;
    overlay.classList.remove("is-open");
    overlay.setAttribute("aria-hidden", "true");
    unlockBody();
    targetInput = null;
    onSelectCb = null;
    if (lastFocus && typeof lastFocus.focus === "function") {
      try {
        lastFocus.focus();
      } catch {
        /* ignore */
      }
    }
    lastFocus = null;
  }

  window.AdminMediaPicker = { open, close };
})();
