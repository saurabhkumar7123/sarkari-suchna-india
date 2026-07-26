'use strict';

/**
 * GOVERNMENT MONITORING BOT — Package MB-1
 * Crawl Policy (Advisory / Configuration Only)
 *
 * Advisory crawl policy metadata. Never performs HTTP requests.
 */

const { deepFreeze } = require('./governmentSourceRegistry');

const CRAWL_POLICY_VERSION = 'MB1.1.0.0';

const ROBOTS_POLICIES = Object.freeze({
  RESPECT: 'RESPECT',
  IGNORE_ADVISORY: 'IGNORE_ADVISORY',
  UNKNOWN: 'UNKNOWN',
});

const VALID_ROBOTS_POLICIES = Object.freeze(Object.values(ROBOTS_POLICIES));

const DEFAULT_CRAWL_POLICY = deepFreeze({
  robotsPolicy: ROBOTS_POLICIES.RESPECT,
  crawlDelayMs: 2000,
  retryPolicy: {
    maxRetries: 3,
    backoffMs: 5000,
    backoffMultiplier: 2,
    retryOnTimeout: true,
    retryOnServerError: true,
  },
  requestTimeoutMs: 30000,
  maximumRedirects: 5,
});

function normalizeRobotsPolicy(value) {
  if (typeof value === 'string' && VALID_ROBOTS_POLICIES.includes(value.trim())) {
    return value.trim();
  }
  return ROBOTS_POLICIES.RESPECT;
}

function normalizePositiveInt(value, fallback) {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return Math.floor(value);
  }
  return fallback;
}

function normalizeRetryPolicy(input, defaults) {
  const src = input && typeof input === 'object' ? input : {};
  return {
    maxRetries: normalizePositiveInt(src.maxRetries, defaults.maxRetries),
    backoffMs: normalizePositiveInt(src.backoffMs, defaults.backoffMs),
    backoffMultiplier:
      typeof src.backoffMultiplier === 'number' &&
      Number.isFinite(src.backoffMultiplier) &&
      src.backoffMultiplier >= 1
        ? src.backoffMultiplier
        : defaults.backoffMultiplier,
    retryOnTimeout:
      typeof src.retryOnTimeout === 'boolean'
        ? src.retryOnTimeout
        : defaults.retryOnTimeout,
    retryOnServerError:
      typeof src.retryOnServerError === 'boolean'
        ? src.retryOnServerError
        : defaults.retryOnServerError,
  };
}

/**
 * Create an advisory crawl policy (configuration only).
 * @param {object} [input]
 */
function createCrawlPolicy(input = {}) {
  const defaults = DEFAULT_CRAWL_POLICY;
  const retryPolicy = normalizeRetryPolicy(input.retryPolicy, defaults.retryPolicy);

  return deepFreeze({
    policyVersion: CRAWL_POLICY_VERSION,
    advisoryOnly: true,
    configurationDriven: true,
    versioned: true,
    deterministic: true,
    executionDenied: true,
    httpRequestsDenied: true,
    websiteVisitsDenied: true,
    robotsPolicy: normalizeRobotsPolicy(input.robotsPolicy),
    crawlDelayMs: normalizePositiveInt(input.crawlDelayMs, defaults.crawlDelayMs),
    retryPolicy,
    requestTimeoutMs: normalizePositiveInt(
      input.requestTimeoutMs,
      defaults.requestTimeoutMs
    ),
    maximumRedirects: normalizePositiveInt(
      input.maximumRedirects,
      defaults.maximumRedirects
    ),
    sourceId:
      typeof input.sourceId === 'string' && input.sourceId.trim()
        ? input.sourceId.trim()
        : null,
  });
}

/**
 * Build per-source crawl policy map.
 * @param {object} [options]
 * @param {Array<object>} [options.sources]
 * @param {object|Array} [options.policies]
 * @param {object} [options.defaultPolicy]
 */
function createCrawlPolicyMap(options = {}) {
  const defaultPolicy = createCrawlPolicy(options.defaultPolicy || {});
  const sources = Array.isArray(options.sources) ? options.sources : [];
  const overrides = {};

  if (Array.isArray(options.policies)) {
    for (let i = 0; i < options.policies.length; i += 1) {
      const p = options.policies[i] || {};
      if (typeof p.sourceId === 'string' && p.sourceId.trim()) {
        overrides[p.sourceId.trim()] = p;
      }
    }
  } else if (options.policies && typeof options.policies === 'object') {
    Object.keys(options.policies).forEach((key) => {
      overrides[key] = { sourceId: key, ...options.policies[key] };
    });
  }

  const bySourceId = {};
  const policies = [];
  const sourceIds = sources.map((s) => s.sourceId).filter(Boolean);

  if (sourceIds.length === 0 && Object.keys(overrides).length === 0) {
    return deepFreeze({
      policyVersion: CRAWL_POLICY_VERSION,
      advisoryOnly: true,
      configurationDriven: true,
      executionDenied: true,
      httpRequestsDenied: true,
      defaultPolicy,
      policyCount: 0,
      policies: [],
      bySourceId: {},
    });
  }

  const ids =
    sourceIds.length > 0 ? sourceIds : Object.keys(overrides).sort();

  const seen = new Set();
  for (let i = 0; i < ids.length; i += 1) {
    const sourceId = ids[i];
    if (!sourceId || seen.has(sourceId)) continue;
    seen.add(sourceId);
    const policy = createCrawlPolicy({
      ...defaultPolicy,
      retryPolicy: { ...defaultPolicy.retryPolicy },
      ...(overrides[sourceId] || {}),
      sourceId,
    });
    bySourceId[sourceId] = policy;
    policies.push(policy);
  }

  policies.sort((a, b) => String(a.sourceId).localeCompare(String(b.sourceId)));

  return deepFreeze({
    policyVersion: CRAWL_POLICY_VERSION,
    advisoryOnly: true,
    configurationDriven: true,
    versioned: true,
    deterministic: true,
    executionDenied: true,
    httpRequestsDenied: true,
    websiteVisitsDenied: true,
    scrapingDenied: true,
    defaultPolicy,
    policyCount: policies.length,
    policies,
    bySourceId,
  });
}

function getDefaultCrawlPolicy() {
  return createCrawlPolicy();
}

function validateCrawlPolicyShape(policy) {
  const issues = [];
  if (!policy || typeof policy !== 'object') {
    return deepFreeze({
      valid: false,
      issues: [
        {
          code: 'CRAWL_POLICY_MISSING',
          severity: 'ERROR',
          message: 'Crawl policy is missing.',
        },
      ],
    });
  }

  if (!VALID_ROBOTS_POLICIES.includes(policy.robotsPolicy)) {
    issues.push({
      code: 'INVALID_ROBOTS_POLICY',
      severity: 'ERROR',
      message: `Invalid robots policy: ${policy.robotsPolicy}`,
    });
  }
  if (
    typeof policy.crawlDelayMs !== 'number' ||
    !Number.isFinite(policy.crawlDelayMs) ||
    policy.crawlDelayMs < 0
  ) {
    issues.push({
      code: 'INVALID_CRAWL_DELAY',
      severity: 'ERROR',
      message: 'crawlDelayMs must be a non-negative number.',
    });
  }
  if (
    typeof policy.requestTimeoutMs !== 'number' ||
    !Number.isFinite(policy.requestTimeoutMs) ||
    policy.requestTimeoutMs <= 0
  ) {
    issues.push({
      code: 'INVALID_REQUEST_TIMEOUT',
      severity: 'ERROR',
      message: 'requestTimeoutMs must be a positive number.',
    });
  }
  if (
    typeof policy.maximumRedirects !== 'number' ||
    !Number.isFinite(policy.maximumRedirects) ||
    policy.maximumRedirects < 0
  ) {
    issues.push({
      code: 'INVALID_MAXIMUM_REDIRECTS',
      severity: 'ERROR',
      message: 'maximumRedirects must be a non-negative number.',
    });
  }
  const retry = policy.retryPolicy;
  if (!retry || typeof retry !== 'object') {
    issues.push({
      code: 'MISSING_RETRY_POLICY',
      severity: 'ERROR',
      message: 'retryPolicy is required.',
    });
  } else if (
    typeof retry.maxRetries !== 'number' ||
    !Number.isFinite(retry.maxRetries) ||
    retry.maxRetries < 0
  ) {
    issues.push({
      code: 'INVALID_MAX_RETRIES',
      severity: 'ERROR',
      message: 'retryPolicy.maxRetries must be a non-negative number.',
    });
  }

  return deepFreeze({
    valid: issues.length === 0,
    issues,
    advisoryOnly: true,
    autoRemediation: false,
  });
}

module.exports = {
  CRAWL_POLICY_VERSION,
  ROBOTS_POLICIES,
  VALID_ROBOTS_POLICIES,
  DEFAULT_CRAWL_POLICY,
  createCrawlPolicy,
  createCrawlPolicyMap,
  getDefaultCrawlPolicy,
  validateCrawlPolicyShape,
};
