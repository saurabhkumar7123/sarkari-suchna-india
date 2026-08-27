"use strict";

const {
  fetchSites,
  getSiteById,
  createSite,
  updateSite,
  deleteSite,
  fetchRecentUpdates,
  restoreSite,
  disableSite,
  markSiteChecked,
  saveSiteBaseline
} = require("./updates/updates.repository");
const { assertMonitoringSiteWritable } = require("./updates/monitoringSiteWriteGuard");
const {
  verifyMonitoringSource,
  assertSafeToActivateMonitoringSource,
  normalizePurpose,
  purposeLabel
} = require("./updates/monitoringSourceVerify");
const { checkSite } = require("./updates/siteChecker");
const { isApprovedOfficialMonitoringUrl } = require(
  "../lib/contentIntelligence/sourceIntelligence/officialDomains"
);
const recruitmentService = require("./recruitment.service");
const generatorDraftService = require("./generatorDraft.service");
const recruitmentReviewService = require("./recruitmentReview.service");
const { listActivity } = require("./adminActivity.service");
const automationSettingsRepository = require("../repositories/automationSettings.repository");
const {
  getAutomationFlags,
  FLAG_DEFAULTS,
  canRunAutomationWorkers,
  canRunProductionPipeline,
  canDeliverTelegram,
  canStartMonitoringScheduler,
  isAutoPublishBlocked,
  isAutomationDormant
} = require("../config/automationFlags");
const { getPlatformSnapshot } = require("./enterprise/enterprisePersistence.service");
const { evaluateActivationReadiness } = require("../lib/recruitment/productionRuntime/activationReadiness");
const notificationGateway = require("../lib/enterprise/notificationGateway");
const { isTelegramConfigured } = require("./updates/telegramNotifier");

const AUTO_PUBLISH_KEYS = new Set([
  "AUTO_PUBLISH_ENABLED",
  "autoPublishEnabled",
  "autoPublish",
  "AUTO_PUBLISH"
]);

function isTruthyFlag(value) {
  return value === true || value === 1 || value === "1" || String(value).trim().toLowerCase() === "true";
}

function statusLabel(on) {
  return on ? "ON" : "OFF";
}

function latestTimestamp(rows, fields) {
  let latest = null;
  for (const row of rows || []) {
    for (const field of fields) {
      const value = row && row[field];
      if (!value) continue;
      const time = Date.parse(value);
      if (!Number.isFinite(time)) continue;
      if (!latest || time > latest.time) {
        latest = { time, at: value, row };
      }
    }
  }
  return latest;
}

function getPublishingControlState() {
  const flags = getAutomationFlags();
  const schedulerArmed = canStartMonitoringScheduler();
  const telegramOn = canDeliverTelegram();
  const telegramConfigured = isTelegramConfigured();
  return {
    scheduler: {
      enabled: flags.SCHEDULER_ACTIVATION_ENABLED === true,
      status: schedulerArmed ? "ON" : "OFF",
      running: schedulerArmed === true,
      armed: schedulerArmed === true
    },
    telegram: {
      enabled: telegramOn === true,
      status: statusLabel(telegramOn),
      configured: telegramConfigured === true,
      configurationStatus: telegramConfigured ? "Configured" : "Not configured"
    },
    autoPublish: {
      enabled: false,
      locked: true,
      status: "LOCKED OFF",
      blocked: isAutoPublishBlocked() === true
    },
    publishingMode: "MANUAL REVIEW ONLY",
    dormant: isAutomationDormant() === true
  };
}

function rejectAutoPublishEnable(input = {}) {
  for (const key of Object.keys(input || {})) {
    const looksLikeAutoPublish =
      AUTO_PUBLISH_KEYS.has(key) || String(key).toUpperCase().includes("AUTO_PUBLISH");
    if (looksLikeAutoPublish && isTruthyFlag(input[key])) {
      const err = new Error("AUTO_PUBLISH cannot be enabled");
      err.statusCode = 403;
      throw err;
    }
  }
}

function updatePublishingControls(input = {}) {
  rejectAutoPublishEnable(input);
  process.env.AUTO_PUBLISH_ENABLED = "false";

  if (input.schedulerEnabled === true) {
    process.env.SCHEDULER_ACTIVATION_ENABLED = "true";
  } else if (input.schedulerEnabled === false) {
    process.env.SCHEDULER_ACTIVATION_ENABLED = "false";
  }

  if (input.telegramEnabled === true) {
    process.env.NOTIFICATION_GATEWAY_ENABLED = "true";
    process.env.TELEGRAM_DELIVERY_ENABLED = "true";
  } else if (input.telegramEnabled === false) {
    process.env.NOTIFICATION_GATEWAY_ENABLED = "false";
    process.env.TELEGRAM_DELIVERY_ENABLED = "false";
  }

  return getPublishingControlState();
}

function buildActiveOfficialSources(sourceRows = []) {
  return (sourceRows || [])
    .filter((row) => row && row.enabled === true)
    .map((row) => ({
      id: row.id,
      name: String(row.name || "").trim() || `Source ${row.id}`,
      status: "ACTIVE"
    }));
}

function buildManualWorkflow(updates = [], drafts = [], reviews = [], published = []) {
  const pendingReview = (reviews || []).filter((row) =>
    ["pending", "under_review"].includes(String(row.status || "").toLowerCase())
  );
  const approved = (reviews || []).filter(
    (row) => String(row.status || "").toLowerCase() === "approved"
  );
  return [
    {
      id: "detected",
      label: "Detected Update",
      count: updates.length,
      status: updates.length ? "READY" : "OFF"
    },
    {
      id: "draft",
      label: "Draft",
      count: drafts.length,
      status: drafts.length ? "READY" : "OFF"
    },
    {
      id: "reviewQueue",
      label: "Review Queue",
      count: reviews.length,
      status: reviews.length ? "PENDING" : "OFF"
    },
    {
      id: "manualEdit",
      label: "Manual Edit / Review",
      count: pendingReview.length,
      status: pendingReview.length ? "PENDING" : "OFF"
    },
    {
      id: "manualApproval",
      label: "Manual Approval",
      count: approved.length,
      status: approved.length ? "READY" : "OFF"
    },
    {
      id: "manualPublish",
      label: "Manual Publish",
      count: published.length,
      status: published.length ? "READY" : "OFF"
    }
  ];
}

function buildRecentPipelineActivity({ sources = [], updates = [], drafts = [], reviews = [], activity = [] } = {}) {
  const lastMonitoring = latestTimestamp(sources, ["lastVisit", "lastSuccess", "lastCheckedAt"]);
  const lastDetectedUpdate = latestTimestamp(updates, ["createdAt", "updatedAt"]);
  const lastDraft = latestTimestamp(drafts, ["updated_at", "created_at", "updatedAt", "createdAt"]);
  const lastReview = latestTimestamp(reviews, ["updated_at", "created_at", "updatedAt", "createdAt"]);
  const telegramRows = (activity || []).filter((row) =>
    /telegram/i.test(`${row.action || ""} ${row.event || ""} ${row.summary || ""} ${row.target || ""}`)
  );
  const lastTelegramDelivery = latestTimestamp(telegramRows, ["timestamp", "time"]);

  const recent = {};
  if (lastMonitoring) {
    recent.lastMonitoring = {
      at: lastMonitoring.at,
      summary: lastMonitoring.row.name || "Monitoring event"
    };
  }
  if (lastDetectedUpdate) {
    recent.lastDetectedUpdate = {
      at: lastDetectedUpdate.at,
      summary: lastDetectedUpdate.row.title || lastDetectedUpdate.row.item || "Detected update"
    };
  }
  if (lastDraft) {
    recent.lastDraft = {
      at: lastDraft.at,
      summary: lastDraft.row.title || `Draft ${lastDraft.row.id}`
    };
  }
  if (lastReview) {
    recent.lastReview = {
      at: lastReview.at,
      summary: lastReview.row.title || `Review ${lastReview.row.id}`
    };
  }
  if (lastTelegramDelivery) {
    recent.lastTelegramDelivery = {
      at: lastTelegramDelivery.at,
      summary: lastTelegramDelivery.row.action || lastTelegramDelivery.row.event || "Telegram delivery"
    };
  }
  return Object.keys(recent).length ? recent : null;
}

function toPositiveInt(value, fallback, { min = 1, max = 50 } = {}) {
  const parsed = parseInt(String(value || fallback), 10);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function normalizeString(value, max = 500) {
  return String(value || "").trim().slice(0, max);
}

function paginate(rows, page, limit) {
  const safePage = toPositiveInt(page, 1, { min: 1, max: 100000 });
  const safeLimit = toPositiveInt(limit, 20, { min: 1, max: 100 });
  const start = (safePage - 1) * safeLimit;
  return {
    data: rows.slice(start, start + safeLimit),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total: rows.length
    }
  };
}

function normalizeSourceRow(site) {
  let officialDomain = String(site.officialDomain || "");
  if (!officialDomain) {
    try {
      officialDomain = new URL(String(site.url || "")).hostname;
    } catch {
      officialDomain = "";
    }
  }
  const broken = Number(site.broken) === 1;
  const active = Number(site.active) === 1 || site.enabled === true;
  const healthStatus = broken ? "offline" : active ? "healthy" : "warning";
  const selector = String(site.selector || "").trim();
  const monitoringUrl = String(site.url || "");
  const purpose = normalizePurpose(site.purpose);
  const failCount = Number(site.failCount || 0);
  let operationalState = "DRAFT";
  if (broken) {
    operationalState = failCount > 0 ? "ERROR" : "BLOCKED";
  } else if (active) {
    operationalState = "ACTIVE";
  } else if (site.lastCheckedAt) {
    operationalState = "DISABLED";
  } else {
    operationalState = "DRAFT";
  }

  // Human-curation quality hint (derived; no schema change).
  // Homepage + bare/generic `a` selectors stay YELLOW even if enabled (not auto-promoted GREEN).
  let qualityGrade = "YELLOW";
  if (broken) {
    qualityGrade = "BLOCKED";
  } else if (active && selector && !/^body$/i.test(selector)) {
    let pathname = "/";
    try {
      pathname = new URL(monitoringUrl).pathname || "/";
    } catch {
      pathname = "/";
    }
    const isHomepage = pathname === "/" || pathname === "";
    if (isHomepage && /^a(\[|$)/i.test(selector)) qualityGrade = "YELLOW";
    else qualityGrade = "GREEN";
  }

  return {
    id: Number(site.id),
    name: String(site.name || ""),
    priority: `P${Math.max(0, Math.min(3, Number(site.priority || 1) - 1))}`,
    officialDomain,
    monitoringUrl,
    notificationUrl: monitoringUrl,
    selector,
    purpose,
    purposeLabel: purposeLabel(purpose) || "",
    healthStatus,
    healthStatusSource: "derived",
    operationalState,
    qualityGrade,
    enabled: active,
    failCount,
    broken,
    lastVisit: site.lastCheckedAt || null,
    lastCheckedAt: site.lastCheckedAt || null,
    lastSuccessfulCheck: broken ? null : site.lastCheckedAt || null,
    lastDetectedChange: site.lastAlertAt || null,
    nextEligibleCheck: site.nextRetryAt || null,
    selectorStatus: !selector ? "missing" : /^body$/i.test(selector) ? "too_broad" : "configured",
    version: Number(site.version || 1)
  };
}

function enrichSiteRows(rows = []) {
  return rows.map((site) =>
    normalizeSourceRow({
      ...site,
      officialDomain: (() => {
        try {
          return new URL(String(site.url || "")).hostname;
        } catch {
          return "";
        }
      })()
    })
  );
}

async function listSources(query = {}) {
  const all = enrichSiteRows(await fetchSites());
  const search = normalizeString(query.search || query.q || "", 200).toLowerCase();
  const health = normalizeString(query.health, 40).toLowerCase();
  const enabledFilter = query.enabled === undefined || query.enabled === "" ? "" : String(query.enabled).toLowerCase();
  const filtered = all.filter((row) => {
    if (health && row.healthStatus !== health) return false;
    if (enabledFilter) {
      const expected = enabledFilter === "true" || enabledFilter === "1";
      if (row.enabled !== expected) return false;
    }
    if (!search) return true;
    return [
      row.name,
      row.officialDomain,
      row.monitoringUrl || row.notificationUrl,
      row.selector,
      row.purpose,
      row.purposeLabel,
      row.healthStatus,
      row.operationalState
    ]
      .join(" ")
      .toLowerCase()
      .includes(search);
  });
  return paginate(filtered, query.page, query.limit);
}

async function getSourceById(id) {
  const site = await getSiteById(parseInt(String(id), 10));
  if (!site) {
    const err = new Error("Source not found");
    err.statusCode = 404;
    throw err;
  }
  return normalizeSourceRow({
    ...site,
    officialDomain: (() => {
      try {
        return new URL(String(site.url || "")).hostname;
      } catch {
        return "";
      }
    })()
  });
}

function normalizeSourceInput(input = {}) {
  const name = normalizeString(input.name, 160);
  const notificationUrl = normalizeString(
    input.monitoringUrl || input.notificationUrl || input.url,
    2000
  );
  const selector = normalizeString(input.selector, 255);
  const purpose = normalizePurpose(input.purpose);
  if (!name) {
    const err = new Error("name is required");
    err.statusCode = 400;
    throw err;
  }
  if (!notificationUrl) {
    const err = new Error("Monitoring URL is required.");
    err.statusCode = 400;
    throw err;
  }
  if (!selector) {
    const err = new Error("CSS selector is required.");
    err.statusCode = 400;
    throw err;
  }
  if (/^body$/i.test(selector) && input.enabled === true) {
    const err = new Error(
      "Selector 'body' is too broad for activation. Choose a stable notice/list selector."
    );
    err.statusCode = 400;
    throw err;
  }
  if (input.purpose != null && String(input.purpose).trim() && !purpose) {
    const err = new Error("Invalid monitoring purpose.");
    err.statusCode = 400;
    throw err;
  }
  return {
    name,
    notificationUrl,
    selector,
    purpose: purpose || null,
    priorityNumber: Math.max(1, Math.min(4, Number(String(input.priority || "P1").replace(/^P/i, "")) + 1 || 2)),
    // Opt-in activation: new sources stay inactive until admin verifies + enables.
    enabled: input.enabled === true
  };
}

async function createSource(input = {}) {
  const normalized = normalizeSourceInput(input);
  await assertMonitoringSiteWritable({
    url: normalized.notificationUrl,
    requireRobotsAllow: normalized.enabled === true
  });
  if (normalized.enabled) {
    await assertSafeToActivateMonitoringSource({
      url: normalized.notificationUrl,
      selector: normalized.selector,
      checkDuplicates: false
    });
  }
  const id = await createSite({
    name: normalized.name,
    url: normalized.notificationUrl,
    selector: normalized.selector,
    priority: normalized.priorityNumber,
    purpose: normalized.purpose
  });
  if (!normalized.enabled) {
    await disableSite(id);
  }
  return getSourceById(id);
}

async function updateSource(id, input = {}) {
  const sourceId = parseInt(String(id), 10);
  if (!Number.isInteger(sourceId) || sourceId <= 0) {
    const err = new Error("Invalid source id");
    err.statusCode = 400;
    throw err;
  }
  const existing = await getSiteById(sourceId);
  if (!existing) {
    const err = new Error("Source not found");
    err.statusCode = 404;
    throw err;
  }
  const merged = normalizeSourceInput({
    name: input.name !== undefined ? input.name : existing.name,
    notificationUrl:
      input.monitoringUrl !== undefined
        ? input.monitoringUrl
        : input.notificationUrl !== undefined
          ? input.notificationUrl
          : input.url !== undefined
            ? input.url
            : existing.url,
    selector: input.selector !== undefined ? input.selector : existing.selector,
    purpose: input.purpose !== undefined ? input.purpose : existing.purpose,
    priority: input.priority !== undefined ? input.priority : `P${Math.max(0, Number(existing.priority || 1) - 1)}`,
    enabled: input.enabled !== undefined ? input.enabled === true : Number(existing.active) === 1
  });
  const wasActive = Number(existing.active) === 1;
  const willEnable = merged.enabled === true;
  const urlChanged = String(merged.notificationUrl) !== String(existing.url || "");
  const selectorChanged = String(merged.selector) !== String(existing.selector || "");
  await assertMonitoringSiteWritable({
    url: merged.notificationUrl,
    excludeId: sourceId,
    // Fail-closed robots when enabling or changing URL while active
    requireRobotsAllow: willEnable
  });
  if (willEnable && (!wasActive || urlChanged || selectorChanged)) {
    await assertSafeToActivateMonitoringSource({
      url: merged.notificationUrl,
      selector: merged.selector,
      excludeId: sourceId,
      checkDuplicates: false
    });
  }
  await updateSite(sourceId, {
    name: merged.name,
    url: merged.notificationUrl,
    selector: merged.selector,
    priority: merged.priorityNumber,
    purpose: merged.purpose
  });
  if (willEnable && !wasActive) {
    await restoreSite(sourceId);
  } else if (!willEnable && wasActive) {
    await disableSite(sourceId);
  }
  return getSourceById(sourceId);
}

async function verifySourceInput(input = {}) {
  return verifyMonitoringSource({
    url: input.monitoringUrl || input.notificationUrl || input.url,
    selector: input.selector,
    excludeId: input.excludeId != null ? Number(input.excludeId) : null,
    checkDuplicates: input.checkDuplicates !== false
  });
}

async function verifySourceById(id) {
  const source = await getSourceById(id);
  return verifyMonitoringSource({
    url: source.monitoringUrl,
    selector: source.selector,
    excludeId: source.id,
    checkDuplicates: true
  });
}

async function setSourceEnabled(id, enabled) {
  return updateSource(id, { enabled: enabled === true });
}

/**
 * Manual single-source check: GET exact configured URL only.
 * Does not crawl, discover, or activate continuous monitoring flags.
 */
async function runSourceCheck(id) {
  const sourceId = parseInt(String(id), 10);
  if (!Number.isInteger(sourceId) || sourceId <= 0) {
    const err = new Error("Invalid source id");
    err.statusCode = 400;
    throw err;
  }
  const row = await getSiteById(sourceId);
  if (!row) {
    const err = new Error("Source not found");
    err.statusCode = 404;
    throw err;
  }
  if (Number(row.active) !== 1) {
    const err = new Error("Disabled source is not eligible for monitoring.");
    err.statusCode = 400;
    err.code = "MONITORING_SOURCE_DISABLED";
    throw err;
  }
  if (!isApprovedOfficialMonitoringUrl(row.url)) {
    const err = new Error("Monitoring URL host is not an approved official source.");
    err.statusCode = 400;
    err.code = "MONITORING_URL_NOT_OFFICIAL";
    throw err;
  }

  const site = {
    id: row.id,
    name: row.name,
    url: row.url,
    selector: row.selector,
    lastContent: row.lastContent,
    lastAlertAt: row.lastAlertAt,
    failCount: row.failCount,
    broken: row.broken,
    priority: row.priority,
    active: row.active
  };

  const result = await checkSite(site);
  if (result && result.establishBaseline) {
    await saveSiteBaseline(sourceId, result.baselineFingerprint || "");
  } else {
    await markSiteChecked(sourceId);
  }

  return {
    sourceId,
    monitoringUrl: row.url,
    exactUrlUsed: row.url,
    result: {
      changed: Boolean(result && result.changed),
      invalid: Boolean(result && result.invalid),
      reason: (result && result.reason) || null,
      policySkip: Boolean(result && result.policySkip),
      httpStatus: (result && result.httpStatus) || null,
      establishBaseline: Boolean(result && result.establishBaseline),
      shouldNotify: Boolean(result && result.shouldNotify)
    }
  };
}

async function deleteSourceById(id) {
  const source = await getSourceById(id);
  await deleteSite(Number(id));
  return { deleted: true, source };
}

function normalizeSettingsPayload(input = {}) {
  const runtimeFlags = getAutomationFlags();
  return {
    thresholds: {
      confidenceThreshold: Math.max(0, Math.min(100, Number(input.confidenceThreshold || input.thresholds?.confidenceThreshold || 82) || 82)),
      riskThreshold: Math.max(0, Math.min(100, Number(input.riskThreshold || input.thresholds?.riskThreshold || 58) || 58))
    },
    rules: {
      reviewRules: normalizeString(input.reviewRules || input.rules?.reviewRules, 5000),
      draftRules: normalizeString(input.draftRules || input.rules?.draftRules, 5000),
      recoveryRules: normalizeString(input.recoveryRules || input.rules?.recoveryRules, 5000),
      departmentRules: normalizeString(input.departmentRules || input.rules?.departmentRules, 5000)
    },
    featureFlags: Object.keys(FLAG_DEFAULTS).map((key) => ({ key, state: runtimeFlags[key] === true }))
  };
}

function getSettings() {
  const stored = automationSettingsRepository.readSettings();
  return {
    ...stored,
    runtimeFlags: getAutomationFlags()
  };
}

function saveSettings(input = {}) {
  const normalized = normalizeSettingsPayload(input);
  const saved = automationSettingsRepository.writeSettings(normalized);
  return {
    ...saved,
    runtimeFlags: getAutomationFlags()
  };
}

async function getDashboardSummary() {
  const [sources, recruitments, drafts, reviewItems, recentActivity, enterpriseSnapshot, readiness, updates] =
    await Promise.all([
    fetchSites().catch(() => []),
    recruitmentService.listRecruitments({ page: 1, limit: 100 }).catch(() => ({ data: [] })),
    generatorDraftService.listDrafts({ limit: 100 }).catch(() => ({ drafts: [], published: [] })),
    recruitmentReviewService.listReviewItems({ page: 1, limit: 100 }).catch(() => ({ data: [] })),
    listActivity({ page: 1, limit: 25 }).catch(() => ({ data: [] })),
    getPlatformSnapshot().catch(() => null),
    evaluateActivationReadiness().catch(() => ({ ready: false, decision: "NO-GO", blockers: [] })),
    fetchRecentUpdates(50).catch(() => [])
  ]);

  const flags = getAutomationFlags();
  const sourceRows = enrichSiteRows(sources);
  const recruitmentRows = Array.isArray(recruitments.data) ? recruitments.data : [];
  const draftRows = Array.isArray(drafts.drafts) ? drafts.drafts : [];
  const publishedRows = Array.isArray(drafts.published) ? drafts.published : [];
  const reviewRows = Array.isArray(reviewItems.data) ? reviewItems.data : [];
  const activityRows = Array.isArray(recentActivity.data) ? recentActivity.data : [];
  const updateRows = Array.isArray(updates) ? updates : [];
  const activeOfficialSources = buildActiveOfficialSources(sourceRows);

  return {
    flags,
    isDormant: isAutomationDormant(),
    runtime: {
      workerActive: canRunAutomationWorkers(),
      pipelineActive: canRunProductionPipeline(),
      telegramActive: canDeliverTelegram(),
      schedulerArmed: canStartMonitoringScheduler(),
      autoPublishBlocked: isAutoPublishBlocked(),
      activationDecision: readiness.decision,
      activationReady: readiness.ready === true
    },
    publishingControls: getPublishingControlState(),
    activeOfficialSources,
    activeOfficialSourceCount: activeOfficialSources.length,
    manualWorkflow: buildManualWorkflow(updateRows, draftRows, reviewRows, publishedRows),
    recentPipelineActivity: buildRecentPipelineActivity({
      sources: sourceRows,
      updates: updateRows,
      drafts: draftRows,
      reviews: reviewRows,
      activity: activityRows
    }),
    enterprise: enterpriseSnapshot,
    readiness,
    notificationGateway: notificationGateway.getChannelStatus(),
    totals: {
      sources: sourceRows.length,
      sourcesOnline: sourceRows.filter((row) => row.healthStatus === "healthy").length,
      sourcesOffline: sourceRows.filter((row) => row.healthStatus === "offline").length,
      recruitments: recruitmentRows.length,
      drafts: draftRows.length,
      reviewQueue: reviewRows.length
    },
    recentActivity: activityRows
  };
}

async function listWorkflowItems(query = {}) {
  const [reviewItems, updates] = await Promise.all([
    recruitmentReviewService.listReviewItems({
      page: 1,
      limit: 200,
      status: query.status || undefined,
      search: query.search || undefined
    }).catch(() => ({ data: [] })),
    fetchRecentUpdates(100).catch(() => [])
  ]);
  const combined = [];
  for (const item of reviewItems.data || []) {
    combined.push({
      id: `review-${item.id}`,
      item: item.title || `Review ${item.id}`,
      status: item.status || "pending",
      priority: item.confidence === "high" ? "P0" : item.confidence === "medium" ? "P1" : "P2",
      department: item.event_type || "review",
      source: item.source_url || "review_queue",
      updatedAt: item.updated_at || item.created_at || null,
      retry: "No"
    });
  }
  for (const item of updates || []) {
    combined.push({
      id: `update-${item.id}`,
      item: item.title || `Update ${item.id}`,
      status: "detected",
      priority: "P1",
      department: item.siteName || "monitoring",
      source: item.link || "updates",
      updatedAt: item.createdAt || null,
      retry: "No"
    });
  }
  return paginate(combined, query.page, query.limit);
}

async function listAuditEntries(query = {}) {
  const activity = await listActivity({
    page: query.page || 1,
    limit: query.limit || 50,
    action: query.search || ""
  }).catch(() => ({ data: [], pagination: { page: 1, limit: 50, total: 0 } }));
  const data = (activity.data || []).map((row) => ({
    time: row.timestamp,
    category: row.status || "system",
    event: row.action,
    entity: row.target || row.admin,
    summary: `${row.action} by ${row.admin}`
  }));
  return {
    data,
    pagination: activity.pagination
  };
}

async function getAccSnapshot() {
  const [dashboard, sources, settings, workflow, audit, drafts, reviews, recruitments] = await Promise.all([
    getDashboardSummary(),
    listSources({ page: 1, limit: 200 }),
    Promise.resolve(getSettings()),
    listWorkflowItems({ page: 1, limit: 200 }),
    listAuditEntries({ page: 1, limit: 100 }),
    generatorDraftService.listDrafts({ limit: 50 }).catch(() => ({ drafts: [], published: [] })),
    recruitmentReviewService.listReviewItems({ page: 1, limit: 50 }).catch(() => ({ data: [] })),
    recruitmentService.listRecruitments({ page: 1, limit: 100 }).catch(() => ({ data: [] }))
  ]);
  return {
    dashboard,
    sources: sources.data,
    settings,
    workflow: workflow.data,
    audit: audit.data,
    recruitments: recruitments.data || [],
    drafts: drafts.drafts || [],
    reviews: reviews.data || []
  };
}

module.exports = {
  listSources,
  getSourceById,
  createSource,
  updateSource,
  deleteSourceById,
  verifySourceInput,
  verifySourceById,
  setSourceEnabled,
  runSourceCheck,
  getSettings,
  saveSettings,
  getDashboardSummary,
  listWorkflowItems,
  listAuditEntries,
  getAccSnapshot,
  getPublishingControlState,
  updatePublishingControls,
  buildActiveOfficialSources,
  buildManualWorkflow,
  buildRecentPipelineActivity
};
