let monitoringSites = [];
let monitorActionInFlight = false;
let sitesSearchQuery = "";

function getFilteredMonitoringSites() {
  const q = sitesSearchQuery.trim().toLowerCase();
  if (!q) return monitoringSites.slice();
  return monitoringSites.filter((s) => {
    const name = String(s && s.name ? s.name : "").toLowerCase();
    const url = String(s && s.url ? s.url : "").toLowerCase();
    return name.includes(q) || url.includes(q);
  });
}

function renderMonitoringStats() {
  const el = document.getElementById("monitoringStats");
  if (!el) return;
  const total = monitoringSites.length;
  if (!total) {
    el.hidden = true;
    return;
  }
  const active = monitoringSites.filter((s) => Number(s && s.active) === 1).length;
  const broken = monitoringSites.filter((s) => Number(s && s.broken) === 1).length;
  const filtered = getFilteredMonitoringSites().length;
  const q = sitesSearchQuery.trim();
  el.hidden = false;
  el.innerHTML = `
    <span class="saas-stat"><strong>${total}</strong> sites</span>
    <span class="saas-stat saas-stat--success"><strong>${active}</strong> active</span>
    <span class="saas-stat saas-stat--warn"><strong>${broken}</strong> broken</span>
    ${q ? `<span class="saas-stat saas-stat--accent"><strong>${filtered}</strong> matching</span>` : ""}
  `;
}

function syncSitesSearchClear() {
  const input = document.getElementById("sitesSearch");
  const btn = document.getElementById("sitesSearchClear");
  if (!input || !btn) return;
  btn.classList.toggle("is-hidden", !input.value.trim());
}

function escapeAttr(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
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
  return `${day} day${day === 1 ? "" : "s"} ago`;
}

function renderSitesTable(data) {
  const host = document.getElementById("sitesTable");
  if (!host) return;
  const list = Array.isArray(data) ? data : getFilteredMonitoringSites();
  if (!list.length) {
    host.innerHTML = sitesSearchQuery.trim()
      ? '<div class="saas-empty-state"><div class="icon">🔍</div><h4>No matching sites</h4><p>Try another search term.</p></div>'
      : '<p class="empty-msg">No monitored sites found.</p>';
    return;
  }
  host.innerHTML = `<div class="monitor-table monitor-table--sites"><div class="monitor-head"><div>Source</div><div>Official URL</div><div>Status</div><div>Last checked</div><div>Last change</div><div>Failures</div><div>Actions</div></div></div>`;
  const table = host.querySelector(".monitor-table");
  const frag = document.createDocumentFragment();
  list.forEach((site) => {
    const row = document.createElement("div");
    row.className = "monitor-row";
    const isActive = Number(site && site.active) === 1;
    const isBroken = Number(site && site.broken) === 1;
    const statusText = isBroken ? "Broken" : isActive ? "Active" : "Inactive";
    const statusClass = isBroken ? "is-broken" : isActive ? "is-active" : "is-disabled";
    const lastCheckedAt =
      (site &&
        (site.lastCheckedAt ||
          site.last_checked_at ||
          site.lastChecked ||
          site.checkedAt)) ||
      null;
    const lastChangeAt =
      (site &&
        (site.lastChangeAt ||
          site.last_change_at ||
          site.lastChanged ||
          site.last_changed_at ||
          site.updated_at)) ||
      null;
    const failCount =
      Number(
        site &&
          (site.failCount ||
            site.failureCount ||
            site.consecutiveFailures ||
            site.fail_count ||
            0)
      ) || 0;
    row.innerHTML = `
      <div class="monitor-site" data-label="Source"><strong>${escapeAttr(site && site.name ? site.name : "Unnamed source")}</strong></div>
      <div data-label="Official URL"><span class="monitor-site-url">${escapeAttr(site && site.url ? site.url : "")}</span></div>
      <div data-label="Status"><span class="monitor-status ${statusClass}"><span class="monitor-status-dot"></span>${statusText}</span></div>
      <div data-label="Last checked">${escapeAttr(lastCheckedAt ? formatMonitorTime(lastCheckedAt) : "Never")}</div>
      <div data-label="Last change">${escapeAttr(lastChangeAt ? formatMonitorTime(lastChangeAt) : "—")}</div>
      <div data-label="Failures">${failCount}</div>
      <div class="monitor-row-actions" data-label="Actions">
        <button type="button" data-action="restore-site" data-site-id="${Number(site.id) || 0}">Restore</button>
        <button type="button" data-action="disable-site" data-site-id="${Number(site.id) || 0}">Disable</button>
      </div>`;
    frag.appendChild(row);
  });
  table.appendChild(frag);
  renderMonitoringStats();
}

async function loadSites() {
  const host = document.getElementById("sitesTable");
  if (host) host.innerHTML = '<p class="empty-msg">Loading monitored sites...</p>';
  const res = await window.adminSafeFetch("/api/admin/sites");
  if (!res || !res.success || !Array.isArray(res.data)) {
    monitoringSites = [];
    renderSitesTable([]);
    setMonitoringMessage("Failed to load monitored sites.", "error");
    return;
  }
  monitoringSites = res.data;
  const set = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = String(value);
  };
  set("totalSites", monitoringSites.length);
  set("activeSites", monitoringSites.filter((s) => Number(s && s.active) === 1).length);
  set("brokenSites", monitoringSites.filter((s) => Number(s && s.broken) === 1).length);
  renderSitesTable(getFilteredMonitoringSites());
  setMonitoringMessage(`Loaded ${monitoringSites.length} monitored sites.`, "success");
}

async function loadQueueStatus() {
  const res = await window.adminSafeFetch("/api/admin/queue/status");
  const set = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = String(value);
  };
  if (!res || !res.success || !res.data) return set("queueWaiting", 0), set("queueActive", 0), set("queueFailed", 0);
  set("queueWaiting", Number(res.data.waiting) || 0);
  set("queueActive", Number(res.data.active) || 0);
  set("queueFailed", Number(res.data.failed) || 0);
}

function renderQueueFailedList(items) {
  const box = document.getElementById("queueFailedList");
  if (!box) return;
  if (!Array.isArray(items) || items.length === 0) {
    box.innerHTML = '<p class="empty-msg">No failed queue jobs.</p>';
    return;
  }
  box.innerHTML = `
    <div class="monitor-table">
      <div class="monitor-head">
        <div>Job ID</div>
        <div>Type</div>
        <div>Status</div>
        <div>Error</div>
        <div>Last Attempt</div>
        <div>Actions</div>
      </div>
      ${items.slice(0, 30).map((item) => {
        const failCount = Number(item.failCount || 1);
        const failBadge = failCount > 1 ? `<span class="badge" style="background:#dc2626;">x${failCount}</span>` : "";
        return `
          <div class="monitor-row">
            <div>${escapeAttr(item.id || "-")}</div>
            <div>${escapeAttr(item.type || "check-site")}</div>
            <div><span class="monitor-status is-broken"><span class="monitor-status-dot"></span>Failed</span> ${failBadge}</div>
            <div title="${escapeAttr(item.error || "")}" class="monitor-error-cell">${escapeAttr(item.error || "unknown")}</div>
            <div>${escapeAttr(formatMonitorTime(item.timestamp))}</div>
            <div class="monitor-row-actions">
              <button type="button" data-action="retry-failed-job" data-job-id="${escapeAttr(item.id || "")}">Retry</button>
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

async function loadSystemHealth() {
  const res = await window.adminSafeFetch("/api/admin/system-health");
  const set = (id, text, ok) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
    const card = el.closest(".admin-health-item");
    if (card) {
      card.classList.remove("is-ok", "is-bad", "is-warn");
      if (ok === true) card.classList.add("is-ok");
      else if (ok === false) card.classList.add("is-bad");
      else if (ok === "warn") card.classList.add("is-warn");
    }
  };
  if (!res || !res.success || !res.data) {
    set("healthDbStatus", "Unavailable", false);
    set("healthRedisStatus", "Unavailable", false);
    set("healthDiskStatus", "Unavailable", false);
    set("healthTelegramStatus", "Unavailable", false);
    return;
  }
  const d = res.data;
  set("healthDbStatus", d.database ? "Connected" : "Down", d.database);
  set("healthRedisStatus", d.redis ? `OK · ${d.queue.failed} failed` : "Down", d.redis);
  const disk = d.disk || {};
  set(
    "healthDiskStatus",
    disk.uploadsDirExists ? `${disk.pdfCount || 0} PDFs · mem ${disk.memoryUsedPct || 0}%` : "Missing uploads dir",
    disk.uploadsDirExists ? true : "warn"
  );
  set(
    "healthTelegramStatus",
    d.telegram && d.telegram.configured ? "Configured" : "Not configured",
    d.telegram && d.telegram.configured ? true : "warn"
  );
}

async function loadRecentUpdates() {
  const box = document.getElementById("recentUpdatesList");
  if (!box) return;
  const res = await window.adminSafeFetch("/api/admin/updates?limit=12");
  const rows = res && res.success && Array.isArray(res.data) ? res.data : [];
  if (!rows.length) {
    box.innerHTML = '<p class="empty-msg">No recent detections.</p>';
    return;
  }
  box.innerHTML = rows
    .map((r) => {
      const source = escapeAttr(r.site_name || r.siteName || "Source");
      const title = escapeAttr(r.summary || r.title || "Update detected");
      const when = formatMonitorTime(r.detected_at || r.detectedAt || r.created_at);
      const href = r.url ? escapeAttr(r.url) : "";
      const status = escapeAttr(r.status || r.processing_status || r.draft_status || "detected");
      return `<article class="detected-update">
        <strong>${source}</strong>
        <span>${title}</span>
        <span>${escapeAttr(when)}</span>
        <span class="badge">${status}</span>
        ${href ? `<a href="${href}" target="_blank" rel="noopener">Official link</a>` : "<span></span>"}
      </article>`;
    })
    .join("");
}

async function refreshMonitoringAll(triggerBtn) {
  const run = () =>
    Promise.all([loadSites(), loadQueueStatus(), loadQueueFailedJobs(), loadSystemHealth(), loadRecentUpdates()]).then(
      () => window.AdminPageToolbar?.markUpdated?.()
    );
  if (window.AdminUI && window.AdminUI.withLoading && triggerBtn) {
    return window.AdminUI.withLoading(triggerBtn, run, "Refreshing...");
  }
  return run();
}

window.adminPageRefreshHandler = refreshMonitoringAll;

async function loadQueueFailedJobs() {
  const sortEl = document.getElementById("failedSort");
  const sort = sortEl ? String(sortEl.value || "latest") : "latest";
  const res = await window.adminSafeFetch(`/api/admin/queue/failed?limit=30&sort=${encodeURIComponent(sort)}`);
  renderQueueFailedList(res && res.success && Array.isArray(res.data) ? res.data : []);
}

async function retryFailedJobById(jobId, triggerBtn) {
  const id = String(jobId || "").trim();
  if (!id) return;
  const run = async () => {
    const res = await window.adminSafeFetch(`/api/admin/queue/retry/${encodeURIComponent(id)}`, { method: "POST" });
    if (!res || !res.success) {
      window.AdminUI?.toastError("Something went wrong");
      return setMonitoringMessage("Retry failed for selected job.", "error");
    }
    window.AdminUI?.toastSuccess("Action completed successfully");
    setMonitoringMessage("Job retry queued.", "success");
    await Promise.all([loadQueueStatus(), loadQueueFailedJobs()]);
  };
  if (window.AdminUI && window.AdminUI.withLoading && triggerBtn) {
    await window.AdminUI.withLoading(triggerBtn, run, "Retrying...");
  } else {
    await run();
  }
}

async function restoreSiteById(siteId) {
  if (!Number.isFinite(siteId) || siteId <= 0 || monitorActionInFlight) return;
  monitorActionInFlight = true;
  const res = await window.adminSafeFetch(`/api/admin/sites/${siteId}/restore`, { method: "PATCH" });
  monitorActionInFlight = false;
  if (!res || !res.success) {
    window.AdminUI?.toastError("Something went wrong");
    return setMonitoringMessage("Restore failed.", "error");
  }
  window.AdminUI?.toastSuccess("Action completed successfully");
  setMonitoringMessage("Site restored.", "success");
  await loadSites();
}

async function disableSiteById(siteId, triggerBtn) {
  if (!Number.isFinite(siteId) || siteId <= 0 || monitorActionInFlight) return;
  const ok = await (window.AdminUI && window.AdminUI.confirmDelete
    ? window.AdminUI.confirmDelete({ title: "Disable site", count: 1 })
    : Promise.resolve(window.confirm("Disable this site?")));
  if (!ok) return;
  monitorActionInFlight = true;
  const doDisable = async () => {
    const res = await window.adminSafeFetch(`/api/admin/sites/${siteId}/disable`, { method: "POST" });
    if (!res || !res.success) {
      window.AdminUI?.toastError("Something went wrong");
      setMonitoringMessage("Disable failed.", "error");
      return;
    }
    window.AdminUI?.toastSuccess("Action completed successfully");
    setMonitoringMessage("Site disabled.", "success");
    await loadSites();
  };
  try {
    if (window.AdminUI && window.AdminUI.withLoading && triggerBtn) {
      await window.AdminUI.withLoading(triggerBtn, doDisable, "Disabling...");
    } else {
      await doDisable();
    }
  } finally {
    monitorActionInFlight = false;
  }
}

async function runManualMonitoringCheck(triggerBtn) {
  setMonitoringMessage("Triggering manual check...");
  const run = async () => {
    const res = await window.adminSafeFetch("/api/admin/run-check", { method: "POST" });
    if (!res || !res.success) {
      window.AdminUI?.toastError("Something went wrong");
      return setMonitoringMessage("Manual check failed.", "error");
    }
    await Promise.all([loadSites(), loadQueueStatus(), loadQueueFailedJobs()]);
    window.AdminUI?.toastSuccess("Action completed successfully");
    setMonitoringMessage("Manual check completed.", "success");
  };
  if (window.AdminUI && window.AdminUI.withLoading && triggerBtn) {
    await window.AdminUI.withLoading(triggerBtn, run, "Running...");
  } else {
    await run();
  }
}

async function retryFailedQueueJobs(triggerBtn) {
  const run = async () => {
    const res = await window.adminSafeFetch("/api/admin/queue/retry", { method: "POST" });
    if (!res || !res.success) {
      window.AdminUI?.toastError("Something went wrong");
      return setMonitoringMessage("Retry failed jobs action failed.", "error");
    }
    await Promise.all([loadQueueStatus(), loadQueueFailedJobs()]);
    window.AdminUI?.toastSuccess("Action completed successfully");
    setMonitoringMessage("Retry queued.", "success");
  };
  if (window.AdminUI && window.AdminUI.withLoading && triggerBtn) {
    await window.AdminUI.withLoading(triggerBtn, run, "Retrying...");
  } else {
    await run();
  }
}

async function clearQueueJobs(triggerBtn) {
  const ok = await (window.AdminUI && window.AdminUI.typedConfirm
    ? window.AdminUI.typedConfirm({
        title: "Clear queue jobs",
        warnText: "This cannot be undone",
        details: "Waiting and failed queue jobs will be removed. Type CLEAR to confirm.",
        requireText: "CLEAR"
      })
    : Promise.resolve(window.confirm("Clear waiting and failed queue jobs?")));
  if (!ok) return;
  const run = async () => {
    const res = await window.adminSafeFetch("/api/admin/queue/clear", { method: "POST" });
    if (!res || !res.success) {
      window.AdminUI?.toastError("Something went wrong");
      return setMonitoringMessage("Clear queue failed.", "error");
    }
    await Promise.all([loadQueueStatus(), loadQueueFailedJobs()]);
    window.AdminUI?.toastSuccess("Action completed successfully");
    setMonitoringMessage("Queue cleared.", "success");
  };
  if (window.AdminUI && window.AdminUI.withLoading && triggerBtn) {
    await window.AdminUI.withLoading(triggerBtn, run, "Clearing...");
  } else {
    await run();
  }
}

document.getElementById("runCheckBtn")?.addEventListener("click", (e) => runManualMonitoringCheck(e.currentTarget));
document.getElementById("refreshSitesBtn")?.addEventListener("click", (e) => refreshMonitoringAll(e.currentTarget));
document.getElementById("retryFailedBtn")?.addEventListener("click", (e) => retryFailedQueueJobs(e.currentTarget));
document.getElementById("clearQueueBtn")?.addEventListener("click", (e) => clearQueueJobs(e.currentTarget));
document.getElementById("sitesTable")?.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-action][data-site-id]");
  if (!btn) return;
  const action = btn.getAttribute("data-action");
  const siteId = Number(btn.getAttribute("data-site-id"));
  if (action === "restore-site") restoreSiteById(siteId);
  if (action === "disable-site") disableSiteById(siteId, btn);
});
document.getElementById("queueFailedList")?.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-action='retry-failed-job'][data-job-id]");
  if (!btn) return;
  const jobId = btn.getAttribute("data-job-id");
  retryFailedJobById(jobId, btn);
});
document.getElementById("failedSort")?.addEventListener("change", () => loadQueueFailedJobs());

let sitesSearchDebounce = null;
document.getElementById("sitesSearch")?.addEventListener("input", (e) => {
  sitesSearchQuery = e.target.value;
  syncSitesSearchClear();
  if (sitesSearchDebounce) clearTimeout(sitesSearchDebounce);
  sitesSearchDebounce = setTimeout(() => renderSitesTable(getFilteredMonitoringSites()), 180);
});
document.getElementById("sitesSearchClear")?.addEventListener("click", () => {
  const input = document.getElementById("sitesSearch");
  if (!input) return;
  input.value = "";
  sitesSearchQuery = "";
  syncSitesSearchClear();
  renderSitesTable(getFilteredMonitoringSites());
});

refreshMonitoringAll();
