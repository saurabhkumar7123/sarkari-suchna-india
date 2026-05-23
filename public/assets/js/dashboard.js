// ================= SAFE FETCH =================
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
    const res = await fetch(url, {
      credentials: "include",
      ...options,
      headers: hdrs
    });

    if (!res.ok) {
      console.error("API Error:", res.status, url);
      return null;
    }

    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) return await res.json();
    return await res.text();
  } catch (err) {
    console.error("Fetch error:", url, err);
    return null;
  }
}

function goPage(path) {
  window.location.href = path;
}

window.logout = async function () {
  await safeFetch("/api/admin/logout", { method: "POST" });
  window.location.href = "/login";
};

let activePages = [];
let currentPage = 1;
let totalPageCount = 1;
let sortOrder = "desc";
let lastDashboardStats = null;
let monitoringSites = [];
let dashboardAutoRefreshTimer = null;
let monitorActionInFlight = false;
const ADMIN_METRICS_KEY = "adminUxMetrics_v1";

let currentFilters = {
  search: "",
  category: "",
  status: ""
};

const dashboardMobileMq = window.matchMedia("(max-width: 768px)");
let sidebarBackdropEl = null;

function isMobileSidebarMode() {
  return dashboardMobileMq.matches;
}

function ensureSidebarBackdrop() {
  if (sidebarBackdropEl && document.body.contains(sidebarBackdropEl)) return sidebarBackdropEl;
  const el = document.createElement("div");
  el.id = "dashboardSidebarBackdrop";
  el.className = "dashboard-sidebar-backdrop";
  el.setAttribute("aria-hidden", "true");
  el.addEventListener("click", () => setSidebarOpen(false));
  document.body.appendChild(el);
  sidebarBackdropEl = el;
  return sidebarBackdropEl;
}

function setSidebarOpen(open) {
  const sidebar = document.getElementById("sidebar");
  if (!sidebar) return;
  const isOpen = Boolean(open);
  sidebar.classList.toggle("active", isOpen);
  document.body.classList.toggle("dashboard-sidebar-open", isOpen && isMobileSidebarMode());
  if (isMobileSidebarMode()) {
    const backdrop = ensureSidebarBackdrop();
    backdrop.classList.toggle("active", isOpen);
  } else if (sidebarBackdropEl) {
    sidebarBackdropEl.classList.remove("active");
    document.body.classList.remove("dashboard-sidebar-open");
  }
}

function toggleSidebar() {
  const sidebar = document.getElementById("sidebar");
  if (!sidebar) return;
  setSidebarOpen(!sidebar.classList.contains("active"));
}

function toggleSidebarCollapsed() {
  const sidebar = document.getElementById("sidebar");
  if (!sidebar) return;
  sidebar.classList.toggle("collapsed");
  document.body.classList.toggle("sidebar-collapsed", sidebar.classList.contains("collapsed"));
  localStorage.setItem("dashboardSidebarCollapsed", sidebar.classList.contains("collapsed") ? "1" : "0");
}

function applySidebarStateFromStorage() {
  const sidebar = document.getElementById("sidebar");
  if (!sidebar) return;
  if (localStorage.getItem("dashboardSidebarCollapsed") === "1") {
    sidebar.classList.add("collapsed");
    document.body.classList.add("sidebar-collapsed");
  }
}

function markActiveSidebarLink() {
  const links = Array.from(document.querySelectorAll("#sidebar a"));
  const path = window.location.pathname.toLowerCase();
  links.forEach((a) => {
    const href = (a.getAttribute("href") || "").toLowerCase();
    if (href && href !== "#" && (href === path || (href === "/dashboard" && path === "/"))) {
      a.classList.add("active");
    } else {
      a.classList.remove("active");
    }
  });
}

function toggleDarkMode() {
  document.body.classList.toggle("dark");
  localStorage.setItem("darkMode", document.body.classList.contains("dark"));
}

if (localStorage.getItem("darkMode") === "true") {
  document.body.classList.add("dark");
}

function escapeAttr(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

function normalizeStatusLabel(status) {
  const label = String(status || "").trim();
  return label || "unknown";
}

function getDashboardStatusBadgeClass(status) {
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

function ensureSortUi() {
  if (document.getElementById("sortOrderDash")) return;
  const st = document.getElementById("statusFilter");
  if (!st || !st.parentNode) return;
  const wrap = document.createElement("span");
  wrap.id = "sortOrderWrapDash";
  wrap.className = "filter-group sort-group";
  const lab = document.createElement("label");
  lab.textContent = "Sort:";
  lab.setAttribute("for", "sortOrderDash");
  const sel = document.createElement("select");
  sel.id = "sortOrderDash";
  [["desc", "Latest"], ["asc", "Oldest"]].forEach(([v, t]) => {
    const o = document.createElement("option");
    o.value = v;
    o.textContent = t;
    sel.appendChild(o);
  });
  sel.value = sortOrder;
  sel.addEventListener("change", () => {
    sortOrder = sel.value;
    currentPage = 1;
    loadDashboard();
  });
  wrap.appendChild(lab);
  wrap.appendChild(sel);
  st.parentNode.insertBefore(wrap, st.nextSibling);
}

async function loadStatsCards() {
  const res = await safeFetch("/api/admin/dashboard");
  if (!res || !res.success || !res.data) {
    lastDashboardStats = null;
    return;
  }
  const d = res.data;
  lastDashboardStats = d;
  const set = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.textContent = v;
  };
  set("totalPages", d.totalPages ?? 0);
  set("smallPages", d.smallPages ?? 0);
  set("trashPages", d.trashPages ?? 0);
  set("totalViews", d.totalViews ?? 0);
  set("todayViews", d.todayViews ?? 0);
  set("totalCategories", d.totalCategories ?? 0);
  set("liveVisitors", d.liveVisitors ?? 0);
  loadAdminUxMetrics();
}

function loadAdminUxMetrics() {
  let metrics = { publishesSuccess: 0, actionsFailed: 0 };
  try {
    const raw = localStorage.getItem(ADMIN_METRICS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      metrics = {
        publishesSuccess: Number(parsed && parsed.publishesSuccess) || 0,
        actionsFailed: Number(parsed && parsed.actionsFailed) || 0
      };
    }
  } catch {
    // ignore local metrics parse errors
  }
  const pendingDrafts = Number(localStorage.getItem("generatorPendingDrafts") || "0") > 0 ? 1 : 0;
  const set = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = String(value);
  };
  set("successfulPublishes", metrics.publishesSuccess);
  set("failedActions", metrics.actionsFailed);
  set("pendingDrafts", pendingDrafts);
}

function formatActivityEntry(e) {
  if (e == null) return "";
  if (typeof e === "string") return escapeAttr(e);
  if (typeof e === "object") {
    const msg = e.message || e.action || e.type || e.slug || "";
    const t = e.at || e.time || e.ts || "";
    const line = [String(msg), t ? String(t) : ""].filter(Boolean).join(" — ");
    return escapeAttr(line || JSON.stringify(e));
  }
  return escapeAttr(String(e));
}

async function loadActivityLog() {
  let res = await safeFetch("/api/admin/activity");
  if (!res || !res.success) {
    res = await safeFetch("/api/activity-log");
  }
  const box = document.getElementById("activityLog");
  if (!box) return;
  const logs = res && res.success ? res.data || [] : [];
  if (!logs.length) {
    box.innerHTML = "<p class=\"activity-empty\">No recent activity yet. Actions you perform will appear here.</p>";
    return;
  }
  box.innerHTML = logs
    .slice(0, 15)
    .map((e) => `<div class="page-item activity-row">${formatActivityEntry(e)}</div>`)
    .join("");
}

async function loadLatestAndTrending() {
  const [latestRes, topRes] = await Promise.all([
    safeFetch("/api/admin/pages?page=1&limit=8&sort=desc"),
    safeFetch("/api/top-views")
  ]);

  const latestBox = document.getElementById("latestPages");
  if (latestBox && latestRes && latestRes.success) {
    const rows = latestRes.data || [];
    latestBox.innerHTML = rows.length
      ? rows
          .map((p) => {
            const href = p.slug ? `/${escapeAttr(p.slug)}` : escapeAttr(p.url || "#");
            return `<div class="page-item"><a href="${href}" target="_blank" rel="noopener">${escapeAttr(p.title)}</a></div>`;
          })
          .join("")
      : "<p>No pages yet. Create your first page from the Page Generator.</p>";
  }

  const topBox = document.getElementById("topPage");
  const trendBox = document.getElementById("trendingPages");
  const topToday = document.getElementById("topTodayPages");
  const list = topRes && topRes.success ? topRes.data || [] : [];

  if (topBox) {
    const first = list[0];
    topBox.innerHTML = first
      ? `<div class="page-item"><a href="/${escapeAttr(first.slug)}" target="_blank" rel="noopener">${escapeAttr(first.title)}</a> <small>(${first.views || 0} views)</small></div>`
      : "<p>No view data yet. Publish pages to start collecting insights.</p>";
  }
  const trendHtml =
    list.length > 0
      ? list
          .slice(0, 6)
          .map(
            (p) =>
              `<div class="page-item"><a href="/${escapeAttr(p.slug)}" target="_blank" rel="noopener">${escapeAttr(p.title)}</a></div>`
          )
          .join("")
      : "<p>No trending pages yet. Publish and share pages to build traffic.</p>";
  if (trendBox) trendBox.innerHTML = trendHtml;
  if (topToday) topToday.innerHTML = trendHtml;

  const kw = document.getElementById("trendingKeywords");
  if (kw) kw.innerHTML = "<p>—</p>";
}

async function checkServerHealth() {
  const setEl = (id, ok, label) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = label;
    el.style.color = ok ? "#16a34a" : "#dc2626";
  };

  const health = await safeFetch("/health");
  const ready = await safeFetch("/ready");
  const apiOk = health && health.status === "ok";
  const dbOk = ready && (ready.database === true || ready.status === "ready");

  setEl("healthServer", apiOk, apiOk ? "Online" : "Down");
  setEl("healthDb", dbOk, dbOk ? "Connected" : "Unreachable");
  setEl("healthApi", apiOk, apiOk ? "Working" : "Error");
}

function setMonitoringMessage(message, type = "") {
  const el = document.getElementById("monitoringMessage");
  if (!el) return;
  el.classList.remove("is-error", "is-success");
  if (type === "error") el.classList.add("is-error");
  if (type === "success") el.classList.add("is-success");
  el.textContent = message || "";
}

function formatMonitorTime(value) {
  if (!value) return "Never";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Never";
  const diffMs = Date.now() - d.getTime();
  if (diffMs < 0) return d.toLocaleString();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} day${day === 1 ? "" : "s"} ago`;
  return d.toLocaleString();
}

function renderSitesTable(data) {
  const host = document.getElementById("sitesTable");
  if (!host) return;
  if (!Array.isArray(data) || data.length === 0) {
    host.innerHTML = '<p class="empty-msg">No monitored sites found. Add sites to start automated monitoring.</p>';
    return;
  }

  host.innerHTML = `
    <div class="monitor-table">
      <div class="monitor-head">
        <div>Site</div>
        <div>Status</div>
        <div>Priority</div>
        <div>Last Checked</div>
        <div>Actions</div>
      </div>
    </div>
  `;

  const table = host.querySelector(".monitor-table");
  const frag = document.createDocumentFragment();
  data.forEach((site) => {
    const row = document.createElement("div");
    row.className = "monitor-row";
    const isActive = Number(site && site.active) === 1;
    const isBroken = Number(site && site.broken) === 1;
    const statusText = isBroken ? "⚠️ Broken" : isActive ? "✅ Active" : "⏸ Disabled";
    const statusClass = isBroken ? "is-broken" : isActive ? "is-active" : "is-disabled";
    const lastCheckedAt =
      (site &&
        (site.lastCheckedAt ||
          site.last_checked_at ||
          site.lastChecked ||
          site.checkedAt)) ||
      null;
    const lastCheckedText = lastCheckedAt ? formatMonitorTime(lastCheckedAt) : "Not available";
    row.innerHTML = `
      <div class="monitor-site">
        <strong>${escapeAttr(site && site.name ? site.name : "Unnamed Site")}</strong>
        <span class="monitor-site-url">${escapeAttr(site && site.url ? site.url : "")}</span>
      </div>
      <div><span class="monitor-status ${statusClass}"><span class="monitor-status-dot"></span>${statusText}</span></div>
      <div>${Number(site && site.priority) || 1}</div>
      <div>${escapeAttr(lastCheckedText)}</div>
      <div class="monitor-row-actions">
        <button type="button" data-action="restore-site" data-site-id="${Number(site.id) || 0}">Restore</button>
        <button type="button" data-action="disable-site" data-site-id="${Number(site.id) || 0}">Disable</button>
      </div>
    `;
    frag.appendChild(row);
  });
  table.appendChild(frag);
}

async function loadSites() {
  const host = document.getElementById("sitesTable");
  if (host) host.innerHTML = '<p class="empty-msg">Loading monitored sites...</p>';
  setMonitoringMessage("Loading monitoring data...");

  const res = await safeFetch("/api/admin/sites");
  if (!res || !res.success || !Array.isArray(res.data)) {
    monitoringSites = [];
    ["totalSites", "activeSites", "brokenSites"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.textContent = "0";
    });
    renderSitesTable([]);
    setMonitoringMessage("Failed to load monitored sites.", "error");
    return;
  }

  monitoringSites = res.data;
  const totalSites = monitoringSites.length;
  const activeSites = monitoringSites.filter((s) => Number(s && s.active) === 1).length;
  const brokenSites = monitoringSites.filter((s) => Number(s && s.broken) === 1).length;

  const set = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = String(value);
  };
  set("totalSites", totalSites);
  set("activeSites", activeSites);
  set("brokenSites", brokenSites);

  renderSitesTable(monitoringSites);
  setMonitoringMessage(`Loaded ${totalSites} monitored site${totalSites === 1 ? "" : "s"}.`, "success");
}

async function loadQueueStatus() {
  const res = await safeFetch("/api/admin/queue/status");
  const set = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = String(value);
  };
  if (!res || !res.success || !res.data) {
    set("queueWaiting", 0);
    set("queueActive", 0);
    set("queueFailed", 0);
    return;
  }
  set("queueWaiting", Number(res.data.waiting) || 0);
  set("queueActive", Number(res.data.active) || 0);
  set("queueFailed", Number(res.data.failed) || 0);
}

function renderQueueFailedList(items) {
  const box = document.getElementById("queueFailedList");
  if (!box) return;
  if (!Array.isArray(items) || items.length === 0) {
    box.innerHTML = '<p class="empty-msg">No failed queue jobs. Queue is healthy.</p>';
    return;
  }
  box.innerHTML = items
    .slice(0, 30)
    .map((item) => {
      const site = escapeAttr(item && item.siteName ? item.siteName : "Unknown site");
      const err = escapeAttr(item && item.error ? item.error : "unknown error");
      const ts = formatMonitorTime(item && item.timestamp ? item.timestamp : null);
      return `<div class="page-item"><span><strong>${site}</strong> - ${err}</span><small>${escapeAttr(ts)}</small></div>`;
    })
    .join("");
}

async function loadQueueFailedJobs() {
  const res = await safeFetch("/api/admin/queue/failed?limit=30");
  if (!res || !res.success || !Array.isArray(res.data)) {
    renderQueueFailedList([]);
    return;
  }
  renderQueueFailedList(res.data);
}

async function restoreSiteById(siteId) {
  if (!Number.isFinite(siteId) || siteId <= 0) return;
  if (monitorActionInFlight) return;
  monitorActionInFlight = true;
  const btn = document.querySelector(`button[data-action="restore-site"][data-site-id="${siteId}"]`);
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Restoring...";
  }
  setMonitoringMessage("Restoring site...");
  const res = await safeFetch(`/api/admin/sites/${siteId}/restore`, { method: "PATCH" });
  if (!res || !res.success) {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Restore";
    }
    monitorActionInFlight = false;
    setMonitoringMessage("Restore failed.", "error");
    return;
  }
  setMonitoringMessage("Site restored successfully.", "success");
  await loadSites();
  monitorActionInFlight = false;
}

async function disableSiteById(siteId) {
  if (!Number.isFinite(siteId) || siteId <= 0) return;
  if (!window.confirm("Disable this site? Monitoring checks will stop for it until restored.")) return;
  if (monitorActionInFlight) return;
  monitorActionInFlight = true;
  const btn = document.querySelector(`button[data-action="disable-site"][data-site-id="${siteId}"]`);
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Disabling...";
  }
  setMonitoringMessage("Disabling site...");
  const res = await safeFetch(`/api/admin/sites/${siteId}/disable`, { method: "POST" });
  if (!res || !res.success) {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Disable";
    }
    monitorActionInFlight = false;
    setMonitoringMessage("Disable failed.", "error");
    return;
  }
  setMonitoringMessage("Site disabled successfully.", "success");
  await loadSites();
  monitorActionInFlight = false;
}

function startDashboardAutoRefresh() {
  if (dashboardAutoRefreshTimer) return;
  dashboardAutoRefreshTimer = setInterval(() => {
    if (document.hidden) return;
    // Keep UI stable: refresh only lightweight live areas.
    loadStatsCards();
    loadSites();
    loadQueueStatus();
    loadQueueFailedJobs();
  }, 30000);
}

async function runManualMonitoringCheck() {
  const btn = document.getElementById("runCheckBtn");
  if (btn) btn.disabled = true;
  if (btn) btn.textContent = "⏳ Running...";
  const before = Array.isArray(monitoringSites) ? monitoringSites.length : 0;
  setMonitoringMessage("Triggering manual check...");
  const res = await safeFetch("/api/admin/run-check", { method: "POST" });
  if (btn) {
    btn.disabled = false;
    btn.textContent = "▶ Run Check";
  }
  if (!res || !res.success) {
    setMonitoringMessage("Manual check failed to trigger.", "error");
    return;
  }
  await loadSites();
  await loadQueueStatus();
  await loadQueueFailedJobs();
  const after = Array.isArray(monitoringSites) ? monitoringSites.length : 0;
  setMonitoringMessage(`Manual check completed. Sites loaded: ${after} (previous: ${before}).`, "success");
}

async function retryFailedQueueJobs() {
  const btn = document.getElementById("retryFailedBtn");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Retrying...";
  }
  setMonitoringMessage("Retrying failed queue jobs...");
  const res = await safeFetch("/api/admin/queue/retry", { method: "POST" });
  if (btn) {
    btn.disabled = false;
    btn.textContent = "♻ Retry Failed";
  }
  if (!res || !res.success) {
    setMonitoringMessage("Retry failed jobs action failed.", "error");
    return;
  }
  const retried = res.data && Number.isFinite(Number(res.data.retried)) ? Number(res.data.retried) : 0;
  setMonitoringMessage(`Retried ${retried} failed job${retried === 1 ? "" : "s"}.`, "success");
  await Promise.all([loadQueueStatus(), loadQueueFailedJobs()]);
}

async function clearQueueJobs() {
  if (!window.confirm("Clear waiting and failed queue jobs? Active jobs are not interrupted.")) return;
  const btn = document.getElementById("clearQueueBtn");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Clearing...";
  }
  setMonitoringMessage("Clearing queue jobs...");
  const res = await safeFetch("/api/admin/queue/clear", { method: "POST" });
  if (btn) {
    btn.disabled = false;
    btn.textContent = "🧹 Clear Queue";
  }
  if (!res || !res.success) {
    setMonitoringMessage("Clear queue action failed.", "error");
    return;
  }
  const waiting = res.data && Number.isFinite(Number(res.data.clearedWaiting)) ? Number(res.data.clearedWaiting) : 0;
  const failed = res.data && Number.isFinite(Number(res.data.clearedFailed)) ? Number(res.data.clearedFailed) : 0;
  setMonitoringMessage(`Queue cleared. Waiting: ${waiting}, Failed: ${failed}.`, "success");
  await Promise.all([loadQueueStatus(), loadQueueFailedJobs()]);
}

function renderChartsFromPages(pages, stats) {
  const counts = {};
  pages.forEach((p) => {
    const st = String(p.status || "unknown").trim().toLowerCase() || "unknown";
    counts[st] = (counts[st] || 0) + 1;
  });

  if (window.statusChart) window.statusChart.destroy();
  const statusEl = document.getElementById("statusChart");
  if (statusEl && typeof Chart !== "undefined") {
    window.statusChart = new Chart(statusEl, {
      type: "bar",
      data: {
        labels: Object.keys(counts),
        datasets: [
          {
            label: "Pages by status",
            data: Object.values(counts),
            backgroundColor: "rgba(37,99,235,0.6)"
          }
        ]
      },
      options: { responsive: true, plugins: { legend: { display: false } } }
    });
  }

  const top = [...pages].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 8);
  if (window.viewsChart) window.viewsChart.destroy();
  const viewsEl = document.getElementById("viewsChart");
  if (viewsEl && typeof Chart !== "undefined") {
    window.viewsChart = new Chart(viewsEl, {
      type: "bar",
      data: {
        labels: top.map((p) => (p.title || p.slug || "").slice(0, 22)),
        datasets: [
          {
            label: "Views",
            data: top.map((p) => p.views || 0),
            backgroundColor: "rgba(16,185,129,0.6)"
          }
        ]
      },
      options: { indexAxis: "y", responsive: true, plugins: { legend: { display: false } } }
    });
  }

  if (window.trafficChart) window.trafficChart.destroy();
  const trEl = document.getElementById("trafficChart");
  if (trEl && typeof Chart !== "undefined") {
    const hours = Array.from({ length: 24 }, (_, i) => `${i}h`);
    const tv = stats && typeof stats.todayViews === "number" ? stats.todayViews : 0;
    const perHour = tv > 0 ? Math.max(1, Math.round(tv / 24)) : 0;
    const data24 = hours.map((_, i) => (i < 12 ? perHour : Math.round(perHour * 0.7)));
    window.trafficChart = new Chart(trEl, {
      type: "line",
      data: {
        labels: hours,
        datasets: [
          {
            label: tv ? "Estimated hourly traffic (derived from today views)" : "No view data — estimated chart unavailable",
            data: tv ? data24 : hours.map(() => 0),
            borderColor: "rgba(99,102,241,0.8)",
            tension: 0.3
          }
        ]
      },
      options: { responsive: true, plugins: { legend: { display: true } } }
    });
  }
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
      loadDashboard();
    });
    nums.appendChild(b);
  }
}

window.prevPage = function () {
  if (currentPage > 1) {
    currentPage--;
    loadDashboard();
  }
};

window.nextPage = function () {
  if (currentPage < totalPageCount) {
    currentPage++;
    loadDashboard();
  }
};

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
      loadDashboard();
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
      loadDashboard();
    };
  }
}

function pageListSkeletonHtml() {
  return `<div class="page-table page-table--skeleton" aria-hidden="true">
    <div class="page-head"><div>Title</div><div>Category</div><div>Status</div><div>Actions</div></div>
    ${Array.from({ length: 6 })
      .map(() => '<div class="page-row skeleton-row"><div></div><div></div><div></div><div></div></div>')
      .join("")}
  </div>`;
}

async function loadDashboard() {
  const box = document.getElementById("pageList");
  if (!box) return;
  box.innerHTML = pageListSkeletonHtml();

  const data = await safeFetch(`/api/admin/pages?${buildPagesQuery()}`);

  if (!data || !data.success) {
    box.innerHTML = `<p class="dashboard-error">Could not load pages. <button type="button" class="retry-btn retry-dashboard-btn">Retry</button></p>`;
    return;
  }

  activePages = data.data || [];
  const pagination = data.pagination || { totalPages: 1, page: 1 };

  renderPages(activePages);
  populateFiltersFromMeta(data.meta);
  renderChartsFromPages(activePages, lastDashboardStats);
  renderPagination(pagination);
}

function renderPages(pages) {
  const box = document.getElementById("pageList");

  if (!pages.length) {
    box.innerHTML = "<p>No pages found for current filters. Try clearing filters or create a new page.</p>";
    return;
  }

  box.innerHTML = `
    <div class="page-table">
      <div class="page-head">
        <div>Title</div>
        <div>Category</div>
        <div>Status</div>
        <div>Actions</div>
      </div>
    </div>
  `;

  const table = box.querySelector(".page-table");
  const frag = document.createDocumentFragment();

  pages.forEach((p) => {
    const row = document.createElement("div");
    row.className = "page-row";

    const url = p.url || "/" + (p.slug || "");
    const slug = p.slug || "";
    const statusLabel = normalizeStatusLabel(p.status);
    const statusClass = getDashboardStatusBadgeClass(statusLabel);

    row.innerHTML = `
      <div>${escapeAttr(p.title)}</div>
      <div>${escapeAttr(p.category || "-")}</div>
      <div><span class="badge ${statusClass}">${escapeAttr(statusLabel)}</span></div>
      <div class="row-actions"></div>
    `;

    const actions = row.querySelector(".row-actions");
    const edit = document.createElement("a");
    edit.href = "#";
    edit.textContent = "Edit";
    edit.addEventListener("click", (e) => {
      e.preventDefault();
      goPage("/generator?slug=" + encodeURIComponent(slug));
    });

    const view = document.createElement("a");
    view.href = url;
    view.target = "_blank";
    view.rel = "noopener";
    view.textContent = "View";

    const del = document.createElement("a");
    del.href = "#";
    del.textContent = "Delete";
    del.addEventListener("click", (e) => {
      e.preventDefault();
      deletePage(slug);
    });

    actions.appendChild(edit);
    actions.appendChild(document.createTextNode(" "));
    actions.appendChild(view);
    actions.appendChild(document.createTextNode(" "));
    actions.appendChild(del);

    frag.appendChild(row);
  });

  table.appendChild(frag);
}

let searchTimer;
let suggestTimer;
const searchPageEl = document.getElementById("searchPage");
const suggestBox = document.getElementById("searchSuggestions");

if (searchPageEl) {
  searchPageEl.addEventListener("input", function () {
    clearTimeout(searchTimer);
    clearTimeout(suggestTimer);
    const raw = this.value;
    const v = raw.trim();

    suggestTimer = setTimeout(async () => {
      if (!suggestBox) return;
      if (v.length < 2) {
        suggestBox.innerHTML = "";
        return;
      }
      try {
        const res = await fetch(`/api/search-suggest?q=${encodeURIComponent(v)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!Array.isArray(data)) {
          suggestBox.innerHTML = "";
          return;
        }
        const escQ = v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        suggestBox.innerHTML = data
          .slice(0, 12)
          .map((item) => {
            const u = (item.url || "#").replace(/"/g, "&quot;");
            const t = String(item.title || "");
            const marked = escQ
              ? escapeAttr(t).replace(new RegExp(`(${escQ})`, "gi"), "<mark>$1</mark>")
              : escapeAttr(t);
            return `<div class="suggest-row"><a href="${u}">${marked}</a></div>`;
          })
          .join("");
      } catch {
        suggestBox.innerHTML = "";
      }
    }, 220);

    searchTimer = setTimeout(() => {
      currentFilters.search = raw.trim();
      currentPage = 1;
      loadDashboard();
    }, 400);
  });

  if (suggestBox) {
    suggestBox.addEventListener("click", (e) => {
      const a = e.target.closest("a");
      if (!a) return;
      e.preventDefault();
      const label = a.textContent.replace(/\s+/g, " ").trim();
      searchPageEl.value = label;
      currentFilters.search = label;
      suggestBox.innerHTML = "";
      currentPage = 1;
      loadDashboard();
    });
  }
}

async function deletePage(slug) {
  if (!confirm("Move this page to Trash?")) return;

  const data = await safeFetch(`/api/admin/pages/${encodeURIComponent(slug)}`, {
    method: "DELETE"
  });

  if (data && data.success) {
    await loadStatsCards();
    loadDashboard();
  } else {
    alert("Delete failed");
  }
}

async function initDashboard() {
  applySidebarStateFromStorage();
  markActiveSidebarLink();
  ensureSortUi();
  loadAdminUxMetrics();
  const pageBox = document.getElementById("pageList");
  if (pageBox) pageBox.innerHTML = pageListSkeletonHtml();

  try {
    await loadStatsCards();
    await Promise.all([
      loadDashboard(),
      loadActivityLog(),
      loadLatestAndTrending(),
      checkServerHealth(),
      loadSites(),
      loadQueueStatus(),
      loadQueueFailedJobs()
    ]);
    startDashboardAutoRefresh();
  } catch (e) {
    console.error("[dashboard] init", e);
  }
}

document.addEventListener("click", (e) => {
  if (e.target.closest(".retry-dashboard-btn")) {
    e.preventDefault();
    loadDashboard();
  }
});

function wireDashboardChrome() {
  document.getElementById("prevBtn")?.addEventListener("click", () => window.prevPage());
  document.getElementById("nextBtn")?.addEventListener("click", () => window.nextPage());
  document.getElementById("sidebarToggle")?.addEventListener("click", (e) => {
    e.preventDefault();
    toggleSidebar();
  });
  document.getElementById("sidebarCollapseBtn")?.addEventListener("click", () => toggleSidebarCollapsed());
  document.getElementById("darkModeToggle")?.addEventListener("click", () => toggleDarkMode());
  document.getElementById("logoutLink")?.addEventListener("click", (e) => {
    e.preventDefault();
    window.logout();
  });
  document.getElementById("dashboardRefreshBtn")?.addEventListener("click", () => loadDashboard());
  document.getElementById("runCheckBtn")?.addEventListener("click", () => runManualMonitoringCheck());
  document.getElementById("refreshSitesBtn")?.addEventListener("click", () => {
    loadSites();
    loadQueueStatus();
    loadQueueFailedJobs();
  });
  document.getElementById("retryFailedBtn")?.addEventListener("click", () => retryFailedQueueJobs());
  document.getElementById("clearQueueBtn")?.addEventListener("click", () => clearQueueJobs());
  document.getElementById("sitesTable")?.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action][data-site-id]");
    if (!btn) return;
    const action = btn.getAttribute("data-action");
    const siteId = Number(btn.getAttribute("data-site-id"));
    if (action === "restore-site") restoreSiteById(siteId);
    if (action === "disable-site") disableSiteById(siteId);
  });

  document.addEventListener("pointerdown", (e) => {
    if (!isMobileSidebarMode()) return;
    const sidebar = document.getElementById("sidebar");
    const toggle = document.getElementById("sidebarToggle");
    if (!sidebar || !sidebar.classList.contains("active")) return;
    const target = e.target;
    if (sidebar.contains(target) || (toggle && toggle.contains(target))) return;
    setSidebarOpen(false);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const sidebar = document.getElementById("sidebar");
    if (!sidebar || !sidebar.classList.contains("active")) return;
    setSidebarOpen(false);
  });

  dashboardMobileMq.addEventListener("change", () => {
    // Ensure no stale mobile-open state remains when viewport changes.
    if (!isMobileSidebarMode()) {
      setSidebarOpen(false);
    }
  });

  document.getElementById("sidebar")?.addEventListener("click", (e) => {
    if (!isMobileSidebarMode()) return;
    const link = e.target.closest("a[href]");
    if (!link) return;
    setSidebarOpen(false);
  });
}

wireDashboardChrome();

initDashboard();
