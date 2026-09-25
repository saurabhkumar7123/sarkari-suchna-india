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
    sourcesPagination: { page: 1, limit: 50, total: 0 },
    recruitments: [],
    reviews: [],
    drafts: [],
    workflow: [],
    audit: [],
    settings: FALLBACK_SETTINGS,
    selectedRecruitmentId: null,
    selectedReviewId: null,
    workflowSelected: new Set(),
    lastVerifyReport: null,
    detailSourceId: null
  };

  const LEGACY_HASH_REDIRECTS = {
    accDrafts: "/admin/automation-control-center/drafts",
    accPublishingControls: "/admin/automation-control-center/controls",
    accAudit: "/admin/automation-control-center/logs",
    accSettings: "/admin/automation-control-center/controls",
    accSources: "/admin/monitoring",
    accInsights: "/admin/automation-control-center/insights",
    accWorkflow: "/admin/automation-control-center/queue",
    accReview: "/admin/automation-control-center/reviews",
    accRecruitments: "/admin/automation-control-center/recruitments",
    accMonitoring: "/admin/automation-control-center/health",
    accDashboard: "/admin/automation-control-center"
  };

  function getAccPageId() {
    return document.body.getAttribute("data-acc-page") || "overview";
  }

  function redirectLegacyAccHash() {
    if (getAccPageId() !== "overview") return false;
    const hashId = (window.location.hash || "").replace(/^#/, "");
    const dest = LEGACY_HASH_REDIRECTS[hashId];
    if (!dest) return false;
    window.location.replace(dest);
    return true;
  }

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
      state.sourcesPagination = {
        page: 1,
        limit: 50,
        total: state.sources.length
      };
      state.recruitments = Array.isArray(snapshot.recruitments) ? snapshot.recruitments : [];
      state.reviews = Array.isArray(snapshot.reviews) ? snapshot.reviews : [];
      state.drafts = Array.isArray(snapshot.drafts) ? snapshot.drafts : [];
      state.workflow = Array.isArray(snapshot.workflow) ? snapshot.workflow : [];
      state.audit = Array.isArray(snapshot.audit) ? snapshot.audit : [];
      state.settings = snapshot.settings || FALLBACK_SETTINGS;
      if (getAccPageId() === "sources") {
        await loadSourcesPage(state.sourcesPagination.page);
      }
    } catch (err) {
      toastError(err.message || "ACC APIs are unavailable");
    }
  }

  async function loadSourcesPage(page) {
    const search = (qs("accSourceSearch")?.value || "").trim();
    const health = qs("accSourceHealthFilter")?.value || "";
    const enabled = qs("accSourceEnabledFilter")?.value || "";
    const limit = state.sourcesPagination.limit || 50;
    const params = new URLSearchParams({
      page: String(Math.max(1, Number(page) || 1)),
      limit: String(limit)
    });
    if (search) params.set("search", search);
    if (health) params.set("health", health);
    if (enabled) params.set("enabled", enabled);
    const response = await (async () => {
      if (typeof window.adminSafeFetch !== "function") {
        throw new Error("Authenticated admin fetch is unavailable");
      }
      return window.adminSafeFetch(`/api/admin/automation-control-center/sources?${params.toString()}`);
    })();
    if (!response || response.success !== true) {
      throw new Error((response && response.message) || "Failed to load sources");
    }
    state.sources = Array.isArray(response.data) ? response.data : [];
    state.sourcesPagination = {
      page: Number(response.pagination?.page || page || 1),
      limit: Number(response.pagination?.limit || limit),
      total: Number(response.pagination?.total || state.sources.length)
    };
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
    renderPublishingControls();
    renderManualWorkflow();
    renderActiveSources();
    renderRecentPipelineActivity();
    renderOperatorOverview();
    renderOverviewCards();
  }

  function na(value) {
    if (value === undefined || value === null || value === "") return "Not available";
    return String(value);
  }

  function toneClass(tone) {
    const t = String(tone || "off").toLowerCase();
    if (t === "on" || t === "ready" || t === "green") return "is-on";
    if (t === "blocked" || t === "lock" || t === "locked") return "is-blocked";
    if (t === "warn" || t === "warning" || t === "yellow" || t === "pending") return "is-warn";
    if (t === "error") return "is-error";
    if (t === "safe" || t === "dormant") return "is-safe";
    return "is-off";
  }

  function applyPillTone(el, state) {
    if (!el) return;
    el.classList.remove("is-on", "is-off", "is-blocked", "is-warn", "is-error", "is-safe");
    const normalized = String(state || "OFF").toUpperCase();
    if (normalized.includes("BLOCK") || normalized.includes("LOCK")) el.classList.add("is-blocked");
    else if (normalized === "ON" || normalized === "RUNNING" || normalized === "ONLINE" || normalized === "AVAILABLE") el.classList.add("is-on");
    else if (normalized.includes("DORMANT") || normalized.includes("SAFE")) el.classList.add("is-safe");
    else if (normalized === "YELLOW" || normalized === "WARNING" || normalized === "PENDING") el.classList.add("is-warn");
    else if (normalized === "ERROR") el.classList.add("is-error");
    else el.classList.add("is-off");
  }

  function formatShortTime(value) {
    if (!value || value === "Not available") return "Not available";
    const time = Date.parse(value);
    if (!Number.isFinite(time)) return String(value);
    try {
      return new Date(time).toLocaleString();
    } catch {
      return String(value);
    }
  }

  function renderOperatorOverview() {
    if (getAccPageId() !== "overview") return;
    const op = state.dashboard?.operatorOverview;
    if (!op) {
      setText("accOverallState", "Not available");
      setText("accOverallExplain", "Operator overview data is not available from the backend.");
      return;
    }

    const overall = op.overall || {};
    const strip = op.statusStrip || {};
    const safety = op.safety || {};
    const flags = state.dashboard?.flags || {};
    const runtime = state.dashboard?.runtime || {};

    setText("accOverallState", overall.state || "Not available");
    setText("accOverallExplain", overall.explanation || "Not available");
    const overallDot = qs("accOverallDot");
    if (overallDot) {
      overallDot.classList.remove("is-safe", "is-off", "is-blocked", "is-on", "is-warn");
      overallDot.classList.add(toneClass(overall.tone || "safe"));
    }

    const monitoringItem = strip.monitoring || {};
    const schedulerItem = strip.scheduler || {};
    const aiItem = strip.aiDraft || {};
    const autoPublishItem = strip.autoPublish || {};
    const telegramItem = strip.telegram || {};
    const workerItem = strip.worker || {};
    const gatewayItem = strip.notificationGateway || {};
    const reviewPipelineOn = flags.RECRUITMENT_PIPELINE_ENABLED === true;

    setText("accTopMonitoringState", monitoringItem.state || "OFF");
    setText("accTopMonitoringStateMirror", monitoringItem.state || "OFF");
    setText(
      "accTopMonitoringExplain",
      monitoringItem.state === "ON"
        ? "Official sources monitoring is authorized."
        : "Official sources are not being monitored automatically."
    );
    applyPillTone(document.querySelector('.acc-status-tile[data-status="monitoring"]'), monitoringItem.state);

    const schedulerState = schedulerItem.state || "OFF";
    setText("accTopSchedulerState", schedulerState);
    setStateBadge("accSchedulerStatusBadge", schedulerState);
    setText(
      "accTopSchedulerExplain",
      schedulerState === "OFF"
        ? "No automatic monitoring cycle is running."
        : "Scheduler flags differ from full OFF; process details are in Scheduler."
    );
    applyPillTone(document.querySelector('.acc-status-tile[data-status="scheduler"]'), schedulerState);

    setText("accTopAiState", aiItem.state || "OFF");
    setText(
      "accTopAiExplain",
      aiItem.state === "OFF"
        ? "AI processing is not running automatically."
        : aiItem.explanation || "AI draft conversion state from backend flags."
    );
    applyPillTone(document.querySelector('.acc-status-tile[data-status="ai"]'), aiItem.state);

    setText("accTopReviewPipelineState", reviewPipelineOn ? "ON" : "OFF");
    setText(
      "accTopReviewPipelineExplain",
      reviewPipelineOn
        ? "Recruitment pipeline flag is ON."
        : "Recruitment pipeline is not authorized."
    );
    applyPillTone(document.querySelector('.acc-status-tile[data-status="review-pipeline"]'), reviewPipelineOn ? "ON" : "OFF");

    const telegramState = telegramItem.state || "OFF";
    setText("accTopTelegramState", telegramState);
    setStateBadge("accTelegramStatusBadge", telegramState);
    setText("accTopTelegramExplain", telegramState === "ON" ? "Telegram delivery flags are armed." : "Telegram delivery is OFF.");
    applyPillTone(document.querySelector('.acc-status-tile[data-status="telegram"]'), telegramState);

    const gatewayState = gatewayItem.state || "OFF";
    setText("accTopGatewayState", gatewayState);
    setText("accTopGatewayExplain", gatewayState === "ON" ? "Notification gateway is armed." : "Notification gateway is OFF.");
    applyPillTone(document.querySelector('.acc-status-tile[data-status="gateway"]'), gatewayState);

    const workerState = workerItem.state || "OFF";
    setText("accTopWorkerState", workerState);
    setText(
      "accTopWorkerExplain",
      workerState === "OFF"
        ? "Worker is not authorized to run automation jobs."
        : "Worker availability does not mean automation is authorized."
    );
    applyPillTone(document.querySelector('.acc-status-tile[data-status="worker"]'), workerState);

    const autoPublishState = autoPublishItem.state === "BLOCKED" || autoPublishItem.state === "LOCKED"
      ? "LOCKED"
      : (autoPublishItem.state || "LOCKED");
    setText("accTopAutoPublishState", autoPublishState);
    setStateBadge("accAutoPublishStatusBadge", "LOCKED OFF");
    setText("accTopAutoPublishExplain", "Human publish is required.");
    applyPillTone(document.querySelector('.acc-status-tile[data-status="auto-publish"]'), "LOCKED");

    setText(
      "accSafetyActivation",
      state.dashboard?.isDormant ? "OFF / DORMANT" : (safety.automationActivation || "OFF")
    );
    setText("accSafetyAutoPublish", "LOCKED / HUMAN REQUIRED");
    setText("accSafetyHumanPublish", "REQUIRED");
    setText("accSafetyMutation", safety.productionMutation || "BLOCKED");
    setText("accPublishingModeStatus", "MANUAL REVIEW ONLY");
    setText("accPublishingModeBadge", "Publishing Mode: MANUAL REVIEW ONLY");

    const actionsHost = qs("accHumanActionList");
    if (actionsHost) {
      const actions = buildHumanActionCards(op);
      if (!actions.length) {
        actionsHost.innerHTML = `<p class="acc-empty">Nothing requires your action right now.</p>`;
      } else {
        actionsHost.innerHTML = actions.map((action) => `
          <article class="acc-action-card">
            <div>
              <strong>${escapeHtml(action.what)}</strong>
              <span class="acc-action-card__why">${escapeHtml(action.why)}</span>
            </div>
            <a href="${escapeHtml(action.href)}" class="header-action-btn" style="text-decoration:none;">${escapeHtml(action.action)}</a>
          </article>
        `).join("");
      }
    }

    const monitoring = op.monitoring || {};
    setText("accMonEnabled", monitoring.sourcesEnabled ?? 0);
    setText("accMonHealthy", monitoring.sourcesHealthy ?? 0);
    setText("accMonWarning", monitoring.sourcesWarning ?? 0);
    setText("accMonBlocked", monitoring.sourcesBlocked ?? 0);
    setText("accMonLastCycle", formatShortTime(monitoring.lastCycle));
    setText("accMonUpdates", monitoring.updatesDetected ?? 0);

    const sourceRows = qs("accMonitoringSourceRows");
    if (sourceRows) {
      const rows = Array.isArray(monitoring.sources) ? monitoring.sources : [];
      if (!rows.length) {
        sourceRows.innerHTML = `<tr><td colspan="6" class="acc-empty">No source data returned.</td></tr>`;
      } else {
        sourceRows.innerHTML = rows.map((row) => `
          <tr>
            <td><a href="${escapeHtml(row.href || "/admin/monitoring")}">${escapeHtml(row.name || "Source")}</a></td>
            <td>${escapeHtml(na(row.organization))}</td>
            <td><span class="acc-state ${toneClass(row.tone)}">${escapeHtml(row.status || "OFF")}</span></td>
            <td>${escapeHtml(formatShortTime(row.lastChecked))}</td>
            <td>${escapeHtml(formatShortTime(row.lastChange))}</td>
            <td>${escapeHtml(na(row.reason))}</td>
          </tr>
        `).join("");
      }
    }

    const updatesHost = qs("accRecentUpdatesList");
    if (updatesHost) {
      const updateEvents = (Array.isArray(op.activityTimeline) ? op.activityTimeline : [])
        .filter((event) => event.component === "Updates" || /update/i.test(event.title || ""))
        .slice(0, 8);
      if (!updateEvents.length) {
        updatesHost.innerHTML = `<li class="acc-empty">No recent updates.</li>`;
      } else {
        updatesHost.innerHTML = updateEvents.map((event) => `
          <li>
            <strong>${escapeHtml(event.detail || event.title || "Update")}</strong>
            <span>${escapeHtml(formatShortTime(event.at))} · ${escapeHtml(event.outcome || "")}</span>
            <a href="${escapeHtml(event.href || "/admin/monitoring/updates")}">Open</a>
          </li>
        `).join("");
      }
    }

    const drafts = op.draftQueue || {};
    const workflow = Array.isArray(state.dashboard?.manualWorkflow) ? state.dashboard.manualWorkflow : [];
    const countById = (id) => {
      const stage = workflow.find((row) => row.id === id);
      return stage ? stage.count : null;
    };
    setText("accPipeSourceCount", monitoring.sourcesEnabled ?? "—");
    setText("accPipeUpdateCount", monitoring.updatesDetected ?? countById("detected") ?? 0);
    setText("accPipeExtractCount", "Not available");
    setText("accPipeAiCount", "Not available");
    setText("accPipeMatchCount", drafts.needsReview ?? 0);
    setText("accPipeDraftCount", drafts.waiting ?? countById("draft") ?? 0);
    setText("accPipeReviewCount", drafts.needsReview ?? countById("reviewQueue") ?? 0);
    setText("accPipeApproveCount", drafts.approved ?? countById("manualApproval") ?? 0);
    setText("accPipeGeneratorCount", drafts.waiting ?? 0);
    setText("accPipePublishCount", drafts.published ?? countById("manualPublish") ?? 0);

    const ai = op.ai || {};
    setStateBadge("accAiConversionState", ai.conversion || "OFF");
    setText("accAiLatestExtraction", na(ai.latestExtraction));
    setText("accAiLatestConversion", formatShortTime(ai.latestConversion));
    setText("accAiSuccessful", na(ai.successful));
    setText("accAiWeak", na(ai.weak));
    setText("accAiBlocked", na(ai.blocked));
    setText("accAiNeedsManual", na(ai.needsManualStructure));

    const scheduler = op.scheduler || {};
    setStateBadge("accSchedulerCardStatus", scheduler.status || "OFF");
    setText("accSchedulerDetailStatus", scheduler.status || "OFF");
    setText("accSchedulerLastRun", formatShortTime(scheduler.lastRun));
    setText("accSchedulerNextRun", scheduler.nextRun || "Not available");
    const cycles = na(scheduler.cyclesCompleted);
    const errors = na(scheduler.errors);
    setText(
      "accSchedulerCyclesErrors",
      cycles === "Not available" && errors === "Not available"
        ? "Not available"
        : `${cycles} / ${errors}`
    );

    const telegram = op.telegram || {};
    setText("accTelegramDeliveryState", telegram.delivery || "OFF");
    setText("accGatewayState", gatewayState);
    setText("accTelegramPending", na(telegram.pendingNotifications));
    setText("accTelegramSent", na(telegram.sent));
    setText("accTelegramFailed", na(telegram.failed));
    setText("accTelegramLastError", na(telegram.lastError));

    setStateBadge("accWorkerCardState", workerState);
    setText("accWorkerDetailStatus", workerState);
    setText("accWorkerHeartbeat", na(workerItem.lastHeartbeat));
    setText("accWorkerLastJob", na(workerItem.lastJob));
    setText("accWorkerLastError", na(workerItem.lastError));

    renderErrorGroups(Array.isArray(op.errorsWarnings) ? op.errorsWarnings : []);

    const advanced = op.advanced || {};
    setText("accAdvCycleId", na(advanced.lastCycleId));
    setText("accAdvActivation", safety.activationDecision || advanced.readiness?.decision || runtime.activationDecision || "NO-GO");
    const flagsEl = qs("accAdvFlags");
    if (flagsEl) {
      flagsEl.textContent = JSON.stringify(advanced.flags || flags || {}, null, 2);
    }
    const refsHost = qs("accAdvRefs");
    if (refsHost) {
      const refs = Array.isArray(advanced.refs) ? advanced.refs : [];
      if (!refs.length) {
        refsHost.innerHTML = `<tr><td colspan="6" class="acc-empty">No entity IDs available.</td></tr>`;
      } else {
        refsHost.innerHTML = refs.map((ref) => `
          <tr>
            <td>${escapeHtml(ref.title || "")}</td>
            <td>${escapeHtml(ref.recruitmentId != null ? `Recruitment #${ref.recruitmentId}` : "—")}</td>
            <td>${escapeHtml(ref.updateId != null ? `Update #${ref.updateId}` : "—")}</td>
            <td>${escapeHtml(ref.reviewId != null ? `Review #${ref.reviewId}` : "—")}</td>
            <td>${escapeHtml(ref.draftId != null ? `Draft #${ref.draftId}` : "—")}</td>
            <td>${escapeHtml(ref.event || "—")}</td>
          </tr>
        `).join("");
      }
    }
  }

  function buildHumanActionCards(op) {
    const cards = [];
    const seen = new Set();
    const push = (key, card) => {
      if (seen.has(key)) return;
      seen.add(key);
      cards.push(card);
    };

    const refs = Array.isArray(op?.advanced?.refs) ? op.advanced.refs : [];
    for (const ref of refs) {
      if (ref.reviewId != null) {
        push(`review-${ref.reviewId}`, {
          what: ref.title || `Review #${ref.reviewId}`,
          why: "Needs review",
          action: "Open Review",
          href: "/admin/recruitment-review-queue"
        });
      } else if (ref.draftId != null) {
        push(`draft-${ref.draftId}`, {
          what: `Draft #${ref.draftId}`,
          why: ref.title ? `${ref.title} — awaiting generator / manual publish path` : "Draft waiting",
          action: "Open Generator",
          href: `/generator?draftId=${encodeURIComponent(ref.draftId)}`
        });
      } else if (ref.updateId != null) {
        push(`update-${ref.updateId}`, {
          what: `Update #${ref.updateId}`,
          why: ref.title ? `${ref.title} — needs review` : "Needs review",
          action: "Open Review",
          href: "/admin/monitoring/updates"
        });
      }
    }

    for (const action of Array.isArray(op?.humanActions) ? op.humanActions : []) {
      push(action.id || action.label, {
        what: action.label || "Action required",
        why: "Requires human attention",
        action: action.cta || "Open",
        href: action.href || "#"
      });
    }
    return cards.slice(0, 12);
  }

  function renderErrorGroups(rows) {
    const groups = { critical: [], warning: [], info: [] };
    for (const row of rows) {
      const status = String(row.status || "").toUpperCase();
      const item = `
        <li>
          <strong>${escapeHtml(row.component || "System")}</strong>
          <span>${escapeHtml(row.message || "")}</span>
          <em>${escapeHtml(formatShortTime(row.at))}</em>
          ${row.href ? `<a href="${escapeHtml(row.href)}">Open</a>` : ""}
        </li>`;
      if (status === "ERROR" || status === "CRITICAL") groups.critical.push(item);
      else if (status === "WARNING" || status === "BLOCKED" || status === "YELLOW") groups.warning.push(item);
      else groups.info.push(item);
    }
    const fill = (id, list) => {
      const host = qs(id);
      if (!host) return;
      host.innerHTML = list.length ? list.join("") : `<li class="acc-empty">None</li>`;
    };
    fill("accErrorsCritical", groups.critical);
    fill("accErrorsWarning", groups.warning);
    fill("accErrorsInfo", groups.info);
  }

  function renderOverviewCards() {
    setText("accOverviewSourcesMeta", `${state.sources.length} sources`);
    setText("accOverviewRecruitmentsMeta", `${state.recruitments.length} tracked`);
    setText("accOverviewReviewsMeta", `${state.reviews.length} pending`);
    setText("accOverviewDraftsMeta", `${state.drafts.length} drafts`);
    setText("accOverviewQueueMeta", `${state.workflow.length} items`);
    const health = qs("accSystemHealth")?.textContent || (state.dashboard ? "Integrated" : "Unknown");
    setText("accOverviewHealthMeta", health);
    const flags = state.settings?.runtimeFlags || state.dashboard?.flags || {};
    const onCount = Object.values(flags).filter(Boolean).length;
    setText("accOverviewFlagsMeta", onCount ? `${onCount} flags ON` : "Flags OFF");
  }

  function stateClass(status) {
    const normalized = String(status || "OFF").toUpperCase();
    if (normalized.includes("LOCK") || normalized.includes("BLOCK")) return "is-locked";
    if (normalized === "ON" || normalized === "READY" || normalized === "AVAILABLE" || normalized === "ONLINE" || normalized === "RUNNING" || normalized === "GREEN") return "is-ready";
    if (normalized === "PENDING" || normalized === "YELLOW" || normalized === "WARNING" || normalized === "DORMANT") return "is-pending";
    if (normalized === "ERROR" || normalized === "FAILED") return "is-error";
    return "is-off";
  }

  function setStateBadge(id, status) {
    const el = qs(id);
    if (!el) return;
    const label = String(status || "OFF");
    el.textContent = label;
    el.classList.remove("is-off", "is-on", "is-locked", "is-pending", "is-ready", "is-error");
    el.classList.add(stateClass(label));
  }

  function setSwitch(id, labelId, enabled) {
    const button = qs(id);
    const on = enabled === true;
    if (button) {
      button.setAttribute("aria-checked", on ? "true" : "false");
      button.classList.toggle("is-on", on);
    }
    setText(labelId, on ? "ON" : "OFF");
  }

  function renderPublishingControls() {
    const controls = state.dashboard?.publishingControls || {};
    const scheduler = controls.scheduler || {};
    const telegram = controls.telegram || {};
    const autoPublish = controls.autoPublish || { status: "LOCKED OFF", locked: true };
    const publishingMode = controls.publishingMode || "MANUAL REVIEW ONLY";
    const schedulerStatus = scheduler.status || "OFF";
    const telegramStatus = telegram.status || "OFF";

    const components = Array.isArray(controls.components) ? controls.components : [];
    const activeCount = components.filter((c) => c && c.locked !== true && c.enabled === true).length;
    const automationLabel = controls.dormant
      ? "OFF"
      : activeCount === 0
        ? "OFF"
        : state.dashboard?.runtime?.activationReady
          ? "ON"
          : "PARTIAL";

    setStateBadge("accSchedulerStatusBadge", schedulerStatus);
    setStateBadge("accTelegramStatusBadge", telegramStatus);
    setStateBadge("accAutoPublishStatusBadge", autoPublish.status || "LOCKED OFF");
    setText("accPublishingModeStatus", publishingMode);
    setText("accPublishingModeBadge", `Publishing Mode: ${publishingMode}`);
    setStateBadge("accSafetyAutomationState", automationLabel);
    setText("accSafetyGateState", "ACTIVE");
    setText("accLockPanelStatus", "LOCKED");

    setSwitch("accSchedulerToggle", "accSchedulerToggleLabel", scheduler.enabled === true);
    setText("accSchedulerCurrentStatus", schedulerStatus);
    setStateBadge("accSchedulerStateLabel", schedulerStatus);

    setSwitch("accTelegramToggle", "accTelegramToggleLabel", telegram.enabled === true);
    setText("accTelegramCurrentStatus", telegramStatus);
    setText("accTelegramConfiguredStatus", telegram.configurationStatus || (telegram.configured ? "Configured" : "Not configured"));
    setStateBadge("accTelegramStateLabel", telegramStatus);

    renderOperatorControlCards(controls);
  }

  const CONTROL_GROUPS = [
    { id: "monitoring", label: "Monitoring", ids: ["monitoring"] },
    { id: "crawler", label: "Live crawler", ids: ["crawler"] },
    { id: "aiDraft", label: "AI Draft", ids: ["aiDraft"] },
    { id: "scheduler", label: "Scheduler", ids: ["scheduler"] },
    { id: "notify", label: "Telegram / Notification", ids: ["notificationGateway", "telegram"] },
    { id: "worker", label: "Worker", ids: ["worker"] }
  ];

  function renderOneControlCard(component) {
    const locked = component.locked === true;
    const enabled = component.enabled === true;
    const status = component.status || (enabled ? "ON" : "OFF");
    const deps = Array.isArray(component.dependencies) && component.dependencies.length
      ? component.dependencies.join(", ")
      : "None";
    const unavailableNote = component.unavailableBecause
      ? `<p class="acc-note acc-note--warn" role="status">${escapeHtml(component.unavailableBecause)}</p>`
      : "";
    const configured = component.configurationStatus
      ? `<div><dt>Configuration</dt><dd>${escapeHtml(component.configurationStatus)}</dd></div>`
      : "";
    const effective = component.armed === true || String(status).toUpperCase() === "ON"
      ? "Effective"
      : enabled
        ? "Configured (not effective)"
        : "Off";
    let action = "";
    if (locked) {
      action = `<div class="acc-locked-badge" aria-label="Locked"><strong>LOCKED</strong></div>`;
    } else {
      const nextOn = !enabled;
      const label = enabled ? "Turn OFF" : "Turn ON";
      action = `<button type="button" class="header-action-btn ${enabled ? "header-action-btn--ghost" : "header-action-btn--primary"}" data-control-key="${escapeHtml(component.inputKey || "")}" data-control-next="${nextOn ? "true" : "false"}" data-control-name="${escapeHtml(component.name || "")}">${label}</button>`;
    }
    return `
      <article class="acc-control-card ${locked ? "acc-control-card--locked" : ""}" data-control-id="${escapeHtml(component.id || "")}">
        <div class="acc-control-card__head">
          <div>
            <h3>${escapeHtml(component.name || "")}</h3>
            <p>${escapeHtml(component.purpose || "")}</p>
          </div>
          <strong class="acc-state ${stateClass(status)}" aria-label="Status ${escapeHtml(status)}">${escapeHtml(status)}</strong>
        </div>
        <dl class="acc-control-meta">
          <div><dt>Dependencies</dt><dd>${escapeHtml(deps)}</dd></div>
          <div><dt>If enabled</dt><dd>${escapeHtml(component.enableEffect || "—")}</dd></div>
          <div><dt>If disabled</dt><dd>${escapeHtml(component.disableEffect || "—")}</dd></div>
          <div><dt>Runtime</dt><dd>${escapeHtml(effective)}</dd></div>
          ${configured}
        </dl>
        ${unavailableNote}
        <div class="acc-control-card__actions">${action}</div>
      </article>
    `;
  }

  function renderOperatorControlCards(controls) {
    const host = qs("accOperatorControls");
    if (!host) return;
    const components = Array.isArray(controls.components) ? controls.components : [];
    const actionable = components.filter((component) => component && component.id !== "autoPublish");
    if (!actionable.length) {
      host.innerHTML = `<p class="acc-empty">Control components unavailable.</p>`;
      return;
    }

    const byId = new Map(actionable.map((component) => [component.id, component]));
    const used = new Set();
    const sections = [];

    CONTROL_GROUPS.forEach((group) => {
      const rows = group.ids.map((id) => byId.get(id)).filter(Boolean);
      rows.forEach((row) => used.add(row.id));
      if (!rows.length) return;
      sections.push({ label: group.label, rows });
    });

    const leftover = actionable.filter((component) => !used.has(component.id));
    if (leftover.length) sections.push({ label: "Other", rows: leftover });

    host.innerHTML = sections.map((section) => `
      <section class="acc-control-group" aria-label="${escapeHtml(section.label)}">
        <h3 class="acc-control-group__title">${escapeHtml(section.label)}</h3>
        <div class="acc-control-group__grid">
          ${section.rows.map((component) => renderOneControlCard(component)).join("")}
        </div>
      </section>
    `).join("");
  }

  async function confirmEnable(title, details) {
    if (window.AdminUI && typeof window.AdminUI.simpleConfirm === "function") {
      return window.AdminUI.simpleConfirm({
        title,
        details,
        warnText: "This requires explicit confirmation.",
        confirmLabel: "Confirm",
        variant: "danger"
      });
    }
    return window.confirm(`${title}\n\n${details}`);
  }

  async function toggleControlPayload(payload, confirmTitle, confirmDetails) {
    const ok = await confirmEnable(confirmTitle, confirmDetails);
    if (!ok) return;
    const data = await apiFetch("/api/admin/automation-control-center/controls", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!state.dashboard) state.dashboard = {};
    state.dashboard.publishingControls = data;
    if (data && data.flags) {
      if (!state.dashboard.flags) state.dashboard.flags = {};
      Object.assign(state.dashboard.flags, data.flags);
    }
    renderPublishingControls();
    await loadSnapshot();
    renderAll();
    toastSuccess("Control updated.");
  }

  async function toggleControl(kind, nextEnabled) {
    const payload = kind === "scheduler"
      ? { schedulerEnabled: nextEnabled }
      : { telegramEnabled: nextEnabled };
    const title = kind === "scheduler"
      ? (nextEnabled ? "Turn Scheduler ON?" : "Turn Scheduler OFF?")
      : (nextEnabled ? "Turn Telegram ON?" : "Turn Telegram OFF?");
    const details = kind === "scheduler"
      ? (nextEnabled
        ? "This arms scheduler activation. Effective cycles still need Monitoring + Live crawler. It will not publish pages automatically."
        : "This disarms scheduler activation.")
      : (nextEnabled
        ? "This arms Telegram delivery. Notification Gateway must already be ON. It will not publish pages."
        : "This stops Telegram delivery authorization.");
    await toggleControlPayload(payload, title, details);
  }

  async function onSchedulerToggle() {
    const currentlyOn = qs("accSchedulerToggle")?.getAttribute("aria-checked") === "true";
    await toggleControl("scheduler", !currentlyOn);
  }

  async function onTelegramToggle() {
    const currentlyOn = qs("accTelegramToggle")?.getAttribute("aria-checked") === "true";
    await toggleControl("telegram", !currentlyOn);
  }

  async function onOperatorControlClick(event) {
    const button = event.target.closest("[data-control-key]");
    if (!button) return;
    const key = button.getAttribute("data-control-key");
    const next = button.getAttribute("data-control-next") === "true";
    const name = button.getAttribute("data-control-name") || "Control";
    if (!key) return;
    const payload = { [key]: next };
    const title = next ? `Turn ${name} ON?` : `Turn ${name} OFF?`;
    const details = next
      ? `This will set ${key}=true on the existing canonical automation flags. It will not publish pages automatically. Auto Publish remains locked.`
      : `This will set ${key}=false. Turning OFF is safe and does not bypass other gates.`;
    await toggleControlPayload(payload, title, details);
  }

  function renderManualWorkflow() {
    const host = qs("accManualWorkflow");
    if (!host) return;
    const stages = Array.isArray(state.dashboard?.manualWorkflow) ? state.dashboard.manualWorkflow : [];
    host.innerHTML = stages.map((stage) => `
      <li class="acc-flow__step">
        <span class="acc-state ${stateClass(stage.status)}">${escapeHtml(stage.status || "OFF")}</span>
        <span class="acc-flow__label">${escapeHtml(stage.label || "")}</span>
        <strong class="acc-flow__count">${escapeHtml(stage.count ?? 0)}</strong>
      </li>
    `).join("");
  }

  function renderActiveSources() {
    const host = qs("accActiveSources");
    const countEl = qs("accActiveSourceCount");
    const sources = Array.isArray(state.dashboard?.activeOfficialSources)
      ? state.dashboard.activeOfficialSources
      : [];
    const count = Number.isInteger(state.dashboard?.activeOfficialSourceCount)
      ? state.dashboard.activeOfficialSourceCount
      : sources.length;
    if (countEl) countEl.textContent = `Active official sources: ${count}`;
    if (!host) return;
    if (!sources.length) {
      host.innerHTML = `<p class="acc-empty">No active official sources returned by the backend.</p>`;
      return;
    }
    host.innerHTML = sources.map((source) => `
      <article class="acc-source-pill">
        <strong>${escapeHtml(source.name || "Source")}</strong>
        <span class="acc-state is-ready">${escapeHtml(source.status || "ACTIVE")}</span>
      </article>
    `).join("");
  }

  function renderRecentPipelineActivity() {
    const panel = qs("accRecentActivityPanel");
    const host = qs("accRecentActivity");
    const recent = state.dashboard?.recentPipelineActivity;
    if (!panel || !host) return;
    if (!recent || typeof recent !== "object") {
      panel.hidden = true;
      host.innerHTML = "";
      return;
    }
    const rows = [
      ["lastMonitoring", "Last monitoring event"],
      ["lastDetectedUpdate", "Last detected update"],
      ["lastDraft", "Last draft"],
      ["lastReview", "Last review"],
      ["lastTelegramDelivery", "Last Telegram delivery"]
    ].filter(([key]) => recent[key] && (recent[key].at || recent[key].summary));
    if (!rows.length) {
      panel.hidden = true;
      host.innerHTML = "";
      return;
    }
    panel.hidden = false;
    host.innerHTML = rows.map(([key, label]) => `
      <div>
        <dt>${escapeHtml(label)}</dt>
        <dd>${escapeHtml(recent[key].summary || "-")}<small>${escapeHtml(recent[key].at || "")}</small></dd>
      </div>
    `).join("");
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
    const rows = state.sources || [];
    const body = qs("accSourceRows");
    const empty = qs("accSourceEmpty");
    if (!body || !empty) return;
    empty.hidden = rows.length > 0;
    body.innerHTML = rows.map((source) => {
      const monitoringUrl = source.monitoringUrl || source.notificationUrl || "";
      const stateLabel = source.operationalState || (source.enabled ? "ACTIVE" : "DISABLED");
      const quality = source.qualityGrade || (source.enabled ? "GREEN" : "YELLOW");
      return `
      <tr>
        <td data-label="Organization">
          <strong>${escapeHtml(source.name)}</strong><br>
          <small>${escapeHtml(source.officialDomain || "-")}</small>
        </td>
        <td class="acc-url-cell" data-label="Exact monitoring URL"><a href="${escapeHtml(monitoringUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(monitoringUrl || "-")}</a></td>
        <td data-label="Purpose">${escapeHtml(source.purposeLabel || source.purpose || "—")}</td>
        <td data-label="State"><span class="acc-pill">${escapeHtml(stateLabel)}</span><br><small>Quality: ${escapeHtml(quality)}</small><br><small>${source.enabled ? "Active" : "Disabled"}</small></td>
        <td data-label="Health"><span class="acc-pill">${escapeHtml(formatHealthLabel(source.healthStatus))}</span></td>
        <td data-label="Priority"><span class="acc-pill">${escapeHtml(source.priority || "P1")}</span></td>
        <td data-label="Last checked">
          <small>Checked: ${escapeHtml(source.lastCheckedAt || source.lastVisit || "-")}</small><br>
          <small>OK: ${escapeHtml(source.lastSuccessfulCheck || "-")}</small><br>
          <small>Change: ${escapeHtml(source.lastDetectedChange || "-")}</small>
        </td>
        <td data-label="Failures">${escapeHtml(source.failCount ?? 0)}</td>
        <td class="acc-source-actions" data-label="Actions">
          <button type="button" class="header-action-btn header-action-btn--sm" data-source-id="${escapeHtml(source.id)}" data-action="view">View</button>
          <button type="button" class="header-action-btn header-action-btn--sm" data-source-id="${escapeHtml(source.id)}" data-action="edit">Edit</button>
          <button type="button" class="header-action-btn header-action-btn--sm" data-source-id="${escapeHtml(source.id)}" data-action="verify">Verify</button>
          <button type="button" class="header-action-btn header-action-btn--sm" data-source-id="${escapeHtml(source.id)}" data-action="${source.enabled ? "disable" : "enable"}">${source.enabled ? "Disable" : "Enable"}</button>
          <button type="button" class="header-action-btn header-action-btn--sm" data-source-id="${escapeHtml(source.id)}" data-action="run-check">Run Check</button>
        </td>
      </tr>`;
    }).join("");
    const total = Number(state.sourcesPagination.total || 0);
    const page = Number(state.sourcesPagination.page || 1);
    const limit = Number(state.sourcesPagination.limit || 50);
    const maxPage = Math.max(1, Math.ceil(total / limit) || 1);
    setText("accSourcesPageLabel", `Page ${page} / ${maxPage} (${total} sources)`);
    const prev = qs("accSourcesPrevBtn");
    const next = qs("accSourcesNextBtn");
    if (prev) prev.disabled = page <= 1;
    if (next) next.disabled = page >= maxPage;
  }

  function deriveDomainFromUrl(url) {
    try {
      return new URL(String(url || "")).hostname;
    } catch {
      return "";
    }
  }

  function updateExactUrlPreview() {
    const url = (qs("accFormMonitoringUrl")?.value || "").trim();
    const el = qs("accExactUrlPreview");
    if (!el) return;
    el.textContent = url ? `Exact URL preview: ${url}` : "Exact URL preview: —";
  }

  function renderVerifyReport(report) {
    const host = qs("accVerifyReport");
    if (!host) return;
    state.lastVerifyReport = report || null;
    if (!report) {
      host.hidden = true;
      host.innerHTML = "";
      return;
    }
    const checks = report.checks || {};
    const rows = Object.keys(checks).map((key) => {
      const item = checks[key] || {};
      const mark = item.status === "PASS" ? "✓" : item.status === "BLOCKED" ? "✕" : "✕";
      return `<li><strong>${mark} ${escapeHtml(key)}</strong>: ${escapeHtml(item.status || "-")} — ${escapeHtml(item.detail || "")}</li>`;
    }).join("");
    host.hidden = false;
    host.innerHTML = `
      <div class="acc-verify-report__head ${report.safeToActivate ? "is-pass" : "is-fail"}">
        <strong>Safe to activate: ${report.safeToActivate ? "YES" : "NO"}</strong>
        <span>Quality: ${escapeHtml(report.qualityGrade || (report.safeToActivate ? "GREEN" : "YELLOW"))}</span>
        <span>${escapeHtml(report.message || "")}</span>
      </div>
      <p><strong>Exact URL:</strong> ${escapeHtml(report.exactUrl || "")}</p>
      <p><strong>Verified at:</strong> ${escapeHtml(report.verifiedAt || "-")}</p>
      <ul>${rows}</ul>
      ${report.preview ? `<p><strong>Extracted preview:</strong> ${escapeHtml(report.preview)}</p>` : ""}
      ${Array.isArray(report.reasons) && report.reasons.length ? `<p><strong>Block reasons:</strong> ${escapeHtml(report.reasons.join(" · "))}</p>` : ""}
      <p class="acc-section__sub">No force-activate / ignore-robots control. If YELLOW, save inactive and refine the exact page or selector.</p>
    `;
  }

  function openSourceDialog(id) {
    const source = state.sources.find((item) => String(item.id) === String(id));
    setText("accSourceDialogTitle", source ? "Edit Official Monitoring Source" : "Add Official Monitoring Source");
    qs("accSourceId").value = source?.id || "";
    qs("accFormSourceName").value = source?.name || "";
    qs("accFormSourcePriority").value = source?.priority || "P1";
    const monitoringUrl = source?.monitoringUrl || source?.notificationUrl || "";
    qs("accFormMonitoringUrl").value = monitoringUrl;
    qs("accFormSelector").value = source?.selector || "";
    if (qs("accFormPurpose")) qs("accFormPurpose").value = source?.purpose || "";
    qs("accFormSourceDomain").value = source?.officialDomain || deriveDomainFromUrl(monitoringUrl);
    qs("accFormHealthStatus").value = source?.healthStatus || (source ? "healthy" : "n/a until saved");
    if (qs("accFormEnabled")) {
      qs("accFormEnabled").value = source ? (source.enabled ? "true" : "false") : "false";
    }
    qs("accDeleteSourceBtn").hidden = !source;
    renderVerifyReport(null);
    updateExactUrlPreview();
    qs("accSourceDialog")?.showModal();
  }

  function closeSourceDialog() {
    qs("accSourceDialog")?.close();
  }

  function openSourceDetail(id) {
    const source = state.sources.find((item) => String(item.id) === String(id));
    if (!source) return;
    state.detailSourceId = source.id;
    const body = qs("accSourceDetailBody");
    const monitoringUrl = source.monitoringUrl || source.notificationUrl || "";
    if (body) {
      body.innerHTML = `
        <section>
          <h4>Source</h4>
          <dl class="acc-detail-dl">
            <div><dt>Name</dt><dd>${escapeHtml(source.name || "-")}</dd></div>
            <div><dt>Official host</dt><dd>${escapeHtml(source.officialDomain || "-")}</dd></div>
            <div><dt>Exact URL</dt><dd class="acc-url-cell"><a href="${escapeHtml(monitoringUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(monitoringUrl || "-")}</a></dd></div>
            <div><dt>Purpose</dt><dd>${escapeHtml(source.purposeLabel || source.purpose || "—")}</dd></div>
            <div><dt>Priority</dt><dd>${escapeHtml(source.priority || "P1")}</dd></div>
          </dl>
        </section>
        <section>
          <h4>Monitoring</h4>
          <dl class="acc-detail-dl">
            <div><dt>CSS selector</dt><dd><code>${escapeHtml(source.selector || "—")}</code></dd></div>
            <div><dt>Active</dt><dd>${source.enabled ? "On" : "Off"}</dd></div>
            <div><dt>State</dt><dd>${escapeHtml(source.operationalState || "-")}</dd></div>
            <div><dt>Quality</dt><dd>${escapeHtml(source.qualityGrade || "-")}</dd></div>
            <div><dt>Last check</dt><dd>${escapeHtml(source.lastCheckedAt || source.lastVisit || "-")}</dd></div>
            <div><dt>Last successful check</dt><dd>${escapeHtml(source.lastSuccessfulCheck || "-")}</dd></div>
            <div><dt>Next eligible check</dt><dd>${escapeHtml(source.nextEligibleCheck || "-")}</dd></div>
            <div><dt>Health</dt><dd>${escapeHtml(formatHealthLabel(source.healthStatus))}</dd></div>
            <div><dt>Failure count</dt><dd>${escapeHtml(source.failCount ?? 0)}</dd></div>
            <div><dt>Selector status</dt><dd>${escapeHtml(source.selectorStatus || "configured")}</dd></div>
          </dl>
        </section>
        <section>
          <h4>Policy</h4>
          <p class="acc-section__sub">Policy is evaluated on Verify / Enable. There is no force-activate or robots bypass.</p>
          <dl class="acc-detail-dl">
            <div><dt>Official host validation</dt><dd>Enforced on save/activate</dd></div>
            <div><dt>robots / access</dt><dd>Fail-closed (use Verify for live status)</dd></div>
          </dl>
        </section>
        <section>
          <h4>Activity</h4>
          <dl class="acc-detail-dl">
            <div><dt>Latest check</dt><dd>${escapeHtml(source.lastCheckedAt || source.lastVisit || "-")}</dd></div>
            <div><dt>Latest detection</dt><dd>${escapeHtml(source.lastDetectedChange || "-")}</dd></div>
            <div><dt>Latest error signal</dt><dd>${source.broken ? `Broken / fail count ${escapeHtml(source.failCount ?? 0)}` : "None recorded"}</dd></div>
          </dl>
        </section>
      `;
    }
    const toggle = qs("accDetailToggleBtn");
    if (toggle) toggle.textContent = source.enabled ? "Disable" : "Enable";
    qs("accSourceDetailDialog")?.showModal();
  }

  function closeSourceDetail() {
    state.detailSourceId = null;
    qs("accSourceDetailDialog")?.close();
  }

  async function verifyFromDialog() {
    const monitoringUrl = (qs("accFormMonitoringUrl")?.value || "").trim();
    const selector = (qs("accFormSelector")?.value || "").trim();
    if (!selector) {
      toastError("CSS selector is required before Verify.");
      throw new Error("CSS selector is required before Verify.");
    }
    const id = qs("accSourceId")?.value;
    const report = await apiFetch("/api/admin/automation-control-center/sources/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        monitoringUrl,
        selector,
        excludeId: id || undefined,
        checkDuplicates: true
      })
    });
    renderVerifyReport(report);
    if (report.safeToActivate) toastSuccess("Verification passed.");
    else toastError(report.message || "Verification failed.");
    return report;
  }

  async function openOfficialSiteFromDialog() {
    const url = (qs("accFormMonitoringUrl")?.value || "").trim();
    const domain = deriveDomainFromUrl(url) || (qs("accFormSourceDomain")?.value || "").trim();
    if (!domain) {
      toastError("Enter a monitoring URL first so the official domain can be derived.");
      return;
    }
    const protocol = url.startsWith("http://") ? "http:" : "https:";
    window.open(`${protocol}//${domain}/`, "_blank", "noopener,noreferrer");
  }

  async function saveSourceFromDialog(event) {
    event.preventDefault();
    const id = qs("accSourceId").value;
    const monitoringUrl = qs("accFormMonitoringUrl").value.trim();
    const enabled = qs("accFormEnabled")?.value === "true";
    if (enabled) {
      const report = state.lastVerifyReport;
      const sameUrl = report && report.exactUrl === monitoringUrl;
      if (!report || !report.safeToActivate || !sameUrl) {
        const fresh = await verifyFromDialog();
        if (!fresh.safeToActivate) {
          toastError(fresh.message || "Cannot activate: verification failed.");
          return;
        }
      }
    }
    const payload = {
      name: qs("accFormSourceName").value.trim(),
      priority: qs("accFormSourcePriority").value,
      monitoringUrl,
      notificationUrl: monitoringUrl,
      selector: qs("accFormSelector").value.trim(),
      purpose: qs("accFormPurpose")?.value || "",
      enabled
    };
    if (!payload.selector) {
      toastError("CSS selector is required.");
      return;
    }
    if (/^body$/i.test(payload.selector) && enabled) {
      toastError("Selector 'body' cannot be activated. Choose a stable notice/list selector.");
      return;
    }
    try {
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
      toastSuccess("Source saved.");
    } catch (err) {
      toastError(err.message || "Save failed");
    }
  }

  async function deleteCurrentSource() {
    const id = qs("accSourceId").value;
    if (!id) return;
    await apiFetch(`/api/admin/automation-control-center/sources/${encodeURIComponent(id)}`, { method: "DELETE" });
    await loadSnapshot();
    renderAll();
    closeSourceDialog();
    toastSuccess("Source removed.");
  }

  async function verifySourceById(id) {
    const report = await apiFetch(
      `/api/admin/automation-control-center/sources/${encodeURIComponent(id)}/verify`,
      { method: "POST" }
    );
    openSourceDialog(id);
    renderVerifyReport(report);
    if (report.safeToActivate) toastSuccess("Verification passed.");
    else toastError(report.message || "Verification failed.");
  }

  async function toggleSourceEnabled(id, enable) {
    const path = enable ? "enable" : "disable";
    await apiFetch(`/api/admin/automation-control-center/sources/${encodeURIComponent(id)}/${path}`, {
      method: "POST"
    });
    await loadSnapshot();
    renderAll();
    if (state.detailSourceId && String(state.detailSourceId) === String(id)) {
      openSourceDetail(id);
    }
    toastSuccess(enable ? "Source enabled." : "Source disabled.");
  }

  async function runSourceCheck(id) {
    const data = await apiFetch(
      `/api/admin/automation-control-center/sources/${encodeURIComponent(id)}/run-check`,
      { method: "POST" }
    );
    await loadSnapshot();
    renderAll();
    const reason = data?.result?.reason || "ok";
    toastSuccess(`Run check finished (${reason}). Exact URL: ${data?.exactUrlUsed || ""}`);
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
        <td data-label="Recruitment" class="acc-recruitment-title"><strong>${escapeHtml(item.title)}</strong></td>
        <td data-label="Organization">${escapeHtml(item.department || "-")}</td>
        <td data-label="Stage">${escapeHtml(item.lifecycle_state || "-")}</td>
        <td data-label="Confidence">${escapeHtml(item.confidence || 0)}%</td>
        <td data-label="Status"><span class="acc-pill">${escapeHtml(item.status || "tracked")}</span></td>
        <td data-label="Updated">${escapeHtml(item.updated_at || "-")}</td>
      </tr>
    `).join("");
  }

  function renderRecruitmentDetail(id) {
    const empty = qs("accRecruitmentDetailEmpty");
    const detail = qs("accRecruitmentDetail");
    if (!empty || !detail) return;
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

  function reviewStatusLabel(row) {
    return String(row?.status || row?.logical_status || "").toLowerCase();
  }

  function reviewOpenHref(item) {
    const updateId = item.update_id || item.updateId;
    if (updateId) {
      return `/admin/recruitment-review-queue?update_id=${encodeURIComponent(updateId)}`;
    }
    if (item.id) {
      return `/admin/recruitment-review-queue?review_id=${encodeURIComponent(item.id)}`;
    }
    return "/admin/recruitment-review-queue";
  }

  function renderReviewList() {
    const host = qs("accReviewList");
    if (!host) return;
    const rows = Array.isArray(state.reviews) ? state.reviews : [];
    const matching = rows.filter((row) => reviewStatusLabel(row) === "needs_matching").length;
    const under = rows.filter((row) => ["pending", "under_review"].includes(reviewStatusLabel(row))).length;
    const approved = rows.filter((row) => reviewStatusLabel(row) === "approved").length;
    const frozen = rows.filter((row) => reviewStatusLabel(row) === "frozen").length;
    const rejected = rows.filter((row) => ["rejected", "dismissed"].includes(reviewStatusLabel(row))).length;

    setText("accPageKpiTotal", rows.length);
    setText("accReviewKpiMatching", matching);
    setText("accReviewKpiUnder", under);
    setText("accReviewKpiApproved", approved);
    setText("accReviewKpiFrozen", frozen);
    setText("accReviewKpiRejected", rejected);
    setText("accReviewCountMeta", `${rows.length} item${rows.length === 1 ? "" : "s"} in snapshot`);

    const actionable = rows.filter((row) =>
      ["pending", "under_review", "needs_matching", "frozen"].includes(reviewStatusLabel(row))
    ).slice(0, 12);

    if (!actionable.length) {
      host.innerHTML = `<tr><td colspan="6" class="acc-empty">Nothing requires your action right now.</td></tr>`;
      return;
    }

    host.innerHTML = actionable.map((item) => {
      const status = item.status || "pending";
      const recruitment =
        item.recruitment_title ||
        item.recruitmentTitle ||
        (item.recruitment_id || item.recruitmentId
          ? `Recruitment #${item.recruitment_id || item.recruitmentId}`
          : "Not linked");
      const created = item.created_at || item.createdAt || item.updated_at || item.updatedAt || "Not available";
      return `
        <tr>
          <td data-label="Title"><strong>${escapeHtml(item.title || `Review ${item.id}`)}</strong></td>
          <td data-label="Event">${escapeHtml(item.event_type || item.eventType || "—")}</td>
          <td data-label="Recruitment">${escapeHtml(recruitment)}</td>
          <td data-label="Status"><span class="acc-pill">${escapeHtml(status)}</span></td>
          <td data-label="Created">${escapeHtml(formatShortTime(created))}</td>
          <td data-label="Action"><a class="header-action-btn" style="text-decoration:none;" href="${escapeHtml(reviewOpenHref(item))}">Open Review</a></td>
        </tr>
      `;
    }).join("");
  }

  function renderReviewDetail() {
    /* ACC Reviews is a snapshot only — full decision UI lives on Review Queue. */
  }

  function healthFlagLabel(on) {
    return on === true ? "ON" : on === false ? "OFF" : "Not available";
  }

  function renderHealthTables() {
    const flags = state.dashboard?.flags || {};
    const runtime = state.dashboard?.runtime || {};
    const readiness = state.dashboard?.readiness || {};
    const controls = state.dashboard?.publishingControls || {};
    const components = Array.isArray(controls.components) ? controls.components : [];
    const byId = Object.fromEntries(components.map((c) => [c.id, c]));
    const gatewayChannels = Array.isArray(state.dashboard?.notificationGateway)
      ? state.dashboard.notificationGateway
      : [];
    const telegramChannel = gatewayChannels.find((row) => row && row.channel === "telegram");

    const appHost = qs("accHealthAppRows");
    if (appHost) {
      const enterprise = state.dashboard?.enterprise;
      const appStatus = state.dashboard ? "Healthy" : "Unavailable";
      const apiStatus = state.dashboard ? "Healthy" : "Unavailable";
      const dbStatus = enterprise && enterprise.database
        ? (enterprise.database.ok === false ? "Error" : "Healthy")
        : state.dashboard
          ? "Not available"
          : "Unavailable";
      appHost.innerHTML = `
        <tr><td data-label="Component">App</td><td data-label="Status"><span class="acc-state ${stateClass(appStatus)}">${escapeHtml(appStatus)}</span></td><td data-label="Last known">${escapeHtml(state.dashboard ? "Dashboard snapshot loaded" : "Not available")}</td></tr>
        <tr><td data-label="Component">API</td><td data-label="Status"><span class="acc-state ${stateClass(apiStatus)}">${escapeHtml(apiStatus)}</span></td><td data-label="Last known">${escapeHtml(state.dashboard ? "ACC APIs responding" : "Not available")}</td></tr>
        <tr><td data-label="Component">Database</td><td data-label="Status"><span class="acc-state ${stateClass(dbStatus)}">${escapeHtml(dbStatus)}</span></td><td data-label="Last known">${escapeHtml(enterprise?.database?.detail || "Not available")}</td></tr>
      `;
    }

    const runtimeHost = qs("accHealthRuntimeRows");
    if (runtimeHost) {
      const rows = [
        {
          name: "Scheduler",
          configured: healthFlagLabel(flags.SCHEDULER_ACTIVATION_ENABLED),
          effective: runtime.schedulerArmed ? "Armed" : "Off",
          notes: byId.scheduler?.unavailableBecause || readiness.decision || "Not available"
        },
        {
          name: "Worker",
          configured: healthFlagLabel(flags.WORKER_ACTIVATION_ENABLED),
          effective: runtime.workerActive ? "Online" : "Off",
          notes: byId.worker?.unavailableBecause || "Not available"
        },
        {
          name: "Monitoring",
          configured: healthFlagLabel(flags.PRODUCTION_MONITORING_ENABLED),
          effective: flags.PRODUCTION_MONITORING_ENABLED && flags.LIVE_CRAWLER_ENABLED ? "Authorized" : "Off",
          notes: "Official sources managed on /admin/monitoring"
        },
        {
          name: "AI processing",
          configured: healthFlagLabel(flags.AUTO_DRAFT_ENABLED),
          effective: byId.aiDraft?.status || healthFlagLabel(flags.AUTO_DRAFT_ENABLED),
          notes: byId.aiDraft?.unavailableBecause || "Not available"
        }
      ];
      runtimeHost.innerHTML = rows.map((row) => `
        <tr>
          <td data-label="Component">${escapeHtml(row.name)}</td>
          <td data-label="Configured"><span class="acc-state ${stateClass(row.configured)}">${escapeHtml(row.configured)}</span></td>
          <td data-label="Effective"><span class="acc-state ${stateClass(row.effective)}">${escapeHtml(row.effective)}</span></td>
          <td data-label="Notes">${escapeHtml(row.notes || "Not available")}</td>
        </tr>
      `).join("");
    }

    const notifyHost = qs("accHealthNotifyRows");
    if (notifyHost) {
      const gatewayStatus = healthFlagLabel(flags.NOTIFICATION_GATEWAY_ENABLED);
      const telegramStatus = runtime.telegramActive
        ? "ON"
        : flags.TELEGRAM_DELIVERY_ENABLED
          ? (byId.telegram?.status || "BLOCKED")
          : "OFF";
      notifyHost.innerHTML = `
        <tr>
          <td data-label="Component">Gateway</td>
          <td data-label="Status"><span class="acc-state ${stateClass(gatewayStatus)}">${escapeHtml(gatewayStatus)}</span></td>
          <td data-label="Last known">${escapeHtml(gatewayChannels.length ? `${gatewayChannels.length} channel(s)` : "Not available")}</td>
        </tr>
        <tr>
          <td data-label="Component">Telegram</td>
          <td data-label="Status"><span class="acc-state ${stateClass(telegramStatus)}">${escapeHtml(telegramStatus)}</span></td>
          <td data-label="Last known">${escapeHtml(telegramChannel?.detail || byId.telegram?.unavailableBecause || byId.telegram?.configurationStatus || "Not available")}</td>
        </tr>
      `;
    }

    const advanced = qs("accHealthAdvancedBody");
    if (advanced) {
      const payload = {
        activationDecision: runtime.activationDecision || readiness.decision || "Not available",
        activationReady: runtime.activationReady === true,
        blockers: Array.isArray(readiness.blockers) ? readiness.blockers : [],
        isDormant: state.dashboard?.isDormant === true,
        autoPublishBlocked: runtime.autoPublishBlocked !== false
      };
      advanced.textContent = state.dashboard
        ? JSON.stringify(payload, null, 2)
        : "Not available";
    }
  }

  function renderMonitoring() {
    renderHealthTables();
    const host = qs("accMonitorGrid");
    if (!host) return;
    if (host.tagName === "TBODY") {
      if (!state.sources.length) {
        host.innerHTML = `<tr><td colspan="4" class="acc-empty">No source health data in the current snapshot.</td></tr>`;
        return;
      }
      host.innerHTML = state.sources.slice(0, 40).map((source) => `
        <tr>
          <td data-label="Source"><strong>${escapeHtml(source.name || `Source ${source.id}`)}</strong><div class="acc-muted-meta">${escapeHtml(source.officialDomain || "—")}</div></td>
          <td data-label="Health"><span class="acc-pill">${escapeHtml(formatHealthLabel(source.healthStatus))}</span></td>
          <td data-label="Last check">${escapeHtml(formatShortTime(source.lastVisit || source.lastCheckedAt || "Not available"))}</td>
          <td data-label="State">${escapeHtml(source.enabled ? "Enabled" : "Disabled")}</td>
        </tr>
      `).join("");
      return;
    }
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

  function renderDraftViewer() {
    const nav = qs("accDraftNav");
    const preview = qs("accDraftPreview");
    if (!nav || !preview) return;
    if (!state.drafts.length) {
      nav.innerHTML = `<p class="acc-empty">No automation drafts in the current snapshot.</p>`;
      preview.innerHTML = `<p class="acc-empty">Open Generator Drafts to create or edit drafts. Publishing remains manual-only.</p>`;
      return;
    }
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
    if (!state.workflow.length) {
      body.innerHTML = `<tr class="acc-table-empty-row"><td colspan="8"><div class="acc-empty">No workflow queue items in the current snapshot.</div></td></tr>`;
      return;
    }
    body.innerHTML = state.workflow.map((item) => `
      <tr>
        <td data-label="Select"><input type="checkbox" data-workflow-id="${escapeHtml(item.id)}" ${state.workflowSelected.has(item.id) ? "checked" : ""}></td>
        <td data-label="Item">${escapeHtml(item.item || "-")}</td>
        <td data-label="Status"><span class="acc-pill">${escapeHtml(item.status || "-")}</span></td>
        <td data-label="Priority">${escapeHtml(item.priority || "-")}</td>
        <td data-label="Department">${escapeHtml(item.department || "-")}</td>
        <td data-label="Source">${escapeHtml(item.source || "-")}</td>
        <td data-label="Updated">${escapeHtml(item.updatedAt || "-")}</td>
        <td data-label="Retry">${escapeHtml(item.retry || "No")}</td>
      </tr>
    `).join("");
  }

  function renderAudit() {
    const body = qs("accAuditRows");
    if (!body) return;
    if (!state.audit.length) {
      body.innerHTML = `<tr class="acc-table-empty-row"><td colspan="5"><div class="acc-empty">No automation audit events in the current snapshot.</div></td></tr>`;
      return;
    }
    body.innerHTML = state.audit.map((item) => `
      <tr>
        <td data-label="Time">${escapeHtml(item.time || "-")}</td>
        <td data-label="Category">${escapeHtml(item.category || "-")}</td>
        <td data-label="Event">${escapeHtml(item.event || "-")}</td>
        <td data-label="Entity">${escapeHtml(item.entity || "-")}</td>
        <td data-label="Summary">${escapeHtml(item.summary || "-")}</td>
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
    const conf = qs("accSettingConfidenceThreshold");
    const risk = qs("accSettingRiskThreshold");
    if (conf) conf.value = state.settings.thresholds?.confidenceThreshold ?? 82;
    if (risk) risk.value = state.settings.thresholds?.riskThreshold ?? 58;
    const review = qs("accSettingReviewRules");
    const draft = qs("accSettingDraftRules");
    const recovery = qs("accSettingRecoveryRules");
    const department = qs("accSettingDepartmentRules");
    if (review) review.value = state.settings.rules?.reviewRules ?? "";
    if (draft) draft.value = state.settings.rules?.draftRules ?? "";
    if (recovery) recovery.value = state.settings.rules?.recoveryRules ?? "";
    if (department) department.value = state.settings.rules?.departmentRules ?? "";
    const flags = state.settings.runtimeFlags || {};
    const flagList = qs("accFlagList");
    if (!flagList) return;
    flagList.innerHTML = Object.keys(flags).map((key) => `
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

  function renderPageKpis() {
    const page = getAccPageId();
    const sourcesOnline = state.sources.filter((item) => item.healthStatus === "healthy").length;
    const sourcesOffline = state.sources.filter((item) => item.healthStatus === "offline").length;
    const sourcesWarning = state.sources.filter((item) => ["warning", "slow"].includes(String(item.healthStatus || ""))).length;
    const processing = state.workflow.filter((item) => !["approved", "rejected"].includes(String(item.status || "").toLowerCase())).length;
    const done = state.workflow.filter((item) => ["approved", "rejected"].includes(String(item.status || "").toLowerCase())).length;
    const avgConfidence = state.recruitments.length
      ? Math.round(state.recruitments.reduce((sum, item) => sum + Number(item.confidence || 0), 0) / state.recruitments.length)
      : 0;
    const flags = state.settings?.runtimeFlags || state.dashboard?.flags || {};
    const onFlags = Object.values(flags).filter(Boolean).length;
    const runtime = state.dashboard?.runtime || {};

    if (page === "sources") {
      setText("accPageKpiTotal", state.sources.length);
      setText("accPageKpiHealthy", sourcesOnline);
      setText("accPageKpiWarning", sourcesWarning);
      setText("accPageKpiOffline", sourcesOffline);
    }
    if (page === "recruitments") {
      setText("accPageKpiTotal", state.recruitments.length);
      setText("accPageKpiConfidence", `${avgConfidence}%`);
      setText("accPageKpiProcessing", processing);
    }
    if (page === "reviews") setText("accPageKpiTotal", state.reviews.length);
    if (page === "drafts") setText("accPageKpiTotal", state.drafts.length);
    if (page === "queue") {
      setText("accPageKpiTotal", state.workflow.length);
      setText("accPageKpiPending", processing);
      setText("accPageKpiDone", done);
    }
    if (page === "insights") {
      setText("accPageKpiConfidence", `${avgConfidence}%`);
      setText("accPageKpiFlags", onFlags);
    }
    if (page === "health") {
      const overall = !state.dashboard
        ? "Unavailable"
        : state.dashboard.isDormant
          ? "Healthy"
          : runtime.activationReady
            ? "Healthy"
            : sourcesOffline > 0
              ? "Degraded"
              : "Healthy";
      setText("accPageKpiHealth", overall);
      setText(
        "accHealthOverallExplain",
        !state.dashboard
          ? "Backend health data is not available."
          : state.dashboard.isDormant
            ? "Automation is dormant and safe. No components are actively cycling."
            : runtime.activationReady
              ? "Activation readiness reports ready."
              : "Runtime is restricted; check Controls for component state."
      );
      const dot = qs("accHealthOverallDot");
      if (dot) {
        dot.classList.remove("is-safe", "is-warn", "is-error");
        if (overall === "Unavailable" || overall === "Degraded") dot.classList.add("is-warn");
        else if (overall === "Error") dot.classList.add("is-error");
        else dot.classList.add("is-safe");
      }
      setText("accPageKpiHealthy", sourcesOnline);
      setText("accPageKpiOffline", sourcesOffline);
      setText(
        "accPageKpiAutomation",
        runtime.activationReady ? "Ready" : state.dashboard?.isDormant ? "Dormant" : "Restricted"
      );
    }
    if (page === "logs") setText("accPageKpiTotal", state.audit.length);
  }

  function renderAll() {
    const page = getAccPageId();
    renderDashboard();
    renderPageKpis();
    if (page === "sources") renderSources();
    if (page === "recruitments") {
      renderRecruitments();
      if (state.recruitments[0]) renderRecruitmentDetail(state.recruitments[0].id);
    }
    if (page === "reviews") {
      renderReviewList();
    }
    if (page === "drafts") renderDraftViewer();
    if (page === "queue") renderWorkflow();
    if (page === "insights") renderInsights();
    if (page === "health") renderMonitoring();
    if (page === "logs") renderAudit();
    if (page === "controls") renderSettings();
    if (page === "insights") renderCharts();
  }

  function bindEvents() {
    qs("accRefreshBtn")?.addEventListener("click", async () => {
      await loadSnapshot();
      renderAll();
      toastSuccess("ACC refreshed.");
    });
    qs("accOpenPaletteBtn")?.addEventListener("click", () => window.AdminCommandPalette?.open?.());
    qs("accSourceSearch")?.addEventListener("input", () => {
      loadSourcesPage(1).then(renderSources).catch((err) => toastError(err.message || "Filter failed"));
    });
    qs("accSourceEnabledFilter")?.addEventListener("change", () => {
      loadSourcesPage(1).then(renderSources).catch((err) => toastError(err.message || "Filter failed"));
    });
    qs("accSourceHealthFilter")?.addEventListener("change", () => {
      loadSourcesPage(1).then(renderSources).catch((err) => toastError(err.message || "Filter failed"));
    });
    qs("accSourcesPrevBtn")?.addEventListener("click", () => {
      const page = Math.max(1, Number(state.sourcesPagination.page || 1) - 1);
      loadSourcesPage(page).then(renderSources).catch((err) => toastError(err.message || "Page failed"));
    });
    qs("accSourcesNextBtn")?.addEventListener("click", () => {
      const page = Number(state.sourcesPagination.page || 1) + 1;
      loadSourcesPage(page).then(renderSources).catch((err) => toastError(err.message || "Page failed"));
    });
    qs("accFormMonitoringUrl")?.addEventListener("input", (event) => {
      if (qs("accFormSourceDomain")) {
        qs("accFormSourceDomain").value = deriveDomainFromUrl(event.target.value);
      }
      updateExactUrlPreview();
    });
    qs("accAddSourceBtn")?.addEventListener("click", () => openSourceDialog());
    qs("accCloseSourceDialog")?.addEventListener("click", closeSourceDialog);
    qs("accCloseSourceDetailDialog")?.addEventListener("click", closeSourceDetail);
    qs("accOpenOfficialSiteBtn")?.addEventListener("click", () => {
      openOfficialSiteFromDialog().catch((err) => toastError(err.message || "Open site failed"));
    });
    qs("accVerifySourceBtn")?.addEventListener("click", () => {
      verifyFromDialog().catch((err) => toastError(err.message || "Verify failed"));
    });
    qs("accSourceForm")?.addEventListener("submit", (event) => {
      saveSourceFromDialog(event).catch((err) => toastError(err.message || "Save failed"));
    });
    qs("accDeleteSourceBtn")?.addEventListener("click", () => {
      deleteCurrentSource().catch((err) => toastError(err.message || "Delete failed"));
    });
    qs("accDetailEditBtn")?.addEventListener("click", () => {
      const id = state.detailSourceId;
      closeSourceDetail();
      if (id) openSourceDialog(id);
    });
    qs("accDetailVerifyBtn")?.addEventListener("click", () => {
      const id = state.detailSourceId;
      if (!id) return;
      verifySourceById(id).catch((err) => toastError(err.message || "Verify failed"));
    });
    qs("accDetailRunCheckBtn")?.addEventListener("click", () => {
      const id = state.detailSourceId;
      if (!id) return;
      runSourceCheck(id).catch((err) => toastError(err.message || "Run check failed"));
    });
    qs("accDetailToggleBtn")?.addEventListener("click", () => {
      const id = state.detailSourceId;
      const source = state.sources.find((item) => String(item.id) === String(id));
      if (!id || !source) return;
      toggleSourceEnabled(id, !source.enabled).catch((err) => toastError(err.message || "Toggle failed"));
    });
    qs("accSourceRows")?.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-source-id]");
      if (!button) return;
      const id = button.getAttribute("data-source-id");
      const action = button.getAttribute("data-action");
      if (action === "view") openSourceDetail(id);
      if (action === "edit") openSourceDialog(id);
      if (action === "verify") {
        verifySourceById(id).catch((err) => toastError(err.message || "Verify failed"));
      }
      if (action === "enable") {
        toggleSourceEnabled(id, true).catch((err) => toastError(err.message || "Enable failed"));
      }
      if (action === "disable") {
        toggleSourceEnabled(id, false).catch((err) => toastError(err.message || "Disable failed"));
      }
      if (action === "run-check") {
        runSourceCheck(id).catch((err) => toastError(err.message || "Run check failed"));
      }
      if (action === "delete") {
        qs("accSourceId").value = id;
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
    qs("accReviewList")?.addEventListener("click", () => {
      /* Snapshot rows use Open Review links — no in-page decision UI. */
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
    qs("accSchedulerToggle")?.addEventListener("click", () => {
      onSchedulerToggle().catch((err) => toastError(err.message || "Scheduler control failed"));
    });
    qs("accTelegramToggle")?.addEventListener("click", () => {
      onTelegramToggle().catch((err) => toastError(err.message || "Telegram control failed"));
    });
    qs("accOperatorControls")?.addEventListener("click", (event) => {
      onOperatorControlClick(event).catch((err) => toastError(err.message || "Control update failed"));
    });
  }

  function bindAccSwitcher() {
    const root = document.querySelector("[data-acc-switcher]");
    if (!root) return;

    const bar = root.querySelector(".acc-switcher__bar");
    if (bar) bar.remove();
    const menu = qs("accSwitcherMenu");
    if (menu) menu.hidden = false;

    root.querySelectorAll("a.acc-switcher__option").forEach((link) => {
      link.addEventListener("click", () => {
        try {
          sessionStorage.setItem("accContentEnter", "1");
        } catch (_) {
          /* ignore */
        }
      });
    });
  }

  function bindAccInternalNavHints() {
    document.querySelectorAll(".acc-main a[href*='/admin/automation-control-center']").forEach((link) => {
      link.addEventListener("click", () => {
        try {
          sessionStorage.setItem("accContentEnter", "1");
        } catch (_) {
          /* ignore */
        }
      });
    });
  }

  function playAccContentEnter() {
    const content = qs("accContent");
    if (!content) return;
    let shouldEnter = false;
    try {
      shouldEnter = sessionStorage.getItem("accContentEnter") === "1";
      sessionStorage.removeItem("accContentEnter");
    } catch (_) {
      shouldEnter = false;
    }
    if (!shouldEnter) return;
    const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    content.classList.remove("is-entering");
    // Force reflow so animation restarts reliably after navigation.
    void content.offsetWidth;
    content.classList.add("is-entering");
    window.setTimeout(() => content.classList.remove("is-entering"), 220);
  }

  async function init() {
    if (redirectLegacyAccHash()) return;
    bindAccSwitcher();
    bindAccInternalNavHints();
    playAccContentEnter();
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
