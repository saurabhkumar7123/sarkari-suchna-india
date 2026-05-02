"use strict";

const TRASH_API = "/api/admin/trash";
let trashPage = 1;
const trashLimit = 20;

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
    const res = await fetch(url, { credentials: "include", ...options, headers: hdrs });
    const ct = res.headers.get("content-type") || "";
    if (!res.ok) return null;
    if (ct.includes("application/json")) return await res.json();
    return null;
  } catch (e) {
    console.error(e);
    return null;
  }
}

function renderTrashPager(pagination) {
  let el = document.getElementById("trashPager");
  if (!el) {
    const host = document.getElementById("trashList");
    if (!host || !host.parentNode) return;
    el = document.createElement("div");
    el.id = "trashPager";
    el.className = "trash-pager";
    host.parentNode.insertBefore(el, host);
  }
  const total = pagination && pagination.total != null ? pagination.total : 0;
  const totalPages = pagination && pagination.totalPages ? pagination.totalPages : 1;
  const page = pagination && pagination.page ? pagination.page : 1;
  el.innerHTML = `
    <p class="trash-meta">Total: ${total} · Page ${page} of ${totalPages}</p>
    <div class="trash-pager-btns">
      <button type="button" id="trashPrev" ${page <= 1 ? "disabled" : ""}>Previous</button>
      <button type="button" id="trashNext" ${page >= totalPages ? "disabled" : ""}>Next</button>
    </div>
  `;
  document.getElementById("trashPrev").onclick = () => {
    if (trashPage > 1) {
      trashPage -= 1;
      loadTrash();
    }
  };
  document.getElementById("trashNext").onclick = () => {
    if (trashPage < totalPages) {
      trashPage += 1;
      loadTrash();
    }
  };
}

function formatDeletedDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function showFeedback(message, isError = false) {
  const box = document.getElementById("trashFeedback");
  if (!box) return;
  if (showFeedback._timer) clearTimeout(showFeedback._timer);
  box.textContent = String(message || "").trim();
  box.className = `trash-feedback ${isError ? "error" : "success"}`.trim();
  if (message) {
    showFeedback._timer = setTimeout(() => {
      box.textContent = "";
      box.className = "trash-feedback";
    }, 2200);
  }
}

async function loadTrash() {
  const box = document.getElementById("trashList");
  if (!box) return;
  box.innerHTML = `<p class="trash-loading">Loading…</p>`;
  showFeedback("");

  const res = await safeFetch(`${TRASH_API}?page=${trashPage}&limit=${trashLimit}`);
  if (!res || !res.success) {
    box.innerHTML = `<div class="trash-empty"><div class="icon">⚠️</div><h3>Unable to load trash</h3><p>Please check login/session and retry.</p></div>`;
    showFeedback("Failed to load trash", true);
    return;
  }

  const pages = res.data || [];
  const pagination = res.pagination || { page: 1, totalPages: 1, total: 0 };

  renderTrashPager(pagination);

  if (!pages.length) {
    box.innerHTML = `<div class="trash-empty"><div class="icon">🗑️</div><h3>Trash is empty</h3><p>Deleted pages will appear here</p></div>`;
    return;
  }

  box.innerHTML = "";

  pages.forEach((p) => {
    const slug = p.slug || (p.url ? String(p.url).replace(/^\//, "").replace(/\.html$/, "") : "");
    const card = document.createElement("div");
    card.className = "trash-card";

    const title = p.title || slug || "Untitled";
    const deletedAt = formatDeletedDate(p.deleted_at || p.deletedAt || p.updated_at || p.updatedAt);
    const slugText = slug ? `/${slug}` : (p.url || "—");

    const main = document.createElement("div");
    main.className = "trash-main";
    main.innerHTML = `
      <div class="trash-title">${title}</div>
      <div class="trash-meta-line">
        <span>Slug: ${slugText}</span>
        <span>Deleted: ${deletedAt}</span>
      </div>
    `;

    const restoreBtn = document.createElement("button");
    restoreBtn.type = "button";
    restoreBtn.className = "btn btn-restore";
    restoreBtn.textContent = "♻ Restore";
    restoreBtn.addEventListener("click", () => restorePage(slug));

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "btn btn-delete";
    delBtn.textContent = "❌ Delete Forever";
    delBtn.addEventListener("click", () => permanentDelete(slug));

    const actions = document.createElement("div");
    actions.className = "trash-actions";
    actions.appendChild(restoreBtn);
    actions.appendChild(delBtn);

    card.appendChild(main);
    card.appendChild(actions);

    box.appendChild(card);
  });
}

async function restorePage(slug) {
  if (!confirm("Restore this page?")) return;

  const data = await safeFetch(`/api/admin/pages/${encodeURIComponent(slug)}/restore`, {
    method: "PATCH"
  });

  if (data && data.success) {
    showFeedback("Page restored successfully");
    loadTrash();
  } else {
    showFeedback("Restore failed", true);
  }
}

async function permanentDelete(slug) {
  const ok = await (window.AdminUI && window.AdminUI.typedConfirm
    ? window.AdminUI.typedConfirm({
        title: "Permanent delete",
        warnText: "This action cannot be undone",
        details: "This will permanently delete the page. Type DELETE to confirm",
        requireText: "DELETE"
      })
    : Promise.resolve(confirm("⚠ This will permanently delete the page. Continue?")));
  if (!ok) return;

  const data = await safeFetch(`/api/admin/pages/${encodeURIComponent(slug)}/permanent`, {
    method: "DELETE"
  });

  if (data && data.success) {
    showFeedback("Page permanently deleted");
    loadTrash();
  } else {
    showFeedback("Delete failed", true);
  }
}

document.getElementById("trashRefreshBtn")?.addEventListener("click", () => loadTrash());

loadTrash();
