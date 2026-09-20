(function () {
  "use strict";

  const API_BASE = "/api/admin/recruitment-review-queue";
  const PAGE_SIZE = 20;

  let currentPage = 1;
  let totalItems = 0;
  let selectedId = null;
  let selectedItem = null;
  let focusedUpdateId = null;

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

  function resolveDraftId(item) {
    const processor =
      item && item.processor_output && typeof item.processor_output === "object"
        ? item.processor_output
        : {};
    const raw =
      item && (item.draft_id || item.draftId || item.generator_draft_id || processor.draftId);
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return String(n);
    return null;
  }

  function syncManualPublishLink(item) {
    const link = document.getElementById("rrqManualPublishLink");
    const editLink = document.getElementById("rrqEditDraftLink");
    if (!link) return;
    const linked = item && item.linked_draft;
    const draftId =
      linked && linked.id
        ? String(linked.id)
        : resolveDraftId(item);
    const status = String((item && item.status) || "").toLowerCase();
    const published = linked && String(linked.status || "").toLowerCase() === "published";

    if (editLink) {
      if (draftId && !published && status !== "rejected" && status !== "frozen") {
        editLink.hidden = false;
        editLink.href = "/generator?draftId=" + encodeURIComponent(draftId);
        editLink.textContent = "Edit Draft #" + draftId;
      } else {
        editLink.hidden = true;
      }
    }

    if (linked && String(linked.status || "").toLowerCase() === "published") {
      if (linked.publishedSlug) {
        link.href = "/generator?slug=" + encodeURIComponent(linked.publishedSlug);
        link.textContent = "Open published page (Generator)";
      } else {
        link.href = "/admin/page-manager";
        link.textContent = "Open Page Manager";
      }
      link.hidden = false;
      return;
    }

    if (status === "rejected" || status === "frozen") {
      link.hidden = true;
      return;
    }

    link.hidden = false;
    if (linked && String(linked.status || "").toLowerCase() === "missing") {
      link.href = "/generator#drafts";
      link.textContent = "Manual Publish (Generator)";
      return;
    }

    if (draftId) {
      link.href = "/generator?draftId=" + encodeURIComponent(draftId);
      link.textContent =
        status === "approved" ? "Manual Publish (required)" : "Manual Publish (Generator)";
      return;
    }
    link.href = "/generator#drafts";
    link.textContent = "Manual Publish (Generator)";
  }

  function syncActionAvailability(item) {
    if (!item) {
      document.querySelectorAll("#rrqActions [data-action]").forEach((btn) => {
        btn.hidden = true;
        btn.disabled = true;
      });
      const editLink = document.getElementById("rrqEditDraftLink");
      const pubLink = document.getElementById("rrqManualPublishLink");
      if (editLink) editLink.hidden = true;
      if (pubLink) pubLink.hidden = true;
      return;
    }
    const status = String((item && item.status) || "").toLowerCase();
    const frozen = status === "frozen";
    const rejected = status === "rejected";
    const approved = status === "approved";
    const published =
      item &&
      item.linked_draft &&
      String(item.linked_draft.status || "").toLowerCase() === "published";
    const needsMatching = status === "needs_matching";

    const show = {
      approve: !frozen && !rejected && !approved && !published,
      reject: !frozen && !rejected && !published,
      "under-review": !frozen && !rejected && !approved && !published,
      freeze: !frozen && !rejected && !published,
      unfreeze: frozen
    };

    document.querySelectorAll("#rrqActions [data-action]").forEach((btn) => {
      const action = btn.getAttribute("data-action");
      const visible = show[action] !== false;
      btn.hidden = !visible;
      btn.disabled = !visible;
    });

    const saveNotesBtn = document.getElementById("rrqSaveNotes");
    const notesEl = document.getElementById("rrqNotes");
    if (saveNotesBtn) saveNotesBtn.disabled = frozen;
    if (notesEl) notesEl.disabled = frozen;

    const matchActions = document.getElementById("rrqNeedsMatchingActions");
    if (matchActions) {
      matchActions.querySelectorAll("[data-match-action]").forEach((btn) => {
        btn.disabled = frozen || rejected || published;
      });
    }

    const legend = document.getElementById("rrqActionLegend");
    if (legend) {
      if (frozen) {
        legend.textContent =
          "Frozen: decisions blocked. Unfreeze restores Under Review. Freeze is not Reject or Approve.";
      } else if (rejected) {
        legend.textContent = "Rejected: no Publish from this item. Reason is stored in Notes.";
      } else if (approved) {
        legend.textContent =
          "Approved (decision only). Next: Edit Draft / Preview → Manual Publish. Approve never auto-publishes.";
      } else if (needsMatching) {
        legend.textContent =
          "Needs Matching: Attach existing, Create Parent (new), Reject, Keep Under Review, or Freeze.";
      } else if (published) {
        legend.textContent =
          "Published: use Recruitments → Manual Update for Admit Card / Result on the same canonical page.";
      } else {
        legend.textContent =
          "Approve ≠ Publish. Freeze ≠ Reject. Under Review = decision deferred. After Approve: Generator → Preview → Manual Publish.";
      }
    }
  }

  function renderWorkflowGuidance(item) {
    const grid = document.getElementById("rrqWorkflowGrid");
    const focusNote = document.getElementById("rrqFocusedUpdateNote");
    if (!grid) return;
    if (!item) {
      grid.innerHTML = `
        <div><dt>Current status</dt><dd>—</dd></div>
        <div><dt>What this means</dt><dd>—</dd></div>
        <div><dt>Next available action</dt><dd>—</dd></div>
      `;
      if (focusNote) {
        focusNote.hidden = true;
        focusNote.textContent = "";
      }
      return;
    }
    const wf = (item && item.workflow) || {};
    const status = wf.currentStatus || item?.status || "—";
    grid.innerHTML = `
      <div>
        <dt>Current status</dt>
        <dd><span class="${statusClass(status)}">${escapeHtml(String(status).replace(/_/g, " "))}</span></dd>
      </div>
      <div>
        <dt>What this means</dt>
        <dd>${escapeHtml(wf.meaning || "—")}</dd>
      </div>
      <div>
        <dt>Next available action</dt>
        <dd>${escapeHtml(wf.nextAction || "—")}</dd>
      </div>
      <div>
        <dt>Approve meaning</dt>
        <dd>${escapeHtml(wf.approveMeans || "Approve is not publish.")}</dd>
      </div>
    `;
    if (focusNote) {
      const updateId = item && item.update_id;
      if (updateId) {
        focusNote.hidden = false;
        focusNote.textContent = `Focused from Monitoring update #${updateId}. This detail is the selected review item — not a generic unrelated queue page.`;
      } else {
        focusNote.hidden = true;
        focusNote.textContent = "";
      }
    }
  }

  function renderContextPanel(item) {
    const grid = document.getElementById("rrqContextGrid");
    if (!grid) return;
    if (!item) {
      grid.innerHTML = "";
      return;
    }
    const processor =
      item.processor_output && typeof item.processor_output === "object" ? item.processor_output : {};
    const raw = item.raw_notice && typeof item.raw_notice === "object" ? item.raw_notice : {};
    const siteName = processor.siteName || raw.siteName || "—";
    const sourceUrl = item.source_url || raw.link || "—";
    const updateId = item.update_id || raw.updateId || "—";
    const detectedAt = formatDate(item.created_at || raw.detectedAt);
    grid.innerHTML = `
      <div><dt>SOURCE</dt><dd>${escapeHtml(siteName)}</dd></div>
      <div><dt>Official URL</dt><dd>${
        sourceUrl && sourceUrl !== "—"
          ? `<a class="rrq-source-link" href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(sourceUrl)}</a>`
          : "—"
      }</dd></div>
      <div><dt>UPDATE</dt><dd>${escapeHtml(item.title || "—")}</dd></div>
      <div><dt>Update type</dt><dd>${escapeHtml(labelizeEvent(item.event_type) || "—")}</dd></div>
      <div><dt>Detected</dt><dd>${escapeHtml(detectedAt)}</dd></div>
      <div><dt>Update ID</dt><dd>${escapeHtml(String(updateId))}</dd></div>
      <div><dt>RECRUITMENT</dt><dd>${escapeHtml(recruitmentLabel(item))}</dd></div>
      <div><dt>Review ID</dt><dd>${escapeHtml(String(item.id || "—"))}</dd></div>
    `;
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
      recruitment_id: document.getElementById("filterRecruitmentId")?.value || "",
      update_id: focusedUpdateId ? String(focusedUpdateId) : ""
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
    if (filters.update_id) params.set("update_id", filters.update_id);
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

  function recruitmentLabel(item) {
    if (!item) return "Not matched yet";
    const title =
      item.recruitment_title ||
      item.recruitmentTitle ||
      (item.assist && (item.assist.recruitmentTitle || item.assist.recruitment_title)) ||
      (item.payload && (item.payload.recruitmentTitle || item.payload.recruitment_title));
    if (title) return String(title);
    if (item.recruitment_id != null && item.recruitment_id !== "") {
      return `Recruitment #${item.recruitment_id}`;
    }
    return "Not matched yet";
  }

  function detectedContentSummary(item) {
    if (!item) return "—";
    const normalized = item.normalized_notice;
    if (typeof normalized === "string" && normalized.trim()) return normalized.trim();
    if (normalized && typeof normalized === "object") {
      const text =
        normalized.text ||
        normalized.summary ||
        normalized.content ||
        normalized.title;
      if (text) return String(text);
      return prettyJson(normalized);
    }
    const raw = item.raw_notice;
    if (typeof raw === "string" && raw.trim()) return raw.trim().slice(0, 2000);
    if (raw && typeof raw === "object") {
      const text = raw.text || raw.content || raw.title || raw.snippet;
      if (text) return String(text).slice(0, 2000);
    }
    return item.title || "—";
  }

  function setAttachSelection(id, title) {
    const idEl = document.getElementById("rrqAttachRecruitmentId");
    const labelEl = document.getElementById("rrqAttachRecruitmentLabel");
    const searchEl = document.getElementById("rrqAttachRecruitmentSearch");
    const suggestions = document.getElementById("rrqAttachSuggestions");
    if (idEl) idEl.value = id ? String(id) : "";
    if (labelEl) {
      labelEl.textContent = id
        ? `Selected: ${title || `Recruitment #${id}`}`
        : "No recruitment selected";
    }
    if (searchEl && title) searchEl.value = title;
    if (suggestions) {
      suggestions.hidden = true;
      suggestions.innerHTML = "";
    }
  }

  function renderRows(items) {
    const tbody = document.getElementById("rrqTableBody");
    if (!tbody) return;

    if (!items.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="rrq-empty">No review items found.</td></tr>`;
      return;
    }

    tbody.innerHTML = items
      .map((item) => {
        const source = item.source_url
          ? `<a class="rrq-source-link" href="${escapeHtml(item.source_url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.source_url)}</a>`
          : "—";
        const selected = selectedId === item.id ? " is-selected" : "";
        return `<tr data-id="${item.id}" class="${selected}">
          <td>${escapeHtml(item.title || "—")}</td>
          <td><span class="${statusClass(item.status)}">${escapeHtml(item.status || "—")}</span></td>
          <td>${escapeHtml(item.event_type || "—")}</td>
          <td>${escapeHtml(recruitmentLabel(item))}</td>
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
    const updatedAt = history.updatedAt ?? item?.updated_at;
    const status = history.status ?? item?.status;
    const decision = history.decision ?? item?.decision;
    const notes = history.notes ?? item?.notes;
    const frozen =
      history.frozen === true || String(status || "").toLowerCase() === "frozen";
    const trail = Array.isArray(history.trail) ? history.trail : [];

    const trailHtml = trail.length
      ? `<div class="rrq-detail-full">
          <dt>Trail</dt>
          <dd><ul class="rrq-history-trail">${trail
            .map(
              (step) =>
                `<li><strong>${escapeHtml(step.event || "event")}</strong>${
                  step.detail ? `: ${escapeHtml(step.detail)}` : ""
                }${step.at ? ` · ${escapeHtml(formatDate(step.at))}` : ""}</li>`
            )
            .join("")}</ul></dd>
        </div>`
      : "";

    grid.innerHTML = `
      <div>
        <dt>Created Time</dt>
        <dd>${escapeHtml(formatDate(createdAt))}</dd>
      </div>
      <div>
        <dt>Updated</dt>
        <dd>${escapeHtml(formatDate(updatedAt))}</dd>
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
      ${trailHtml}
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
    const contextHost = document.getElementById("rrqNeedsMatchingContext");
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
        "AI MATCH: Uncertain — choose how this update relates to a Recruitment.";
    }

    const draftId = resolveDraftId(item);
    const linked = item && item.linked_draft;
    const pageSlug =
      (linked && linked.publishedSlug) ||
      item.canonical_page_slug ||
      item.public_page_slug ||
      null;
    if (contextHost) {
      const summary = document.getElementById("rrqNeedsMatchingSummary");
      if (summary) {
        const conversionRequired = Boolean(
          processor.conversionRequired ||
            (processor.conversionError && typeof processor.conversionError === "object")
        );
        const extractionQuality = processor.extractionQuality || null;
        const validationStatus =
          (processor.contentValidation && processor.contentValidation.status) ||
          (extractionQuality && extractionQuality.status) ||
          null;
        const validationProblems = []
          .concat(
            (processor.contentValidation && processor.contentValidation.problems) || []
          )
          .concat(
            (processor.contentValidation && processor.contentValidation.warnings) || []
          );
        const extractionNote =
          extractionQuality && extractionQuality.lowConfidence
            ? extractionQuality.code || "EXTRACTION_LOW_CONFIDENCE"
            : extractionQuality && extractionQuality.code
              ? extractionQuality.code
              : "—";
        const conversionNote = conversionRequired
          ? "Conversion failed/weak — Review item preserved; retry in Generator."
          : validationProblems.length
            ? validationProblems
                .slice(0, 3)
                .map((p) => p.message || p.code)
                .join("; ")
            : "—";
        const mode =
          processor.generatorMode ||
          (processor.mergeContext && processor.mergeContext.generatorMode) ||
          "—";
        const canon =
          pageSlug
            ? "/" + String(pageSlug).replace(/^\//, "")
            : (processor.canonicalPage && processor.canonicalPage.slug
                ? "/" + String(processor.canonicalPage.slug).replace(/^\//, "")
                : "Not linked yet");
        const matchLevel =
          processor.matchLevel ||
          (processor.matching && processor.matching.matchLevel) ||
          item.match_level ||
          "—";
        const decision =
          String(item.status || "").toLowerCase() === "needs_matching"
            ? "Human must attach correct Recruitment (never auto-publish)"
            : mode === "UPDATE" || mode === "UPDATE EXISTING PAGE"
              ? "Human: Generator → Preview → Manual Publish (UPDATE EXISTING PAGE)"
              : "Human: Generator → Preview → Manual Publish (CREATE NEW CANONICAL PAGE)";
        const repairBits = [];
        if (!item.recruitment_id) repairBits.push("missing recruitment");
        if (canon === "Not linked yet" && ["admit_card", "answer_key", "result", "final_result"].includes(String(item.event_type || "").toLowerCase())) {
          repairBits.push("missing canonical page — BLOCK UPDATE");
        }
        if (processor.canonicalAmbiguous || (processor.mergeContext && processor.mergeContext.blocked)) {
          repairBits.push("canonical page blocked/ambiguous");
        }
        summary.innerHTML = `
          <div><dt>Detected document</dt><dd>${escapeHtml(labelizeEvent(item.event_type) || item.title || "—")}</dd></div>
          <div><dt>Document type</dt><dd>${escapeHtml(labelizeEvent(item.event_type) || "—")}</dd></div>
          <div><dt>Source</dt><dd>${
            item.source_url
              ? `<a class="rrq-source-link" href="${escapeHtml(item.source_url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.source_url)}</a>`
              : "—"
          }</dd></div>
          <div><dt>Source verification</dt><dd>${
            item.source_url
              ? `<a class="header-action-btn header-action-btn--ghost" href="${escapeHtml(item.source_url)}" target="_blank" rel="noopener noreferrer">${
                  /\.pdf(\?|#|$)/i.test(String(item.source_url))
                    ? "Open Official PDF"
                    : "Open Official Notice"
                }</a>${
                  draftId
                    ? ` <a class="header-action-btn header-action-btn--ghost" href="/generator?draftId=${encodeURIComponent(draftId)}&pdfUrl=${encodeURIComponent(item.source_url)}">Verify PDF in Generator</a>`
                    : ""
                }`
              : "—"
          }</dd></div>
          <div><dt>Match confidence</dt><dd>${escapeHtml(matchLevel)}</dd></div>
          <div><dt>Recruitment candidate</dt><dd>${escapeHtml(recruitmentLabel(item))}</dd></div>
          <div><dt>Event</dt><dd>${escapeHtml(labelizeEvent(item.event_type) || "—")}</dd></div>
          <div><dt>Draft</dt><dd>${
            draftId
              ? `<a href="/generator?draftId=${encodeURIComponent(draftId)}">Draft #${escapeHtml(draftId)}</a>`
              : "—"
          }</dd></div>
          <div><dt>Canonical Page</dt><dd>${escapeHtml(canon)}</dd></div>
          <div><dt>Generator Mode</dt><dd>${escapeHtml(mode)}</dd></div>
          <div><dt>Extraction</dt><dd>${escapeHtml(extractionNote)}</dd></div>
          <div><dt>Validation</dt><dd>${escapeHtml(validationStatus || "—")}</dd></div>
          <div><dt>Conversion / Warnings</dt><dd>${escapeHtml(conversionNote)}</dd></div>
          <div><dt>Required human decision</dt><dd>${escapeHtml(decision)}</dd></div>
          ${
            repairBits.length
              ? `<div><dt>REPAIR REQUIRED</dt><dd>${escapeHtml(repairBits.join("; "))}</dd></div>`
              : ""
          }`;
      }
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
      body.innerHTML = '<tr><td colspan="4" class="rrq-empty">No candidates — search by name below to attach an existing Recruitment.</td></tr>';
      return;
    }

    body.innerHTML = candidates
      .map((row) => {
        const rid = row.recruitmentId || row.recruitment_id || (row.kind === "recruitment" ? row.id : "");
        const title = row.title || (rid ? `Recruitment #${rid}` : "—");
        const match = row.level || row.matchLevel || row.kind || "—";
        const slug = row.canonicalSlug || row.page_slug || row.slug || "";
        return `<tr>
          <td>${escapeHtml(title)}${slug ? `<br><small>/${escapeHtml(slug)}</small>` : ""}</td>
          <td>${escapeHtml(match)}</td>
          <td>${escapeHtml(row.score ?? "—")}</td>
          <td>${
            rid
              ? `<button type="button" class="header-action-btn header-action-btn--ghost" data-pick-recruitment="${escapeHtml(
                  rid
                )}" data-pick-title="${escapeHtml(title)}">Use</button>`
              : "—"
          }</td>
        </tr>`;
      })
      .join("");
  }

  function labelizeEvent(value) {
    return String(value || "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  function renderLinkage(item) {
    const panel = document.getElementById("rrqLinkagePanel");
    const meta = document.getElementById("rrqLinkageMeta");
    if (!panel || !meta) return;
    const status = String(item && item.status || "").toLowerCase();
    const hasRecruitment = item && item.recruitment_id;
    const show =
      hasRecruitment &&
      status !== "needs_matching" &&
      status !== "rejected";
    panel.hidden = !show;
    if (!show) {
      meta.innerHTML = "";
      return;
    }
    const draftId =
      (item.linked_draft && item.linked_draft.id) ||
      item.draft_id ||
      item.draftId ||
      item.generator_draft_id ||
      resolveDraftId(item) ||
      "—";
    const eventType = item.event_type || "—";
    const updateId = item.update_id || "—";
    const pageSlug =
      (item.linked_draft && item.linked_draft.publishedSlug) ||
      item.canonical_page_slug ||
      null;
    const draftHref =
      draftId && draftId !== "—"
        ? `/generator?draftId=${encodeURIComponent(draftId)}`
        : null;
    meta.innerHTML = `
      <div><dt>Recruitment</dt><dd>${escapeHtml(recruitmentLabel(item))}</dd></div>
      <div><dt>Update</dt><dd>${escapeHtml(updateId)}</dd></div>
      <div><dt>Event</dt><dd>${escapeHtml(labelizeEvent(eventType))}</dd></div>
      <div><dt>Draft</dt><dd>${
        draftHref
          ? `<a href="${escapeHtml(draftHref)}">Draft #${escapeHtml(draftId)}</a> · <a href="${escapeHtml(draftHref)}">Open Draft</a>`
          : escapeHtml(draftId)
      }</dd></div>
      <div><dt>Public Page</dt><dd>${escapeHtml(pageSlug ? "/" + String(pageSlug).replace(/^\//, "") : "Same permanent page after Manual Publish")}</dd></div>
      <div><dt>Review</dt><dd>${escapeHtml(item.title || `#${item.id}`)} · ${escapeHtml(item.status || "—")}</dd></div>
    `;
  }

  function syncStatusChips() {
    const status = document.getElementById("filterStatus")?.value || "";
    document.querySelectorAll("#rrqStatusChips [data-rrq-status]").forEach((btn) => {
      const active = (btn.getAttribute("data-rrq-status") || "") === status;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-pressed", active ? "true" : "false");
    });
    const legend = document.getElementById("rrqFilterLegend");
    if (legend) {
      if (status === "needs_matching") {
        legend.textContent =
          "Showing: Needs Matching (Review Center filter — associate item with the correct recruitment)";
      } else if (status) {
        legend.textContent = `Showing: ${String(status).replace(/_/g, " ")}`;
      } else {
        legend.textContent = "Showing: All review items";
      }
    }
    const review = document.getElementById("admWfReviewCenter");
    const needs = document.getElementById("admWfNeedsMatching");
    if (review && needs) {
      const isNeeds = status === "needs_matching";
      review.hidden = isNeeds;
      needs.hidden = !isNeeds;
    }
  }

  function applyStatusFromUrl() {
    try {
      const params = new URLSearchParams(window.location.search || "");
      const status = params.get("status");
      if (status == null) return;
      const select = document.getElementById("filterStatus");
      if (!select) return;
      const allowed = new Set(Array.from(select.options).map((o) => o.value));
      if (allowed.has(status)) {
        select.value = status;
      }
    } catch {
      /* ignore */
    }
  }

  function readDeepLinkFromUrl() {
    try {
      const params = new URLSearchParams(window.location.search || "");
      const reviewIdRaw = params.get("id") || params.get("review_id");
      const updateIdRaw = params.get("update_id");
      const reviewId = reviewIdRaw ? parseInt(reviewIdRaw, 10) : null;
      const updateId = updateIdRaw ? parseInt(updateIdRaw, 10) : null;
      return {
        reviewId: Number.isInteger(reviewId) && reviewId > 0 ? reviewId : null,
        updateId: Number.isInteger(updateId) && updateId > 0 ? updateId : null
      };
    } catch {
      return { reviewId: null, updateId: null };
    }
  }

  async function openFocusedReviewFromUrl() {
    const deep = readDeepLinkFromUrl();
    focusedUpdateId = deep.updateId;
    const listMessage = document.getElementById("rrqListMessage");
    const detailMessage = document.getElementById("rrqDetailMessage");

    if (deep.reviewId) {
      await loadDetail(deep.reviewId);
      setMessage(
        detailMessage,
        `Opened review #${deep.reviewId}${deep.updateId ? ` for update #${deep.updateId}` : ""}.`,
        "success"
      );
      return;
    }

    if (!deep.updateId) return;

    const ensure = await apiRequest(`${API_BASE}/ensure-from-update`, {
      method: "POST",
      body: JSON.stringify({ update_id: deep.updateId })
    });

    if (!ensure.ok || !ensure.body || ensure.body.success !== true) {
      setMessage(
        listMessage,
        (ensure.body && ensure.body.message) ||
          `Could not open review for update #${deep.updateId}.`,
        "error"
      );
      return;
    }

    renderDetail(ensure.body.data);
    const created = Boolean(ensure.body.created);
    setMessage(
      detailMessage,
      created
        ? `Created review for Monitoring update #${deep.updateId}. Decide matching / next action below.`
        : `Opened existing review for Monitoring update #${deep.updateId}.`,
      "success"
    );
    // Prefer the focused item's real status over a stale URL status filter
    // so the list stays aligned with the opened review row.
    if (ensure.body.data && ensure.body.data.status) {
      const select = document.getElementById("filterStatus");
      if (select) {
        select.value = String(ensure.body.data.status);
        syncStatusChips();
      }
    }
  }

  function actionOutcomeMessage(action, item) {
    const wf = (item && item.workflow) || {};
    const status = item && item.status ? String(item.status) : action;
    if (action === "approve") {
      return `Approved (decision only). Status: ${status}. Next: ${wf.nextAction || "Manual Publish in Generator."}`;
    }
    if (action === "reject") {
      return `Rejected. Status: ${status}. Will not draft/publish from this item.`;
    }
    if (action === "under-review") {
      return `Marked Under Review — decision deferred. Status: ${status}. No public change.`;
    }
    if (action === "freeze") {
      return `Frozen — hold for investigation (not Reject/Approve). Unfreeze to continue.`;
    }
    if (action === "unfreeze") {
      return `Unfrozen → Under Review. Continue Approve / Reject / matching as needed.`;
    }
    return `Updated: ${action}. Status: ${status}.`;
  }

  async function runAction(action) {
    if (!selectedId) return;
    const detailMessage = document.getElementById("rrqDetailMessage");
    setMessage(detailMessage, "");

    const notes = document.getElementById("rrqNotes")?.value ?? "";
    if (action === "reject" && !String(notes).trim()) {
      setMessage(detailMessage, "Reject requires a reason in Notes.", "error");
      document.getElementById("rrqNotes")?.focus();
      return;
    }

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
    setMessage(detailMessage, actionOutcomeMessage(action, result.body.data), "success");
    await loadList();
  }

  function renderDetail(item) {
    selectedItem = item;
    selectedId = item ? item.id : null;
    const panel = document.getElementById("rrqDetailPanel");
    if (!panel) return;

    if (!item) {
      panel.hidden = true;
      syncManualPublishLink(null);
      syncActionAvailability(null);
      renderWorkflowGuidance(null);
      renderContextPanel(null);
      return;
    }

    panel.hidden = false;
    const matchResult = item.match_result || {};
    const assist = item.assist || null;
    const meta = document.getElementById("rrqDetailMeta");
    if (meta) {
      meta.innerHTML = `
        <span>Title: <strong>${escapeHtml(item.title || "—")}</strong></span>
        <span>Status: <span class="${statusClass(item.status)}">${escapeHtml(item.status || "—")}</span></span>
        <span>Decision: <strong>${escapeHtml(item.decision || "—")}</strong></span>
        <span>Recruitment: <strong>${escapeHtml(recruitmentLabel(item))}</strong></span>
        <span>Confidence: <strong>${escapeHtml(item.confidence || "—")}</strong></span>
        <span>Created: <strong>${escapeHtml(formatDate(item.created_at))}</strong></span>
      `;
    }

    renderDecisionAssist(assist);
    renderComparison(assist);
    renderNeedsMatching(item);
    renderLinkage(item);
    renderHistory(assist, item);
    renderWorkflowGuidance(item);
    renderContextPanel(item);
    syncManualPublishLink(item);
    syncActionAvailability(item);
    setAttachSelection("", "");

    const notesEl = document.getElementById("rrqNotes");
    if (notesEl) notesEl.value = item.notes || "";

    const fields = {
      title: item.title,
      event_type: item.event_type,
      confidence: item.confidence,
      matchedSignals: matchResult.matchedSignals,
      conflictingSignals: matchResult.conflictingSignals,
      source_url: item.source_url,
      match_result: item.match_result,
      raw_notice: item.raw_notice,
      normalized_notice: item.normalized_notice,
      processor_output: item.processor_output,
      nm_title: item.title,
      nm_status: `${item.event_type || "—"} · ${item.status || "—"} · confidence ${item.confidence || "—"}`,
      nm_content: detectedContentSummary(item)
    };
    Object.keys(fields).forEach((key) => {
      const el = document.querySelector(`[data-field="${key}"]`);
      if (el) el.textContent = prettyJson(fields[key]);
    });
  }

  function nextStepMessage(action, item) {
    const name = recruitmentLabel(item);
    const draftId =
      (item && item.linked_draft && item.linked_draft.id) || resolveDraftId(item);
    const draftHint = draftId
      ? ` Open Generator with draft: /generator?draftId=${draftId}`
      : " Open Generator when a draft is ready.";
    const messages = {
      attach: `Attached to ${name}. Next: Generator → Preview → Manual Publish/Update (same permanent page).${draftHint}`,
      create_parent: `Parent Recruitment created${item && item.recruitment_id ? ` (#${item.recruitment_id})` : ""}. Next: Generator → Preview → Manual Publish.${draftHint}`,
      standalone:
        "Left standalone — no Recruitment was created or attached. Detected content remains available. Next: Create Parent or Attach later, or reject if not needed.",
      reject: "Rejected — no Recruitment or page change."
    };
    return messages[action] || `Resolved: ${action}`;
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
    setMessage(detailMessage, nextStepMessage(action, result.body.data), "success");
    await loadList();
  }

  async function loadList() {
    const listMessage = document.getElementById("rrqListMessage");
    setMessage(listMessage, "");

    const result = await apiRequest(`${API_BASE}?${buildListQuery(currentPage)}`);
    if (!result.ok || !result.body || result.body.success !== true) {
      const tbody = document.getElementById("rrqTableBody");
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="7" class="rrq-empty">Could not load review items.</td></tr>`;
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
    syncStatusChips();
    await loadList();
  });

  document.getElementById("resetFiltersBtn")?.addEventListener("click", async () => {
    document.getElementById("filterSearch").value = "";
    document.getElementById("filterStatus").value = "";
    document.getElementById("filterEventType").value = "";
    document.getElementById("filterRecruitmentId").value = "";
    focusedUpdateId = null;
    currentPage = 1;
    syncStatusChips();
    await loadList();
  });

  document.getElementById("filterStatus")?.addEventListener("change", () => {
    syncStatusChips();
  });

  document.getElementById("rrqStatusChips")?.addEventListener("click", async (event) => {
    const btn = event.target.closest("[data-rrq-status]");
    if (!btn) return;
    const status = btn.getAttribute("data-rrq-status") || "";
    const select = document.getElementById("filterStatus");
    if (select) select.value = status;
    currentPage = 1;
    syncStatusChips();
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
      setMessage(
        document.getElementById("rrqDetailMessage"),
        "Select an existing Recruitment (Use a candidate or search by name).",
        "error"
      );
      return;
    }
    if (action === "reject") {
      const notes = document.getElementById("rrqNotes")?.value || "";
      if (!String(notes).trim()) {
        setMessage(
          document.getElementById("rrqDetailMessage"),
          "Reject requires a reason in Notes.",
          "error"
        );
        document.getElementById("rrqNotes")?.focus();
        return;
      }
    }
    await resolveMatching(action, recruitmentId || undefined);
  });

  document.getElementById("rrqCandidateBody")?.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-pick-recruitment]");
    if (!btn) return;
    setAttachSelection(
      btn.getAttribute("data-pick-recruitment") || "",
      btn.getAttribute("data-pick-title") || ""
    );
  });

  let attachSearchTimer = null;
  async function searchRecruitmentsForAttach(query) {
    const suggestions = document.getElementById("rrqAttachSuggestions");
    if (!suggestions) return;
    const q = String(query || "").trim();
    if (q.length < 2) {
      suggestions.hidden = true;
      suggestions.innerHTML = "";
      return;
    }
    const result = await apiRequest(
      `/api/admin/recruitments?search=${encodeURIComponent(q)}&limit=8`
    );
    const rows =
      result.ok && result.body && result.body.success === true && Array.isArray(result.body.data)
        ? result.body.data
        : [];
    if (!rows.length) {
      suggestions.innerHTML = `<div class="rrq-attach-empty">No matching recruitments</div>`;
      suggestions.hidden = false;
      return;
    }
    suggestions.innerHTML = rows
      .map((row) => {
        const title = row.title || `Recruitment #${row.id}`;
        return `<button type="button" class="rrq-attach-option" data-pick-recruitment="${escapeHtml(
          row.id
        )}" data-pick-title="${escapeHtml(title)}">${escapeHtml(title)}</button>`;
      })
      .join("");
    suggestions.hidden = false;
  }

  document.getElementById("rrqAttachRecruitmentSearch")?.addEventListener("input", (event) => {
    const value = event.target.value;
    if (attachSearchTimer) clearTimeout(attachSearchTimer);
    attachSearchTimer = setTimeout(() => searchRecruitmentsForAttach(value), 250);
  });

  document.getElementById("rrqAttachSuggestions")?.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-pick-recruitment]");
    if (!btn) return;
    setAttachSelection(
      btn.getAttribute("data-pick-recruitment") || "",
      btn.getAttribute("data-pick-title") || ""
    );
  });

  document.getElementById("rrqSaveNotes")?.addEventListener("click", saveNotes);

  applyStatusFromUrl();
  syncStatusChips();
  (async function initReviewCenter() {
    await openFocusedReviewFromUrl();
    await loadList();
  })();
})();
