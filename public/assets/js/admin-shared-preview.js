(function () {
  "use strict";

  /**
   * Package 4D — Shared Runtime Preview panel.
   *
   * Single reusable preview representation consumed by both
   * Recruitment Operations and Editorial Review. Reads the shared
   * preview API only; refresh is manual (no polling, no timers).
   */

  const escapeHtml = (value) => String(value ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const labelize = (value) => String(value || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

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

  function host() {
    return document.getElementById("sharedPreviewPanel");
  }

  function badge(kind, label) {
    return `<span class="spv-badge is-${escapeHtml(kind)}">${escapeHtml(label)}</span>`;
  }

  function renderEmpty(text) {
    const el = host();
    if (!el) return;
    el.innerHTML = `<p class="spv-empty">${escapeHtml(text || "Select a recruitment to load its shared preview.")}</p>`;
  }

  function renderError(message) {
    const el = host();
    if (!el) return;
    el.innerHTML = `<p class="spv-empty is-error">${escapeHtml(message)}</p>`;
  }

  function renderSnapshot(preview, diagnostics, recruitmentId) {
    const el = host();
    if (!el) return;
    const snapshot = preview.snapshot || {};
    const rec = snapshot.recruitment || {};
    const review = snapshot.reviewStatus || {};
    const validation = snapshot.validationSummary || {};
    const integrity = snapshot.integrity || { status: "ok", issues: [] };
    const lifecycle = snapshot.lifecycleSummary || {};
    const pages = snapshot.linkedPages || [];
    const notes = snapshot.operatorNotes || [];
    const draft = snapshot.currentDraft;
    const missing = snapshot.missingDependencies || [];
    const consistency = diagnostics ? diagnostics.consistencyStatus : null;

    el.innerHTML = `
      <div class="spv-head">
        <div>
          <strong>${escapeHtml(rec.title || `Recruitment #${snapshot.recruitmentId}`)}</strong>
          <small class="spv-version" data-snapshot-version>${escapeHtml(snapshot.snapshotVersion || "—")}</small>
        </div>
        <button type="button" class="header-action-btn" data-shared-preview-refresh>↻ Refresh preview</button>
      </div>
      <div class="spv-badges">
        ${badge(review.workflowState || "unknown", review.workflowStateLabel || "Unknown")}
        ${badge(review.bindingStatus || "no_draft", review.bindingStatusLabel || "No Draft")}
        ${badge(integrity.status === "ok" ? "ok" : "fail", integrity.status === "ok" ? "Integrity OK" : `${integrity.issueCount} integrity issue${integrity.issueCount === 1 ? "" : "s"}`)}
        ${consistency ? badge(consistency === "consistent" ? "ok" : "warn", `Consistency: ${labelize(consistency)}`) : ""}
      </div>
      <dl class="spv-grid">
        <dt>Current draft</dt>
        <dd>${draft ? `#${escapeHtml(draft.id)} ${escapeHtml(draft.title || "Untitled")} (${escapeHtml(draft.status || "—")})` : "None bound"}</dd>
        <dt>Validation</dt>
        <dd>${escapeHtml(validation.passed ?? 0)}/${escapeHtml(validation.total ?? 0)} checks passed</dd>
        <dt>Linked pages</dt>
        <dd>${pages.length ? pages.map((page) => `${escapeHtml(page.slug || page.id)}${page.linkStatus === "broken_event_link" ? " (broken event link)" : ""}`).join(", ") : "None"}</dd>
        <dt>Lifecycle</dt>
        <dd>${escapeHtml(labelize(lifecycle.lifecycleState || "—"))} · ${escapeHtml(lifecycle.totalEvents ?? 0)} event${(lifecycle.totalEvents ?? 0) === 1 ? "" : "s"}</dd>
        <dt>Operator notes</dt>
        <dd>${notes.length ? `${notes.length} note${notes.length === 1 ? "" : "s"} · latest: ${escapeHtml((notes[notes.length - 1].text || "(decision marker)").slice(0, 120))}` : "None"}</dd>
        <dt>Snapshot taken</dt>
        <dd>${escapeHtml(snapshot.timestamp || "—")}</dd>
        <dt>Last refresh</dt>
        <dd>${escapeHtml(preview.lastRefresh || "—")}${preview.refreshReason ? ` (${escapeHtml(labelize(preview.refreshReason))})` : ""}</dd>
      </dl>
      ${integrity.issues && integrity.issues.length ? `
        <ul class="spv-issues">
          ${integrity.issues.map((issue) => `<li class="is-${escapeHtml(issue.severity)}">${escapeHtml(issue.message)}</li>`).join("")}
        </ul>` : ""}
      ${missing.length ? `<p class="spv-missing">Missing dependencies: ${missing.map((item) => escapeHtml(labelize(item))).join(", ")}</p>` : ""}
      <p class="spv-note">Advisory preview only — no automatic corrections, no publishing.</p>
    `;

    const refreshBtn = el.querySelector("[data-shared-preview-refresh]");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", () => refresh(recruitmentId));
    }
  }

  async function show(recruitmentId) {
    if (!host()) return;
    if (!recruitmentId) {
      renderEmpty();
      return;
    }
    try {
      const [previewBody, diagnosticsBody] = await Promise.all([
        api(`/api/admin/shared-preview/${encodeURIComponent(recruitmentId)}`),
        api(`/api/admin/shared-preview/${encodeURIComponent(recruitmentId)}/diagnostics`).catch(() => null)
      ]);
      renderSnapshot(previewBody.data, diagnosticsBody ? diagnosticsBody.data : null, recruitmentId);
    } catch (err) {
      renderError(err.message);
    }
  }

  async function refresh(recruitmentId) {
    if (!host() || !recruitmentId) return;
    try {
      await api(`/api/admin/shared-preview/${encodeURIComponent(recruitmentId)}/refresh`, {
        method: "POST",
        body: { reason: "manual" }
      });
      await show(recruitmentId);
    } catch (err) {
      renderError(err.message);
    }
  }

  function clear() {
    renderEmpty();
  }

  window.AdminSharedPreview = { show, refresh, clear };
  renderEmpty();
})();
