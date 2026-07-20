(function () {
  "use strict";

  const FALLBACK_SETTINGS = {
    thresholds: { confidenceThreshold: 82, riskThreshold: 58 },
    rules: {
      reviewRules: "Route low-confidence records to manual review.",
      draftRules: "Draft generation follows AUTO_DRAFT_ENABLED runtime flag.",
      recoveryRules: "History recovery persists to enterprise repositories.",
      departmentRules: "Prioritize official domains and preserve traceability."
    },
    runtimeFlags: {}
  };

  const state = {
    dashboard: null,
    sources: [],
    recruitments: [],
    reviews: [],
    drafts: [],
    workflow: [],
    audit: [],
    settings: FALLBACK_SETTINGS,
    selectedRecruitmentId: null,
    selectedReviewId: null,
    workflowSelected: new Set()
  };

  function qs(id) {
    return document.getElementById(id);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function toastSuccess(message) {
    window.AdminUI?.toastSuccess?.(message);
  }

  function toastError(message) {
    window.AdminUI?.toastError?.(message);
  }

  async function apiFetch(url, options) {
    if (typeof window.adminSafeFetch !== "function") {
      throw new Error("Authenticated admin fetch is unavailable");
    }
    const response = await window.adminSafeFetch(url, options || {});
    if (!response || response.success !== true) {
      throw new Error((response && response.message) || "Request failed");
    }
    return response.data;
  }

  function setText(id, value) {
    const el = qs(id);
    if (el) el.textContent = String(value ?? "");
  }

  function formatHealthLabel(value) {
    return String(value || "unknown").replace(/^\w/, (char) => char.toUpperCase());
  }

  function buildDepartmentOptions(selectId, rows, extractor) {
    const select = qs(selectId);
    if (!select) return;
    const current = select.value;
    const values = [...new Set((rows || []).map(extractor).filter(Boolean))].sort();
    select.innerHTML = `<option value="">All</option>${values
      .map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`)
      .join("")}`;
    select.value = current;
  }

  async function loadSnapshot() {
    try {
      const snapshot = await apiFetch("/api/admin/automation-control-center");
      state.dashboard = snapshot.dashboard || null;
      state.sources = Array.isArray(snapshot.sources) ? snapshot.sources : [];
      state.recruitments = Array.isArray(snapshot.recruitments) ? snapshot.recruitments : [];
      state.reviews = Array.isArray(snapshot.reviews) ? snapshot.reviews : [];
      state.drafts = Array.isArray(snapshot.drafts) ? snapshot.drafts : [];
      state.workflow = Array.isArray(snapshot.workflow) ? snapshot.workflow : [];
      state.audit = Array.isArray(snapshot.audit) ? snapshot.audit : [];
      state.settings = snapshot.settings || FALLBACK_SETTINGS;
    } catch (err) {
      toastError(err.message || "ACC APIs are unavailable");
    }
  }

  function renderDashboard() {
    const flags = state.dashboard?.flags || {};
    const runtime = state.dashboard?.runtime || {};
    const sourcesOnline = state.sources.filter((item) => item.healthStatus === "healthy").length;
    const sourcesOffline = state.sources.filter((item) => item.healthStatus === "offline").length;
    const processing = state.workflow.filter((item) => !["approved", "rejected"].includes(String(item.status || "").toLowerCase())).length;
    const avgConfidence = state.recruitments.length
      ? Math.round(state.recruitments.reduce((sum, item) => sum + Number(item.confidence || 0), 0) / state.recruitments.length)
      : 0;

    setText("accTotalSources", state.sources.length);
    setText("accSourcesOnline", sourcesOnline);
    setText("accSourcesOffline", sourcesOffline);
    setText("accRecruitmentsProcessing", processing);
    setText("accDraftQueue", state.drafts.length);
    setText("accReviewQueue", state.reviews.length);
    setText("accTodayUpdates", state.audit.length);
    setText("accPendingReviews", state.reviews.length);
    setText("accPublishedToday", 0);
    setText("accAverageConfidence", `${avgConfidence}%`);
    setText("accSystemHealth", state.dashboard ? "Integrated" : "Unavailable");
    setText(
      "accAutomationHealth",
      runtime.activationReady ? "Production Ready" : state.dashboard?.isDormant ? "Dormant" : "Restricted"
    );
    setText("accAutomationHealthSub", runtime.activationDecision || "Live runtime status");
    setText("accLastScanHero", `Last scan: ${state.sources[0]?.lastVisit || "Manual only"}`);
    setText("accNextScanHero", runtime.workerActive ? "Worker runtime armed" : "Next planned scan: Not scheduled");
    setText("accRuntimeModeLabel", `Runtime: ${state.dashboard?.isDormant ? "Dormant" : "Live"}`);
    setText("accActivationDecision", `Activation: ${runtime.activationDecision || "NO-GO"}`);
    setText(
      "accPipelineFlagLabel",
      `RECRUITMENT_PIPELINE_ENABLED = ${flags.RECRUITMENT_PIPELINE_ENABLED ? "ON" : "OFF"}`
    );
    setText("accWorkerStatusPill", `Worker: ${runtime.workerActive ? "Active" : "Off"}`);
    setText("accPipelineStatusPill", `Pipeline: ${runtime.pipelineActive ? "Active" : "Off"}`);
    setText("accPublishStatusPill", `Publishing: ${runtime.autoPublishBlocked === false ? "Enabled" : "Manual only"}`);
    setText("accTelegramStatusPill", `Telegram: ${runtime.telegramActive ? "Active" : "Off"}`);
  }

  function renderCharts() {
    if (typeof Chart === "undefined") return;
    const chartDefs = [
      ["accDailyDetectionChart", "line", ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], [4, 5, 3, 6, 4, 5, 2], "#2563eb"],
      ["accDepartmentDistributionChart", "doughnut", ["SSC", "UPSC", "State", "Railway"], [28, 22, 30, 20], "#14b8a6"],
      ["accConfidenceTrendChart", "bar", ["W1", "W2", "W3", "W4"], [74, 79, 82, 86], "#7c3aed"],
      ["accWorkflowTrendChart", "line", ["Detected", "Matching", "Validated", "Review"], [3, 2, 1, 1], "#0ea5e9"],
      ["accInsightsConfidenceChart", "line", ["R1", "R2", "R3", "R4"], [68, 73, 77, 84], "#f59e0b"]
    ];
    chartDefs.forEach(([id, type, labels, points, color]) => {
      const el = qs(id);
      if (!el || el.dataset.chartReady === "1") return;
      el.dataset.chartReady = "1";
      new Chart(el, {
        type,
        data: {
          labels,
          datasets: [{ label: "Value", data: points, borderColor: color, backgroundColor: color, tension: 0.35 }]
        },
        options: { responsive: true, maintainAspectRatio: false }
      });
    });
  }

  function renderSources() {
    buildDepartmentOptions("accSourceDepartmentFilter", state.sources, (row) => row.department);
    const search = (qs("accSourceSearch")?.value || "").trim().toLowerCase();
    const department = qs("accSourceDepartmentFilter")?.value || "";
    const health = qs("accSourceHealthFilter")?.value || "";
    const rows = state.sources.filter((source) => {
      if (department && source.department !== department) return false;
      if (health && source.healthStatus !== health) return false;
      if (!search) return true;
      return [source.name, source.department, source.officialDomain, source.notificationUrl].join(" ").toLowerCase().includes(search);
    });
    const body = qs("accSourceRows");
    const empty = qs("accSourceEmpty");
    if (!body || !empty) return;
    empty.hidden = rows.length > 0;
    body.innerHTML = rows.map((source) => `
      <tr>
        <td><strong>${escapeHtml(source.name)}</strong><br><small>${source.enabled ? "Enabled" : "Disabled"}</small></td>
        <td>${escapeHtml(source.department || "-")}</td>
        <td><span class="acc-pill">${escapeHtml(source.priority || "P1")}</span></td>
        <td>${escapeHtml(source.officialDomain || "-")}</td>
        <td>${escapeHtml(source.crawlInterval || "Manual only")}</td>
        <td>${escapeHtml(source.retryPolicy || "Manual only")}</td>
        <td><span class="acc-pill">${escapeHtml(formatHealthLabel(source.healthStatus))}</span></td>
        <td>${escapeHtml(source.lastVisit || "-")}</td>
        <td>${source.responseTime ? `${escapeHtml(source.responseTime)} ms` : "N/A"}</td>
        <td>
          <button type="button" class="header-action-btn" data-source-id="${escapeHtml(source.id)}" data-action="edit">Edit</button>
          <button type="button" class="header-action-btn" data-source-id="${escapeHtml(source.id)}" data-action="delete">Delete</button>
        </td>
      </tr>
    `).join("");
  }

  function openSourceDialog(id) {
    const source = state.sources.find((item) => String(item.id) === String(id));
    setText("accSourceDialogTitle", source ? "Edit Source" : "Add Source");
    qs("accSourceId").value = source?.id || "";
    qs("accFormSourceName").value = source?.name || "";
    qs("accFormSourceDepartment").value = source?.department || "";
    qs("accFormSourcePriority").value = source?.priority || "P1";
    qs("accFormSourceDomain").value = source?.officialDomain || "";
    qs("accFormNotificationUrl").value = source?.notificationUrl || "";
    qs("accFormPdfUrl").value = source?.pdfUrl || "";
    qs("accFormArchiveUrl").value = source?.archiveUrl || "";
    qs("accFormAllowedDomains").value = source?.allowedDomains || "body";
    qs("accFormCrawlInterval").value = source?.crawlInterval || "Manual only";
    qs("accFormRetryPolicy").value = source?.retryPolicy || "Manual only";
    qs("accFormHealthStatus").value = source?.healthStatus || "healthy";
    qs("accFormResponseTime").value = source?.responseTime || 0;
    qs("accFormEnabled").checked = source?.enabled !== false;
    qs("accDeleteSourceBtn").hidden = !source;
    qs("accSourceDialog")?.showModal();
  }

  function closeSourceDialog() {
    qs("accSourceDialog")?.close();
  }

  async function saveSourceFromDialog(event) {
    event.preventDefault();
    const id = qs("accSourceId").value;
    const payload = {
      name: qs("accFormSourceName").value.trim(),
      department: qs("accFormSourceDepartment").value.trim(),
      priority: qs("accFormSourcePriority").value,
      notificationUrl: qs("accFormNotificationUrl").value.trim(),
      selector: qs("accFormAllowedDomains").value.trim() || "body",
      healthStatus: qs("accFormHealthStatus").value,
      responseTime: Number(qs("accFormResponseTime").value || 0),
      enabled: qs("accFormEnabled").checked
    };
    await apiFetch(
      id ? `/api/admin/automation-control-center/sources/${encodeURIComponent(id)}` : "/api/admin/automation-control-center/sources",
      {
        method: id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }
    );
    await loadSnapshot();
    renderAll();
    closeSourceDialog();
    toastSuccess("Source saved to server-backed ACC.");
  }

  async function deleteCurrentSource() {
    const id = qs("accSourceId").value;
    if (!id) return;
    await apiFetch(`/api/admin/automation-control-center/sources/${encodeURIComponent(id)}`, { method: "DELETE" });
    await loadSnapshot();
    renderAll();
    closeSourceDialog();
    toastSuccess("Source removed from ACC.");
  }

  function renderRecruitments() {
    buildDepartmentOptions("accRecruitmentDepartmentFilter", state.recruitments, (row) => row.department);
    const rows = state.recruitments.filter((item) => {
      const search = (qs("accRecruitmentSearch")?.value || "").trim().toLowerCase();
      const department = qs("accRecruitmentDepartmentFilter")?.value || "";
      const stage = qs("accRecruitmentStageFilter")?.value || "";
      if (department && item.department !== department) return false;
      if (stage && String(item.lifecycle_state || "") !== stage) return false;
      if (!search) return true;
      return [item.title, item.department, item.slug].join(" ").toLowerCase().includes(search);
    });
    const stageSelect = qs("accRecruitmentStageFilter");
    if (stageSelect) {
      const current = stageSelect.value;
      const values = [...new Set(state.recruitments.map((item) => item.lifecycle_state).filter(Boolean))];
      stageSelect.innerHTML = `<option value="">All</option>${values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("")}`;
      stageSelect.value = current;
    }
    const body = qs("accRecruitmentRows");
    if (!body) return;
    body.innerHTML = rows.map((item) => `
      <tr data-recruitment-id="${item.id}">
        <td><strong>${escapeHtml(item.title)}</strong></td>
        <td>${escapeHtml(item.department || "-")}</td>
        <td>${escapeHtml(item.lifecycle_state || "-")}</td>
        <td>${escapeHtml(item.confidence || 0)}%</td>
        <td><span class="acc-pill">${escapeHtml(item.status || "tracked")}</span></td>
        <td>${escapeHtml(item.updated_at || "-")}</td>
      </tr>
    `).join("");
  }

  function renderRecruitmentDetail(id) {
    const item = state.recruitments.find((row) => Number(row.id) === Number(id));
    if (!item) return;
    state.selectedRecruitmentId = item.id;
    qs("accRecruitmentDetailEmpty").hidden = true;
    qs("accRecruitmentDetail").hidden = false;
    setText("accRecruitmentDetailMeta", item.title);
    setText("accRecruitmentCurrentStage", item.lifecycle_state || "-");
    setText("accRecruitmentConfidence", `${item.confidence || 0}%`);
    setText("accRecruitmentStatus", item.status || "tracked");
    setText("accRecruitmentPrediction", item.lifecycle_state || "tracked");
    qs("accRecruitmentMissingInfo").innerHTML = `<span class="acc-chip is-warning">Server persistence active</span>`;
    qs("accRecruitmentTimeline").innerHTML = `<li>Created: ${escapeHtml(item.created_at || "-")}</li><li>Updated: ${escapeHtml(item.updated_at || "-")}</li>`;
    qs("accRecruitmentReviewNotes").textContent = item.advertisement_no || "No review notes recorded.";
    qs("accRecruitmentHistory").innerHTML = `<div class="acc-history-item"><small>Slug</small><strong>${escapeHtml(item.slug || "-")}</strong></div>`;
  }

  function renderReviewList() {
    const host = qs("accReviewList");
    if (!host) return;
    setText("accReviewCountMeta", `${state.reviews.length} items`);
    host.innerHTML = state.reviews.map((item) => `
      <button type="button" class="acc-list-item" data-review-id="${escapeHtml(item.id)}">
        <span class="acc-pill">${escapeHtml(item.status || "pending")}</span>
        <h4>${escapeHtml(item.title || `Review ${item.id}`)}</h4>
        <p>${escapeHtml(item.event_type || "manual review only")}</p>
      </button>
    `).join("");
  }

  function renderReviewDetail(id) {
    const item = state.reviews.find((row) => String(row.id) === String(id));
    if (!item) return;
    state.selectedReviewId = item.id;
    qs("accReviewEmpty").hidden = true;
    qs("accReviewDetail").hidden = false;
    setText("accReviewDetailMeta", item.title || `Review ${item.id}`);
    setText("accReviewConfidence", item.confidence || "-");
    setText("accReviewRisk", item.status || "-");
    setText("accReviewRecommendation", item.decision || "none");
    setText("accReviewHistoryRecovery", item.source_url || "No source URL");
    qs("accValidationReport").innerHTML = `<li>Status: ${escapeHtml(item.status || "pending")}</li>`;
    qs("accReviewWarnings").innerHTML = `<li>Runtime mode: ${escapeHtml(state.dashboard?.runtime?.activationDecision || "NO-GO")}</li>`;
    qs("accReviewMissing").innerHTML = `<li>Publishing blocked: ${escapeHtml(state.dashboard?.runtime?.autoPublishBlocked !== false ? "yes" : "no")}</li>`;
    qs("accPreviousVersion").textContent = JSON.stringify(item.payload || {}, null, 2);
    qs("accNewVersion").textContent = JSON.stringify(item.assist || item.payload || {}, null, 2);
  }

  function renderDraftViewer() {
    const nav = qs("accDraftNav");
    const preview = qs("accDraftPreview");
    if (!nav || !preview) return;
    nav.innerHTML = state.drafts.map((draft, index) => `
      <details ${index === 0 ? "open" : ""}>
        <summary>${escapeHtml(draft.title || `Draft ${draft.id}`)}</summary>
        <p>${escapeHtml(draft.slug_hint || "draft")}</p>
      </details>
    `).join("");
    preview.innerHTML = state.drafts.map((draft) => `
      <section id="draft-${escapeHtml(draft.id)}">
        <h4>${escapeHtml(draft.title || `Draft ${draft.id}`)}</h4>
        <p><strong>Status:</strong> ${escapeHtml(draft.status || "draft")}</p>
        <p><strong>Published slug:</strong> ${escapeHtml(draft.published_slug || "-")}</p>
      </section>
    `).join("");
  }

  function renderWorkflow() {
    const body = qs("accWorkflowRows");
    if (!body) return;
    body.innerHTML = state.workflow.map((item) => `
      <tr>
        <td><input type="checkbox" data-workflow-id="${escapeHtml(item.id)}" ${state.workflowSelected.has(item.id) ? "checked" : ""}></td>
        <td>${escapeHtml(item.item || "-")}</td>
        <td><span class="acc-pill">${escapeHtml(item.status || "-")}</span></td>
        <td>${escapeHtml(item.priority || "-")}</td>
        <td>${escapeHtml(item.department || "-")}</td>
        <td>${escapeHtml(item.source || "-")}</td>
        <td>${escapeHtml(item.updatedAt || "-")}</td>
        <td>${escapeHtml(item.retry || "No")}</td>
      </tr>
    `).join("");
  }

  function renderMonitoring() {
    const host = qs("accMonitorGrid");
    if (!host) return;
    host.innerHTML = state.sources.map((source) => `
      <article class="acc-monitor-card">
        <div class="acc-monitor-card__head">
          <div><h3>${escapeHtml(source.name)}</h3><p>${escapeHtml(source.department || "-")}</p></div>
          <span class="acc-pill">${escapeHtml(formatHealthLabel(source.healthStatus))}</span>
        </div>
        <div class="acc-monitor-card__stats">
          <div><span>Official Source</span><strong>${escapeHtml(source.officialDomain || "-")}</strong></div>
          <div><span>Response Time</span><strong>${escapeHtml(source.responseTime || 0)} ms</strong></div>
          <div><span>Last Visit</span><strong>${escapeHtml(source.lastVisit || "-")}</strong></div>
          <div><span>Activation</span><strong>${escapeHtml(source.enabled ? (state.dashboard?.runtime?.workerActive ? "Worker armed" : "Enabled source") : "Disabled")}</strong></div>
        </div>
      </article>
    `).join("");
  }

  function renderAudit() {
    const body = qs("accAuditRows");
    if (!body) return;
    body.innerHTML = state.audit.map((item) => `
      <tr>
        <td>${escapeHtml(item.time || "-")}</td>
        <td>${escapeHtml(item.category || "-")}</td>
        <td>${escapeHtml(item.event || "-")}</td>
        <td>${escapeHtml(item.entity || "-")}</td>
        <td>${escapeHtml(item.summary || "-")}</td>
      </tr>
    `).join("");
  }

  function renderInsights() {
    const metrics = [
      ["accDepartmentAccuracyBars", [{ label: "Repository health", value: state.dashboard?.enterprise?.repositories ? 100 : 0 }, { label: "Manual approvals", value: 100 }], "%"],
      ["accFailureCategoryBars", [{ label: "Activation blockers", value: state.dashboard?.readiness?.blockers?.length || 0 }, { label: "Active flags", value: Object.values(state.dashboard?.flags || {}).filter(Boolean).length }], ""]
    ];
    metrics.forEach(([id, rows, suffix]) => {
      const host = qs(id);
      if (!host) return;
      host.innerHTML = rows.map((row) => `
        <div class="acc-bar">
          <div class="acc-bar__meta"><span>${escapeHtml(row.label)}</span><strong>${escapeHtml(row.value)}${suffix}</strong></div>
          <div class="acc-bar__track"><div class="acc-bar__fill" style="width:${row.value}%"></div></div>
        </div>
      `).join("");
    });
    const listTargets = {
      accRecoveryAnalytics: "History recovery persists through enterprise recruitment repository.",
      accValidationAnalytics: "Validation runs through production workflow orchestration.",
      accRecommendationAnalytics: "Recommendations route to review queue; auto-publish remains blocked."
    };
    Object.keys(listTargets).forEach((id) => {
      const host = qs(id);
      if (!host) return;
      host.innerHTML = `<div><strong>${escapeHtml(id)}</strong><br><span>${escapeHtml(listTargets[id])}</span></div>`;
    });
  }

  function renderSettings() {
    qs("accSettingConfidenceThreshold").value = state.settings.thresholds?.confidenceThreshold ?? 82;
    qs("accSettingRiskThreshold").value = state.settings.thresholds?.riskThreshold ?? 58;
    qs("accSettingReviewRules").value = state.settings.rules?.reviewRules ?? "";
    qs("accSettingDraftRules").value = state.settings.rules?.draftRules ?? "";
    qs("accSettingRecoveryRules").value = state.settings.rules?.recoveryRules ?? "";
    qs("accSettingDepartmentRules").value = state.settings.rules?.departmentRules ?? "";
    const flags = state.settings.runtimeFlags || {};
    qs("accFlagList").innerHTML = Object.keys(flags).map((key) => `
      <div class="acc-flag ${flags[key] ? "is-locked" : "is-off"}">
        <div><strong>${escapeHtml(key.replace(/_/g, " "))}</strong><br><small>${escapeHtml(key)}</small></div>
        <span>${flags[key] ? "ON" : "OFF"}</span>
      </div>
    `).join("");
  }

  async function saveSettingsForm(event) {
    event.preventDefault();
    await apiFetch("/api/admin/automation-control-center/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        confidenceThreshold: Number(qs("accSettingConfidenceThreshold").value || 82),
        riskThreshold: Number(qs("accSettingRiskThreshold").value || 58),
        reviewRules: qs("accSettingReviewRules").value.trim(),
        draftRules: qs("accSettingDraftRules").value.trim(),
        recoveryRules: qs("accSettingRecoveryRules").value.trim(),
        departmentRules: qs("accSettingDepartmentRules").value.trim()
      })
    });
    await loadSnapshot();
    renderSettings();
    toastSuccess("ACC settings saved on the server.");
  }

  function filterSections() {
    const query = (qs("accGlobalSearch")?.value || "").trim().toLowerCase();
    document.querySelectorAll("[data-acc-searchable]").forEach((section) => {
      const hay = `${section.getAttribute("data-acc-searchable") || ""} ${section.textContent || ""}`.toLowerCase();
      section.classList.toggle("acc-hidden-by-search", Boolean(query) && !hay.includes(query));
    });
  }

  function renderAll() {
    renderDashboard();
    renderSources();
    renderRecruitments();
    renderReviewList();
    renderDraftViewer();
    renderWorkflow();
    renderInsights();
    renderMonitoring();
    renderAudit();
    renderSettings();
    renderCharts();
    if (state.recruitments[0]) renderRecruitmentDetail(state.recruitments[0].id);
    if (state.reviews[0]) renderReviewDetail(state.reviews[0].id);
  }

  function bindEvents() {
    qs("accRefreshBtn")?.addEventListener("click", async () => {
      await loadSnapshot();
      renderAll();
      toastSuccess("ACC refreshed.");
    });
    qs("accOpenPaletteBtn")?.addEventListener("click", () => window.AdminCommandPalette?.open?.());
    qs("accGlobalSearch")?.addEventListener("input", filterSections);
    qs("accSourceSearch")?.addEventListener("input", renderSources);
    qs("accSourceDepartmentFilter")?.addEventListener("change", renderSources);
    qs("accSourceHealthFilter")?.addEventListener("change", renderSources);
    qs("accAddSourceBtn")?.addEventListener("click", () => openSourceDialog());
    qs("accCloseSourceDialog")?.addEventListener("click", closeSourceDialog);
    qs("accSourceForm")?.addEventListener("submit", saveSourceFromDialog);
    qs("accDeleteSourceBtn")?.addEventListener("click", deleteCurrentSource);
    qs("accSourceRows")?.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-source-id]");
      if (!button) return;
      if (button.getAttribute("data-action") === "edit") openSourceDialog(button.getAttribute("data-source-id"));
      if (button.getAttribute("data-action") === "delete") {
        qs("accSourceId").value = button.getAttribute("data-source-id");
        deleteCurrentSource().catch((err) => toastError(err.message || "Delete failed"));
      }
    });
    ["accRecruitmentSearch", "accRecruitmentDepartmentFilter", "accRecruitmentStageFilter"].forEach((id) => {
      qs(id)?.addEventListener(id.includes("Search") ? "input" : "change", renderRecruitments);
    });
    qs("accRecruitmentRows")?.addEventListener("click", (event) => {
      const row = event.target.closest("tr[data-recruitment-id]");
      if (row) renderRecruitmentDetail(Number(row.getAttribute("data-recruitment-id")));
    });
    qs("accReviewList")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-review-id]");
      if (button) renderReviewDetail(button.getAttribute("data-review-id"));
    });
    qs("accDraftSearch")?.addEventListener("input", renderDraftViewer);
    qs("accPrintDraftBtn")?.addEventListener("click", () => window.print());
    qs("accWorkflowRows")?.addEventListener("change", (event) => {
      const checkbox = event.target.closest("[data-workflow-id]");
      if (!checkbox) return;
      const id = checkbox.getAttribute("data-workflow-id");
      if (checkbox.checked) state.workflowSelected.add(id);
      else state.workflowSelected.delete(id);
    });
    qs("accBulkRetryBtn")?.addEventListener("click", () => toastSuccess("Retry placeholder recorded. No workflow executed."));
    qs("accExportAuditBtn")?.addEventListener("click", () => toastSuccess("Audit export placeholder prepared. No publication performed."));
    qs("accSettingsForm")?.addEventListener("submit", (event) => {
      saveSettingsForm(event).catch((err) => toastError(err.message || "Settings save failed"));
    });
  }

  async function init() {
    bindEvents();
    await loadSnapshot();
    renderAll();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      init().catch((err) => toastError(err.message || "ACC init failed"));
    });
  } else {
    init().catch((err) => toastError(err.message || "ACC init failed"));
  }
})();
