"use strict";

const TRASH_API = "/api/admin/trash";
const TRASH_PAGE_SIZE = 12;
let trashPage = 1;
let trashItems = [];
let trashTotal = 0;
let trashSearchQuery = "";
let trashSearchDebounce = null;

async function safeFetch(url, options = {}) {
  if (typeof window.adminSafeFetch === "function") {
    return window.adminSafeFetch(url, options);
  }
  try {
    const hdrs = { ...(options.headers || {}) };
    if (String(url).includes("/api/admin") && typeof window.getAdminCsrfToken === "function") {
      hdrs["X-CSRF-Token"] = await window.getAdminCsrfToken();
    }
    const res = await fetch(url, { credentials: "include", ...options, headers: hdrs });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.error(e);
    return null;
  }
}

function renderTrashStats() {
  const el = document.getElementById("trashStats");
  if (!el) return;
  if (!trashTotal && !trashSearchQuery.trim()) {
    el.hidden = true;
    return;
  }
  const q = trashSearchQuery.trim();
  el.hidden = false;
  el.innerHTML = `
    <span class="saas-stat saas-stat--warn"><strong>${trashTotal}</strong> in trash</span>
    ${q ? `<span class="saas-stat saas-stat--accent">search: "${q.replace(/"/g, "")}"</span>` : ""}
  `;
}

function syncTrashSearchClear() {
  const input = document.getElementById("trashSearch");
  const btn = document.getElementById("trashSearchClear");
  if (!input || !btn) return;
  btn.classList.toggle("is-hidden", !input.value.trim());
}

function renderTrashPagination() {
  const nav = document.getElementById("trashPagination");
  const summary = document.getElementById("trashPaginationSummary");
  const prev = document.getElementById("trashPrevBtn");
  const next = document.getElementById("trashNextBtn");
  const nums = document.getElementById("trashPageNumbers");
  const totalPages = Math.max(1, Math.ceil(trashTotal / TRASH_PAGE_SIZE) || 1);
  if (trashPage > totalPages) trashPage = totalPages;

  if (nav) nav.classList.toggle("is-hidden", trashTotal === 0);

  if (summary) {
    if (!trashTotal) summary.textContent = trashSearchQuery.trim() ? "No matching pages in trash." : "Trash is empty.";
    else {
      const start = (trashPage - 1) * TRASH_PAGE_SIZE + 1;
      const end = Math.min(trashPage * TRASH_PAGE_SIZE, trashTotal);
      summary.textContent = `Showing ${start}–${end} of ${trashTotal}`;
    }
  }

  if (prev) prev.disabled = trashPage <= 1;
  if (next) next.disabled = trashPage >= totalPages;

  if (!nums) return;
  nums.innerHTML = "";
  const maxBtns = 5;
  let startPage = Math.max(1, trashPage - 2);
  let endPage = Math.min(totalPages, startPage + maxBtns - 1);
  startPage = Math.max(1, endPage - maxBtns + 1);
  for (let i = startPage; i <= endPage; i += 1) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `pagination-num${i === trashPage ? " is-active" : ""}`;
    b.textContent = String(i);
    b.addEventListener("click", () => {
      if (trashPage === i) return;
      trashPage = i;
      loadTrash({ resetPage: false });
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

function showFeedback(message, isError = false, withActivityLink = false) {
  const box = document.getElementById("trashFeedback");
  if (!box) return;
  if (showFeedback._timer) clearTimeout(showFeedback._timer);
  box.innerHTML = "";
  const text = document.createElement("span");
  text.textContent = String(message || "").trim();
  box.appendChild(text);
  if (withActivityLink) {
    const link = document.createElement("a");
    link.href = "/admin/activity?action=restore";
    link.textContent = " View in activity log";
    link.style.marginLeft = "6px";
    box.appendChild(link);
  }
  box.className = `trash-feedback ${isError ? "error" : "success"}`.trim();
  if (message) {
    showFeedback._timer = setTimeout(() => {
      box.textContent = "";
      box.className = "trash-feedback";
    }, 4200);
  }
}

function renderTrashView() {
  const box = document.getElementById("trashList");
  if (!box) return;

  renderTrashStats();

  if (!trashItems.length && !trashTotal) {
    box.innerHTML = `<div class="saas-empty-state"><div class="icon">🗑️</div><h4>Trash is empty</h4><p>Deleted pages will appear here.</p></div>`;
    renderTrashPagination();
    return;
  }

  if (!trashItems.length && trashSearchQuery.trim()) {
    box.innerHTML = `<div class="saas-empty-state"><div class="icon">🔍</div><h4>No matching pages</h4></div>`;
    renderTrashPagination();
    return;
  }

  box.innerHTML = "";
  trashItems.forEach((p) => {
    const slug = p.slug || (p.url ? String(p.url).replace(/^\//, "").replace(/\.html$/, "") : "");
    const card = document.createElement("div");
    card.className = "trash-card";

    const title = p.title || slug || "Untitled";
    const deletedAt = formatDeletedDate(p.deleted_at || p.deletedAt || p.created_at || p.createdAt);
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

  renderTrashPagination();
}

async function loadTrash(opts = {}) {
  const box = document.getElementById("trashList");
  if (!box) return;
  box.innerHTML = `<div class="saas-loading-grid"><div class="saas-skeleton"></div><div class="saas-skeleton"></div></div>`;
  showFeedback("");

  if (opts.resetPage !== false) trashPage = 1;

  const q = trashSearchQuery.trim();
  const params = new URLSearchParams({
    page: String(trashPage),
    limit: String(TRASH_PAGE_SIZE)
  });
  if (q) params.set("q", q);

  const res = await safeFetch(`${TRASH_API}?${params.toString()}`);
  if (!res || !res.success) {
    box.innerHTML = `<div class="saas-empty-state"><div class="icon">⚠️</div><h4>Unable to load trash</h4></div>`;
    showFeedback("Failed to load trash", true);
    return;
  }

  trashItems = res.data || [];
  trashTotal = res.pagination && typeof res.pagination.total === "number" ? res.pagination.total : trashItems.length;
  renderTrashView();
  window.AdminPageToolbar?.markUpdated?.();
}

async function restorePage(slug) {
  const ok = await (window.AdminUI && window.AdminUI.confirmDelete
    ? window.AdminUI.confirmDelete({ title: "Restore page", count: 1, confirmLabel: "Restore" })
    : Promise.resolve(window.confirm("Restore this page?")));
  if (!ok) return;
  const data = await safeFetch(`/api/admin/pages/${encodeURIComponent(slug)}/restore`, { method: "PATCH" });
  if (data && data.success) {
    showFeedback("Page restored.", false, true);
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
    : Promise.resolve(window.confirm("Permanently delete this page?")));
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
  window.adminPageRefreshHandler = () => loadTrash({ resetPage: false });

  document.getElementById("trashRefreshBtn")?.addEventListener("click", () => loadTrash({ resetPage: false }));
  document.getElementById("trashRefreshBtn2")?.addEventListener("click", () => loadTrash({ resetPage: false }));
  document.getElementById("trashPrevBtn")?.addEventListener("click", () => {
    if (trashPage <= 1) return;
    trashPage -= 1;
    loadTrash({ resetPage: false });
  });
  document.getElementById("trashNextBtn")?.addEventListener("click", () => {
    trashPage += 1;
    loadTrash({ resetPage: false });
  });

  document.getElementById("trashSearch")?.addEventListener("input", (e) => {
    trashSearchQuery = e.target.value;
    syncTrashSearchClear();
    if (trashSearchDebounce) clearTimeout(trashSearchDebounce);
    trashSearchDebounce = setTimeout(() => loadTrash({ resetPage: true }), 280);
  });
  document.getElementById("trashSearchClear")?.addEventListener("click", () => {
    const input = document.getElementById("trashSearch");
    if (!input) return;
    input.value = "";
    trashSearchQuery = "";
    syncTrashSearchClear();
    loadTrash({ resetPage: true });
  });
}

wireTrashControls();
loadTrash();
