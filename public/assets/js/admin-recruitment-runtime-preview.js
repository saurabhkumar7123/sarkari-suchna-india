(function () {
  "use strict";

  const API_BASE = "/api/admin/recruitment-runtime-preview";
  const PAGE_SIZE = 20;

  let currentPage = 1;
  let totalItems = 0;
  let bufferSize = 0;
  let bufferCapacity = 100;
  let selectedId = null;

  function prettyJson(value) {
    if (value === undefined || value === null || value === "") return "—";
    if (typeof value === "string") return value;
    return JSON.stringify(value, null, 2);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function setMessage(el, message, tone) {
    if (!el) return;
    if (!message) {
      el.hidden = true;
      el.textContent = "";
      el.classList.remove("is-success", "is-error");
      return;
    }
    el.hidden = false;
    el.textContent = message;
    el.classList.toggle("is-success", tone === "success");
    el.classList.toggle("is-error", tone === "error");
  }

  function formatDate(value) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString();
  }

  function readFilters() {
    return {
      event_type: document.getElementById("filterEventType")?.value || "",
      site: document.getElementById("filterSite")?.value.trim() || "",
      site_id: document.getElementById("filterSiteId")?.value || ""
    };
  }

  function buildListQuery(page) {
    const filters = readFilters();
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(PAGE_SIZE));
    if (filters.event_type) params.set("event_type", filters.event_type);
    if (filters.site) params.set("site", filters.site);
    if (filters.site_id) params.set("site_id", filters.site_id);
    return params.toString();
  }

  async function apiRequest(url, options) {
    const opts = options || {};
    const method = String(opts.method || "GET").toUpperCase();
    const headers = Object.assign({}, opts.headers || {});
    if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
      if (typeof window.getAdminCsrfToken === "function") {
        headers["X-CSRF-Token"] = await window.getAdminCsrfToken();
      }
      if (opts.body && !headers["Content-Type"]) {
        headers["Content-Type"] = "application/json";
      }
    }

    const response = await fetch(url, {
      credentials: "include",
      ...opts,
      headers
    });

    let body = null;
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      body = await response.json().catch(() => null);
    }

    if (response.status === 401) {
      window.location.href = "/login?reason=expired";
      return { ok: false, status: 401, body };
    }

    return { ok: response.ok, status: response.status, body };
  }

  function siteLabel(entry) {
    const site = entry && entry.monitoredSite;
    if (!site) return "—";
    if (site.name) return site.name;
    if (site.url) return site.url;
    if (site.id != null) return `Site #${site.id}`;
    return "—";
  }

  function renderRows(items) {
    const tbody = document.getElementById("rrpTableBody");
    if (!tbody) return;

    if (!items.length) {
      tbody.innerHTML = `<tr><td colspan="8" class="rrp-empty">No preview entries in memory.</td></tr>`;
      return;
    }

    tbody.innerHTML = items
      .map((item) => {
        const status =
          item.processorResult && item.processorResult.status
            ? item.processorResult.status
            : "—";
        const warnings = Array.isArray(item.warnings) ? item.warnings.length : 0;
        const lookup =
          item.lookupSummary && item.lookupSummary.status
            ? `${item.lookupSummary.status}${
                item.lookupSummary.candidateCount != null
                  ? ` (${item.lookupSummary.candidateCount})`
                  : ""
              }`
            : "—";
        const selected = selectedId === item.id ? " is-selected" : "";
        return `<tr data-id="${escapeHtml(item.id)}" class="${selected}">
          <td>${escapeHtml(item.id)}</td>
          <td>${escapeHtml(formatDate(item.timestamp))}</td>
          <td>${escapeHtml(siteLabel(item))}</td>
          <td>${escapeHtml(item.noticeTitle || "—")}</td>
          <td>${escapeHtml(item.eventType || "—")}</td>
          <td>${escapeHtml(status)}</td>
          <td>${escapeHtml(lookup)}</td>
          <td>${escapeHtml(warnings)}</td>
        </tr>`;
      })
      .join("");
  }

  function updatePagination() {
    const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE) || 1);
    const label = document.getElementById("rrpPageLabel");
    const meta = document.getElementById("rrpListMeta");
    const prev = document.getElementById("rrpPrevPage");
    const next = document.getElementById("rrpNextPage");

    if (label) label.textContent = `Page ${currentPage} of ${totalPages}`;
    if (meta) {
      meta.textContent = `${totalItems} shown · buffer ${bufferSize}/${bufferCapacity}`;
    }
    if (prev) prev.disabled = currentPage <= 1;
    if (next) next.disabled = currentPage >= totalPages;
  }

  async function loadList(page) {
    const listMessage = document.getElementById("rrpListMessage");
    setMessage(listMessage, "");
    currentPage = page;

    const result = await apiRequest(`${API_BASE}?${buildListQuery(page)}`);
    if (!result.ok) {
      setMessage(
        listMessage,
        (result.body && result.body.message) || "Could not load preview entries.",
        "error"
      );
      renderRows([]);
      totalItems = 0;
      updatePagination();
      return;
    }

    const items = Array.isArray(result.body?.data) ? result.body.data : [];
    const pagination = result.body?.pagination || {};
    totalItems = Number(pagination.total) || items.length;
    bufferSize = Number(pagination.bufferSize) || 0;
    bufferCapacity = Number(pagination.bufferCapacity) || 100;
    renderRows(items);
    updatePagination();
  }

  async function loadDetail(id) {
    const panel = document.getElementById("rrpDetailPanel");
    const detailMessage = document.getElementById("rrpDetailMessage");
    setMessage(detailMessage, "");

    const result = await apiRequest(`${API_BASE}/${encodeURIComponent(id)}`);
    if (!result.ok) {
      if (panel) panel.hidden = false;
      setMessage(
        detailMessage,
        (result.body && result.body.message) || "Preview entry not found.",
        "error"
      );
      return;
    }

    const entry = result.body?.data;
    selectedId = entry?.id != null ? String(entry.id) : id;
    if (panel) panel.hidden = false;

    const meta = document.getElementById("rrpDetailMeta");
    if (meta) {
      meta.innerHTML = `
        <div><strong>ID</strong> ${escapeHtml(entry.id)}</div>
        <div><strong>Timestamp</strong> ${escapeHtml(formatDate(entry.timestamp))}</div>
        <div><strong>Site</strong> ${escapeHtml(siteLabel(entry))}</div>
        <div><strong>Title</strong> ${escapeHtml(entry.noticeTitle || "—")}</div>
        <div><strong>Event type</strong> ${escapeHtml(entry.eventType || "—")}</div>
        <div><strong>Status</strong> ${escapeHtml(entry.processorResult?.status || "—")}</div>
        <div><strong>Update ID</strong> ${escapeHtml(entry.updateId ?? "—")}</div>
        <div><strong>Lookup status</strong> ${escapeHtml(entry.lookupSummary?.status || "—")}</div>
        <div><strong>Lookup strategy</strong> ${escapeHtml(entry.lookupSummary?.strategy || "—")}</div>
        <div><strong>Candidates</strong> ${escapeHtml(
          entry.lookupSummary?.candidateCount != null ? entry.lookupSummary.candidateCount : "—"
        )}</div>
        <div><strong>Eligibility Status</strong> ${escapeHtml(entry.eligibility?.status || "—")}</div>
        <div><strong>Eligible</strong> ${escapeHtml(
          entry.eligibility && typeof entry.eligibility.eligible === "boolean"
            ? entry.eligibility.eligible
              ? "Yes"
              : "No"
            : "—"
        )}</div>
      `;
    }

    const setPre = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = prettyJson(value);
    };

    setPre("rrpNormalizedNotice", entry.normalizedNotice || "—");
    setPre("rrpLookupSummary", entry.lookupSummary);
    setPre("rrpEligibility", entry.eligibility);
    setPre(
      "rrpEligibilityReasons",
      entry.eligibility && Array.isArray(entry.eligibility.reasons)
        ? entry.eligibility.reasons
        : []
    );
    setPre("rrpWarnings", entry.warnings || []);
    setPre("rrpSelectedRecruitment", entry.selectedRecruitment);
    setPre("rrpProcessorResult", entry.processorResult);

    const rows = document.querySelectorAll("#rrpTableBody tr[data-id]");
    rows.forEach((row) => {
      row.classList.toggle("is-selected", row.getAttribute("data-id") === selectedId);
    });
  }

  async function clearBuffer() {
    const listMessage = document.getElementById("rrpListMessage");
    if (
      !window.confirm(
        "Clear the in-memory preview buffer? This cannot be undone (entries are not in the database)."
      )
    ) {
      return;
    }

    const result = await apiRequest(`${API_BASE}/clear`, {
      method: "POST",
      body: "{}"
    });

    if (!result.ok) {
      setMessage(
        listMessage,
        (result.body && result.body.message) || "Could not clear preview buffer.",
        "error"
      );
      return;
    }

    selectedId = null;
    const panel = document.getElementById("rrpDetailPanel");
    if (panel) panel.hidden = true;
    const removed = result.body?.data?.removed;
    setMessage(
      listMessage,
      `Preview buffer cleared${removed != null ? ` (${removed} removed)` : ""}.`,
      "success"
    );
    await loadList(1);
  }

  function bindEvents() {
    document.getElementById("rrpFilters")?.addEventListener("submit", (event) => {
      event.preventDefault();
      loadList(1);
    });

    document.getElementById("resetFiltersBtn")?.addEventListener("click", () => {
      const eventType = document.getElementById("filterEventType");
      const site = document.getElementById("filterSite");
      const siteId = document.getElementById("filterSiteId");
      if (eventType) eventType.value = "";
      if (site) site.value = "";
      if (siteId) siteId.value = "";
      loadList(1);
    });

    document.getElementById("clearBufferBtn")?.addEventListener("click", () => {
      clearBuffer();
    });

    document.getElementById("rrpPrevPage")?.addEventListener("click", () => {
      if (currentPage > 1) loadList(currentPage - 1);
    });

    document.getElementById("rrpNextPage")?.addEventListener("click", () => {
      const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE) || 1);
      if (currentPage < totalPages) loadList(currentPage + 1);
    });

    document.getElementById("rrpTableBody")?.addEventListener("click", (event) => {
      const row = event.target.closest("tr[data-id]");
      if (!row) return;
      loadDetail(row.getAttribute("data-id"));
    });

    document.getElementById("rrpCloseDetail")?.addEventListener("click", () => {
      selectedId = null;
      const panel = document.getElementById("rrpDetailPanel");
      if (panel) panel.hidden = true;
      document.querySelectorAll("#rrpTableBody tr.is-selected").forEach((row) => {
        row.classList.remove("is-selected");
      });
    });
  }

  bindEvents();
  loadList(1);
})();
