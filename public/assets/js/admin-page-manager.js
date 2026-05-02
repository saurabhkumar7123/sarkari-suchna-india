let activePages = [];
let currentPage = 1;
let totalPageCount = 1;
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
    <div class="page-head"><div><input type="checkbox" disabled></div><div>Title</div><div>Category</div><div>Status</div><div>Actions</div></div>
    ${Array.from({ length: 6 }).map(() => '<div class="page-row skeleton-row"><div></div><div></div><div></div><div></div><div></div></div>').join("")}
  </div>`;
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
    bar.style.display = "none";
    bar.style.marginBottom = "10px";
    bar.style.padding = "10px";
    bar.style.border = "1px solid #cbd5e1";
    bar.style.borderRadius = "10px";
    bar.style.background = "var(--surface-soft, #f8fafc)";
    panel.insertBefore(bar, document.getElementById("pageList"));
  }
  const count = selectedSlugs.size;
  if (!count) {
    bar.style.display = "none";
    bar.innerHTML = "";
    return;
  }
  bar.style.display = "flex";
  bar.style.alignItems = "center";
  bar.style.justifyContent = "space-between";
  bar.innerHTML = `
    <strong>${count} selected</strong>
    <button type="button" id="bulkDeleteBtn" style="border:1px solid #dc2626;background:#dc2626;color:#fff;border-radius:8px;padding:7px 10px;cursor:pointer;">Delete Selected</button>
  `;
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
  totalPageCount = pagination.totalPages || 1;
  const prev = document.getElementById("prevBtn");
  const next = document.getElementById("nextBtn");
  const nums = document.getElementById("pageNumbers");
  if (prev) prev.disabled = currentPage <= 1;
  if (next) next.disabled = currentPage >= totalPageCount;
  if (!nums) return;
  nums.innerHTML = "";
  const maxButtons = 7;
  let start = Math.max(1, currentPage - 3);
  let end = Math.min(totalPageCount, start + maxButtons - 1);
  start = Math.max(1, end - maxButtons + 1);
  for (let i = start; i <= end; i++) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = String(i);
    if (i === currentPage) b.classList.add("is-active");
    b.addEventListener("click", () => {
      currentPage = i;
      loadPageManager();
    });
    nums.appendChild(b);
  }
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
    box.innerHTML = "<p>No pages found for current filters.</p>";
    return;
  }
  const pageSlugs = pages.map((p) => String(p.slug || "").trim()).filter(Boolean);
  selectedSlugs = new Set(Array.from(selectedSlugs).filter((slug) => pageSlugs.includes(slug)));
  const allSelected = pageSlugs.length > 0 && pageSlugs.every((slug) => selectedSlugs.has(slug));
  box.innerHTML = `<div class="page-table"><div class="page-head"><div><input type="checkbox" id="selectAllPages"${allSelected ? " checked" : ""}></div><div>Title</div><div>Category</div><div>Status</div><div>Actions</div></div></div>`;
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
    row.innerHTML = `<div><input type="checkbox" class="row-select" data-slug="${escapeAttr(slug)}"${isChecked ? " checked" : ""}></div><div>${escapeAttr(p.title)}</div><div>${escapeAttr(p.category || "-")}</div><div><span class="badge ${statusClass}">${escapeAttr(statusLabel)}</span></div><div class="row-actions"></div>`;
    const actions = row.querySelector(".row-actions");
    const edit = document.createElement("a");
    edit.href = "#";
    edit.textContent = "Edit";
    edit.addEventListener("click", (e) => {
      e.preventDefault();
      window.location.href = "/generator?slug=" + encodeURIComponent(slug);
    });
    const view = document.createElement("a");
    view.href = url;
    view.target = "_blank";
    view.rel = "noopener";
    view.textContent = "View";
    const del = document.createElement("a");
    del.href = "#";
    del.textContent = "Delete";
    del.addEventListener("click", async (e) => {
      e.preventDefault();
      await deletePage(slug, del);
    });
    actions.append(edit, document.createTextNode(" "), view, document.createTextNode(" "), del);
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

async function loadPageManager() {
  const box = document.getElementById("pageList");
  if (!box) return;
  box.innerHTML = pageListSkeletonHtml();
  const data = await window.adminSafeFetch(`/api/admin/pages?${buildPagesQuery()}`);
  if (!data || !data.success) {
    box.innerHTML = `<p class="dashboard-error">Could not load pages.</p>`;
    return;
  }
  activePages = data.data || [];
  renderPages(activePages);
  populateFiltersFromMeta(data.meta);
  renderPagination(data.pagination || { totalPages: 1, page: 1 });
  renderBulkBar();
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
    loadPageManager();
  }
});
document.getElementById("nextBtn")?.addEventListener("click", () => {
  if (currentPage < totalPageCount) {
    currentPage++;
    loadPageManager();
  }
});
document.getElementById("managerRefreshBtn")?.addEventListener("click", () => loadPageManager());

initSearch();
loadPageManager();
