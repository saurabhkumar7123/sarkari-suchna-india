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
  canAutoDraft,
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

const NA = "Not available";

/** Mirrors updateScheduler interval bounds without importing the scheduler module. */
function readConfiguredIntervalMinutes() {
  const min = 5;
  const max = 10;
  const fallback = 10;
  const raw = parseInt(process.env.UPDATE_CHECK_INTERVAL_MINUTES || String(fallback), 10);
  if (!Number.isFinite(raw)) return fallback;
  return Math.min(max, Math.max(min, raw));
}

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
  const monitoringOn = flags.PRODUCTION_MONITORING_ENABLED === true;
  const crawlerOn = flags.LIVE_CRAWLER_ENABLED === true;
  const gatewayOn = flags.NOTIFICATION_GATEWAY_ENABLED === true;
  const workerEffective = canRunAutomationWorkers();
  const aiDraftEffective = canAutoDraft();

  const components = [
    {
      id: "monitoring",
      name: "Monitoring / Bot",
      flag: "PRODUCTION_MONITORING_ENABLED",
      inputKey: "productionMonitoringEnabled",
      enabled: monitoringOn,
      status: statusLabel(monitoringOn),
      purpose: "Authorizes production monitoring of approved official sources.",
      dependencies: [],
      unavailableBecause: null,
      enableEffect: "Allows monitoring flags to arm. Does not publish pages.",
      disableEffect: "Disarms production monitoring authorization.",
      locked: false
    },
    {
      id: "crawler",
      name: "Live crawler / source monitoring",
      flag: "LIVE_CRAWLER_ENABLED",
      inputKey: "liveCrawlerEnabled",
      enabled: crawlerOn,
      status: statusLabel(crawlerOn),
      purpose: "Allows live crawler jobs against approved official sources.",
      dependencies: ["PRODUCTION_MONITORING_ENABLED"],
      unavailableBecause:
        crawlerOn && !monitoringOn
          ? "Monitoring / Bot is OFF"
          : null,
      enableEffect: "Allows crawler jobs when Monitoring and Scheduler are also armed.",
      disableEffect: "Stops live crawler authorization.",
      locked: false
    },
    {
      id: "scheduler",
      name: "Scheduler",
      flag: "SCHEDULER_ACTIVATION_ENABLED",
      inputKey: "schedulerEnabled",
      enabled: flags.SCHEDULER_ACTIVATION_ENABLED === true,
      status: schedulerArmed ? "ON" : flags.SCHEDULER_ACTIVATION_ENABLED ? "DORMANT" : "OFF",
      armed: schedulerArmed === true,
      purpose: "Triggers monitoring cycles on an interval. Does not publish content.",
      dependencies: ["PRODUCTION_MONITORING_ENABLED", "LIVE_CRAWLER_ENABLED"],
      unavailableBecause: !schedulerArmed
        ? !monitoringOn
          ? "Unavailable because Monitoring / Bot is OFF"
          : !crawlerOn
            ? "Unavailable because Live crawler is OFF"
            : flags.SCHEDULER_ACTIVATION_ENABLED
              ? null
              : null
        : null,
      enableEffect: "Arms scheduler activation. Effective cycles still need Monitoring + Live crawler.",
      disableEffect: "Disarms scheduler activation.",
      locked: false
    },
    {
      id: "aiDraft",
      name: "AI Draft / processing",
      flag: "AUTO_DRAFT_ENABLED",
      inputKey: "autoDraftEnabled",
      enabled: flags.AUTO_DRAFT_ENABLED === true,
      status: aiDraftEffective ? "ON" : flags.AUTO_DRAFT_ENABLED ? "BLOCKED" : "OFF",
      purpose: "AI may prepare structured drafts for human review.",
      dependencies: [
        "RECRUITMENT_PIPELINE_ENABLED",
        "PRODUCTION_MONITORING_ENABLED",
        "WORKER_ACTIVATION_ENABLED",
        "LIVE_CRAWLER_ENABLED"
      ],
      unavailableBecause:
        flags.AUTO_DRAFT_ENABLED && !aiDraftEffective
          ? "Unavailable until production pipeline prerequisites are ON"
          : null,
      enableEffect: "Allows AI draft preparation when the production pipeline is authorized. Does not publish.",
      disableEffect: "Disables automatic AI draft preparation.",
      locked: false
    },
    {
      id: "notificationGateway",
      name: "Notification Gateway",
      flag: "NOTIFICATION_GATEWAY_ENABLED",
      inputKey: "notificationGatewayEnabled",
      enabled: gatewayOn,
      status: statusLabel(gatewayOn),
      purpose: "Authorizes the notification delivery gateway.",
      dependencies: [],
      unavailableBecause: null,
      enableEffect: "Allows gateway channels (Telegram still needs its own flag).",
      disableEffect: "Blocks all gateway deliveries including Telegram.",
      locked: false
    },
    {
      id: "telegram",
      name: "Telegram Delivery",
      flag: "TELEGRAM_DELIVERY_ENABLED",
      inputKey: "telegramEnabled",
      enabled: flags.TELEGRAM_DELIVERY_ENABLED === true,
      status: telegramOn ? "ON" : flags.TELEGRAM_DELIVERY_ENABLED ? "BLOCKED" : "OFF",
      configured: telegramConfigured === true,
      configurationStatus: telegramConfigured ? "Configured" : "Not configured",
      purpose: "Sends approved/authorized Telegram notifications.",
      dependencies: ["NOTIFICATION_GATEWAY_ENABLED"],
      unavailableBecause:
        flags.TELEGRAM_DELIVERY_ENABLED && !gatewayOn
          ? "Unavailable because Notification Gateway is OFF"
          : null,
      enableEffect: "Arms Telegram delivery. Requires Notification Gateway ON. Does not publish pages.",
      disableEffect: "Stops Telegram delivery authorization.",
      locked: false
    },
    {
      id: "worker",
      name: "Worker",
      flag: "WORKER_ACTIVATION_ENABLED",
      inputKey: "workerEnabled",
      enabled: flags.WORKER_ACTIVATION_ENABLED === true,
      status: workerEffective ? "ON" : flags.WORKER_ACTIVATION_ENABLED ? "DORMANT" : "OFF",
      purpose: "Authorizes automation workers. Availability alone does not authorize publish.",
      dependencies: ["PRODUCTION_MONITORING_ENABLED", "LIVE_CRAWLER_ENABLED"],
      unavailableBecause:
        flags.WORKER_ACTIVATION_ENABLED && !workerEffective
          ? !monitoringOn
            ? "Unavailable because Monitoring / Bot is OFF"
            : !crawlerOn
              ? "Unavailable because Live crawler is OFF"
              : null
          : null,
      enableEffect: "Arms worker activation when Monitoring + Live crawler are also ON.",
      disableEffect: "Disarms worker activation.",
      locked: false
    },
    {
      id: "autoPublish",
      name: "Auto Publish",
      flag: "AUTO_PUBLISH_ENABLED",
      inputKey: null,
      enabled: false,
      status: "LOCKED OFF",
      purpose: "Automatic publishing of public pages.",
      dependencies: [],
      unavailableBecause: "Human Manual Publish is mandatory.",
      enableEffect: "Not available from this UI.",
      disableEffect: "Always forced OFF.",
      locked: true,
      blocked: true
    }
  ];

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
    dormant: isAutomationDormant() === true,
    flags,
    components
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

function setEnvFlag(name, enabled) {
  process.env[name] = enabled ? "true" : "false";
}

function updatePublishingControls(input = {}) {
  rejectAutoPublishEnable(input);
  process.env.AUTO_PUBLISH_ENABLED = "false";

  const before = getPublishingControlState();
  const flags = getAutomationFlags();

  if (input.productionMonitoringEnabled === true) {
    setEnvFlag("PRODUCTION_MONITORING_ENABLED", true);
  } else if (input.productionMonitoringEnabled === false) {
    setEnvFlag("PRODUCTION_MONITORING_ENABLED", false);
  }

  if (input.liveCrawlerEnabled === true) {
    setEnvFlag("LIVE_CRAWLER_ENABLED", true);
  } else if (input.liveCrawlerEnabled === false) {
    setEnvFlag("LIVE_CRAWLER_ENABLED", false);
  }

  if (input.schedulerEnabled === true) {
    setEnvFlag("SCHEDULER_ACTIVATION_ENABLED", true);
  } else if (input.schedulerEnabled === false) {
    setEnvFlag("SCHEDULER_ACTIVATION_ENABLED", false);
  }

  if (input.autoDraftEnabled === true) {
    setEnvFlag("AUTO_DRAFT_ENABLED", true);
  } else if (input.autoDraftEnabled === false) {
    setEnvFlag("AUTO_DRAFT_ENABLED", false);
  }

  if (input.notificationGatewayEnabled === true) {
    setEnvFlag("NOTIFICATION_GATEWAY_ENABLED", true);
  } else if (input.notificationGatewayEnabled === false) {
    setEnvFlag("NOTIFICATION_GATEWAY_ENABLED", false);
  }

  if (input.telegramEnabled === true) {
    const gatewayReady =
      input.notificationGatewayEnabled === true ||
      (input.notificationGatewayEnabled !== false &&
        (flags.NOTIFICATION_GATEWAY_ENABLED === true ||
          process.env.NOTIFICATION_GATEWAY_ENABLED === "true"));
    if (!gatewayReady) {
      const err = new Error("Telegram requires Notification Gateway to be ON");
      err.statusCode = 409;
      throw err;
    }
    setEnvFlag("TELEGRAM_DELIVERY_ENABLED", true);
  } else if (input.telegramEnabled === false) {
    setEnvFlag("TELEGRAM_DELIVERY_ENABLED", false);
  }

  if (input.workerEnabled === true) {
    setEnvFlag("WORKER_ACTIVATION_ENABLED", true);
  } else if (input.workerEnabled === false) {
    setEnvFlag("WORKER_ACTIVATION_ENABLED", false);
  }

  const after = getPublishingControlState();
  return {
    ...after,
    change: {
      beforeFlags: before.flags,
      afterFlags: after.flags,
      input: { ...input }
    }
  };
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

function displayOrNa(value) {
  if (value === undefined || value === null || value === "") return NA;
  return value;
}

function formatStatusTone(status) {
  const normalized = String(status || "").toUpperCase();
  if (normalized.includes("BLOCK") || normalized.includes("LOCK")) return "blocked";
  if (normalized === "ON" || normalized === "RUNNING" || normalized === "ONLINE" || normalized === "GREEN") {
    return "on";
  }
  if (normalized === "YELLOW" || normalized === "WARNING" || normalized === "PENDING") return "warn";
  if (normalized === "ERROR" || normalized === "FAILED") return "error";
  if (normalized === "DORMANT" || normalized === "SAFE") return "safe";
  return "off";
}

function mapSourceDisplayStatus(row) {
  if (!row) return { status: "OFF", tone: "off" };
  if (row.broken || row.operationalState === "ERROR") return { status: "ERROR", tone: "error" };
  if (row.operationalState === "BLOCKED" || row.qualityGrade === "BLOCKED") {
    return { status: "BLOCKED", tone: "blocked" };
  }
  if (!row.enabled) return { status: "OFF", tone: "off" };
  if (row.qualityGrade === "YELLOW" || row.healthStatus === "warning") {
    return { status: "YELLOW", tone: "warn" };
  }
  if (row.qualityGrade === "GREEN" || row.healthStatus === "healthy") {
    return { status: "GREEN", tone: "on" };
  }
  return { status: "YELLOW", tone: "warn" };
}

function reviewStatusOf(row) {
  return String(row?.status || row?.logical_status || "").toLowerCase();
}

function buildSafetyWhy(flags, publishingControls, readiness) {
  const why = [];
  if (publishingControls?.autoPublish?.blocked !== false || flags.AUTO_PUBLISH_ENABLED !== true) {
    why.push("Auto Publish flag OFF");
  }
  why.push("Human publish gate required");
  if (readiness?.ready !== true) {
    why.push("Automation activation not authorized");
  }
  if (flags.RECRUITMENT_PIPELINE_ENABLED !== true) {
    why.push("Recruitment pipeline disabled");
  }
  if (flags.LIVE_CRAWLER_ENABLED !== true) {
    why.push("Live crawler disabled");
  }
  if (flags.SCHEDULER_ACTIVATION_ENABLED !== true) {
    why.push("Scheduler activation disabled");
  }
  if (flags.WORKER_ACTIVATION_ENABLED !== true) {
    why.push("Worker activation disabled");
  }
  if (flags.TELEGRAM_DELIVERY_ENABLED !== true) {
    why.push("Telegram delivery disabled");
  }
  return why;
}

function buildHumanActions({ updates = [], drafts = [], reviews = [], sources = [] } = {}) {
  const actions = [];
  const pendingReviews = reviews.filter((row) =>
    ["pending", "under_review", "needs_matching"].includes(reviewStatusOf(row))
  );
  const frozen = reviews.filter((row) => reviewStatusOf(row) === "frozen");
  const draftWaiting = drafts.filter((row) => String(row.status || "draft").toLowerCase() === "draft");
  const blockedSources = sources.filter(
    (row) => row.broken || row.operationalState === "BLOCKED" || row.qualityGrade === "BLOCKED"
  );
  const warningSources = sources.filter(
    (row) => row.enabled && (row.qualityGrade === "YELLOW" || row.healthStatus === "warning")
  );

  if (updates.length) {
    actions.push({
      id: "updates-review",
      label: `${updates.length} update${updates.length === 1 ? "" : "s"} waiting for review`,
      count: updates.length,
      href: "/admin/monitoring/updates",
      cta: "Open Monitoring Updates"
    });
  }
  if (pendingReviews.length) {
    actions.push({
      id: "review-queue",
      label: `${pendingReviews.length} item${pendingReviews.length === 1 ? "" : "s"} in review queue`,
      count: pendingReviews.length,
      href: "/admin/recruitment-review-queue",
      cta: "Open Review Queue"
    });
  }
  if (draftWaiting.length) {
    actions.push({
      id: "drafts-edit",
      label: `${draftWaiting.length} draft${draftWaiting.length === 1 ? "" : "s"} need editing`,
      count: draftWaiting.length,
      href: "/generator#drafts",
      cta: "Open Drafts"
    });
  }
  if (frozen.length) {
    actions.push({
      id: "frozen-reviews",
      label: `${frozen.length} frozen review${frozen.length === 1 ? "" : "s"}`,
      count: frozen.length,
      href: "/admin/recruitment-review-queue",
      cta: "Open Review Queue"
    });
  }
  if (blockedSources.length) {
    actions.push({
      id: "blocked-sources",
      label: `${blockedSources.length} source${blockedSources.length === 1 ? "" : "s"} blocked or erroring`,
      count: blockedSources.length,
      href: "/admin/monitoring",
      cta: "Open Source Registry"
    });
  } else if (warningSources.length) {
    actions.push({
      id: "warning-sources",
      label: `${warningSources.length} source${warningSources.length === 1 ? "" : "s"} need verification`,
      count: warningSources.length,
      href: "/admin/monitoring",
      cta: "Open Source Registry"
    });
  }
  return actions;
}

function buildActivityTimeline({ sources = [], updates = [], drafts = [], reviews = [], activity = [] } = {}) {
  const events = [];
  for (const row of sources.slice(0, 20)) {
    if (!row.lastCheckedAt && !row.lastVisit) continue;
    const display = mapSourceDisplayStatus(row);
    events.push({
      at: row.lastCheckedAt || row.lastVisit,
      component: "Monitoring",
      title: "Official source checked",
      detail: row.name || `Source ${row.id}`,
      outcome: row.lastDetectedChange ? "Change detected" : "No change",
      status: display.status,
      href: "/admin/monitoring",
      ids: { sourceId: row.id }
    });
  }
  for (const row of updates.slice(0, 20)) {
    events.push({
      at: row.createdAt || row.updatedAt || null,
      component: "Updates",
      title: "Update created",
      detail: row.title || row.item || `Update ${row.id}`,
      outcome: "Needs Review",
      status: "PENDING",
      href: "/admin/monitoring/updates",
      ids: { updateId: row.id }
    });
  }
  for (const row of drafts.slice(0, 15)) {
    events.push({
      at: row.updated_at || row.created_at || row.updatedAt || row.createdAt || null,
      component: "Drafts",
      title: "Draft updated",
      detail: row.title || `Draft ${row.id}`,
      outcome: String(row.status || "draft"),
      status: String(row.status || "draft").toUpperCase(),
      href: row.id ? `/generator?draftId=${encodeURIComponent(row.id)}` : "/generator#drafts",
      ids: { draftId: row.id, recruitmentId: row.recruitment_id || row.recruitmentId || null }
    });
  }
  for (const row of reviews.slice(0, 15)) {
    events.push({
      at: row.updated_at || row.created_at || row.updatedAt || row.createdAt || null,
      component: "Review",
      title: "Human review pending",
      detail: row.title || `Review ${row.id}`,
      outcome: reviewStatusOf(row) || "pending",
      status: (reviewStatusOf(row) || "pending").toUpperCase(),
      href: "/admin/recruitment-review-queue",
      ids: { reviewId: row.id, recruitmentId: row.recruitment_id || row.recruitmentId || null }
    });
  }
  for (const row of activity.slice(0, 15)) {
    const text = `${row.action || ""} ${row.event || ""} ${row.summary || ""} ${row.target || ""}`;
    const isError = /error|fail|block|warn/i.test(text);
    if (!isError && !/telegram|monitor|scheduler|worker|draft|review|publish/i.test(text)) continue;
    events.push({
      at: row.timestamp || row.time || null,
      component: row.status || "Activity",
      title: row.action || row.event || "Activity",
      detail: row.target || row.summary || "",
      outcome: row.status || "",
      status: isError ? "WARNING" : "INFO",
      href: "/admin/activity",
      ids: {}
    });
  }
  return events
    .filter((event) => event.at)
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, 25);
}

function buildErrorsWarnings({ sources = [], activity = [], reviews = [] } = {}) {
  const rows = [];
  for (const source of sources) {
    if (source.broken || source.operationalState === "ERROR") {
      rows.push({
        at: source.lastCheckedAt || source.lastVisit || null,
        component: "Official source",
        message: `${source.name || `Source ${source.id}`} unavailable or erroring`,
        status: "ERROR",
        href: "/admin/monitoring"
      });
    } else if (source.operationalState === "BLOCKED" || source.qualityGrade === "BLOCKED") {
      rows.push({
        at: source.lastCheckedAt || null,
        component: "Official source",
        message: `${source.name || `Source ${source.id}`} blocked`,
        status: "BLOCKED",
        href: "/admin/monitoring"
      });
    } else if (source.selectorStatus === "missing" || source.selectorStatus === "too_broad") {
      rows.push({
        at: source.lastCheckedAt || null,
        component: "Selector",
        message: `${source.name || `Source ${source.id}`} selector needs attention (${source.selectorStatus})`,
        status: "WARNING",
        href: "/admin/monitoring"
      });
    }
  }
  for (const review of reviews) {
    const status = reviewStatusOf(review);
    if (status === "needs_matching") {
      rows.push({
        at: review.updated_at || review.created_at || null,
        component: "Review",
        message: `${review.title || `Review ${review.id}`} needs matching`,
        status: "WARNING",
        href: "/admin/recruitment-review-queue"
      });
    }
    if (status === "frozen") {
      rows.push({
        at: review.updated_at || review.created_at || null,
        component: "Review",
        message: `${review.title || `Review ${review.id}`} is frozen`,
        status: "BLOCKED",
        href: "/admin/recruitment-review-queue"
      });
    }
  }
  for (const row of activity) {
    const text = `${row.action || ""} ${row.summary || ""} ${row.target || ""}`;
    if (!/error|fail|block|warn|unavailable|selector/i.test(text)) continue;
    rows.push({
      at: row.timestamp || row.time || null,
      component: row.status || "System",
      message: row.action || row.summary || "Warning",
      status: /error|fail/i.test(text) ? "ERROR" : /block/i.test(text) ? "BLOCKED" : "WARNING",
      href: "/admin/activity"
    });
  }
  return rows.slice(0, 20);
}

function buildOperatorOverview({
  flags,
  runtime,
  publishingControls,
  readiness,
  notificationGatewayStatus,
  sources = [],
  updates = [],
  drafts = [],
  published = [],
  reviews = [],
  activity = [],
  isDormant
} = {}) {
  const schedulerArmed = runtime?.schedulerArmed === true;
  const monitoringOn = flags.PRODUCTION_MONITORING_ENABLED === true && flags.LIVE_CRAWLER_ENABLED === true;
  const aiDraftArmed = canAutoDraft() === true;
  const telegramOn = runtime?.telegramActive === true;
  const workerOn = runtime?.workerActive === true;
  const gatewayOn = flags.NOTIFICATION_GATEWAY_ENABLED === true;
  const autoPublishBlocked = runtime?.autoPublishBlocked !== false;
  const overallState = isDormant
    ? "DORMANT / SAFE"
    : autoPublishBlocked
      ? "RESTRICTED / SAFE"
      : "LIVE";

  const intervalMinutes = readConfiguredIntervalMinutes();

  const enabledSources = sources.filter((row) => row.enabled === true);
  const healthy = sources.filter((row) => row.healthStatus === "healthy").length;
  const warning = sources.filter((row) => row.healthStatus === "warning" || row.qualityGrade === "YELLOW").length;
  const blocked = sources.filter(
    (row) => row.broken || row.operationalState === "BLOCKED" || row.qualityGrade === "BLOCKED"
  ).length;
  const lastCycle = latestTimestamp(sources, ["lastVisit", "lastCheckedAt", "lastSuccessfulCheck"]);
  const pendingReviews = reviews.filter((row) =>
    ["pending", "under_review", "needs_matching"].includes(reviewStatusOf(row))
  );
  const approvedReviews = reviews.filter((row) => reviewStatusOf(row) === "approved");
  const frozenReviews = reviews.filter((row) => reviewStatusOf(row) === "frozen");
  const rejectedReviews = reviews.filter((row) =>
    ["rejected", "dismissed"].includes(reviewStatusOf(row))
  );
  const draftWaiting = drafts.filter((row) => String(row.status || "draft").toLowerCase() === "draft");
  const telegramChannel = (notificationGatewayStatus || []).find((row) => row.channel === "telegram");
  const recentActivity = buildRecentPipelineActivity({ sources, updates, drafts, reviews, activity });
  const safetyWhy = buildSafetyWhy(flags, publishingControls, readiness);

  let aiState = "OFF";
  if (flags.AUTO_DRAFT_ENABLED === true && aiDraftArmed) aiState = "AVAILABLE";
  else if (flags.AUTO_DRAFT_ENABLED === true) aiState = "BLOCKED";
  else aiState = "OFF";

  let workerState = "OFF";
  if (workerOn) workerState = "ONLINE";
  else if (flags.WORKER_ACTIVATION_ENABLED === true) workerState = "DORMANT";

  let schedulerState = "OFF";
  if (schedulerArmed) schedulerState = "DORMANT";
  else if (flags.SCHEDULER_ACTIVATION_ENABLED === true) schedulerState = "DORMANT";

  const sourcesPreview = sources.slice(0, 25).map((row) => {
    const display = mapSourceDisplayStatus(row);
    return {
      id: row.id,
      name: row.name || `Source ${row.id}`,
      organization: row.officialDomain || NA,
      officialUrl: row.monitoringUrl || NA,
      status: display.status,
      tone: display.tone,
      lastChecked: displayOrNa(row.lastCheckedAt || row.lastVisit),
      lastChange: displayOrNa(row.lastDetectedChange),
      latestUpdate: displayOrNa(row.lastDetectedChange),
      reason:
        row.broken
          ? "Source marked broken"
          : !row.enabled
            ? "Source disabled"
            : row.selectorStatus === "missing"
              ? "Selector missing"
              : row.selectorStatus === "too_broad"
                ? "Selector too broad"
                : row.qualityGrade === "YELLOW"
                  ? "Needs curation"
                  : row.enabled
                    ? "Enabled"
                    : NA,
      href: "/admin/monitoring"
    };
  });

  const advancedRefs = [];
  for (const row of updates.slice(0, 5)) {
    advancedRefs.push({
      title: row.title || row.item || `Update ${row.id}`,
      updateId: row.id,
      recruitmentId: row.recruitmentId || row.recruitment_id || null,
      reviewId: null,
      draftId: null,
      event: row.eventType || row.type || null
    });
  }
  for (const row of reviews.slice(0, 5)) {
    advancedRefs.push({
      title: row.title || `Review ${row.id}`,
      updateId: row.update_id || row.updateId || null,
      recruitmentId: row.recruitment_id || row.recruitmentId || null,
      reviewId: row.id,
      draftId: row.draft_id || row.draftId || null,
      event: row.event_type || row.eventType || null
    });
  }
  for (const row of drafts.slice(0, 5)) {
    advancedRefs.push({
      title: row.title || `Draft ${row.id}`,
      updateId: null,
      recruitmentId: row.recruitment_id || row.recruitmentId || null,
      reviewId: null,
      draftId: row.id,
      event: null
    });
  }

  return {
    overall: {
      state: overallState,
      tone: formatStatusTone(isDormant ? "DORMANT" : "SAFE"),
      explanation: isDormant
        ? "All activation flags are OFF. System is dormant and safe."
        : "Some runtime capability flags differ from full dormant defaults. Auto publish remains blocked.",
      lastUpdated: displayOrNa(lastCycle?.at)
    },
    statusStrip: {
      monitoring: {
        state: monitoringOn ? "ON" : "OFF",
        explanation: monitoringOn
          ? "Production monitoring and live crawler flags are armed."
          : "Monitoring bot is not authorized to run continuous checks.",
        lastUpdated: displayOrNa(lastCycle?.at)
      },
      scheduler: {
        state: schedulerState,
        explanation: schedulerArmed
          ? "Scheduler flags allow start, but continuous operation is not active from this view."
          : "Scheduler is currently OFF. This is intentional, not broken.",
        lastUpdated: NA
      },
      aiDraft: {
        state: aiState,
        explanation:
          "AI converts extracted official-source information into the site's structured publisher format.",
        lastUpdated: displayOrNa(recentActivity?.lastDraft?.at)
      },
      autoPublish: {
        state: autoPublishBlocked ? "BLOCKED" : "ON",
        explanation: "Human publish is required. AI does not publish directly.",
        lastUpdated: NA
      },
      telegram: {
        state: telegramOn ? "ON" : "OFF",
        explanation: telegramOn
          ? "Telegram delivery flags are armed."
          : "Telegram delivery is OFF.",
        lastUpdated: displayOrNa(recentActivity?.lastTelegramDelivery?.at),
        configured: publishingControls?.telegram?.configured === true,
        connection: telegramOn
          ? "Connected"
          : publishingControls?.telegram?.configured
            ? "Not Active"
            : "Not Active"
      },
      worker: {
        state: workerState,
        explanation: "Worker availability does not mean automation is authorized.",
        lastUpdated: NA,
        lastHeartbeat: NA,
        lastJob: NA,
        lastError: NA
      },
      notificationGateway: {
        state: gatewayOn ? "ON" : "OFF",
        explanation: "Notification gateway remains informational until explicitly authorized.",
        lastActivity: displayOrNa(recentActivity?.lastTelegramDelivery?.at),
        pending: NA,
        failures: NA,
        channels: notificationGatewayStatus || []
      }
    },
    safety: {
      autoPublish: autoPublishBlocked ? "BLOCKED" : "ON",
      humanPublishRequired: "YES",
      automationActivation: readiness?.ready === true ? "AUTHORIZED" : "OFF",
      productionMutation: autoPublishBlocked || readiness?.ready !== true ? "BLOCKED" : "ALLOWED",
      publishingMode: publishingControls?.publishingMode || "MANUAL REVIEW ONLY",
      why: safetyWhy,
      activationDecision: readiness?.decision || "NO-GO",
      blockers: Array.isArray(readiness?.blockers) ? readiness.blockers : []
    },
    monitoring: {
      status: monitoringOn ? "ON" : "OFF",
      lastCycle: displayOrNa(lastCycle?.at),
      nextScheduledCycle: schedulerArmed && intervalMinutes != null
        ? `About every ${intervalMinutes} minutes when scheduler is running`
        : "Not scheduled",
      sourcesEnabled: enabledSources.length,
      sourcesHealthy: healthy,
      sourcesWarning: warning,
      sourcesBlocked: blocked,
      updatesDetected: updates.length,
      updatesPendingReview: pendingReviews.length,
      sources: sourcesPreview
    },
    scheduler: {
      status: schedulerState,
      intervalMinutes: intervalMinutes != null ? intervalMinutes : null,
      intervalLabel: intervalMinutes != null ? `${intervalMinutes} minutes` : NA,
      lastRun: displayOrNa(lastCycle?.at),
      nextRun: schedulerArmed ? NA : "Not scheduled",
      lastResult: displayOrNa(recentActivity?.lastMonitoring?.summary),
      cyclesCompleted: NA,
      errors: NA,
      explanation:
        "When active, Scheduler triggers monitoring cycles. It does not itself publish content."
    },
    ai: {
      conversion: aiState,
      explanation:
        "AI converts extracted official-source information into the site's structured publisher format.",
      latestExtraction: NA,
      latestConversion: displayOrNa(recentActivity?.lastDraft?.at),
      successful: NA,
      weak: NA,
      blocked: NA,
      needsManualStructure: NA
    },
    draftQueue: {
      waiting: draftWaiting.length,
      needsReview: pendingReviews.length,
      approved: approvedReviews.length,
      frozen: frozenReviews.length,
      rejected: rejectedReviews.length,
      published: Array.isArray(published) ? published.length : 0,
      links: {
        needsReview: "/admin/recruitment-review-queue",
        drafts: "/generator#drafts",
        approved: "/generator#drafts",
        monitoringUpdates: "/admin/monitoring/updates"
      }
    },
    telegram: {
      delivery: telegramOn ? "ON" : "OFF",
      connection: telegramOn
        ? "Connected"
        : publishingControls?.telegram?.configured
          ? "Not Active"
          : "Not Active",
      configured: publishingControls?.telegram?.configured === true,
      lastDelivery: displayOrNa(recentActivity?.lastTelegramDelivery?.at),
      lastError: NA,
      pendingNotifications: NA,
      sent: NA,
      failed: NA,
      explanation:
        "Telegram delivery sends approved/authorized notification content according to the existing delivery workflow.",
      channelImplemented: telegramChannel ? telegramChannel.implemented === true : false
    },
    pipeline: {
      autoPublish: autoPublishBlocked ? "OFF/BLOCKED" : "ON",
      humanPublish: "REQUIRED",
      note: "AI does NOT directly publish. One recruitment = one canonical page."
    },
    whatWouldHappenNext: [
      monitoringOn
        ? "Monitoring would continue checking enabled official sources."
        : "If Monitoring were enabled, the bot would check official sources on a schedule.",
      schedulerArmed
        ? "Scheduler flags are armed; enabling the process would trigger monitoring cycles only — not publish."
        : "If Scheduler were enabled, it would trigger monitoring cycles only — not publish.",
      aiDraftArmed
        ? "AI draft conversion could prepare structured drafts for human review."
        : "If AI Draft were enabled, extraction could convert into structured drafts for review.",
      "Auto Publish remains blocked; human approval and manual publish are required.",
      telegramOn
        ? "Telegram could deliver authorized notifications per existing workflow."
        : "If Telegram were enabled, approved notifications could be delivered — never auto-publish."
    ],
    humanActions: buildHumanActions({ updates, drafts, reviews, sources }),
    activityTimeline: buildActivityTimeline({ sources, updates, drafts, reviews, activity }),
    errorsWarnings: buildErrorsWarnings({ sources, activity, reviews }),
    advanced: {
      flags,
      runtime,
      publishingControls,
      readiness,
      lastCycleId: NA,
      refs: advancedRefs
    }
  };
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
  const isDormant = isAutomationDormant();
  const runtime = {
    workerActive: canRunAutomationWorkers(),
    pipelineActive: canRunProductionPipeline(),
    telegramActive: canDeliverTelegram(),
    schedulerArmed: canStartMonitoringScheduler(),
    autoPublishBlocked: isAutoPublishBlocked(),
    activationDecision: readiness.decision,
    activationReady: readiness.ready === true
  };
  const publishingControls = getPublishingControlState();
  const notificationGatewayStatus = notificationGateway.getChannelStatus();
  const operatorOverview = buildOperatorOverview({
    flags,
    runtime,
    publishingControls,
    readiness,
    notificationGatewayStatus,
    sources: sourceRows,
    updates: updateRows,
    drafts: draftRows,
    published: publishedRows,
    reviews: reviewRows,
    activity: activityRows,
    isDormant
  });

  return {
    flags,
    isDormant,
    runtime,
    publishingControls,
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
    operatorOverview,
    enterprise: enterpriseSnapshot,
    readiness,
    notificationGateway: notificationGatewayStatus,
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
  buildRecentPipelineActivity,
  buildOperatorOverview
};
