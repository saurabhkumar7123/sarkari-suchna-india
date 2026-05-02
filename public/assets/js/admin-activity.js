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

function renderActivity(rows, pagination) {
  const host = document.getElementById("activityTable");
  if (!host) return;
  if (!Array.isArray(rows) || !rows.length) {
    host.innerHTML = '<p class="empty-msg">No activity records found.</p><div id="activityPagination" class="pagination"></div>';
    renderPagination(pagination || { totalPages: 1 });
    return;
  }
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
  const res = await window.adminSafeFetch(`/api/admin/activity?${buildQuery()}`);
  if (!res || !res.success) {
    return renderActivity([], { totalPages: 1 });
  }
  renderActivity(res.data || [], res.pagination || { totalPages: 1 });
}

document.getElementById("applyActivityFilter")?.addEventListener("click", () => {
  activityPage = 1;
  loadActivity();
});
document.getElementById("refreshActivityBtn")?.addEventListener("click", () => loadActivity());

loadActivity();
