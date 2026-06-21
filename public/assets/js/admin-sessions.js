function esc(v) {
  return String(v || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}

let sessionsAll = [];
let sessionsSearchQuery = "";

function simplifyUa(ua) {
  const s = String(ua || "").toLowerCase();
  if (s.includes("android")) return "Android";
  if (s.includes("iphone") || s.includes("ios")) return "iPhone";
  if (s.includes("windows")) return "Windows";
  if (s.includes("mac")) return "macOS";
  if (s.includes("linux")) return "Linux";
  return "Unknown device";
}

function setMsg(msg, isError = false) {
  const el = document.getElementById("sessionsMessage");
  if (!el) return;
  el.textContent = msg || "";
  el.classList.toggle("is-error", Boolean(isError));
}

function getFilteredSessions() {
  const q = sessionsSearchQuery.trim().toLowerCase();
  if (!q) return sessionsAll.slice();
  return sessionsAll.filter((r) => {
    const ip = String(r.ip || "").toLowerCase();
    const ua = String(r.userAgent || "").toLowerCase();
    const device = simplifyUa(r.userAgent).toLowerCase();
    return ip.includes(q) || ua.includes(q) || device.includes(q);
  });
}

function renderSessionsStats() {
  const el = document.getElementById("sessionsStats");
  if (!el) return;
  const total = sessionsAll.length;
  if (!total) {
    el.hidden = true;
    return;
  }
  const current = sessionsAll.filter((r) => r.current).length;
  const filtered = getFilteredSessions().length;
  const q = sessionsSearchQuery.trim();
  el.hidden = false;
  el.innerHTML = `
    <span class="saas-stat"><strong>${total}</strong> sessions</span>
    <span class="saas-stat saas-stat--accent"><strong>${current || 1}</strong> current device</span>
    ${q ? `<span class="saas-stat saas-stat--accent"><strong>${filtered}</strong> matching</span>` : ""}
  `;
}

function syncSessionsSearchClear() {
  const input = document.getElementById("sessionsSearch");
  const btn = document.getElementById("sessionsSearchClear");
  if (!input || !btn) return;
  btn.classList.toggle("is-hidden", !input.value.trim());
}

function renderSessions(rows) {
  const host = document.getElementById("sessionsTable");
  if (!host) return;
  const list = Array.isArray(rows) ? rows : getFilteredSessions();
  if (!list.length) {
    host.innerHTML = sessionsSearchQuery.trim()
      ? '<div class="saas-empty-state"><div class="icon">🔍</div><h4>No matching sessions</h4></div>'
      : '<div class="saas-empty-state"><div class="icon">🧭</div><h4>No active sessions</h4><p>Only your current session may be active.</p></div>';
    renderSessionsStats();
    return;
  }
  host.innerHTML = `<div class="monitor-table monitor-table--sessions">
    <div class="monitor-head"><div>Device</div><div>IP</div><div>Created</div><div>Last Active</div><div>Current</div><div>Actions</div></div>
    ${list.map((r) => `
      <div class="monitor-row">
        <div data-label="Device" title="${esc(r.userAgent)}">${esc(simplifyUa(r.userAgent))}</div>
        <div data-label="IP">${esc(r.ip || "N/A")}</div>
        <div data-label="Created">${esc(r.created_at ? new Date(r.created_at).toLocaleString() : "N/A")}</div>
        <div data-label="Last Active">${esc(r.last_active_at ? new Date(r.last_active_at).toLocaleString() : "N/A")}</div>
        <div data-label="Current">${r.current ? '<span class="badge status-new">Current</span>' : "-"}</div>
        <div class="monitor-row-actions" data-label="Actions">${r.current ? "-" : `<button type="button" data-action="revoke-session" data-session-id="${esc(r.sessionId)}">Revoke</button>`}</div>
      </div>
    `).join("")}
  </div>`;
  renderSessionsStats();
}

async function loadSessions() {
  const host = document.getElementById("sessionsTable");
  if (host) host.innerHTML = '<div class="saas-loading-grid"><div class="saas-skeleton"></div><div class="saas-skeleton"></div></div>';
  const res = await window.adminSafeFetch("/api/admin/sessions");
  if (!res || !res.success) {
    setMsg("Failed to load sessions.", true);
    sessionsAll = [];
    return renderSessions([]);
  }
  sessionsAll = res.data || [];
  setMsg(`Loaded ${sessionsAll.length} session(s).`);
  renderSessions(getFilteredSessions());
  window.AdminPageToolbar?.markUpdated?.();
}

async function revokeSession(sessionId, triggerBtn) {
  const ok = await (window.AdminUI && window.AdminUI.confirmDelete
    ? window.AdminUI.confirmDelete({ title: "Revoke session", count: 1 })
    : Promise.resolve(window.confirm("Revoke this session?")));
  if (!ok) return;
  const run = async () => {
    const res = await window.adminSafeFetch(`/api/admin/sessions/revoke/${encodeURIComponent(sessionId)}`, { method: "POST" });
    if (!res || !res.success) {
      window.AdminUI?.toastError("Something went wrong");
      return;
    }
    window.AdminUI?.toastSuccess("Session revoked");
    await loadSessions();
  };
  if (window.AdminUI && window.AdminUI.withLoading && triggerBtn) return window.AdminUI.withLoading(triggerBtn, run, "Revoking...");
  return run();
}

async function revokeAllSessions(triggerBtn) {
  const ok = await (window.AdminUI && window.AdminUI.confirmDelete
    ? window.AdminUI.confirmDelete({ title: "Logout all devices", count: 1 })
    : Promise.resolve(window.confirm("Logout all devices except current session?")));
  if (!ok) return;
  const run = async () => {
    const res = await window.adminSafeFetch("/api/admin/sessions/revoke-all", { method: "POST" });
    if (!res || !res.success) {
      window.AdminUI?.toastError("Something went wrong");
      return;
    }
    window.AdminUI?.toastSuccess("Other sessions logged out");
    await loadSessions();
  };
  if (window.AdminUI && window.AdminUI.withLoading && triggerBtn) return window.AdminUI.withLoading(triggerBtn, run, "Processing...");
  return run();
}

document.getElementById("refreshSessionsBtn")?.addEventListener("click", () => loadSessions());
document.getElementById("revokeAllBtn")?.addEventListener("click", (e) => revokeAllSessions(e.currentTarget));
document.getElementById("sessionsTable")?.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-action='revoke-session'][data-session-id]");
  if (!btn) return;
  revokeSession(btn.getAttribute("data-session-id"), btn);
});

let sessionsSearchDebounce = null;
document.getElementById("sessionsSearch")?.addEventListener("input", (e) => {
  sessionsSearchQuery = e.target.value;
  syncSessionsSearchClear();
  if (sessionsSearchDebounce) clearTimeout(sessionsSearchDebounce);
  sessionsSearchDebounce = setTimeout(() => renderSessions(getFilteredSessions()), 180);
});
document.getElementById("sessionsSearchClear")?.addEventListener("click", () => {
  const input = document.getElementById("sessionsSearch");
  if (!input) return;
  input.value = "";
  sessionsSearchQuery = "";
  syncSessionsSearchClear();
  renderSessions(getFilteredSessions());
});

window.adminPageRefreshHandler = loadSessions;
loadSessions();
