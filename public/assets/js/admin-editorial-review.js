(function () {
  "use strict";

  let selectedId = null;
  let workspace = null;

  const DECISION_LABELS = {
    submit_for_review: "Submit for Review",
    start_review: "Start Review",
    approve: "Approve",
    request_changes: "Request Changes",
    reject: "Reject",
    return_to_draft: "Return to Draft",
    reopen_review: "Reopen Review"
  };

  const byId = (id) => document.getElementById(id);
  const escapeHtml = (value) => String(value ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  function message(text, isError) {
    const el = byId("erMessage");
    el.hidden = !text;
    el.textContent = text || "";
    el.classList.toggle("is-error", Boolean(isError));
  }

  async function api(url, options) {
    const opts = { ...(options || {}) };
    if (opts.body && typeof opts.body !== "string") {
      opts.headers = { ...(opts.headers || {}), "Content-Type": "application/json" };
      opts.body = JSON.stringify(opts.body);
    }
    const response = typeof window.fetchAdminWithCsrf === "function"
      ? await window.fetchAdminWithCsrf(url, opts)
      : await fetch(url, { credentials: "include", ...opts });
    if (response.status === 401) {
      window.location.href = "/login?reason=expired";
      throw new Error("Admin session expired");
    }
    const body = await response.json().catch(() => null);
    if (!response.ok || !body || body.success === false) {
      throw new Error(body?.message || `Request failed (${response.status})`);
    }
    return body;
  }

  function badge(status, label) {
    return `<span class="er-badge is-${escapeHtml(status)}">${escapeHtml(label || status)}</span>`;
  }

  function renderInbox(rows) {
    const host = byId("erInboxList");
    byId("erInboxCount").textContent = `${rows.length} item${rows.length === 1 ? "" : "s"}`;
    if (!rows.length) {
      host.innerHTML = '<p class="er-empty" style="padding:1rem 0;">No editorial reviews yet. Attach a draft in Recruitment Operations, then submit for review.</p>';
      return;
    }
    host.innerHTML = rows.map((row) => `<button type="button" class="er-inbox-item ${Number(selectedId) === Number(row.recruitmentId) ? "is-selected" : ""}" data-id="${row.recruitmentId}">
      <strong>${escapeHtml(row.recruitmentTitle || `Recruitment #${row.recruitmentId}`)}</strong>
      <small>${badge(row.workflowState, row.workflowStateLabel)} · ${escapeHtml(row.bindingStatusLabel)} · #${row.recruitmentId}</small>
    </button>`).join("");
    host.querySelectorAll("[data-id]").forEach((btn) => {
      btn.addEventListener("click", () => openWorkspace(btn.dataset.id));
    });
  }

  async function loadInbox() {
    try {
      const state = byId("erWorkflowFilter").value;
      const qs = state ? `?workflow_state=${encodeURIComponent(state)}` : "";
      const body = await api(`/api/admin/editorial-reviews${qs}`);
      renderInbox(body.data || []);
    } catch (err) {
      message(err.message, true);
    }
  }

  function renderWorkspace(data) {
    workspace = data;
    byId("erEmpty").hidden = true;
    byId("erDetail").hidden = false;
    const rec = data.recruitment || {};
    byId("erRecruitmentTitle").textContent = rec.title || `Review #${rec.id}`;
    byId("erStatusLine").innerHTML = `${badge(data.workflowState, data.workflowStateLabel)} ${badge(data.bindingStatus, data.bindingStatusLabel)} <span>Source → Draft → Review</span>`;
    byId("erOpsLink").href = "/admin/recruitments";
    byId("erRecruitmentMeta").innerHTML = `
      <dt>ID</dt><dd>${escapeHtml(rec.id)}</dd>
      <dt>Slug</dt><dd>${escapeHtml(rec.slug || "—")}</dd>
      <dt>Department</dt><dd>${escapeHtml(rec.department || "—")}</dd>
      <dt>Lifecycle</dt><dd>${escapeHtml(rec.lifecycle_state || "—")}</dd>
      <dt>Updated by</dt><dd>${escapeHtml(data.updatedBy || "—")}</dd>
      <dt>Updated at</dt><dd>${escapeHtml(data.updatedAt || "—")}</dd>`;

    const draft = data.draft;
    byId("erDraftPanel").innerHTML = draft
      ? `<p><strong>#${escapeHtml(draft.id)}</strong> ${escapeHtml(draft.title || "Untitled")}</p>
         <p><small>Slug hint: ${escapeHtml(draft.slugHint || "—")} · Status: ${escapeHtml(draft.status)}</small></p>
         <pre style="white-space:pre-wrap;max-height:14rem;overflow:auto;background:#f8fafc;padding:.75rem;border-radius:8px;font-size:.78rem;">${escapeHtml(JSON.stringify(draft.payload || {}, null, 2).slice(0, 4000))}</pre>`
      : '<p class="er-empty" style="padding:1rem 0;">No draft attached. Use Recruitment Operations to attach one.</p>';

    const cmp = data.comparison || {};
    byId("erCompare").innerHTML = `
      <div class="er-compare__col"><h3>Recruitment</h3>
        <div><strong>Title:</strong> ${escapeHtml(cmp.recruitmentTitle || "—")}</div>
        <div><strong>Slug:</strong> ${escapeHtml(cmp.recruitmentSlug || "—")}</div>
        <div><strong>Department:</strong> ${escapeHtml(cmp.recruitmentDepartment || "—")}</div>
        <div><strong>Lifecycle:</strong> ${escapeHtml(cmp.recruitmentLifecycle || "—")}</div>
      </div>
      <div class="er-compare__col"><h3>Draft</h3>
        <div><strong>Title:</strong> ${escapeHtml(cmp.draftTitle || "—")}</div>
        <div><strong>Slug hint:</strong> ${escapeHtml(cmp.draftSlugHint || "—")}</div>
        <div><strong>Status:</strong> ${escapeHtml(cmp.draftStatus || "—")}</div>
      </div>`;

    const validation = data.validation || { checks: [] };
    byId("erValidation").innerHTML = (validation.checks || []).map((check) => `
      <li><span>${escapeHtml(check.label)}<br><small>${escapeHtml(check.detail || "")}</small></span>
      ${badge(check.ok ? "ok" : "fail", check.ok ? "Pass" : "Fail")}</li>`).join("") || "<li>No checks</li>";

    loadContentPipelineGuidance(rec.slug || cmp.draftSlugHint || (draft && draft.slugHint) || "");

    const allowed = data.allowedDecisions || [];
    byId("erDecisions").innerHTML = allowed.length
      ? allowed.map((decision) => `<button type="button" class="header-action-btn${decision === "approve" ? " btn-primary" : ""}" data-decision="${escapeHtml(decision)}">${escapeHtml(DECISION_LABELS[decision] || decision)}</button>`).join("")
      : "<p>No decisions available in the current state.</p>";
    byId("erDecisions").querySelectorAll("[data-decision]").forEach((btn) => {
      btn.addEventListener("click", () => applyDecision(btn.dataset.decision));
    });

    const notes = data.notes || [];
    byId("erNotes").innerHTML = notes.length
      ? notes.slice().reverse().map((note) => `<li>
          <div>${escapeHtml(note.text || "(decision marker)")}</div>
          <small>${escapeHtml(note.operator || "admin")} · ${escapeHtml(note.createdAt || "")}${note.decision ? ` · ${escapeHtml(note.decision)}` : ""}</small>
        </li>`).join("")
      : "<li>No notes yet.</li>";

    const history = data.decisionHistory || [];
    byId("erHistory").innerHTML = history.length
      ? history.slice().reverse().map((item) => `<li>
          <div><strong>${escapeHtml(DECISION_LABELS[item.decision] || item.decision)}</strong>
            ${escapeHtml(item.fromState)} → ${escapeHtml(item.toState)}</div>
          <small>${escapeHtml(item.operator || "admin")} · ${escapeHtml(item.createdAt || "")}${item.comment ? ` · ${escapeHtml(item.comment)}` : ""}</small>
        </li>`).join("")
      : "<li>No decisions yet.</li>";

    // Phase PI-2 — present AI-4 / PI-1 analysis already on the workspace payload.
    // No extra network calls; Pro UI is read-only over this data.
    if (window.EditorialWorkspacePro && typeof window.EditorialWorkspacePro.render === "function") {
      window.EditorialWorkspacePro.render(data);
    }
  }

  async function loadContentPipelineGuidance(slugHint) {
    const progress = byId("erChecklistProgress");
    const checklistEl = byId("erEditorialChecklist");
    const freshnessEl = byId("erFreshnessMeta");
    const linksEl = byId("erLinkSuggestions");
    if (!progress || !checklistEl || !freshnessEl || !linksEl) return;

    const slug = String(slugHint || "")
      .trim()
      .replace(/^\//, "")
      .replace(/\.html$/i, "");
    if (!slug || slug.length < 3) {
      progress.textContent = "No page slug available for Package 4F checklist yet.";
      checklistEl.innerHTML = "";
      freshnessEl.innerHTML = "";
      linksEl.innerHTML = "";
      return;
    }

    progress.textContent = `Loading advisory guidance for /${slug}…`;
    try {
      const [checklistBody, freshnessBody, linksBody] = await Promise.all([
        api(`/api/admin/seo-pipeline/pages/${encodeURIComponent(slug)}/editorial-checklist`),
        api(`/api/admin/seo-pipeline/pages/${encodeURIComponent(slug)}/freshness`),
        api(`/api/admin/seo-pipeline/pages/${encodeURIComponent(slug)}/link-suggestions`)
      ]);
      const checklist = checklistBody.data?.checklist || {};
      progress.textContent = checklist.progressLabel || "Checklist loaded";
      checklistEl.innerHTML = (checklist.items || [])
        .map(
          (item) => `<li><span>${escapeHtml(item.label)}<br><small>${escapeHtml(item.detail || "")}</small></span>
        ${badge(item.ok ? "ok" : "fail", item.ok ? "Done" : "Todo")}</li>`
        )
        .join("") || "<li>No checklist items</li>";

      const freshness = freshnessBody.data?.freshness || {};
      freshnessEl.innerHTML = `
        <dt>Created</dt><dd>${escapeHtml(freshness.createdDate || "—")}</dd>
        <dt>Updated</dt><dd>${escapeHtml(freshness.updatedDate || "—")}</dd>
        <dt>Last review</dt><dd>${escapeHtml(freshness.lastReviewDate || "—")}</dd>
        <dt>Freshness</dt><dd>${escapeHtml(freshness.freshnessLabel || "Unknown")}</dd>`;

      const suggestions = linksBody.data?.suggestions || {};
      const groups = [
        ["Related recruitments", suggestions.relatedRecruitments],
        ["Related departments", suggestions.relatedDepartments],
        ["Related qualifications", suggestions.relatedQualifications],
        ["Related states", suggestions.relatedStates],
        ["Related topics", suggestions.relatedTopics]
      ];
      linksEl.innerHTML = `<p class="er-help">${escapeHtml(linksBody.data?.note || "Suggestions only — no automatic insertion.")}</p>` +
        groups
          .map(([label, rows]) => {
            const list = Array.isArray(rows) ? rows : [];
            if (!list.length) return "";
            return `<div><strong>${escapeHtml(label)}</strong><ul>${list
              .map(
                (row) =>
                  `<li>${escapeHtml(row.title || row.label || row.slug || "—")}${
                    row.href ? ` · <a href="${escapeHtml(row.href)}" target="_blank" rel="noopener">${escapeHtml(row.href)}</a>` : ""
                  }</li>`
              )
              .join("")}</ul></div>`;
          })
          .join("");
    } catch (err) {
      progress.textContent = `Checklist unavailable for /${slug}: ${err.message}`;
      checklistEl.innerHTML = "";
      freshnessEl.innerHTML = "";
      linksEl.innerHTML = "";
    }
  }

  async function openWorkspace(id) {
    selectedId = id;
    try {
      const body = await api(`/api/admin/editorial-reviews/${encodeURIComponent(id)}`);
      renderWorkspace(body.data);
      await loadInbox();
      // Package 4D — shared preview panel (same model as Recruitment Operations).
      if (window.AdminSharedPreview) await window.AdminSharedPreview.show(id);
      message(`Opened review for recruitment #${id}.`);
    } catch (err) {
      message(err.message, true);
    }
  }

  async function applyDecision(decision) {
    if (!selectedId) return;
    try {
      const body = await api(`/api/admin/editorial-reviews/${encodeURIComponent(selectedId)}/decision`, {
        method: "POST",
        body: {
          decision,
          comment: byId("erDecisionComment").value.trim() || null
        }
      });
      byId("erDecisionComment").value = "";
      renderWorkspace(body.data);
      await loadInbox();
      if (window.AdminSharedPreview) await window.AdminSharedPreview.show(selectedId);
      message(`Decision applied: ${DECISION_LABELS[decision] || decision}.`);
      window.AdminOpsNotifications?.push({
        type: window.AdminOpsNotifications.TYPES.REVIEW_COMPLETED,
        text: `Review ${DECISION_LABELS[decision] || decision} for recruitment #${selectedId}`,
        href: `/admin/editorial-review?recruitment_id=${encodeURIComponent(selectedId)}`
      });
      if (decision === "request_changes" || decision === "reject") {
        window.AdminOpsNotifications?.push({
          type: window.AdminOpsNotifications.TYPES.VALIDATION_WARNING,
          text: `Validation follow-up needed after ${DECISION_LABELS[decision] || decision}`,
          href: `/admin/editorial-review?recruitment_id=${encodeURIComponent(selectedId)}`
        });
      }
    } catch (err) {
      message(err.message, true);
    }
  }

  async function addNote(event) {
    event.preventDefault();
    if (!selectedId) return;
    try {
      const body = await api(`/api/admin/editorial-reviews/${encodeURIComponent(selectedId)}/notes`, {
        method: "POST",
        body: { text: byId("erNoteText").value.trim() }
      });
      byId("erNoteText").value = "";
      renderWorkspace(body.data);
      if (window.AdminSharedPreview) await window.AdminSharedPreview.show(selectedId);
      message("Note added.");
    } catch (err) {
      message(err.message, true);
    }
  }

  byId("erWorkflowFilter").addEventListener("change", loadInbox);
  byId("erRefreshBtn").addEventListener("click", async () => {
    await loadInbox();
    if (selectedId) await openWorkspace(selectedId);
  });
  byId("erOpenForm").addEventListener("submit", (event) => {
    event.preventDefault();
    openWorkspace(byId("erOpenId").value);
  });
  byId("erNoteForm").addEventListener("submit", addNote);

  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get("recruitment_id") || params.get("id");
  window.adminPageRefreshHandler = async () => {
    await loadInbox();
    if (selectedId) await openWorkspace(selectedId);
  };

  loadInbox().then(() => {
    if (fromQuery) openWorkspace(fromQuery);
  });
})();
