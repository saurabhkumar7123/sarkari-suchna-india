"use strict";

const TRASH_API = "/api/admin/trash";
const TRASH_PAGE_SIZE = 12;
let trashPage = 1;
let trashAll = [];
let trashSearchQuery = "";

async function safeFetch(url, options = {}) {
  try {
    const hdrs = { ...(options.headers || {}) };
    if (String(url).includes("/api/admin") && typeof window.getAdminCsrfToken === "function") {
      try {
        hdrs["X-CSRF-Token"] = await window.getAdminCsrfToken();
      } catch (err) {
        console.error("[CSRF]", err);
      }
    }
    if (typeof options.body === "string" && !hdrs["Content-Type"]) {
      hdrs["Content-Type"] = "application/json";
    }
    const res = await fetch(url, { credentials: "include", ...options, headers: hdrs });
    const ct = res.headers.get("content-type") || "";
    if (!res.ok) return null;
    if (ct.includes("application/json")) return await res.json();
    return null;
  } catch (e) {
    console.error(e);
    return null;
  }
}

function getFilteredTrash() {
  const q = trashSearchQuery.trim().toLowerCase();
  if (!q) return trashAll.slice();
  return trashAll.filter((p) => {
    const title = String(p.title || "").toLowerCase();
    const slug = String(p.slug || p.url || "").toLowerCase();
    return title.includes(q) || slug.includes(q);
  });
}

function renderTrashStats(filteredCount) {
  const el = document.getElementById("trashStats");
  if (!el) return;
  const total = trashAll.length;
  if (!total) {
    el.hidden = true;
    return;
  }
  const q = trashSearchQuery.trim();
  el.hidden = false;
  el.innerHTML = `
    <span class="saas-stat saas-stat--warn"><strong>${total}</strong> in trash</span>
    ${q ? `<span class="saas-stat saas-stat--accent"><strong>${filteredCount}</strong> matching</span>` : ""}
  `;
}

function syncTrashSearchClear() {
  const input = document.getElementById("trashSearch");
  const btn = document.getElementById("trashSearchClear");
  if (!input || !btn) return;
  btn.classList.toggle("is-hidden", !input.value.trim());
}

function renderTrashPagination(total) {
  const nav = document.getElementById("trashPagination");
  const summary = document.getElementById("trashPaginationSummary");
  const prev = document.getElementById("trashPrevBtn");
  const next = document.getElementById("trashNextBtn");
  const nums = document.getElementById("trashPageNumbers");
  const totalPages = Math.max(1, Math.ceil(total / TRASH_PAGE_SIZE) || 1);
  if (trashPage > totalPages) trashPage = totalPages;

  if (nav) nav.classList.toggle("is-hidden", !trashAll.length);

  if (summary) {
    if (!trashAll.length) summary.textContent = "Trash is empty.";
    else if (!total && trashSearchQuery.trim()) summary.textContent = `No results for "${trashSearchQuery.trim()}".`;
    else {
      const start = (trashPage - 1) * TRASH_PAGE_SIZE + 1;
      const end = Math.min(trashPage * TRASH_PAGE_SIZE, total);
      const filterNote = trashSearchQuery.trim() ? ` · filtered from ${trashAll.length}` : "";
      summary.textContent = `Showing ${start}–${end} of ${total}${filterNote} · Page ${trashPage} of ${totalPages}`;
    }
  }

  if (prev) prev.disabled = trashPage <= 1 || total === 0;
  if (next) next.disabled = trashPage >= totalPages || total === 0;

  if (!nums) return;
  nums.innerHTML = "";
  if (totalPages <= 1 || total === 0) return;

  for (let i = 1; i <= Math.min(totalPages, 7); i++) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = String(i);
    if (i === trashPage) b.classList.add("is-active");
    b.addEventListener("click", () => {
      if (trashPage === i) return;
      trashPage = i;
      renderTrashView();
    });
    nums.appendChild(b);
  }
}

function formatDeletedDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function showFeedback(message, isError = false) {
  const box = document.getElementById("trashFeedback");
  if (!box) return;
  if (showFeedback._timer) clearTimeout(showFeedback._timer);
  box.textContent = String(message || "").trim();
  box.className = `trash-feedback ${isError ? "error" : "success"}`.trim();
  if (message) {
    showFeedback._timer = setTimeout(() => {
      box.textContent = "";
      box.className = "trash-feedback";
    }, 2200);
  }
}

function renderTrashView() {
  const box = document.getElementById("trashList");
  if (!box) return;

  const filtered = getFilteredTrash();
  const total = filtered.length;
  renderTrashStats(total);

  if (!trashAll.length) {
    box.innerHTML = `<div class="saas-empty-state"><div class="icon">🗑️</div><h4>Trash is empty</h4><p>Deleted pages will appear here.</p></div>`;
    renderTrashPagination(0);
    return;
  }

  if (!total && trashSearchQuery.trim()) {
    box.innerHTML = `<div class="saas-empty-state"><div class="icon">🔍</div><h4>No matching pages</h4></div>`;
    renderTrashPagination(0);
    return;
  }

  const start = (trashPage - 1) * TRASH_PAGE_SIZE;
  const pages = filtered.slice(start, start + TRASH_PAGE_SIZE);

  box.innerHTML = "";
  pages.forEach((p) => {
    const slug = p.slug || (p.url ? String(p.url).replace(/^\//, "").replace(/\.html$/, "") : "");
    const card = document.createElement("div");
    card.className = "trash-card";

    const title = p.title || slug || "Untitled";
    const deletedAt = formatDeletedDate(p.deleted_at || p.deletedAt || p.updated_at || p.updatedAt);
    const slugText = slug ? `/${slug}` : (p.url || "—");

    const main = document.createElement("div");
    main.className = "trash-main";
    main.innerHTML = `
      <div class="trash-title">${title}</div>
      <div class="trash-meta-line">
        <span>Slug: ${slugText}</span>
        <span>Deleted: ${deletedAt}</span>
      </div>
    `;

    const restoreBtn = document.createElement("button");
    restoreBtn.type = "button";
    restoreBtn.className = "btn btn-restore";
    restoreBtn.textContent = "Restore";
    restoreBtn.addEventListener("click", () => restorePage(slug));

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "btn btn-delete";
    delBtn.textContent = "Delete Forever";
    delBtn.addEventListener("click", () => permanentDelete(slug));

    const actions = document.createElement("div");
    actions.className = "trash-actions";
    actions.appendChild(restoreBtn);
    actions.appendChild(delBtn);

    card.appendChild(main);
    card.appendChild(actions);
    box.appendChild(card);
  });

  renderTrashPagination(total);
}

async function loadTrash(opts = {}) {
  const box = document.getElementById("trashList");
  if (!box) return;
  box.innerHTML = `<div class="saas-loading-grid"><div class="saas-skeleton"></div><div class="saas-skeleton"></div></div>`;
  showFeedback("");

  const res = await safeFetch(`${TRASH_API}?page=1&limit=100`);
  if (!res || !res.success) {
    box.innerHTML = `<div class="saas-empty-state"><div class="icon">⚠️</div><h4>Unable to load trash</h4></div>`;
    showFeedback("Failed to load trash", true);
    return;
  }

  trashAll = res.data || [];
  if (opts.resetPage !== false) trashPage = 1;
  renderTrashView();
}

async function restorePage(slug) {
  if (!confirm("Restore this page?")) return;
  const data = await safeFetch(`/api/admin/pages/${encodeURIComponent(slug)}/restore`, { method: "PATCH" });
  if (data && data.success) {
    showFeedback("Page restored");
    loadTrash({ resetPage: false });
  } else {
    showFeedback("Restore failed", true);
  }
}

async function permanentDelete(slug) {
  const ok = await (window.AdminUI && window.AdminUI.typedConfirm
    ? window.AdminUI.typedConfirm({
        title: "Permanent delete",
        warnText: "This action cannot be undone",
        details: "Type DELETE to confirm",
        requireText: "DELETE"
      })
    : Promise.resolve(confirm("Permanently delete this page?")));
  if (!ok) return;

  const data = await safeFetch(`/api/admin/pages/${encodeURIComponent(slug)}/permanent`, { method: "DELETE" });
  if (data && data.success) {
    showFeedback("Page permanently deleted");
    loadTrash({ resetPage: false });
  } else {
    showFeedback("Delete failed", true);
  }
}

function wireTrashControls() {
  document.getElementById("trashRefreshBtn")?.addEventListener("click", () => loadTrash());
  document.getElementById("trashRefreshBtn2")?.addEventListener("click", () => loadTrash());
  document.getElementById("trashPrevBtn")?.addEventListener("click", () => {
    if (trashPage <= 1) return;
    trashPage -= 1;
    renderTrashView();
  });
  document.getElementById("trashNextBtn")?.addEventListener("click", () => {
    trashPage += 1;
    renderTrashView();
  });

  let debounce = null;
  document.getElementById("trashSearch")?.addEventListener("input", (e) => {
    trashSearchQuery = e.target.value;
    trashPage = 1;
    syncTrashSearchClear();
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(() => renderTrashView(), 180);
  });
  document.getElementById("trashSearchClear")?.addEventListener("click", () => {
    const input = document.getElementById("trashSearch");
    if (!input) return;
    input.value = "";
    trashSearchQuery = "";
    trashPage = 1;
    syncTrashSearchClear();
    renderTrashView();
  });
}

wireTrashControls();
loadTrash();
