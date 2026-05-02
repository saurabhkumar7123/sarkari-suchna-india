function esc(v) {
  return String(v || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}

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

function renderSessions(rows) {
  const host = document.getElementById("sessionsTable");
  if (!host) return;
  if (!Array.isArray(rows) || !rows.length) {
    host.innerHTML = '<p class="empty-msg">No active sessions found.</p>';
    return;
  }
  host.innerHTML = `<div class="monitor-table">
    <div class="monitor-head"><div>Device</div><div>IP</div><div>Created</div><div>Last Active</div><div>Current</div><div>Actions</div></div>
    ${rows.map((r) => `
      <div class="monitor-row">
        <div title="${esc(r.userAgent)}">${esc(simplifyUa(r.userAgent))}</div>
        <div>${esc(r.ip || "N/A")}</div>
        <div>${esc(r.created_at ? new Date(r.created_at).toLocaleString() : "N/A")}</div>
        <div>${esc(r.last_active_at ? new Date(r.last_active_at).toLocaleString() : "N/A")}</div>
        <div>${r.current ? '<span class="badge status-new">Current</span>' : "-"}</div>
        <div class="monitor-row-actions">${r.current ? "-" : `<button type="button" data-action="revoke-session" data-session-id="${esc(r.sessionId)}">Revoke</button>`}</div>
      </div>
    `).join("")}
  </div>`;
}

async function loadSessions() {
  const res = await window.adminSafeFetch("/api/admin/sessions");
  if (!res || !res.success) {
    setMsg("Failed to load sessions.", true);
    return renderSessions([]);
  }
  setMsg(`Loaded ${res.data.length} sessions.`);
  renderSessions(res.data || []);
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
    window.AdminUI?.toastSuccess("Action completed successfully");
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
    window.AdminUI?.toastSuccess("Action completed successfully");
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

loadSessions();
