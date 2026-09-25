"use strict";

/**
 * Controlled monitoring dry-run framework (Phase I).
 *
 * - Uses approved sources only
 * - Safe GET via central HTTP safety layer
 * - Detects changes
 * - Records execution audit
 * - Does NOT publish, send Telegram, or mutate external websites
 * - Does NOT create production drafts / pipeline side effects
 */

const logger = require("../../utils/logger");
const {
  fetchSites,
  getSiteById,
  saveSiteBaseline,
  markSiteChecked
} = require("./updates.repository");
const { checkSite } = require("./siteChecker");
const {
  buildSourcePolicy,
  assertExactUrlBinding,
  deriveSourceHealth,
  SELECTOR_STATUS,
  enrichSiteWithGovernance
} = require("./sourceGovernancePolicy");
const {
  isDryRunMode,
  setDryRunMode,
  getControlPlaneSnapshot,
  isMonitoringFetchPermitted
} = require("../../config/automationControlPlane");
const {
  recordExecutionAudit,
  recordBlockedSecurityEvent,
  SECURITY_EVENT_TYPES
} = require("./monitoringSecurityAudit");
const { isAutoPublishBlocked, canDeliverTelegram, canAutoDraft } = require("../../config/automationFlags");

async function assertDryRunSafetyGates() {
  if (!isDryRunMode()) {
    const err = new Error("Dry-run mode is not active");
    err.statusCode = 409;
    err.code = "DRY_RUN_INACTIVE";
    throw err;
  }
  if (!isMonitoringFetchPermitted()) {
    const err = new Error("Monitoring fetch is not permitted (emergency stop or dormant)");
    err.statusCode = 403;
    err.code = "MONITORING_FETCH_BLOCKED";
    throw err;
  }
  if (isAutoPublishBlocked() !== true) {
    const err = new Error("Auto-publish must remain blocked during dry-run");
    err.statusCode = 500;
    err.code = "AUTO_PUBLISH_NOT_BLOCKED";
    throw err;
  }
  if (canDeliverTelegram() === true) {
    const err = new Error("Telegram delivery must remain disabled during dry-run");
    err.statusCode = 500;
    err.code = "TELEGRAM_NOT_BLOCKED";
    throw err;
  }
  if (canAutoDraft() === true) {
    const err = new Error("Auto-draft must remain disabled during dry-run");
    err.statusCode = 500;
    err.code = "AUTO_DRAFT_NOT_BLOCKED";
    throw err;
  }
}

/**
 * Run a single-source dry-run check.
 * @param {object|number} siteOrId
 */
async function runSourceDryRun(siteOrId, options = {}) {
  await assertDryRunSafetyGates();

  let site = siteOrId;
  if (typeof siteOrId === "number" || (typeof siteOrId === "string" && /^\d+$/.test(siteOrId))) {
    site = await getSiteById(Number(siteOrId));
  }
  if (!site || !site.id) {
    const err = new Error("Source not found");
    err.statusCode = 404;
    throw err;
  }

  const policy = buildSourcePolicy(site);
    const binding = assertExactUrlBinding(policy, policy.approvedUrl, { requireEnabled: true });
  if (!binding.allowed) {
    await recordBlockedSecurityEvent({
      eventType: binding.code || SECURITY_EVENT_TYPES.POLICY_REJECTION,
      reason: binding.reason,
      action: "DRY_RUN_BLOCKED",
      requestedMethod: "GET",
      requestedUrl: policy.approvedUrl,
      siteId: site.id,
      detail: { dryRun: true }
    });
    return {
      dryRun: true,
      siteId: site.id,
      sourceName: policy.sourceName,
      blocked: true,
      reason: binding.reason,
      code: binding.code,
      health: deriveSourceHealth(site, { policy, blocked: true, lastBlockedReason: binding.reason }),
      published: false,
      telegramSent: false,
      draftCreated: false
    };
  }

  const started = Date.now();
  let result;
  try {
    // allowWhenAutomationDormant is false — dry-run uses isMonitoringFetchPermitted gate.
    result = await checkSite(site, { allowWhenAutomationDormant: false });
  } catch (err) {
    const durationMs = Date.now() - started;
    await recordExecutionAudit({
      dryRun: true,
      siteId: site.id,
      sourceName: policy.sourceName,
      requestedUrl: policy.approvedUrl,
      requestedMethod: "GET",
      result: "ERROR",
      status: "error",
      reason: err && err.message ? err.message : String(err),
      durationMs,
      websiteContacted: err && err.blocked === true ? false : true,
      changeDetected: false
    });
    return {
      dryRun: true,
      siteId: site.id,
      sourceName: policy.sourceName,
      error: true,
      reason: err && err.message ? err.message : String(err),
      code: err && err.code ? err.code : "CHECK_FAILED",
      blocked: err && err.blocked === true,
      durationMs,
      published: false,
      telegramSent: false,
      draftCreated: false,
      health: deriveSourceHealth(site, {
        policy,
        blocked: err && err.blocked === true,
        lastBlockedReason: err && err.message
      })
    };
  }

  const durationMs = Date.now() - started;
  const selectorStatus =
    result && result.invalid && result.reason === "selector_miss"
      ? SELECTOR_STATUS.MISS
      : result && result.invalid
        ? SELECTOR_STATUS.UNKNOWN
        : SELECTOR_STATUS.OK;

  // Persist local check evidence only (baseline / last_checked_at). Never publishes.
  if (result && !result.invalid && !result.policySkip && !result.blocked) {
    try {
      if (result.establishBaseline) {
        await saveSiteBaseline(site.id, result.baselineFingerprint || "");
      } else {
        await markSiteChecked(site.id);
      }
      site = (await getSiteById(site.id)) || site;
    } catch (persistErr) {
      logger.warn("monitoring-dry-run: failed to persist local check evidence", {
        siteId: site.id,
        message: persistErr && persistErr.message ? persistErr.message : String(persistErr)
      });
    }
  }

  if (selectorStatus === SELECTOR_STATUS.MISS) {
    await recordExecutionAudit({
      eventType: SECURITY_EVENT_TYPES.SELECTOR_MISS,
      dryRun: true,
      siteId: site.id,
      sourceName: policy.sourceName,
      requestedUrl: policy.approvedUrl,
      requestedMethod: "GET",
      result: "SELECTOR_MISS",
      status: "warning",
      reason: "selector_miss",
      durationMs,
      changeDetected: false,
      selectorStatus,
      websiteContacted: true
    });
  } else {
    await recordExecutionAudit({
      dryRun: true,
      siteId: site.id,
      sourceName: policy.sourceName,
      requestedUrl: policy.approvedUrl,
      requestedMethod: "GET",
      result: result && result.changed ? "CHANGE_DETECTED" : "NO_CHANGE",
      status: "ok",
      durationMs,
      changeDetected: Boolean(result && result.changed),
      selectorStatus,
      websiteContacted: true,
      detail: {
        invalid: Boolean(result && result.invalid),
        reason: (result && result.reason) || null,
        policySkip: Boolean(result && result.policySkip)
      }
    });
  }

  logger.info("monitoring-dry-run: source check complete", {
    siteId: site.id,
    changed: Boolean(result && result.changed),
    invalid: Boolean(result && result.invalid),
    reason: (result && result.reason) || null,
    durationMs
  });

  const refreshedPolicy = buildSourcePolicy(site);
  return {
    dryRun: true,
    siteId: site.id,
    sourceName: refreshedPolicy.sourceName,
    officialHost: refreshedPolicy.officialHost,
    approvedUrl: refreshedPolicy.approvedUrl,
    durationMs,
    check: {
      changed: Boolean(result && result.changed),
      invalid: Boolean(result && result.invalid),
      reason: (result && result.reason) || null,
      policySkip: Boolean(result && result.policySkip),
      establishBaseline: Boolean(result && result.establishBaseline)
    },
    health: deriveSourceHealth(site, {
      policy: refreshedPolicy,
      selectorStatus,
      hasSuccessfulCheck: true
    }),
    published: false,
    telegramSent: false,
    draftCreated: false,
    externalNotificationSent: false
  };
}

/**
 * Run dry-run across active sources (bounded).
 * @param {{ limit?: number, siteIds?: number[] }} options
 */
async function runDryRunBatch(options = {}) {
  await assertDryRunSafetyGates();

  const limit = Math.min(100, Math.max(1, Number(options.limit) || 5));
  let sites = await fetchSites().catch(() => []);
  if (!Array.isArray(sites)) sites = [];

  if (Array.isArray(options.siteIds) && options.siteIds.length) {
    const wanted = new Set(options.siteIds.map((id) => Number(id)));
    sites = sites.filter((s) => wanted.has(Number(s.id)));
  } else {
    sites = sites.filter((s) => s && (s.active === true || s.active === 1));
  }

  sites = sites.slice(0, limit);
  const results = [];
  for (const site of sites) {
    // Sequential — politeness / failure isolation between sources.
    // eslint-disable-next-line no-await-in-loop
    const one = await runSourceDryRun(site, options);
    results.push(one);
  }

  return {
    dryRun: true,
    mode: "DRY_RUN",
    controlPlane: getControlPlaneSnapshot(),
    count: results.length,
    results,
    guarantees: {
      published: false,
      telegramSent: false,
      draftCreated: false,
      autoPublishBlocked: true,
      externalWebsiteModified: false
    }
  };
}

async function enableDryRunMode(actor = "operator") {
  const snapshot = setDryRunMode(true, { updatedBy: actor });
  return { enabled: true, controlPlane: snapshot };
}

async function disableDryRunMode(actor = "operator") {
  const snapshot = setDryRunMode(false, { updatedBy: actor });
  return { enabled: false, controlPlane: snapshot };
}

function getDryRunStatus() {
  const plane = getControlPlaneSnapshot();
  return {
    active: plane.dryRun === true,
    mode: plane.mode,
    monitoringFetchPermitted: plane.monitoringFetchPermitted,
    autoPublishBlocked: true,
    telegramPermitted: false,
    controlPlane: plane
  };
}

module.exports = {
  assertDryRunSafetyGates,
  runSourceDryRun,
  runDryRunBatch,
  enableDryRunMode,
  disableDryRunMode,
  getDryRunStatus,
  enrichSiteWithGovernance
};
