function escapeAttr(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

const ADMIN_METRICS_KEY = "adminUxMetrics_v1";

let lastDashboardStats = null;
let dashboardLiveTimer = null;
let dashboardLivePaused = false;

function flashKpi(id) {
  const card = document.getElementById(id)?.closest(".card");
  if (!card) return;
  card.classList.remove("admin-kpi-flash");
  void card.offsetWidth;
  card.classList.add("admin-kpi-flash");
}

async function loadStatsCards() {
  const res = await window.adminSafeFetch("/api/admin/dashboard");
  if (!res || !res.success || !res.data) {
    lastDashboardStats = null;
    return;
  }
  const d = res.data;
  const prev = lastDashboardStats;
  lastDashboardStats = d;
  const set = (id, v) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (prev && String(el.textContent) !== String(v)) flashKpi(id);
    el.textContent = v;
  };
  set("totalPages", d.totalPages ?? 0);
  set("smallPages", d.smallPages ?? 0);
  set("trashPages", d.trashPages ?? 0);
  set("totalViews", d.totalViews ?? 0);
  set("todayViews", d.todayViews ?? 0);
  set("totalCategories", d.totalCategories ?? 0);
  set("liveVisitors", d.liveVisitors ?? 0);
  set("kpiTotalPages", d.totalPages ?? 0);
  set("kpiTotalUploads", d.totalUploads ?? 0);
  set("kpiFailedJobs", d.failedJobs ?? 0);
  set("kpiPendingJobs", d.pendingJobs ?? 0);
  set("kpiSuccessRate", `${Number(d.successRate) || 0}%`);
  set("attentionFailedJobs", d.needsAttention && d.needsAttention.failedJobs ? d.needsAttention.failedJobs : 0);
  set("attentionManualItems", d.needsAttention && d.needsAttention.manualActionItems ? d.needsAttention.manualActionItems : 0);
  set("avgProcessingTime", d.avgProcessingTimeMs != null ? `${d.avgProcessingTimeMs} ms` : "N/A");
  set("recentTrend", `${Number(d.completedJobs || 0)} success / ${Number(d.failedJobs || 0)} failed`);
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
  } catch {}
  const pendingDrafts = Number(localStorage.getItem("generatorPendingDrafts") || "0") > 0 ? 1 : 0;
  const set = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = String(value);
  };
  set("successfulPublishes", metrics.publishesSuccess);
  set("failedActions", metrics.actionsFailed);
  set("pendingDrafts", pendingDrafts);
}

async function loadActivityLog() {
  let res = await window.adminSafeFetch("/api/admin/activity");
  if (!res || !res.success) res = await window.adminSafeFetch("/api/activity-log");
  const box = document.getElementById("activityLog");
  if (!box) return;
  const logs = res && res.success ? res.data || [] : [];
  box.innerHTML = logs.length
    ? logs.slice(0, 15).map((e) => `<div class="page-item">${escapeAttr(typeof e === "string" ? e : e.message || e.action || "")}</div>`).join("")
    : "<p class=\"activity-empty\">No recent activity yet.</p>";
}

async function loadLatestAndTrending() {
  const [latestRes, topRes] = await Promise.all([
    window.adminSafeFetch("/api/admin/pages?page=1&limit=8&sort=desc"),
    window.adminSafeFetch("/api/top-views")
  ]);

  const latestBox = document.getElementById("latestPages");
  if (latestBox && latestRes && latestRes.success) {
    const rows = latestRes.data || [];
    latestBox.innerHTML = rows.length
      ? rows.map((p) => `<div class="page-item"><a href="/${escapeAttr(p.slug)}" target="_blank" rel="noopener">${escapeAttr(p.title)}</a></div>`).join("")
      : "<p>No pages yet.</p>";
  }

  const topBox = document.getElementById("topPage");
  const trendBox = document.getElementById("trendingPages");
  const topToday = document.getElementById("topTodayPages");
  const list = topRes && topRes.success ? topRes.data || [] : [];
  if (topBox) {
    const first = list[0];
    topBox.innerHTML = first
      ? `<div class="page-item"><a href="/${escapeAttr(first.slug)}" target="_blank" rel="noopener">${escapeAttr(first.title)}</a></div>`
      : "<p>No view data yet.</p>";
  }
  const trendHtml = list.length
    ? list.slice(0, 6).map((p) => `<div class="page-item"><a href="/${escapeAttr(p.slug)}" target="_blank" rel="noopener">${escapeAttr(p.title)}</a></div>`).join("")
    : "<p>No trending pages yet.</p>";
  if (trendBox) trendBox.innerHTML = trendHtml;
  if (topToday) topToday.innerHTML = trendHtml;
}

async function checkServerHealth() {
  const setEl = (id, ok, label) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = label;
    el.style.color = ok ? "#16a34a" : "#dc2626";
  };
  const health = await window.adminSafeFetch("/health");
  const ready = await window.adminSafeFetch("/ready");
  const apiOk = health && health.status === "ok";
  const dbOk = ready && (ready.database === true || ready.status === "ready");
  setEl("healthServer", apiOk, apiOk ? "Online" : "Down");
  setEl("healthDb", dbOk, dbOk ? "Connected" : "Unreachable");
  setEl("healthApi", apiOk, apiOk ? "Working" : "Error");
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
      data: { labels: Object.keys(counts), datasets: [{ label: "Pages by status", data: Object.values(counts), backgroundColor: "rgba(37,99,235,0.6)" }] },
      options: { responsive: true, plugins: { legend: { display: false } } }
    });
  }
  const top = [...pages].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 8);
  if (window.viewsChart) window.viewsChart.destroy();
  const viewsEl = document.getElementById("viewsChart");
  if (viewsEl && typeof Chart !== "undefined") {
    window.viewsChart = new Chart(viewsEl, {
      type: "bar",
      data: { labels: top.map((p) => (p.title || p.slug || "").slice(0, 22)), datasets: [{ label: "Views", data: top.map((p) => p.views || 0), backgroundColor: "rgba(16,185,129,0.6)" }] },
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
      data: { labels: hours, datasets: [{ label: "Estimated hourly traffic", data: tv ? data24 : hours.map(() => 0), borderColor: "rgba(99,102,241,0.8)", tension: 0.3 }] },
      options: { responsive: true, plugins: { legend: { display: true } } }
    });
  }
}

async function loadChartsData() {
  const res = await window.adminSafeFetch("/api/admin/pages?page=1&limit=60&sort=desc");
  if (!res || !res.success || !Array.isArray(res.data)) return;
  renderChartsFromPages(res.data, lastDashboardStats);
}

async function initAdminDashboard() {
  loadAdminUxMetrics();
  await loadStatsCards();
  await Promise.all([loadActivityLog(), loadLatestAndTrending(), checkServerHealth(), loadChartsData()]);
  updateLiveStripLabel();
}

/** Live refresh — polling only, cleans up on pagehide. */
function ensureLiveRefreshUi() {
  if (!window.AdminEnhancements || !window.AdminEnhancements.isEnabled()) return;
  if (document.getElementById("adminLiveStrip")) return;

  const heading = document.querySelector(".page-sub");
  if (!heading) return;

  const strip = document.createElement("div");
  strip.id = "adminLiveStrip";
  strip.className = "admin-live-strip";
  strip.innerHTML = `
    <span class="admin-live-dot" id="adminLiveDot" aria-hidden="true"></span>
    <span id="adminLiveLabel">Updated just now</span>
    <button type="button" class="header-action-btn" id="adminLivePauseBtn" aria-pressed="false">Pause live</button>
  `;
  heading.after(strip);

  document.getElementById("adminLivePauseBtn")?.addEventListener("click", () => {
    dashboardLivePaused = !dashboardLivePaused;
    const btn = document.getElementById("adminLivePauseBtn");
    const dot = document.getElementById("adminLiveDot");
    if (btn) {
      btn.textContent = dashboardLivePaused ? "Resume live" : "Pause live";
      btn.setAttribute("aria-pressed", dashboardLivePaused ? "true" : "false");
    }
    if (dot) dot.classList.toggle("is-paused", dashboardLivePaused);
    if (!dashboardLivePaused) tickLive();
  });

  const INTERVAL_MS = 45000;
  async function tickLive() {
    if (dashboardLivePaused) return;
    await initAdminDashboard();
  }

  dashboardLiveTimer = window.setInterval(tickLive, INTERVAL_MS);
  window.addEventListener("pagehide", () => {
    if (dashboardLiveTimer) clearInterval(dashboardLiveTimer);
    dashboardLiveTimer = null;
  });
}

function updateLiveStripLabel() {
  const el = document.getElementById("adminLiveLabel");
  if (el) el.textContent = `Updated ${new Date().toLocaleTimeString()}`;
}

document.getElementById("dashboardRefreshBtn")?.addEventListener("click", () => initAdminDashboard());
document.getElementById("quickRunCheckBtn")?.addEventListener("click", async (e) => {
  e.preventDefault();
  await window.adminSafeFetch("/api/admin/run-check", { method: "POST" });
  window.location.href = "/admin/monitoring";
});
document.getElementById("quickRetryFailedBtn")?.addEventListener("click", async (e) => {
  e.preventDefault();
  await window.adminSafeFetch("/api/admin/queue/retry", { method: "POST" });
  window.location.href = "/admin/monitoring";
});

initAdminDashboard();
ensureLiveRefreshUi();
