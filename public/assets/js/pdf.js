/**
 * Phase 5: PDF notification cards no longer render NEW/IMPORTANT/URGENT badges.
 * Flip to `true` to instantly restore them without redeploy if a regression
 * is reported.
 */
const RENDER_BADGES_IN_PDF = false;

const PDF_ALERTS_PAGE_SIZE = 10;

let pdfAlertsAll = [];
let pdfAlertsQuery = "";
let pdfAlertsPage = 1;
let pdfAlertsTotalPages = 1;
let pdfAlertsLoading = false;

function isPdfAlertsAdminPage() {
  return document.body.classList.contains("admin-alerts-page");
}

function normalizePdfSearchQuery(raw) {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function getFilteredPdfAlerts() {
  const q = normalizePdfSearchQuery(pdfAlertsQuery);
  if (!q) return pdfAlertsAll.slice();
  return pdfAlertsAll.filter((item) => {
    const name = String(item.name || "").toLowerCase();
    const url = String(item.url || "").toLowerCase();
    return name.includes(q) || url.includes(q);
  });
}

function safeUrl(raw) {
  const s = String(raw ?? "").trim();
  if (!s || s === "#") return "#";
  const colonIdx = s.indexOf(":");
  if (colonIdx !== -1) {
    const proto = s.slice(0, colonIdx).toLowerCase();
    if (proto === "javascript" || proto === "data" || proto === "vbscript" || proto === "file") return "#";
  }
  if (/^https?:\/\//i.test(s)) {
    try {
      const u = new URL(s);
      if (u.protocol !== "http:" && u.protocol !== "https:") return "#";
      return u.href;
    } catch {
      return "#";
    }
  }
  if (s.startsWith("//")) return "#";
  if (s.startsWith("/")) return s;
  return "#";
}

function formatRelativeUploadDate(dateStr) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 60 * 1000) return "Just uploaded";
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / (60 * 1000))} min ago`;
  if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / (60 * 60 * 1000))} hr ago`;
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return "";
}

async function copyTextToClipboard(text) {
  const value = String(text || "").trim();
  if (!value) return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    /* fallback below */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = value;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

function showPdfAlertsLoading() {
  const box = document.getElementById("pdfList");
  if (!box || !isPdfAlertsAdminPage()) return;
  box.innerHTML = `
    <div class="pdf-alerts-loading" aria-busy="true" aria-label="Loading PDF alerts">
      ${Array.from({ length: 4 }, () => '<div class="pdf-alert-skeleton"></div>').join("")}
    </div>
  `;
}

function renderPdfAlertsStats(filteredCount) {
  const el = document.getElementById("pdfAlertsStats");
  if (!el || !isPdfAlertsAdminPage()) return;

  const total = pdfAlertsAll.length;
  if (!total) {
    el.hidden = true;
    el.innerHTML = "";
    return;
  }

  const now = Date.now();
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const thisWeek = pdfAlertsAll.filter((p) => new Date(p.date).getTime() >= weekAgo).length;
  const today = pdfAlertsAll.filter((p) => new Date(p.date).getTime() >= dayStart.getTime()).length;
  const q = normalizePdfSearchQuery(pdfAlertsQuery);

  el.hidden = false;
  el.innerHTML = `
    <span class="pdf-stat"><strong>${total}</strong> total</span>
    <span class="pdf-stat"><strong>${thisWeek}</strong> this week</span>
    <span class="pdf-stat"><strong>${today}</strong> today</span>
    ${q && filteredCount !== total ? `<span class="pdf-stat pdf-stat--filter"><strong>${filteredCount}</strong> matching</span>` : ""}
  `;
}

function buildNotifyCard(item) {
  const wrap = document.createElement("div");
  wrap.className = "notify-card";

  const lowerName = String(item.name || "").toLowerCase();
  const isImportant = /important|priority|notice/i.test(lowerName);
  const isUrgent = /urgent|emergency|immediate/i.test(lowerName);
  const isNew = item.date ? Date.now() - new Date(item.date).getTime() < 1000 * 60 * 60 * 24 * 3 : false;
  if (RENDER_BADGES_IN_PDF) {
    if (isUrgent) wrap.classList.add("urgent");
    else if (isImportant) wrap.classList.add("important");
  }

  const top = document.createElement("div");
  top.className = "notify-top";

  const textWrap = document.createElement("div");
  const title = document.createElement("h3");
  title.className = "notify-title";
  title.textContent = item.name || "PDF Notification";

  const date = document.createElement("p");
  date.className = "notify-date";
  const formattedDate = item.date
    ? new Date(item.date).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      })
    : "Date unavailable";
  const relative = formatRelativeUploadDate(item.date);
  date.textContent = relative ? `${formattedDate} · ${relative}` : formattedDate;

  textWrap.appendChild(title);
  textWrap.appendChild(date);

  top.appendChild(textWrap);
  if (RENDER_BADGES_IN_PDF) {
    const badges = document.createElement("div");
    badges.className = "notify-badges";
    if (isNew) badges.innerHTML += `<span class="badge new">NEW</span>`;
    if (isImportant) badges.innerHTML += `<span class="badge important">IMPORTANT</span>`;
    if (isUrgent) badges.innerHTML += `<span class="badge urgent">URGENT</span>`;
    if (badges.innerHTML.trim()) top.appendChild(badges);
  }

  const summary = document.createElement("p");
  summary.className = "notify-summary";
  summary.textContent = "Official update available. Open to preview details or download notification PDF.";

  const actions = document.createElement("div");
  actions.className = "notify-actions";
  const linkUrl = safeUrl(String(item.absoluteUrl || item.url || "").trim() || "#");
  const copyUrl = String(item.absoluteUrl || item.url || linkUrl).trim();

  const viewLink = document.createElement("a");
  viewLink.href = linkUrl;
  viewLink.target = "_blank";
  viewLink.rel = "noopener noreferrer";
  viewLink.className = "action-link view";
  viewLink.textContent = "View";

  const dlLink = document.createElement("a");
  dlLink.href = linkUrl;
  dlLink.target = "_blank";
  dlLink.rel = "noopener noreferrer";
  dlLink.className = "action-link download";
  dlLink.textContent = "Download";
  dlLink.setAttribute("download", item.name || "notification.pdf");

  actions.appendChild(viewLink);
  actions.appendChild(dlLink);

  if (isPdfAlertsAdminPage()) {
    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "action-link copy";
    copyBtn.textContent = "Copy link";
    copyBtn.addEventListener("click", async () => {
      const ok = await copyTextToClipboard(copyUrl);
      copyBtn.textContent = ok ? "Copied!" : "Copy failed";
      setTimeout(() => {
        copyBtn.textContent = "Copy link";
      }, 1600);
    });
    actions.appendChild(copyBtn);
  }

  wrap.appendChild(top);
  wrap.appendChild(summary);
  wrap.appendChild(actions);
  return wrap;
}

function renderPdfAlertsPagination(total) {
  if (!isPdfAlertsAdminPage()) return;

  const nav = document.getElementById("pdfAlertsPagination");
  const summary = document.getElementById("pdfPaginationSummary");
  const prev = document.getElementById("pdfPrevBtn");
  const next = document.getElementById("pdfNextBtn");
  const nums = document.getElementById("pdfPageNumbers");
  const hasCatalog = pdfAlertsAll.length > 0;
  const q = normalizePdfSearchQuery(pdfAlertsQuery);

  if (nav) nav.classList.toggle("is-hidden", !hasCatalog);

  if (summary) {
    if (!hasCatalog) {
      summary.textContent = "No PDF alerts uploaded yet.";
    } else if (!total && q) {
      summary.textContent = `No results for "${pdfAlertsQuery.trim()}".`;
    } else {
      const start = (pdfAlertsPage - 1) * PDF_ALERTS_PAGE_SIZE + 1;
      const end = Math.min(pdfAlertsPage * PDF_ALERTS_PAGE_SIZE, total);
      const filterNote = q ? ` · filtered from ${pdfAlertsAll.length}` : "";
      summary.textContent = `Showing ${start}–${end} of ${total}${filterNote} · Page ${pdfAlertsPage} of ${pdfAlertsTotalPages}`;
    }
  }

  if (prev) prev.disabled = pdfAlertsPage <= 1 || total === 0;
  if (next) next.disabled = pdfAlertsPage >= pdfAlertsTotalPages || total === 0;

  if (!nums) return;
  nums.innerHTML = "";
  if (total === 0 || pdfAlertsTotalPages <= 1) return;

  const maxButtons = 7;
  let startPage = Math.max(1, pdfAlertsPage - 3);
  let endPage = Math.min(pdfAlertsTotalPages, startPage + maxButtons - 1);
  startPage = Math.max(1, endPage - maxButtons + 1);

  for (let i = startPage; i <= endPage; i++) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = String(i);
    if (i === pdfAlertsPage) b.classList.add("is-active");
    b.addEventListener("click", () => {
      if (pdfAlertsPage === i) return;
      pdfAlertsPage = i;
      renderPdfAlertsPage();
    });
    nums.appendChild(b);
  }
}

function getVisiblePdfSlice(filtered) {
  if (!isPdfAlertsAdminPage()) return filtered;
  const start = (pdfAlertsPage - 1) * PDF_ALERTS_PAGE_SIZE;
  return filtered.slice(start, start + PDF_ALERTS_PAGE_SIZE);
}

function renderPdfAlertsPage(opts = {}) {
  const box = document.getElementById("pdfList");
  if (!box) return;

  const filtered = getFilteredPdfAlerts();
  const total = filtered.length;
  const q = normalizePdfSearchQuery(pdfAlertsQuery);
  const isAdmin = isPdfAlertsAdminPage();

  if (isAdmin) {
    pdfAlertsTotalPages = Math.max(1, Math.ceil(total / PDF_ALERTS_PAGE_SIZE) || 1);
    if (pdfAlertsPage > pdfAlertsTotalPages) pdfAlertsPage = pdfAlertsTotalPages;
  }

  renderPdfAlertsStats(total);

  if (!pdfAlertsAll.length) {
    box.innerHTML = isAdmin
      ? `
      <div class="empty-state">
        <div class="icon">🔔</div>
        <h3>No notifications available</h3>
        <p>Upload a PDF from the Upload page and it will appear here automatically.</p>
        <a href="/upload" class="pdf-alerts-empty-cta">Go to Upload PDF</a>
      </div>
    `
      : `
      <div class="empty-state">
        <div class="icon">🔔</div>
        <h3>No notifications available</h3>
        <p>New updates will appear here once uploaded.</p>
      </div>
    `;
    renderPdfAlertsPagination(0);
    return;
  }

  if (!total && q) {
    box.innerHTML = `
      <div class="empty-state">
        <div class="icon">🔍</div>
        <h3>No matching PDFs</h3>
        <p>Try another name or clear the search box.</p>
      </div>
    `;
    renderPdfAlertsPagination(0);
    return;
  }

  const slice = getVisiblePdfSlice(filtered);

  box.innerHTML = "";
  const frag = document.createDocumentFragment();
  slice.forEach((item) => frag.appendChild(buildNotifyCard(item)));
  box.appendChild(frag);

  renderPdfAlertsPagination(total);
  if (isAdmin && !opts.skipScroll) {
    box.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}

function syncPdfSearchClearButton() {
  const input = document.getElementById("pdfAlertsSearch");
  const clearBtn = document.getElementById("pdfAlertsSearchClear");
  if (!input || !clearBtn) return;
  clearBtn.classList.toggle("is-hidden", !input.value.trim());
}

function wirePdfAlertsSearch() {
  const input = document.getElementById("pdfAlertsSearch");
  if (!input) return;

  let debounceTimer = null;
  input.addEventListener("input", () => {
    pdfAlertsQuery = input.value;
    pdfAlertsPage = 1;
    syncPdfSearchClearButton();
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      renderPdfAlertsPage({ skipScroll: true });
    }, 180);
  });

  input.addEventListener("search", () => {
    pdfAlertsQuery = input.value;
    pdfAlertsPage = 1;
    syncPdfSearchClearButton();
    renderPdfAlertsPage();
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && input.value) {
      input.value = "";
      pdfAlertsQuery = "";
      pdfAlertsPage = 1;
      syncPdfSearchClearButton();
      renderPdfAlertsPage({ skipScroll: true });
    }
  });

  document.getElementById("pdfAlertsSearchClear")?.addEventListener("click", () => {
    input.value = "";
    pdfAlertsQuery = "";
    pdfAlertsPage = 1;
    syncPdfSearchClearButton();
    input.focus();
    renderPdfAlertsPage({ skipScroll: true });
  });
}

function wirePdfAlertsPagination() {
  document.getElementById("pdfPrevBtn")?.addEventListener("click", () => {
    if (pdfAlertsPage <= 1) return;
    pdfAlertsPage -= 1;
    renderPdfAlertsPage();
  });
  document.getElementById("pdfNextBtn")?.addEventListener("click", () => {
    if (pdfAlertsPage >= pdfAlertsTotalPages) return;
    pdfAlertsPage += 1;
    renderPdfAlertsPage();
  });
}

function wirePdfAlertsRefresh() {
  const btn = document.getElementById("pdfAlertsRefresh");
  if (!btn) return;

  btn.addEventListener("click", () => {
    if (pdfAlertsLoading) return;
    loadNotifications({ forceRefresh: true });
  });
}

async function loadNotifications(opts = {}) {
  const box = document.getElementById("pdfList");
  if (!box) return;

  if (pdfAlertsLoading) return;
  pdfAlertsLoading = true;

  const refreshBtn = document.getElementById("pdfAlertsRefresh");
  if (refreshBtn) {
    refreshBtn.disabled = true;
    refreshBtn.classList.add("is-loading");
  }

  if (opts.forceRefresh || !pdfAlertsAll.length) {
    showPdfAlertsLoading();
  }

  try {
    const res = await fetch("/api/public/notifications", { cache: "no-store" });
    if (!res.ok) {
      box.innerHTML = '<div class="empty-state"><div class="icon">⚠️</div><h3>Could not load notifications</h3><p>Please refresh and try again.</p></div>';
      renderPdfAlertsPagination(0);
      return;
    }
    const body = await res.json();
    pdfAlertsAll = (body && body.data) || [];
    if (!opts.keepPage) pdfAlertsPage = 1;
    renderPdfAlertsPage({ skipScroll: true });
  } catch (e) {
    console.error(e);
    box.innerHTML = `
      <div class="empty-state">
        <div class="icon">⚠️</div>
        <h3>Error loading notifications</h3>
        <p>Please try again after refreshing the page.</p>
      </div>
    `;
    renderPdfAlertsPagination(0);
  } finally {
    pdfAlertsLoading = false;
    if (refreshBtn) {
      refreshBtn.disabled = false;
      refreshBtn.classList.remove("is-loading");
    }
    syncPdfSearchClearButton();
    window.AdminPageToolbar?.markUpdated?.();
  }
}

wirePdfAlertsPagination();
wirePdfAlertsSearch();
wirePdfAlertsRefresh();
window.adminPageRefreshHandler = () => loadNotifications({ forceRefresh: true });
loadNotifications();
