(function () {
  "use strict";

  const API_BASE = "/api/admin/recruitment-review-queue";
  const PAGE_SIZE = 20;

  let currentPage = 1;
  let totalItems = 0;
  let selectedId = null;
  let selectedItem = null;

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

  function statusClass(status) {
    const key = String(status || "").toLowerCase().replace(/\s+/g, "_");
    return `rrq-status is-${escapeHtml(key)}`;
  }

  function readFilters() {
    return {
      search: document.getElementById("filterSearch")?.value.trim() || "",
      status: document.getElementById("filterStatus")?.value || "",
      event_type: document.getElementById("filterEventType")?.value || "",
      recruitment_id: document.getElementById("filterRecruitmentId")?.value || ""
    };
  }

  function buildListQuery(page) {
    const filters = readFilters();
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(PAGE_SIZE));
    if (filters.search) params.set("search", filters.search);
    if (filters.status) params.set("status", filters.status);
    if (filters.event_type) params.set("event_type", filters.event_type);
    if (filters.recruitment_id) params.set("recruitment_id", filters.recruitment_id);
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

  function renderRows(items) {
    const tbody = document.getElementById("rrqTableBody");
    if (!tbody) return;

    if (!items.length) {
      tbody.innerHTML = `<tr><td colspan="8" class="rrq-empty">No review items found.</td></tr>`;
      return;
    }

    tbody.innerHTML = items
      .map((item) => {
        const source = item.source_url
          ? `<a class="rrq-source-link" href="${escapeHtml(item.source_url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.source_url)}</a>`
          : "—";
        const selected = selectedId === item.id ? " is-selected" : "";
        return `<tr data-id="${item.id}" class="${selected}">
          <td>${escapeHtml(item.id)}</td>
          <td>${escapeHtml(item.title || "—")}</td>
          <td><span class="${statusClass(item.status)}">${escapeHtml(item.status || "—")}</span></td>
          <td>${escapeHtml(item.event_type || "—")}</td>
          <td>${escapeHtml(item.recruitment_id ?? "—")}</td>
          <td>${escapeHtml(item.confidence || "—")}</td>
          <td>${escapeHtml(formatDate(item.created_at))}</td>
          <td>${source}</td>
        </tr>`;
      })
      .join("");
  }

  function updatePagination() {
    const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE) || 1);
    const label = document.getElementById("rrqPageLabel");
    const meta = document.getElementById("rrqListMeta");
    const prev = document.getElementById("rrqPrevPage");
    const next = document.getElementById("rrqNextPage");

    if (label) label.textContent = `Page ${currentPage} of ${totalPages}`;
    if (meta) meta.textContent = `${totalItems} item${totalItems === 1 ? "" : "s"}`;
    if (prev) prev.disabled = currentPage <= 1;
    if (next) next.disabled = currentPage >= totalPages;
  }

  function setField(name, value) {
    const el = document.querySelector(`[data-field="${name}"]`);
    if (el) el.textContent = prettyJson(value);
  }

  function recommendationClass(decision) {
    const value = String(decision || "").toLowerCase();
    if (value.includes("likely match") && !value.includes("different")) {
      return "is-likely-match";
    }
    if (value.includes("possible match")) return "is-possible-match";
    if (value.includes("different")) return "is-likely-different";
    return "is-needs-review";
  }

  function visualClass(status) {
    const key = String(status || "neutral").toLowerCase();
    return `rrq-field-status is-${escapeHtml(key)}`;
  }

  function renderComparison(assist) {
    const tbody = document.getElementById("rrqComparisonBody");
    if (!tbody) return;

    const rows = assist && Array.isArray(assist.comparison?.rows) ? assist.comparison.rows : [];
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="3" class="rrq-empty">No comparison data.</td></tr>`;
      return;
    }

    tbody.innerHTML = rows
      .map(
        (row) => `<tr class="${visualClass(row.visualStatus)}">
          <th scope="row">${escapeHtml(row.label)}</th>
          <td><span class="rrq-cmp-value">${escapeHtml(row.noticeValue)}</span></td>
          <td><span class="rrq-cmp-value">${escapeHtml(row.candidateValue)}</span></td>
        </tr>`
      )
      .join("");
  }

  function renderDecisionAssist(assist) {
    const decisionEl = document.getElementById("rrqRecommendedDecision");
    const rationaleEl = document.getElementById("rrqRecommendedRationale");
    const recommendation = assist && assist.recommendation ? assist.recommendation : null;
    const decision = recommendation?.decision || "—";

    if (decisionEl) {
      decisionEl.textContent = decision;
      decisionEl.className = recommendationClass(decision);
    }
    if (rationaleEl) {
      rationaleEl.textContent = recommendation?.rationale || "";
    }
  }

  function renderHistory(assist, item) {
    const grid = document.getElementById("rrqHistoryGrid");
    if (!grid) return;

    const history = (assist && assist.history) || {};
    const createdAt = history.createdAt ?? item?.created_at;
    const status = history.status ?? item?.status;
    const decision = history.decision ?? item?.decision;
    const notes = history.notes ?? item?.notes;
    const frozen =
      history.frozen === true || String(status || "").toLowerCase() === "frozen";

    grid.innerHTML = `
      <div>
        <dt>Created Time</dt>
        <dd>${escapeHtml(formatDate(createdAt))}</dd>
      </div>
      <div>
        <dt>Current Status</dt>
        <dd><span class="${statusClass(status)}">${escapeHtml(status || "—")}</span></dd>
      </div>
      <div>
        <dt>Decision</dt>
        <dd>${escapeHtml(decision || "—")}</dd>
      </div>
      <div>
        <dt>Notes</dt>
        <dd>${escapeHtml(notes || "—")}</dd>
      </div>
      <div>
        <dt>Frozen state</dt>
        <dd>${frozen ? "Frozen" : "Not frozen"}</dd>
      </div>
    `;
  }

  function candidateIdentity(row) {
    const rid = Number(row && (row.recruitmentId || row.recruitment_id));
    if (Number.isFinite(rid) && rid > 0) return `recruitment:${rid}`;
    const kind = String((row && row.kind) || "").toLowerCase();
    if ((kind === "recruitment" || kind === "") && row && row.id != null) {
      const id = Number(row.id);
      if (Number.isFinite(id) && id > 0) return `recruitment:${id}`;
    }
    const pageId = Number(row && (row.pageId || row.page_id));
    if (Number.isFinite(pageId) && pageId > 0) return `page:${pageId}`;
    if (row && row.id != null) return `${kind || "unknown"}:${row.id}`;
    return `composite:${kind}|${String((row && row.title) || "").trim().toLowerCase()}|${String(
      (row && row.slug) || ""
    )
      .trim()
      .toLowerCase()}`;
  }

  function levelRank(level) {
    const key = String(level || "")
      .trim()
      .toLowerCase();
    const ranks = { high: 4, medium: 3, ambiguous: 2, low: 1, hard_negative: 0, no_match: 0 };
    return ranks[key] != null ? ranks[key] : -1;
  }

  function mergeCandidate(existing, incoming) {
    if (!existing) return Object.assign({}, incoming);
    if (!incoming) return Object.assign({}, existing);
    const existingScore = Number(existing.score);
    const incomingScore = Number(incoming.score);
    const es = Number.isFinite(existingScore) ? existingScore : Number.NEGATIVE_INFINITY;
    const is = Number.isFinite(incomingScore) ? incomingScore : Number.NEGATIVE_INFINITY;
    const preferIncoming =
      is > es ||
      (is === es &&
        levelRank(incoming.level || incoming.matchLevel) >
          levelRank(existing.level || existing.matchLevel));
    const primary = preferIncoming ? incoming : existing;
    const secondary = preferIncoming ? existing : incoming;
    const merged = Object.assign({}, secondary, primary);
    const rid = Number(primary.recruitmentId || primary.recruitment_id || secondary.recruitmentId || secondary.recruitment_id || primary.id || secondary.id);
    if (Number.isFinite(rid) && rid > 0) {
      merged.recruitmentId = rid;
      merged.recruitment_id = rid;
    }
    merged.title = primary.title || secondary.title || merged.title;
    merged.level = primary.level || primary.matchLevel || secondary.level || secondary.matchLevel;
    merged.matchLevel = primary.matchLevel || primary.level || secondary.matchLevel || secondary.level;
    merged.score = Math.max(es, is) === Number.NEGATIVE_INFINITY ? primary.score ?? secondary.score : Math.max(es, is);
    merged.confidence = primary.confidence || secondary.confidence;
    merged.reason = primary.reason || secondary.reason;
    merged.recommendation = primary.recommendation || secondary.recommendation;
    merged.recommendedAction = primary.recommendedAction || secondary.recommendedAction;
    return merged;
  }

  function normalizeNeedsMatchingCandidates(candidates) {
    const list = Array.isArray(candidates) ? candidates.filter((row) => row && typeof row === "object") : [];
    const byKey = new Map();
    const order = [];
    for (const row of list) {
      const key = candidateIdentity(row);
      if (!byKey.has(key)) {
        byKey.set(key, Object.assign({}, row));
        order.push(key);
      } else {
        byKey.set(key, mergeCandidate(byKey.get(key), row));
      }
    }
    return order.map((key) => byKey.get(key));
  }

  function renderNeedsMatching(item) {
    const panel = document.getElementById("rrqNeedsMatching");
    const body = document.getElementById("rrqCandidateBody");
    const reasonEl = document.getElementById("rrqNeedsMatchingReason");
    if (!panel || !body) return;

    const payload = item && item.payload && typeof item.payload === "object" ? item.payload : {};
    const processor =
      item && item.processor_output && typeof item.processor_output === "object"
        ? item.processor_output
        : {};
    const needs =
      payload.needsMatching ||
      processor.needsMatching ||
      (String(item && item.status || "").toLowerCase() === "needs_matching" ? {} : null);

    if (!needs) {
      panel.hidden = true;
      return;
    }

    panel.hidden = false;
    if (reasonEl) {
      reasonEl.textContent =
        needs.reason ||
        processor.persistenceReason ||
        "Human must choose the parent recruitment.";
    }

    const candidates = Array.isArray(item.needs_matching_candidates)
      ? item.needs_matching_candidates
      : normalizeNeedsMatchingCandidates(
          []
            .concat(needs.candidateRecruitments || [])
            .concat(needs.candidatePages || [])
            .concat(needs.candidates || [])
            .concat(processor.candidates || [])
        );

    if (!candidates.length) {
      body.innerHTML = '<tr><td colspan="6" class="rrq-empty">No candidates.</td></tr>';
      return;
    }

    body.innerHTML = candidates
      .map((row) => {
        const rid = row.recruitmentId || row.recruitment_id || (row.kind === "recruitment" ? row.id : "");
        return `<tr>
          <td>${escapeHtml(row.kind || "—")}</td>
          <td>${escapeHtml(row.id ?? "—")}</td>
          <td>${escapeHtml(row.title || "—")}</td>
          <td>${escapeHtml(row.level || row.matchLevel || "—")}</td>
          <td>${escapeHtml(row.score ?? "—")}</td>
          <td>${
            rid
              ? `<button type="button" class="header-action-btn header-action-btn--ghost" data-pick-recruitment="${escapeHtml(
                  rid
                )}">Use</button>`
              : "—"
          }</td>
        </tr>`;
      })
      .join("");
  }

  function renderDetail(item) {
    selectedItem = item;
    selectedId = item ? item.id : null;
    const panel = document.getElementById("rrqDetailPanel");
    if (!panel) return;

    if (!item) {
      panel.hidden = true;
      return;
    }

    panel.hidden = false;
    const matchResult = item.match_result || {};
    const assist = item.assist || null;
    const meta = document.getElementById("rrqDetailMeta");
    if (meta) {
      meta.innerHTML = `
        <span>ID: <strong>${escapeHtml(item.id)}</strong></span>
        <span>Status: <span class="${statusClass(item.status)}">${escapeHtml(item.status || "—")}</span></span>
        <span>Decision: <strong>${escapeHtml(item.decision || "—")}</strong></span>
        <span>Recruitment: <strong>${escapeHtml(item.recruitment_id ?? "—")}</strong></span>
        <span>Update: <strong>${escapeHtml(item.update_id ?? "—")}</strong></span>
        <span>Created: <strong>${escapeHtml(formatDate(item.created_at))}</strong></span>
      `;
    }

    renderDecisionAssist(assist);
    renderComparison(assist);
    renderNeedsMatching(item);
    renderHistory(assist, item);

    const notesEl = document.getElementById("rrqNotes");
    if (notesEl) notesEl.value = item.notes || "";

    const frozen = item.status === "frozen";
    document.querySelectorAll("#rrqActions [data-action]").forEach((btn) => {
      btn.disabled = frozen;
    });
    const saveNotesBtn = document.getElementById("rrqSaveNotes");
    if (saveNotesBtn) saveNotesBtn.disabled = frozen;
    if (notesEl) notesEl.disabled = frozen;

    const fields = {
      title: item.title,
      event_type: item.event_type,
      confidence: item.confidence,
      matchedSignals: matchResult.matchedSignals,
      conflictingSignals: matchResult.conflictingSignals,
      source_url: item.source_url,
      match_result: item.match_result,
      raw_notice: item.raw_notice,
      processor_output: item.processor_output
    };
    Object.keys(fields).forEach((key) => {
      const el = document.querySelector(`[data-field="${key}"]`);
      if (el) el.textContent = prettyJson(fields[key]);
    });
  }

  async function resolveMatching(action, recruitmentId) {
    if (!selectedId) return;
    const detailMessage = document.getElementById("rrqDetailMessage");
    setMessage(detailMessage, "");
    const body = {
      action,
      notes: document.getElementById("rrqNotes")?.value || undefined
    };
    if (recruitmentId) body.recruitment_id = recruitmentId;
    if (selectedItem && selectedItem.event_type) body.event_type = selectedItem.event_type;

    const result = await apiRequest(`${API_BASE}/${selectedId}/resolve-matching`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!result.ok || !result.body || result.body.success !== true) {
      setMessage(
        detailMessage,
        (result.body && result.body.message) || "Could not resolve matching.",
        "error"
      );
      return;
    }
    renderDetail(result.body.data);
    setMessage(detailMessage, `Resolved: ${action}`, "success");
    await loadList();
  }

  async function loadList() {
    const listMessage = document.getElementById("rrqListMessage");
    setMessage(listMessage, "");

    const result = await apiRequest(`${API_BASE}?${buildListQuery(currentPage)}`);
    if (!result.ok || !result.body || result.body.success !== true) {
      const tbody = document.getElementById("rrqTableBody");
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="8" class="rrq-empty">Could not load review items.</td></tr>`;
      }
      setMessage(
        listMessage,
        (result.body && result.body.message) || "Could not load review items.",
        "error"
      );
      totalItems = 0;
      updatePagination();
      return;
    }

    const items = Array.isArray(result.body.data) ? result.body.data : [];
    totalItems = result.body.pagination?.total ?? items.length;
    renderRows(items);
    updatePagination();

    if (selectedId) {
      const stillPresent = items.some((item) => item.id === selectedId);
      if (!stillPresent) {
        // Keep detail open; selection row simply won't highlight on this page.
      }
    }
  }

  async function loadDetail(id) {
    const detailMessage = document.getElementById("rrqDetailMessage");
    setMessage(detailMessage, "");
    const result = await apiRequest(`${API_BASE}/${id}`);
    if (!result.ok || !result.body || result.body.success !== true) {
      setMessage(
        detailMessage,
        (result.body && result.body.message) || "Could not load review item.",
        "error"
      );
      return;
    }
    renderDetail(result.body.data);
    await loadList();
  }

  async function runAction(action) {
    if (!selectedId) return;
    const detailMessage = document.getElementById("rrqDetailMessage");
    setMessage(detailMessage, "");

    const notes = document.getElementById("rrqNotes")?.value ?? "";
    const path =
      action === "under-review"
        ? `${API_BASE}/${selectedId}/under-review`
        : `${API_BASE}/${selectedId}/${action}`;

    const result = await apiRequest(path, {
      method: "POST",
      body: JSON.stringify({ notes })
    });

    if (!result.ok || !result.body || result.body.success !== true) {
      setMessage(
        detailMessage,
        (result.body && result.body.message) || `Could not ${action}.`,
        "error"
      );
      return;
    }

    renderDetail(result.body.data);
    setMessage(detailMessage, `Updated: ${action}`, "success");
    await loadList();
  }

  async function saveNotes() {
    if (!selectedId) return;
    const detailMessage = document.getElementById("rrqDetailMessage");
    setMessage(detailMessage, "");
    const notes = document.getElementById("rrqNotes")?.value ?? "";

    const result = await apiRequest(`${API_BASE}/${selectedId}/notes`, {
      method: "PATCH",
      body: JSON.stringify({ notes })
    });

    if (!result.ok || !result.body || result.body.success !== true) {
      setMessage(
        detailMessage,
        (result.body && result.body.message) || "Could not update notes.",
        "error"
      );
      return;
    }

    renderDetail(result.body.data);
    setMessage(detailMessage, "Notes updated", "success");
    await loadList();
  }

  document.getElementById("rrqFilters")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    currentPage = 1;
    await loadList();
  });

  document.getElementById("resetFiltersBtn")?.addEventListener("click", async () => {
    document.getElementById("filterSearch").value = "";
    document.getElementById("filterStatus").value = "";
    document.getElementById("filterEventType").value = "";
    document.getElementById("filterRecruitmentId").value = "";
    currentPage = 1;
    await loadList();
  });

  document.getElementById("rrqPrevPage")?.addEventListener("click", async () => {
    if (currentPage <= 1) return;
    currentPage -= 1;
    await loadList();
  });

  document.getElementById("rrqNextPage")?.addEventListener("click", async () => {
    const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE) || 1);
    if (currentPage >= totalPages) return;
    currentPage += 1;
    await loadList();
  });

  document.getElementById("rrqTableBody")?.addEventListener("click", async (event) => {
    const row = event.target.closest("tr[data-id]");
    if (!row) return;
    if (event.target.closest("a")) return;
    const id = parseInt(row.getAttribute("data-id"), 10);
    if (!Number.isInteger(id) || id <= 0) return;
    await loadDetail(id);
  });

  document.getElementById("rrqCloseDetail")?.addEventListener("click", () => {
    selectedId = null;
    selectedItem = null;
    renderDetail(null);
    loadList();
  });

  document.getElementById("rrqActions")?.addEventListener("click", async (event) => {
    const btn = event.target.closest("[data-action]");
    if (!btn || btn.disabled) return;
    await runAction(btn.getAttribute("data-action"));
  });

  document.getElementById("rrqNeedsMatchingActions")?.addEventListener("click", async (event) => {
    const btn = event.target.closest("[data-match-action]");
    if (!btn || btn.disabled) return;
    const action = btn.getAttribute("data-match-action");
    let recruitmentId = document.getElementById("rrqAttachRecruitmentId")?.value || "";
    if (action === "attach" && !recruitmentId) {
      setMessage(document.getElementById("rrqDetailMessage"), "Enter a recruitment ID to attach.", "error");
      return;
    }
    await resolveMatching(action, recruitmentId || undefined);
  });

  document.getElementById("rrqCandidateBody")?.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-pick-recruitment]");
    if (!btn) return;
    const input = document.getElementById("rrqAttachRecruitmentId");
    if (input) input.value = btn.getAttribute("data-pick-recruitment") || "";
  });

  document.getElementById("rrqSaveNotes")?.addEventListener("click", saveNotes);

  loadList();
})();
