function esc(v) {
  return String(v || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}

let activityPage = 1;

function buildQuery() {
  const q = new URLSearchParams();
  q.set("page", String(activityPage));
  q.set("limit", "20");
  const action = document.getElementById("activityAction")?.value || "";
  const from = document.getElementById("activityFrom")?.value || "";
  const to = document.getElementById("activityTo")?.value || "";
  if (String(action).trim()) q.set("action", String(action).trim());
  if (String(from).trim()) q.set("from", String(from).trim());
  if (String(to).trim()) q.set("to", String(to).trim());
  return q.toString();
}

function renderPagination(pagination) {
  const host = document.getElementById("activityPagination");
  if (!host) return;
  const total = Number(pagination && pagination.totalPages ? pagination.totalPages : 1);
  host.innerHTML = `
    <button type="button" id="activityPrevBtn" ${activityPage <= 1 ? "disabled" : ""}>Previous</button>
    <span>Page ${activityPage} / ${total}</span>
    <button type="button" id="activityNextBtn" ${activityPage >= total ? "disabled" : ""}>Next</button>
  `;
  document.getElementById("activityPrevBtn")?.addEventListener("click", () => {
    activityPage = Math.max(1, activityPage - 1);
    loadActivity();
  });
  document.getElementById("activityNextBtn")?.addEventListener("click", () => {
    activityPage = Math.min(total, activityPage + 1);
    loadActivity();
  });
}

/** API/network/auth failure — not the same as an empty audit log. */
function renderActivityError(message) {
  const host = document.getElementById("activityTable");
  if (!host) return;
  host.innerHTML = `<p class="empty-msg is-error">${esc(message)}</p>`;
}

/** Successful response with zero rows (filters may still apply). */
function renderActivityEmpty(pagination) {
  const host = document.getElementById("activityTable");
  if (!host) return;
  host.innerHTML = '<p class="empty-msg">No activity records found.</p><div id="activityPagination" class="pagination"></div>';
  renderPagination(pagination || { totalPages: 1 });
}

function renderActivity(rows, pagination) {
  const host = document.getElementById("activityTable");
  if (!host) return;
  host.innerHTML = `
    <div class="monitor-table">
      <div class="monitor-head"><div>Admin</div><div>Action</div><div>Target</div><div>Status</div><div>IP</div><div>Time</div></div>
      ${rows.map((r) => `
        <div class="monitor-row">
          <div>${esc(r.admin || "admin")}</div>
          <div>${esc(r.action || "-")}</div>
          <div>${esc(r.target || "-")}</div>
          <div><span class="badge ${String(r.status || "").toLowerCase() === "success" ? "status-new" : "badge-custom"}">${esc(r.status || "-")}</span></div>
          <div>${esc(r.ip || "-")}</div>
          <div>${esc(r.timestamp ? new Date(r.timestamp).toLocaleString() : "-")}</div>
        </div>
      `).join("")}
    </div>
    <div id="activityPagination" class="pagination"></div>
  `;
  renderPagination(pagination || { totalPages: 1 });
}

async function loadActivity() {
  const host = document.getElementById("activityTable");
  if (host) host.innerHTML = '<p class="empty-msg">Loading activity...</p>';

  const res = await window.adminSafeFetch(`/api/admin/activity?${buildQuery()}`);

  // adminSafeFetch returns null on non-OK HTTP — previously shown as "no records".
  if (res == null) {
    console.warn("[activity] Request failed (HTTP error, network, or non-JSON). Check login and Network tab.");
    renderActivityError(
      "Could not load activity. Your session may have expired or the server returned an error. Try logging in again, then refresh."
    );
    return;
  }

  if (!res.success) {
    console.warn("[activity] API returned success=false", res);
    renderActivityError("Activity API returned an error. Check server logs or try again later.");
    return;
  }

  const rows = res.data || [];
  if (!Array.isArray(rows) || !rows.length) {
    return renderActivityEmpty(res.pagination || { totalPages: 1 });
  }

  renderActivity(rows, res.pagination || { totalPages: 1 });
}

document.getElementById("applyActivityFilter")?.addEventListener("click", () => {
  activityPage = 1;
  loadActivity();
});
document.getElementById("refreshActivityBtn")?.addEventListener("click", () => loadActivity());

loadActivity();
