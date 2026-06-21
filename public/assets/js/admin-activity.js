function esc(v) {
  return String(v || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}

let activityPage = 1;
let activeActionChip = "";

const ACTION_CHIPS = [
  { id: "", label: "All" },
  { id: "login", label: "Login" },
  { id: "page_create", label: "Publish" },
  { id: "page_delete", label: "Delete" },
  { id: "content_import", label: "Import" }
];

function actionBadgeClass(action) {
  const a = String(action || "").toLowerCase();
  if (a.includes("login")) return "activity-badge--login";
  if (a.includes("create") || a.includes("publish") || a.includes("update")) return "activity-badge--publish";
  if (a.includes("delete")) return "activity-badge--delete";
  if (a.includes("import")) return "activity-badge--import";
  return "activity-badge--default";
}

function targetLink(row) {
  const action = String(row.action || "");
  const target = String(row.target || "").trim();
  if (!target) return esc("-");
  const slugMatch = target.match(/^[a-z0-9-]+/i);
  if (action.includes("page") && slugMatch) {
    const slug = slugMatch[0];
    return `<a href="/generator?slug=${encodeURIComponent(slug)}">${esc(target)}</a>`;
  }
  return esc(target);
}

function dayKey(ts) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "Unknown date";
  return d.toLocaleDateString(undefined, { weekday: "short", year: "numeric", month: "short", day: "numeric" });
}

function ensureFilterChips() {
  const toolbar = document.querySelector(".filters-toolbar");
  if (!toolbar || document.getElementById("activityFilterChips")) return;
  const host = document.createElement("div");
  host.id = "activityFilterChips";
  host.className = "activity-filter-chips";
  host.setAttribute("role", "group");
  host.setAttribute("aria-label", "Quick action filters");
  ACTION_CHIPS.forEach((chip) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "activity-chip" + (chip.id === activeActionChip ? " is-active" : "");
    btn.textContent = chip.label;
    btn.dataset.action = chip.id;
    btn.addEventListener("click", () => {
      activeActionChip = chip.id;
      const input = document.getElementById("activityAction");
      if (input) input.value = chip.id;
      activityPage = 1;
      host.querySelectorAll(".activity-chip").forEach((b) => {
        b.classList.toggle("is-active", b.dataset.action === activeActionChip);
      });
      loadActivity();
    });
    host.appendChild(btn);
  });
  toolbar.parentNode.insertBefore(host, toolbar);
}

function buildQuery() {
  const q = new URLSearchParams();
  q.set("page", String(activityPage));
  q.set("limit", "20");
  const action = document.getElementById("activityAction")?.value || activeActionChip || "";
  const from = document.getElementById("activityFrom")?.value || "";
  const to = document.getElementById("activityTo")?.value || "";
  if (String(action).trim()) q.set("action", String(action).trim());
  if (String(from).trim()) q.set("from", String(from).trim());
  if (String(to).trim()) q.set("to", String(to).trim());
  return q.toString();
}

function renderActivityStats(pagination) {
  const el = document.getElementById("activityStats");
  if (!el) return;
  const total = Number(pagination && pagination.total) || 0;
  if (!total) {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  el.innerHTML = `
    <span class="saas-stat"><strong>${total}</strong> events</span>
    <span class="saas-stat saas-stat--accent"><strong>${activityPage}</strong> / ${Number(pagination.totalPages) || 1} page</span>
  `;
}

function renderPagination(pagination) {
  const nav = document.getElementById("activityPaginationNav");
  const summary = document.getElementById("activityPaginationSummary");
  const prev = document.getElementById("activityPrevBtn");
  const next = document.getElementById("activityNextBtn");
  const nums = document.getElementById("activityPageNumbers");
  const totalPages = Math.max(1, Number(pagination && pagination.totalPages ? pagination.totalPages : 1));
  const total = Number(pagination && pagination.total) || 0;

  if (nav) nav.classList.toggle("is-hidden", !total);
  renderActivityStats(pagination);

  if (summary) {
    if (!total) summary.textContent = "No activity records yet.";
    else {
      const start = (activityPage - 1) * 20 + 1;
      const end = Math.min(activityPage * 20, total);
      summary.textContent = `Showing ${start}–${end} of ${total} · Page ${activityPage} of ${totalPages}`;
    }
  }

  if (prev) prev.disabled = activityPage <= 1;
  if (next) next.disabled = activityPage >= totalPages;

  if (!nums) return;
  nums.innerHTML = "";
  if (totalPages <= 1) return;

  const maxButtons = 7;
  let startPage = Math.max(1, activityPage - 3);
  let endPage = Math.min(totalPages, startPage + maxButtons - 1);
  startPage = Math.max(1, endPage - maxButtons + 1);

  for (let i = startPage; i <= endPage; i++) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = String(i);
    if (i === activityPage) b.classList.add("is-active");
    b.addEventListener("click", () => {
      if (activityPage === i) return;
      activityPage = i;
      loadActivity();
    });
    nums.appendChild(b);
  }
}

function renderActivityError(message) {
  const host = document.getElementById("activityTable");
  if (!host) return;
  host.innerHTML = `<p class="empty-msg is-error">${esc(message)}</p>`;
}

function renderActivityEmpty(pagination) {
  const host = document.getElementById("activityTable");
  if (!host) return;
  host.innerHTML = '<div class="saas-empty-state"><div class="icon">📝</div><h4>No activity records</h4><p>Try changing filters or date range.</p></div>';
  renderPagination(pagination || { totalPages: 1, total: 0 });
}

/** Timeline cards (progressive); falls back to table-friendly layout on wide screens via CSS. */
function renderActivity(rows, pagination) {
  const host = document.getElementById("activityTable");
  if (!host) return;

  const byDay = {};
  rows.forEach((r) => {
    const key = dayKey(r.timestamp);
    if (!byDay[key]) byDay[key] = [];
    byDay[key].push(r);
  });

  let html = '<div class="activity-timeline">';
  Object.keys(byDay).forEach((day) => {
    html += `<div class="activity-timeline-day">${esc(day)}</div>`;
    byDay[day].forEach((r) => {
      const badgeCls = actionBadgeClass(r.action);
      html += `
        <article class="activity-timeline-card">
          <div class="activity-timeline-card__meta">
            <span class="activity-badge ${badgeCls}">${esc(r.action || "-")}</span>
            <strong class="activity-timeline-card__admin">${esc(r.admin || "admin")}</strong>
          </div>
          <div class="activity-timeline-card__body">
            <div>${targetLink(r)}</div>
            <div class="activity-timeline-card__sub">${esc(r.ip || "-")} · ${esc(r.timestamp ? new Date(r.timestamp).toLocaleString() : "-")}</div>
            <span class="badge ${String(r.status || "").toLowerCase() === "success" ? "status-new" : "badge-custom"}">${esc(r.status || "-")}</span>
          </div>
        </article>`;
    });
  });
  html += "</div>";
  host.innerHTML = html;
  renderPagination(pagination || { totalPages: 1 });
}

async function loadActivity() {
  const host = document.getElementById("activityTable");
  if (host) host.innerHTML = '<div class="saas-loading-grid"><div class="saas-skeleton"></div><div class="saas-skeleton"></div></div>';

  const res = await window.adminSafeFetch(`/api/admin/activity?${buildQuery()}`);

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
  activeActionChip = String(document.getElementById("activityAction")?.value || "").trim();
  loadActivity();
});
document.getElementById("refreshActivityBtn")?.addEventListener("click", () => loadActivity());

document.getElementById("exportActivityBtn")?.addEventListener("click", async () => {
  const res = await window.adminSafeFetch(`/api/admin/activity?${buildQuery().replace(/page=\d+/, "page=1").replace(/limit=\d+/, "limit=500")}`);
  if (!res || !res.success || !Array.isArray(res.data) || !res.data.length) {
    window.AdminUI?.toastInfo("No activity rows to export");
    return;
  }
  const header = ["timestamp", "admin", "action", "target", "status", "ip"];
  const lines = [header.join(",")];
  res.data.forEach((row) => {
    lines.push(
      header
        .map((key) => {
          const val = String(row[key] ?? "").replace(/"/g, '""');
          return `"${val}"`;
        })
        .join(",")
    );
  });
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "admin-activity.csv";
  a.click();
  URL.revokeObjectURL(a.href);
  window.AdminUI?.toastSuccess("Activity exported");
});

document.getElementById("activityPrevBtn")?.addEventListener("click", () => {
  if (activityPage <= 1) return;
  activityPage -= 1;
  loadActivity();
});
document.getElementById("activityNextBtn")?.addEventListener("click", () => {
  if (document.getElementById("activityNextBtn")?.disabled) return;
  activityPage += 1;
  loadActivity();
});

ensureFilterChips();
loadActivity();
