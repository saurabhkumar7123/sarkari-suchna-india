function escapeAttr(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

let lastDashboardStats = null;
let dashboardLiveTimer = null;
let dashboardLivePaused = false;

function getTimeGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function initDashboardWelcome() {
  const banner = document.getElementById("dashboardWelcomeBanner");
  const dismiss = document.getElementById("dashboardWelcomeDismiss");
  const greeting = document.getElementById("dashboardGreeting");
  const heroTitle = document.getElementById("dashboardHeroTitle");
  const welcomeTitle = document.getElementById("dashboardWelcomeTitle");
  const dateLine = document.getElementById("dashboardDateLine");

  let username = "Admin";
  let justLoggedIn = false;
  try {
    justLoggedIn = sessionStorage.getItem("adminLoginWelcome") === "1";
    username = sessionStorage.getItem("adminLoginWelcomeUser") || username;
    if (justLoggedIn) {
      sessionStorage.removeItem("adminLoginWelcome");
    }
  } catch {
    /* ignore */
  }

  const greet = getTimeGreeting();
  const displayName = username.charAt(0).toUpperCase() + username.slice(1);
  if (greeting) greeting.textContent = `${greet}, ${displayName}`;
  if (heroTitle) heroTitle.textContent = `${greet}, ${displayName}`;
  if (welcomeTitle) welcomeTitle.textContent = `Welcome back, ${displayName}`;
  if (dateLine) {
    dateLine.textContent = new Date().toLocaleDateString("en-IN", {
      weekday: "long",
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  }

  if (banner && justLoggedIn) {
    banner.classList.remove("is-hidden");
    window.AdminUI?.toastSuccess("Signed in successfully");
  }

  dismiss?.addEventListener("click", () => {
    banner?.classList.add("is-hidden");
  });
}

initDashboardWelcome();

function flashKpi(id) {
  const card = document.getElementById(id)?.closest(".card");
  if (!card) return;
  card.classList.remove("admin-kpi-flash");
  void card.offsetWidth;
  card.classList.add("admin-kpi-flash");
}

function renderTodaySummary(d) {
  const s = d && d.todaySummary ? d.todaySummary : null;
  if (!s) return;
  const set = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.textContent = v;
  };
  set("todayPdfUploads", s.pdfUploads ?? 0);
  set("todayCsvImports", s.csvImports == null ? "N/A" : s.csvImports);
  set("todayAdminActions", s.adminActions ?? 0);
  set("todayQueueFailed", s.queueFailed ?? 0);
  set("todayBrokenSites", s.brokenSites ?? 0);
  set("todayTelegramStatus", s.telegramConfigured ? "Ready" : "Not set");
  set("dashBrokenSites", s.brokenSites ?? 0);

  const queueCard = document.getElementById("todayQueueCard");
  if (queueCard) queueCard.classList.toggle("is-warn", Number(s.queueFailed) > 0);
  const brokenCard = document.getElementById("todayBrokenCard");
  if (brokenCard) brokenCard.classList.toggle("is-warn", Number(s.brokenSites) > 0);
  const tgCard = document.getElementById("todayTelegramCard");
  if (tgCard) tgCard.classList.toggle("is-ok", Boolean(s.telegramConfigured));
}

function renderExpiryPanel(d) {
  const counts = d && d.expiry ? d.expiry : {};
  const set = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.textContent = String(v ?? 0);
  };
  set("expiryClosingCount", counts.closingSoon);
  set("expiryExpiredCount", counts.expiredLive);
  set("expiryMissingCount", counts.missingLastDate);

  const renderList = (hostId, rows, emptyText) => {
    const host = document.getElementById(hostId);
    if (!host) return;
    const list = Array.isArray(rows) ? rows : [];
    if (!list.length) {
      host.innerHTML = `<p class="dashboard-expiry-empty">${emptyText}</p>`;
      return;
    }
    host.innerHTML = list
      .map((p) => {
        const slug = escapeAttr(p.slug || "");
        const title = escapeAttr(p.title || p.slug || "Page");
        const date = p.last_date || p.lastDate || "—";
        return `<a class="dashboard-expiry-item" href="/generator?slug=${encodeURIComponent(p.slug || "")}"><span class="dashboard-expiry-item__title">${title}</span><span class="dashboard-expiry-item__meta">${escapeAttr(date)}</span></a>`;
      })
      .join("");
  };

  renderList("dashboardClosingSoon", d && d.closingSoonPages, "No jobs closing in the next 3 days.");
  renderList("dashboardExpiredLive", d && d.expiredLivePages, "No expired jobs currently live.");
}

function renderActionInbox(d) {
  const host = document.getElementById("dashboardActionInbox");
  const list = document.getElementById("dashboardActionList");
  if (!host || !list) return;
  const items = Array.isArray(d && d.actionInbox) ? d.actionInbox : [];
  if (!items.length) {
    host.classList.add("is-hidden");
    list.innerHTML = "";
    return;
  }
  host.classList.remove("is-hidden");
  list.innerHTML = items
    .map(
      (item) =>
        `<li><a class="dashboard-action-item dashboard-action-item--${escapeAttr(item.type || "default")}" href="${escapeAttr(item.href || "#")}"><span>${escapeAttr(item.label || "")}</span><span aria-hidden="true">→</span></a></li>`
    )
    .join("");
}

function renderTopTrafficPanel(list) {
  const host = document.getElementById("dashboardTopTraffic");
  if (!host) return;
  const rows = Array.isArray(list) ? list : [];
  if (!rows.length) {
    host.innerHTML = `<p class="dashboard-expiry-empty">No view data yet. Traffic will appear after pages get visits.</p>`;
    return;
  }
  host.innerHTML = rows
    .slice(0, 8)
    .map((p, i) => {
      const views = Number(p.views) || 0;
      return `<a class="dashboard-traffic-item" href="/${escapeAttr(p.slug)}" target="_blank" rel="noopener"><span class="dashboard-traffic-item__rank">${i + 1}</span><span class="dashboard-traffic-item__title">${escapeAttr(p.title || p.slug)}</span><span class="dashboard-traffic-item__views">${views} views</span></a>`;
    })
    .join("");
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
  set("successfulPublishes", d.successfulPublishes ?? 0);
  set("kpiRecentPublishes", d.successfulPublishes ?? 0);
  set("failedActions", d.failedActions ?? 0);
  set("kpiTotalPages", d.totalPages ?? 0);
  set("kpiTotalUploads", d.totalUploads ?? 0);
  set("kpiFailedJobs", d.failedJobs ?? 0);
  set("opsFailedJobs", d.failedJobs ?? 0);
  set("kpiPendingJobs", d.pendingJobs ?? 0);
  set("kpiSuccessRate", `${Number(d.successRate) || 0}%`);
  set("dashQueueFailed", d.failedJobs ?? 0);
  set("attentionFailedJobs", d.needsAttention && d.needsAttention.failedJobs ? d.needsAttention.failedJobs : 0);
  set("attentionManualItems", d.needsAttention && d.needsAttention.manualActionItems ? d.needsAttention.manualActionItems : 0);
  set("avgProcessingTime", d.avgProcessingTimeMs != null ? `${d.avgProcessingTimeMs} ms` : "N/A");
  set("recentTrend", `${Number(d.completedJobs || 0)} success / ${Number(d.failedJobs || 0)} failed`);
  renderTodaySummary(d);
  renderExpiryPanel(d);
  renderActionInbox(d);
}

function loadPendingDraftMetric() {
  const pendingDrafts = Number(localStorage.getItem("generatorPendingDrafts") || "0") > 0 ? 1 : 0;
  const el = document.getElementById("pendingDrafts");
  if (el) el.textContent = String(pendingDrafts);
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
  renderTopTrafficPanel(list);
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

/** Safe Chart.js teardown — avoids named-element globals (canvas#statusChart) and non-Chart values. */
function destroyDashboardChart(canvasOrChart) {
  if (!canvasOrChart) return;
  try {
    if (typeof Chart !== "undefined" && typeof Chart.getChart === "function") {
      const canvas =
        canvasOrChart instanceof HTMLCanvasElement
          ? canvasOrChart
          : canvasOrChart.canvas instanceof HTMLCanvasElement
            ? canvasOrChart.canvas
            : null;
      if (canvas) {
        const existing = Chart.getChart(canvas);
        if (existing && typeof existing.destroy === "function") {
          existing.destroy();
          return;
        }
      }
    }
    if (typeof canvasOrChart.destroy === "function") {
      canvasOrChart.destroy();
    }
  } catch (_) {
    /* already destroyed or incompatible instance */
  }
}

function renderChartsFromPages(pages) {
  const counts = {};
  pages.forEach((p) => {
    const st = String(p.status || "unknown").trim().toLowerCase() || "unknown";
    counts[st] = (counts[st] || 0) + 1;
  });
  const statusEl = document.getElementById("statusChart");
  destroyDashboardChart(statusEl || window.__dashboardStatusChart);
  if (statusEl && typeof Chart !== "undefined") {
    window.__dashboardStatusChart = new Chart(statusEl, {
      type: "bar",
      data: { labels: Object.keys(counts), datasets: [{ label: "Pages by status", data: Object.values(counts), backgroundColor: "rgba(37,99,235,0.6)" }] },
      options: { responsive: true, plugins: { legend: { display: false } } }
    });
  }
  const top = [...pages].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 8);
  const viewsEl = document.getElementById("viewsChart");
  destroyDashboardChart(viewsEl || window.__dashboardViewsChart);
  if (viewsEl && typeof Chart !== "undefined") {
    window.__dashboardViewsChart = new Chart(viewsEl, {
      type: "bar",
      data: { labels: top.map((p) => (p.title || p.slug || "").slice(0, 22)), datasets: [{ label: "Views", data: top.map((p) => p.views || 0), backgroundColor: "rgba(16,185,129,0.6)" }] },
      options: { indexAxis: "y", responsive: true, plugins: { legend: { display: false } } }
    });
  }
}

async function loadChartsData() {
  const res = await window.adminSafeFetch("/api/admin/pages?page=1&limit=60&sort=desc");
  if (!res || !res.success || !Array.isArray(res.data)) return;
  renderChartsFromPages(res.data);
}

function setAutoStatusItem(id, on, labelOn, labelOff) {
  const card = document.getElementById(id);
  const value = document.getElementById(id + "Value");
  const isOn = Boolean(on);
  if (card) {
    card.classList.toggle("is-on", isOn);
    card.classList.toggle("is-off", !isOn);
  }
  if (value) value.textContent = isOn ? labelOn : labelOff;
}

async function loadAutomationSafetyStatus() {
  const [controlsRes, settingsRes] = await Promise.all([
    window.adminSafeFetch("/api/admin/automation-control-center/controls"),
    window.adminSafeFetch("/api/admin/automation-control-center/settings")
  ]);
  const controls = controlsRes && controlsRes.success ? controlsRes.data || {} : {};
  const flags = settingsRes && settingsRes.success && settingsRes.data ? settingsRes.data.runtimeFlags || {} : {};
  setAutoStatusItem(
    "autoStatusMonitoring",
    flags.PRODUCTION_MONITORING_ENABLED === true,
    "ON",
    "OFF"
  );
  setAutoStatusItem(
    "autoStatusCrawler",
    flags.LIVE_CRAWLER_ENABLED === true,
    "ON",
    "OFF"
  );
  setAutoStatusItem(
    "autoStatusDraft",
    flags.AUTO_DRAFT_ENABLED === true,
    "ON",
    "OFF"
  );
  const telegramOn = controls.telegram && (controls.telegram.status === "ON" || controls.telegram.enabled === true);
  setAutoStatusItem("autoStatusTelegram", telegramOn, "ON", "OFF");
}

async function loadRecentDetections() {
  const host = document.getElementById("dashboardRecentDetections");
  const countEl = document.getElementById("opsDetectedUpdates");
  if (!host && !countEl) return;
  const res = await window.adminSafeFetch("/api/admin/updates?limit=8");
  const rows = res && res.success && Array.isArray(res.data) ? res.data : [];
  if (countEl) countEl.textContent = String(rows.length);
  if (!host) return;
  if (!rows.length) {
    host.innerHTML = `<p class="dashboard-expiry-empty">No recent detections.</p>`;
    return;
  }
  host.innerHTML = rows
    .map((r) => {
      const title = escapeAttr(r.summary || r.title || r.url || "Update detected");
      const source = escapeAttr(r.site_name || r.siteName || "Source");
      const when = escapeAttr(r.detected_at || r.detectedAt || r.created_at || "");
      const href = r.url ? escapeAttr(r.url) : "";
      return `<div class="detected-update"><strong>${source}</strong><span>${title}</span><span>${when ? new Date(when).toLocaleString("en-IN") : "—"}</span>${href ? `<a href="${href}" target="_blank" rel="noopener">Open</a>` : "<span></span>"}</div>`;
    })
    .join("");
}

async function loadNeedsMatchingCount() {
  const set = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.textContent = v;
  };
  const res = await window.adminSafeFetch(
    "/api/admin/recruitment-review-queue?status=needs_matching&page=1&limit=1"
  );
  if (!res || !res.success) {
    set("opsNeedsMatching", "—");
    return;
  }
  const total = res.pagination?.total ?? (Array.isArray(res.data) ? res.data.length : 0);
  set("opsNeedsMatching", total);
  const desc = document.getElementById("opsNeedsMatchingDesc");
  if (desc) {
    desc.textContent =
      Number(total) === 1
        ? "1 update requires recruitment matching"
        : `${total} updates require recruitment matching`;
  }
  const card = document.getElementById("attnNeedsMatchingCard");
  if (card) {
    card.classList.toggle("is-amber", Number(total) > 0);
    card.classList.toggle("is-ok", Number(total) === 0);
  }
}

async function loadProductivityWidgets() {
  const set = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.textContent = v;
  };
  const res = await window.adminSafeFetch("/api/admin/admin-productivity");
  if (!res || !res.success || !res.data) {
    set("opsPendingReviews", "—");
    set("opsActiveRecruitments", "—");
    set("opsDraftsWaiting", "—");
    set("opsBrokenPageLinks", "—");
    set("opsValidationWarnings", "—");
    set("kpiActiveRecruitments", "—");
    return;
  }
  const d = res.data;
  set("opsPendingReviews", d.pendingReviews ?? 0);
  set("opsActiveRecruitments", d.activeRecruitments ?? 0);
  set("opsDraftsWaiting", d.draftsWaiting ?? 0);
  set("opsBrokenPageLinks", d.brokenPageLinks ?? 0);
  set("opsValidationWarnings", d.validationWarnings ?? 0);
  set("kpiActiveRecruitments", d.activeRecruitments ?? 0);
  const pendingCard = document.getElementById("attnPendingReviewsCard");
  if (pendingCard) pendingCard.classList.toggle("is-amber", Number(d.pendingReviews) > 0);
  const draftsCard = document.getElementById("attnDraftsCard");
  if (draftsCard) draftsCard.classList.toggle("is-blue", Number(d.draftsWaiting) > 0);
  const failedCard = document.getElementById("attnFailedCard");
  if (failedCard) {
    const failedEl = document.getElementById("opsFailedJobs");
    const failed = failedEl ? Number(failedEl.textContent) : 0;
    failedCard.classList.toggle("is-red", Number.isFinite(failed) && failed > 0);
  }
}

async function initAdminDashboard() {
  loadPendingDraftMetric();
  await Promise.all([
    loadStatsCards(),
    loadProductivityWidgets(),
    loadNeedsMatchingCount(),
    loadAutomationSafetyStatus(),
    loadRecentDetections()
  ]);
  await Promise.all([loadActivityLog(), loadLatestAndTrending(), checkServerHealth(), loadChartsData()]);
  updateLiveStripLabel();
  window.AdminPageToolbar?.markUpdated?.();
}

window.adminPageRefreshHandler = initAdminDashboard;

/** Live refresh — polling only, cleans up on pagehide. */
function ensureLiveRefreshUi() {
  if (!window.AdminEnhancements || !window.AdminEnhancements.isEnabled()) return;
  if (document.getElementById("adminLiveStrip")) return;

  const heading = document.querySelector(".dashboard-hero__sub");
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
