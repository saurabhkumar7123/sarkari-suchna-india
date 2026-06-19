let activePages = [];
let currentPage = 1;
let totalPageCount = 1;
let totalItemCount = 0;
let pageLimit = 20;
let sortOrder = "desc";
let currentFilters = { search: "", category: "", status: "" };
let selectedSlugs = new Set();

function escapeAttr(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

function normalizeStatusLabel(status) {
  const label = String(status || "").trim();
  return label || "unknown";
}

function getStatusBadgeClass(status) {
  const s = normalizeStatusLabel(status).toLowerCase();
  if (s === "new" || s === "new form" || s === "form") return "status-new";
  if (s === "result") return "status-result";
  if (s === "admit" || s === "admit card") return "status-admit";
  if (s === "answer" || s === "answer key") return "status-answer";
  if (s === "syllabus") return "status-syllabus";
  if (s === "admission") return "status-admission";
  return "badge-custom";
}

function buildPagesQuery() {
  const params = new URLSearchParams();
  params.set("page", String(currentPage));
  params.set("limit", "20");
  params.set("sort", sortOrder === "asc" ? "asc" : "desc");
  if (currentFilters.search) params.set("q", currentFilters.search);
  if (currentFilters.status) params.set("status", currentFilters.status);
  if (currentFilters.category === "__notag") params.set("notag", "1");
  else if (currentFilters.category) params.set("category", currentFilters.category);
  return params.toString();
}

function pageListSkeletonHtml() {
  return `<div class="page-table page-table--skeleton" aria-hidden="true">
    <div class="page-head"><div><input type="checkbox" disabled></div><div>Title</div><div>Category</div><div>Status</div><div>Updated</div><div>Actions</div></div>
    ${Array.from({ length: 6 }).map(() => '<div class="page-row skeleton-row"><div></div><div></div><div></div><div></div><div></div><div></div></div>').join("")}
  </div>`;
}

function formatPageDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function pageUpdatedAt(page) {
  return page.content_updated_at || page.updated_at || page.created_at || null;
}

function renderStatusFilterChips(meta) {
  const host = document.getElementById("statusFilterChips");
  if (!host) return;
  const statuses = Array.isArray(meta && meta.statuses) ? meta.statuses : [];
  const chips = [{ value: "", label: "All" }, ...statuses.map((s) => ({ value: s, label: s }))];
  host.innerHTML = chips
    .map(
      (chip) =>
        `<button type="button" class="status-chip${currentFilters.status === chip.value ? " is-active" : ""}" data-status="${escapeAttr(chip.value)}">${escapeAttr(chip.label)}</button>`
    )
    .join("");
  host.querySelectorAll(".status-chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      currentFilters.status = btn.getAttribute("data-status") || "";
      const stSel = document.getElementById("statusFilter");
      if (stSel) stSel.value = currentFilters.status;
      currentPage = 1;
      loadPageManager();
    });
  });
}

function escapeHtmlText(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderBulkBar() {
  const panel = document.querySelector(".page-list-panel");
  if (!panel) return;
  let bar = document.getElementById("bulkActionBar");
  if (!bar) {
    bar = document.createElement("div");
    bar.id = "bulkActionBar";
    bar.className = "bulk-action-bar";
    document.body.appendChild(bar);
  }
  const count = selectedSlugs.size;
  if (!count) {
    bar.classList.remove("is-visible");
    bar.innerHTML = "";
    return;
  }
  bar.classList.add("is-visible");
  bar.innerHTML = `
    <strong>${count} selected</strong>
    <div class="bulk-action-bar__actions">
      <button type="button" class="bulk-action-btn" id="bulkExportBtn">Export slugs</button>
      <button type="button" class="bulk-action-btn" id="bulkRegenerateBtn" disabled title="Coming soon">Regenerate (soon)</button>
      <button type="button" class="bulk-action-btn bulk-action-btn--danger" id="bulkDeleteBtn">Move to trash</button>
      <button type="button" class="bulk-action-btn" id="bulkClearBtn">Clear</button>
    </div>
  `;
  document.getElementById("bulkClearBtn")?.addEventListener("click", () => {
    selectedSlugs.clear();
    renderPages(activePages);
  });
  document.getElementById("bulkExportBtn")?.addEventListener("click", () => {
    const slugs = Array.from(selectedSlugs);
    const blob = new Blob([slugs.join("\n")], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "selected-slugs.txt";
    a.click();
    URL.revokeObjectURL(a.href);
    window.AdminUI?.toastSuccess(`Exported ${slugs.length} slug(s)`);
  });
  document.getElementById("bulkDeleteBtn")?.addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    const countNow = selectedSlugs.size;
    if (!countNow) return;
    const ok = await (window.AdminUI && window.AdminUI.simpleConfirm
      ? window.AdminUI.simpleConfirm({
          title: "Move pages to trash",
          warnText: "This action cannot be undone",
          details: `You are moving ${countNow} pages to trash. Continue?`
        })
      : Promise.resolve(window.confirm(`You are moving ${countNow} pages to trash. Continue?`)));
    if (!ok) return;
    const slugs = Array.from(selectedSlugs);
    await (window.AdminUI && window.AdminUI.withLoading
      ? window.AdminUI.withLoading(btn, async () => {
          let failed = 0;
          for (const slug of slugs) {
            const data = await window.adminSafeFetch(`/api/admin/pages/${encodeURIComponent(slug)}`, { method: "DELETE" });
            if (!data || !data.success) failed += 1;
          }
          if (failed) {
            window.AdminUI?.toastError(`Deleted ${slugs.length - failed}/${slugs.length}. Some deletions failed.`);
          } else {
            window.AdminUI?.toastSuccess("Action completed successfully");
          }
          selectedSlugs.clear();
          await loadPageManager();
        }, "Deleting...")
      : (async () => {
          for (const slug of slugs) {
            await window.adminSafeFetch(`/api/admin/pages/${encodeURIComponent(slug)}`, { method: "DELETE" });
          }
          selectedSlugs.clear();
          await loadPageManager();
        })());
  });
}

function renderPagination(pagination) {
  const total = Number(pagination.total) || 0;
  totalItemCount = total;
  pageLimit = Number(pagination.limit) || 20;
  totalPageCount = Math.max(1, Number(pagination.totalPages) || 1);
  if (total === 0) totalPageCount = 1;

  const prev = document.getElementById("prevBtn");
  const next = document.getElementById("nextBtn");
  const nums = document.getElementById("pageNumbers");
  const summary = document.getElementById("paginationSummary");
  const nav = document.getElementById("pageManagerPagination");

  if (nav) {
    nav.classList.toggle("is-hidden", total === 0);
  }

  if (summary) {
    if (!total) {
      summary.textContent = "No pages match the current filters.";
    } else {
      const start = (currentPage - 1) * pageLimit + 1;
      const end = Math.min(currentPage * pageLimit, total);
      summary.textContent = `Showing ${start}–${end} of ${total} · Page ${currentPage} of ${totalPageCount}`;
    }
  }

  if (prev) prev.disabled = currentPage <= 1 || total === 0;
  if (next) next.disabled = currentPage >= totalPageCount || total === 0;
  if (!nums) return;
  nums.innerHTML = "";
  if (total === 0 || totalPageCount <= 1) return;

  const maxButtons = 7;
  let startPage = Math.max(1, currentPage - 3);
  let endPage = Math.min(totalPageCount, startPage + maxButtons - 1);
  startPage = Math.max(1, endPage - maxButtons + 1);
  for (let i = startPage; i <= endPage; i++) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = String(i);
    if (i === currentPage) b.classList.add("is-active");
    b.addEventListener("click", () => {
      if (currentPage === i) return;
      currentPage = i;
      loadPageManager({ scrollToTop: true });
    });
    nums.appendChild(b);
  }
}

function scrollPageListIntoView() {
  document.querySelector(".page-list-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function populateFiltersFromMeta(meta) {
  const prevCat = currentFilters.category;
  const prevSt = currentFilters.status;
  const m = meta && typeof meta === "object" ? meta : {};
  const categories = Array.isArray(m.categories) ? m.categories : [];
  const statuses = Array.isArray(m.statuses) ? m.statuses : [];
  const catSel = document.getElementById("categoryFilter");
  if (catSel) {
    catSel.innerHTML = `<option value="">All</option><option value="__notag">No Tag</option>`;
    categories.forEach((cat) => {
      const opt = document.createElement("option");
      opt.value = cat;
      opt.textContent = cat;
      catSel.appendChild(opt);
    });
    const cvals = ["", "__notag", ...categories];
    catSel.value = cvals.includes(prevCat) ? prevCat : "";
    catSel.onchange = (e) => {
      currentFilters.category = e.target.value;
      currentPage = 1;
      loadPageManager();
    };
  }
  const stSel = document.getElementById("statusFilter");
  if (stSel) {
    stSel.innerHTML = `<option value="">All</option>`;
    statuses.forEach((st) => {
      const opt = document.createElement("option");
      opt.value = st;
      opt.textContent = st;
      stSel.appendChild(opt);
    });
    const svals = ["", ...statuses];
    stSel.value = svals.includes(prevSt) ? prevSt : "";
    stSel.onchange = (e) => {
      currentFilters.status = e.target.value;
      currentPage = 1;
      loadPageManager();
    };
  }
}

function renderPages(pages) {
  const box = document.getElementById("pageList");
  if (!box) return;
  if (!pages.length) {
    selectedSlugs.clear();
    renderBulkBar();
    const hasFilters = currentFilters.search || currentFilters.category || currentFilters.status;
    box.innerHTML = hasFilters
      ? "<p>No pages found for current filters.</p>"
      : `<div class="admin-empty-state"><p>No pages yet. Create your first job page.</p><a href="/generator">Create first page</a></div>`;
    return;
  }
  const pageSlugs = pages.map((p) => String(p.slug || "").trim()).filter(Boolean);
  selectedSlugs = new Set(Array.from(selectedSlugs).filter((slug) => pageSlugs.includes(slug)));
  const allSelected = pageSlugs.length > 0 && pageSlugs.every((slug) => selectedSlugs.has(slug));
  box.innerHTML = `<div class="page-table"><div class="page-head"><div><input type="checkbox" id="selectAllPages"${allSelected ? " checked" : ""}></div><div>Title</div><div>Category</div><div>Status</div><div>Updated</div><div>Actions</div></div></div>`;
  const table = box.querySelector(".page-table");
  const frag = document.createDocumentFragment();
  pages.forEach((p) => {
    const row = document.createElement("div");
    row.className = "page-row";
    const url = p.url || "/" + (p.slug || "");
    const slug = p.slug || "";
    const statusLabel = normalizeStatusLabel(p.status);
    const statusClass = getStatusBadgeClass(statusLabel);
    const isChecked = selectedSlugs.has(slug);
    const views = Number(p.views) || 0;
    row.innerHTML = `<div><input type="checkbox" class="row-select" data-slug="${escapeAttr(slug)}"${isChecked ? " checked" : ""}></div><div><span class="page-row-title">${escapeAttr(p.title)}</span><span class="page-row-slug">/${escapeAttr(slug)}</span></div><div>${escapeAttr(p.category || "-")}</div><div><span class="badge ${statusClass}">${escapeAttr(statusLabel)}</span></div><div><span class="page-row-meta">${escapeAttr(formatPageDate(pageUpdatedAt(p)))}</span>${views ? `<span class="page-row-meta">${views} views</span>` : ""}</div><div class="row-actions"></div>`;
    const actions = row.querySelector(".row-actions");
    const edit = document.createElement("a");
    edit.href = "/generator?slug=" + encodeURIComponent(slug);
    edit.className = "row-action-btn--edit";
    edit.textContent = "Edit";
    const view = document.createElement("a");
    view.href = url;
    view.target = "_blank";
    view.rel = "noopener";
    view.className = "row-action-btn--view";
    view.textContent = "View";
    const del = document.createElement("button");
    del.type = "button";
    del.className = "row-action-btn row-action-btn--delete";
    del.textContent = "Trash";
    del.addEventListener("click", async () => {
      await deletePage(slug, del);
    });
    actions.append(edit, view, del);
    frag.appendChild(row);
  });
  table.appendChild(frag);
  document.getElementById("selectAllPages")?.addEventListener("change", (e) => {
    const checked = Boolean(e.target && e.target.checked);
    pageSlugs.forEach((slug) => {
      if (checked) selectedSlugs.add(slug);
      else selectedSlugs.delete(slug);
    });
    renderPages(activePages);
  });
  box.querySelectorAll(".row-select").forEach((cb) => {
    cb.addEventListener("change", (e) => {
      const slug = String(e.target && e.target.getAttribute("data-slug") || "").trim();
      if (!slug) return;
      if (e.target.checked) selectedSlugs.add(slug);
      else selectedSlugs.delete(slug);
      renderPages(activePages);
    });
  });
  renderBulkBar();
}

async function deletePage(slug, triggerEl) {
  const confirmed = await (window.AdminUI && window.AdminUI.simpleConfirm
    ? window.AdminUI.simpleConfirm({
        title: "Move page to trash",
        warnText: "This action cannot be undone",
        details: "Move this page to trash?"
      })
    : Promise.resolve(window.confirm("Move this page to Trash?")));
  if (!confirmed) return;
  const run = async () => {
    const data = await window.adminSafeFetch(`/api/admin/pages/${encodeURIComponent(slug)}`, { method: "DELETE" });
    if (data && data.success) {
      selectedSlugs.delete(slug);
      window.AdminUI?.toastSuccess("Action completed successfully");
      await loadPageManager();
    } else {
      window.AdminUI?.toastError("Something went wrong");
    }
  };
  if (window.AdminUI && window.AdminUI.withLoading && triggerEl) {
    await window.AdminUI.withLoading(triggerEl, run, "Deleting...");
  } else {
    await run();
  }
}

async function loadPageManager(opts = {}) {
  const box = document.getElementById("pageList");
  if (!box) return;
  box.innerHTML = pageListSkeletonHtml();
  const data = await window.adminSafeFetch(`/api/admin/pages?${buildPagesQuery()}`);
  if (!data || !data.success) {
    box.innerHTML = `<p class="dashboard-error">Could not load pages.</p>`;
    renderPagination({ total: 0, totalPages: 0, limit: pageLimit });
    return;
  }
  activePages = data.data || [];
  const pagination = data.pagination || { totalPages: 1, page: 1, total: 0, limit: pageLimit };
  const total = Number(pagination.total) || 0;
  if (activePages.length === 0 && currentPage > 1 && total > 0) {
    currentPage = Math.max(1, currentPage - 1);
    return loadPageManager(opts);
  }
  if (pagination.page) {
    currentPage = Math.max(1, Number(pagination.page) || 1);
  }
  renderPages(activePages);
  populateFiltersFromMeta(data.meta);
  renderStatusFilterChips(data.meta);
  renderPagination(pagination);
  renderBulkBar();
  if (opts.scrollToTop) scrollPageListIntoView();
}

function initSearch() {
  let searchTimer;
  let suggestTimer;
  const searchPageEl = document.getElementById("searchPage");
  const suggestBox = document.getElementById("searchSuggestions");
  if (!searchPageEl) return;
  searchPageEl.addEventListener("input", function () {
    clearTimeout(searchTimer);
    clearTimeout(suggestTimer);
    const raw = this.value;
    const v = raw.trim();
    suggestTimer = setTimeout(async () => {
      if (!suggestBox) return;
      if (v.length < 2) return (suggestBox.innerHTML = "");
      try {
        const res = await fetch(`/api/search-suggest?q=${encodeURIComponent(v)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!Array.isArray(data)) return (suggestBox.innerHTML = "");
        const escQ = v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        suggestBox.innerHTML = data.slice(0, 12).map((item) => {
          const u = (item.url || "#").replace(/"/g, "&quot;");
          const t = String(item.title || "");
          const marked = escQ ? escapeAttr(t).replace(new RegExp(`(${escQ})`, "gi"), "<mark>$1</mark>") : escapeAttr(t);
          return `<div class="suggest-row"><a href="${u}">${marked}</a></div>`;
        }).join("");
      } catch {
        suggestBox.innerHTML = "";
      }
    }, 220);
    searchTimer = setTimeout(() => {
      currentFilters.search = raw.trim();
      currentPage = 1;
      loadPageManager();
    }, 400);
  });
}

document.getElementById("prevBtn")?.addEventListener("click", () => {
  if (currentPage > 1) {
    currentPage--;
    loadPageManager({ scrollToTop: true });
  }
});
document.getElementById("nextBtn")?.addEventListener("click", () => {
  if (currentPage < totalPageCount) {
    currentPage++;
    loadPageManager({ scrollToTop: true });
  }
});
document.getElementById("managerRefreshBtn")?.addEventListener("click", () => loadPageManager());

document.getElementById("sortOrder")?.addEventListener("change", (e) => {
  sortOrder = e.target.value === "asc" ? "asc" : "desc";
  currentPage = 1;
  loadPageManager();
});

initSearch();
loadPageManager();
