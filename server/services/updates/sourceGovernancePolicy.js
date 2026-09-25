"use strict";

/**
 * Source governance policy — Phase C / F.
 *
 * Derives an explicit monitoring boundary from each monitored_sites row
 * without requiring a production schema migration. Optional per-source
 * overrides live in server/data/source-policies.json (local/shared FS).
 *
 * Exact URL binding: a source may only fetch its approvedUrl (plus any
 * explicitly declared approvedFetchUrls for that source's extraction policy).
 */

const fs = require("fs");
const path = require("path");
const {
  extractHostname,
  isApprovedOfficialMonitoringUrl
} = require("../../lib/contentIntelligence/sourceIntelligence/officialDomains");

const DEFAULT_OVERRIDES_PATH = path.join(__dirname, "../../data/source-policies.json");
const DEFAULT_MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const HARD_MAX_RESPONSE_BYTES = 8 * 1024 * 1024;

function resolveMaxResponseBytes(overrideBytes) {
  const fromEnv = parseInt(process.env.UPDATE_MAX_HTML_BYTES || String(DEFAULT_MAX_RESPONSE_BYTES), 10);
  const base =
    Number.isFinite(fromEnv) && fromEnv > 0
      ? Math.min(HARD_MAX_RESPONSE_BYTES, fromEnv)
      : DEFAULT_MAX_RESPONSE_BYTES;
  if (Number.isFinite(Number(overrideBytes)) && Number(overrideBytes) > 0) {
    return Math.min(base, Number(overrideBytes));
  }
  return base;
}

const HEALTH_STATUS = Object.freeze({
  HEALTHY: "HEALTHY",
  DEGRADED: "DEGRADED",
  BLOCKED: "BLOCKED",
  ERROR: "ERROR",
  DISABLED: "DISABLED",
  UNKNOWN: "UNKNOWN"
});

const SELECTOR_STATUS = Object.freeze({
  OK: "OK",
  MISS: "MISS",
  UNKNOWN: "UNKNOWN",
  N_A: "N_A"
});

const DEFAULT_POLL_INTERVAL_MINUTES = 10;
const MIN_POLL_INTERVAL_MINUTES = 5;
const MAX_POLL_INTERVAL_MINUTES = 60;
const DEFAULT_TIMEOUT_MS = 25000;
const DEFAULT_RATE_LIMIT_MS = 1500;
const FAIL_DEGRADED_THRESHOLD = 2;
const FAIL_ERROR_THRESHOLD = 5;

/** Explicit alternate fetch URLs allowed only when extraction method requires them. */
const SSC_NOTICE_API_URL = "https://ssc.gov.in/api/general-website/portal/notice-boards";

function resolveOverridesPath() {
  const fromEnv = String(process.env.AUTOMATION_SOURCE_POLICIES_PATH || "").trim();
  return fromEnv || DEFAULT_OVERRIDES_PATH;
}

function readOverrides(filePath = resolveOverridesPath()) {
  try {
    if (!fs.existsSync(filePath)) return { sources: {} };
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return {
      sources: parsed && typeof parsed.sources === "object" && parsed.sources ? parsed.sources : {}
    };
  } catch {
    return { sources: {} };
  }
}

function normalizeUrlKey(rawUrl) {
  const value = String(rawUrl || "").trim();
  if (!value) return "";
  try {
    const parsed = new URL(value);
    parsed.hash = "";
    // Trailing slash normalization for path-only equality (keep root slash).
    if (parsed.pathname.length > 1 && parsed.pathname.endsWith("/")) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }
    return parsed.toString();
  } catch {
    return value;
  }
}

function urlsEqual(a, b) {
  return normalizeUrlKey(a) === normalizeUrlKey(b) && normalizeUrlKey(a) !== "";
}

function clampPollInterval(minutes) {
  const n = Number(minutes);
  if (!Number.isFinite(n)) return DEFAULT_POLL_INTERVAL_MINUTES;
  return Math.min(MAX_POLL_INTERVAL_MINUTES, Math.max(MIN_POLL_INTERVAL_MINUTES, Math.round(n)));
}

function resolveApprovedFetchUrls(site, override = {}) {
  const approvedUrl = String((site && site.url) || "").trim();
  const extras = [];
  if (Array.isArray(override.approvedFetchUrls)) {
    for (const u of override.approvedFetchUrls) {
      const s = String(u || "").trim();
      if (s) extras.push(s);
    }
  }
  // SSC JSON extraction policy: only when site host is SSC and API flag is on.
  const useSscApi = String(process.env.SSC_USE_API || "").trim() === "1";
  if (useSscApi && site) {
    try {
      const host = new URL(approvedUrl).hostname.toLowerCase().replace(/^www\./, "");
      if (host === "ssc.gov.in") {
        extras.push(SSC_NOTICE_API_URL);
      }
    } catch {
      /* ignore */
    }
  }
  const seen = new Set();
  const out = [];
  for (const u of [approvedUrl, ...extras]) {
    const key = normalizeUrlKey(u);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(u);
  }
  return out;
}

/**
 * Build governance policy for a monitored site row.
 * @param {object} site
 * @param {object} [options]
 */
function buildSourcePolicy(site, options = {}) {
  const overrides = options.overrides || readOverrides();
  const siteId = site && site.id != null ? Number(site.id) : null;
  const override =
    siteId != null && overrides.sources && overrides.sources[String(siteId)]
      ? overrides.sources[String(siteId)]
      : {};

  const approvedUrl = String((site && site.url) || "").trim();
  let officialHost = null;
  let approvedProtocol = null;
  try {
    const parsed = new URL(approvedUrl);
    officialHost = extractHostname(approvedUrl) || parsed.hostname.toLowerCase();
    approvedProtocol = parsed.protocol.replace(":", "").toLowerCase();
  } catch {
    officialHost = null;
    approvedProtocol = null;
  }

  const enabled =
    site && (site.active === true || site.active === 1 || site.is_active === 1 || site.is_active === true);
  const broken = site && (site.broken === true || site.broken === 1);
  const failCount = Number(site && (site.failCount != null ? site.failCount : site.fail_count)) || 0;
  const selector = String((site && site.selector) || "").trim() || null;

  const pollIntervalMinutes = clampPollInterval(
    override.pollIntervalMinutes != null
      ? override.pollIntervalMinutes
      : process.env.UPDATE_CHECK_INTERVAL_MINUTES || DEFAULT_POLL_INTERVAL_MINUTES
  );

  const policy = Object.freeze({
    sourceId: siteId,
    sourceName: String((site && site.name) || "").trim() || (siteId != null ? `Source ${siteId}` : "unknown"),
    officialHost,
    approvedUrl,
    approvedProtocol,
    approvedFetchUrls: resolveApprovedFetchUrls(site, override),
    enabled: enabled === true,
    broken: broken === true,
    pollIntervalMinutes,
    timeoutMs:
      Number.isFinite(Number(override.timeoutMs)) && Number(override.timeoutMs) > 0
        ? Number(override.timeoutMs)
        : DEFAULT_TIMEOUT_MS,
    retryPolicy: Object.freeze({
      maxAttempts: Number.isFinite(Number(override.maxAttempts)) ? Number(override.maxAttempts) : 3,
      backoffMs: Number.isFinite(Number(override.backoffMs)) ? Number(override.backoffMs) : 5000
    }),
    rateLimitMs:
      Number.isFinite(Number(override.rateLimitMs)) && Number(override.rateLimitMs) >= 0
        ? Number(override.rateLimitMs)
        : DEFAULT_RATE_LIMIT_MS,
    selectorPolicy: Object.freeze({
      selector,
      mode: "exact_only",
      guessingAllowed: false,
      recursiveCrawlAllowed: false
    }),
    robotsPolicy: Object.freeze({
      mustComply: true,
      bypassAllowed: false
    }),
    maxResponseBytes: resolveMaxResponseBytes(override.maxResponseBytes),
    redirectPolicy: Object.freeze({
      follow: true,
      maxHops: 5,
      sameHostFamilyOnly: true,
      requireOfficialHost: true
    }),
    failCount,
    lastCheckedAt: (site && (site.lastCheckedAt || site.last_checked_at)) || null,
    lastSuccessAt: override.lastSuccessAt || null,
    lastChangeAt: (site && (site.lastAlertAt || site.last_alert_at)) || null,
    lastError: override.lastError || null,
    purpose: (site && site.purpose) || null,
    priority: Number(site && site.priority) || 1,
    hostApproved: approvedUrl ? isApprovedOfficialMonitoringUrl(approvedUrl) === true : false
  });

  return policy;
}

/**
 * Fail-closed: destination must be one of the source's approved fetch URLs.
 * @param {object} policy
 * @param {string} destinationUrl
 * @param {{ requireEnabled?: boolean }} [options] — default true for scheduler/worker gates
 */
function assertExactUrlBinding(policy, destinationUrl, options = {}) {
  const dest = String(destinationUrl || "").trim();
  if (!policy || !dest) {
    return {
      allowed: false,
      code: "POLICY_REJECTION",
      reason: "Source policy or destination URL missing."
    };
  }
  const requireEnabled = options.requireEnabled !== false;
  if (requireEnabled && !policy.enabled) {
    return {
      allowed: false,
      code: "SOURCE_DISABLED",
      reason: "Source is disabled."
    };
  }
  if (!policy.hostApproved) {
    return {
      allowed: false,
      code: "UNAPPROVED_HOST",
      reason: "Source approved URL host is not an approved official host."
    };
  }
  const allowed = (policy.approvedFetchUrls || []).some((u) => urlsEqual(u, dest));
  if (!allowed) {
    return {
      allowed: false,
      code: "POLICY_REJECTION",
      reason: "Destination URL is not bound to this source's approved URL/path policy."
    };
  }
  return { allowed: true, code: null, reason: null };
}

/**
 * Derive truthful health — never invent HEALTHY when unknown.
 */
function deriveSourceHealth(site, extras = {}) {
  const policy = extras.policy || buildSourcePolicy(site);
  const selectorStatus = extras.selectorStatus || SELECTOR_STATUS.UNKNOWN;
  const robotsStatus = extras.robotsStatus || null;
  const lastBlockedReason = extras.lastBlockedReason || null;

  if (!policy.enabled) {
    return {
      healthStatus: HEALTH_STATUS.DISABLED,
      selectorStatus,
      robotsStatus,
      consecutiveFailures: policy.failCount,
      lastCheckedAt: policy.lastCheckedAt,
      lastSuccessAt: policy.lastSuccessAt,
      lastChangeAt: policy.lastChangeAt,
      lastError: policy.lastError || lastBlockedReason,
      reason: "source_disabled"
    };
  }

  if (lastBlockedReason || extras.blocked === true) {
    return {
      healthStatus: HEALTH_STATUS.BLOCKED,
      selectorStatus,
      robotsStatus,
      consecutiveFailures: policy.failCount,
      lastCheckedAt: policy.lastCheckedAt,
      lastSuccessAt: policy.lastSuccessAt,
      lastChangeAt: policy.lastChangeAt,
      lastError: lastBlockedReason || policy.lastError,
      reason: "safety_blocked"
    };
  }

  if (policy.broken || policy.failCount >= FAIL_ERROR_THRESHOLD) {
    return {
      healthStatus: HEALTH_STATUS.ERROR,
      selectorStatus,
      robotsStatus,
      consecutiveFailures: policy.failCount,
      lastCheckedAt: policy.lastCheckedAt,
      lastSuccessAt: policy.lastSuccessAt,
      lastChangeAt: policy.lastChangeAt,
      lastError: policy.lastError,
      reason: "consecutive_failures"
    };
  }

  if (selectorStatus === SELECTOR_STATUS.MISS) {
    return {
      healthStatus: HEALTH_STATUS.DEGRADED,
      selectorStatus,
      robotsStatus,
      consecutiveFailures: policy.failCount,
      lastCheckedAt: policy.lastCheckedAt,
      lastSuccessAt: policy.lastSuccessAt,
      lastChangeAt: policy.lastChangeAt,
      lastError: "selector_miss",
      reason: "selector_miss"
    };
  }

  if (policy.failCount >= FAIL_DEGRADED_THRESHOLD) {
    return {
      healthStatus: HEALTH_STATUS.DEGRADED,
      selectorStatus,
      robotsStatus,
      consecutiveFailures: policy.failCount,
      lastCheckedAt: policy.lastCheckedAt,
      lastSuccessAt: policy.lastSuccessAt,
      lastChangeAt: policy.lastChangeAt,
      lastError: policy.lastError,
      reason: "elevated_failures"
    };
  }

  if (!policy.lastCheckedAt && !extras.hasSuccessfulCheck) {
    return {
      healthStatus: HEALTH_STATUS.UNKNOWN,
      selectorStatus,
      robotsStatus,
      consecutiveFailures: policy.failCount,
      lastCheckedAt: null,
      lastSuccessAt: policy.lastSuccessAt,
      lastChangeAt: policy.lastChangeAt,
      lastError: null,
      reason: "never_checked"
    };
  }

  if (policy.hostApproved !== true) {
    return {
      healthStatus: HEALTH_STATUS.BLOCKED,
      selectorStatus,
      robotsStatus,
      consecutiveFailures: policy.failCount,
      lastCheckedAt: policy.lastCheckedAt,
      lastSuccessAt: policy.lastSuccessAt,
      lastChangeAt: policy.lastChangeAt,
      lastError: "unapproved_host",
      reason: "unapproved_host"
    };
  }

  return {
    healthStatus: HEALTH_STATUS.HEALTHY,
    selectorStatus: selectorStatus === SELECTOR_STATUS.UNKNOWN ? SELECTOR_STATUS.OK : selectorStatus,
    robotsStatus,
    consecutiveFailures: policy.failCount,
    lastCheckedAt: policy.lastCheckedAt,
    lastSuccessAt: policy.lastSuccessAt || policy.lastCheckedAt,
    lastChangeAt: policy.lastChangeAt,
    lastError: null,
    reason: null
  };
}

function enrichSiteWithGovernance(site) {
  const policy = buildSourcePolicy(site);
  const health = deriveSourceHealth(site, { policy });
  return {
    ...site,
    governance: policy,
    health
  };
}

module.exports = {
  HEALTH_STATUS,
  SELECTOR_STATUS,
  DEFAULT_POLL_INTERVAL_MINUTES,
  MIN_POLL_INTERVAL_MINUTES,
  MAX_POLL_INTERVAL_MINUTES,
  SSC_NOTICE_API_URL,
  resolveOverridesPath,
  readOverrides,
  normalizeUrlKey,
  urlsEqual,
  buildSourcePolicy,
  assertExactUrlBinding,
  deriveSourceHealth,
  enrichSiteWithGovernance
};
