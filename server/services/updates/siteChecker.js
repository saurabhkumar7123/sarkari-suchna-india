"use strict";

const cheerio = require("cheerio");
const crypto = require("crypto");
const logger = require("../../utils/logger");
const {
  isSscApiEnabled,
  isSscApiSite,
  extractSscNoticeItems
} = require("./sscNoticeChecker");
const { evaluateRobotsAccessPolicy, MONITORING_BOT_UA } = require("./robotsAccessPolicy");
const {
  withHostPoliteness,
  noteHostRateLimited,
  noteHostCrawlDelay
} = require("./hostPoliteness");
const {
  classifyMonitoringHttpError,
  createMonitoringFetchError
} = require("./monitoringFetchErrors");
const {
  monitoringSafeGet,
  MonitoringHttpSafetyError,
  MONITORING_BOT_UA: SAFETY_UA
} = require("./monitoringHttpSafety");
const {
  buildSourcePolicy,
  assertExactUrlBinding
} = require("./sourceGovernancePolicy");
const {
  recordBlockedSecurityEvent,
  SECURITY_EVENT_TYPES
} = require("./monitoringSecurityAudit");

const SOURCE_METHODS = Object.freeze({
  HTML_SELECTOR: "HTML_SELECTOR",
  SSC_JSON: "SSC_JSON"
});

const FETCH_TIMEOUT_MS = 25000;
const FETCH_HEADERS = Object.freeze({
  "User-Agent": MONITORING_BOT_UA || SAFETY_UA,
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
});

function resolveSourceMethod(site) {
  if (isSscApiEnabled() && isSscApiSite(site)) {
    return SOURCE_METHODS.SSC_JSON;
  }
  return SOURCE_METHODS.HTML_SELECTOR;
}

function normalizeText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeForFingerprint(value) {
  return normalizeText(value).toLowerCase();
}

function buildSignature(value) {
  const compact = normalizeForFingerprint(value).slice(0, 200);
  const hash = crypto.createHash("sha1").update(compact).digest("hex");
  return `sig:${hash}:${compact}`;
}

function isStoredFingerprint(value) {
  return /^sig:[a-f0-9]{40}:/i.test(String(value || "").trim());
}

/**
 * Resolve stored last_content to a comparable top-item fingerprint.
 * @param {string|null|undefined} lastContent
 * @returns {{ hasBaseline: boolean, fingerprint: string|null }}
 */
function normalizeStoredBaseline(lastContent) {
  const raw = String(lastContent || "").trim();
  if (!raw) {
    return { hasBaseline: false, fingerprint: null };
  }
  if (isStoredFingerprint(raw)) {
    return { hasBaseline: true, fingerprint: raw };
  }
  return { hasBaseline: true, fingerprint: buildSignature(raw) };
}

/**
 * @param {string} itemFingerprint
 * @param {{ hasBaseline: boolean, fingerprint: string|null }} baseline
 */
function itemMatchesBaseline(itemFingerprint, baseline) {
  if (!baseline.hasBaseline || !baseline.fingerprint) return false;
  return String(itemFingerprint || "") === baseline.fingerprint;
}

/**
 * Select nodes using the exact configured selector only.
 * No host-specific guessing/fallback — selector miss stays UNKNOWN.
 */
function selectLatestRoots($, site) {
  return $(site.selector);
}

function absolutizeLink(siteUrl, href) {
  const raw = String(href || "").trim();
  if (!raw) return "";
  try {
    return new URL(raw, siteUrl).toString();
  } catch {
    return raw;
  }
}

/**
 * Live monitoring GET via central HTTP safety layer (GET-only, safe redirects, size limit).
 * @param {string} url
 * @param {object} [axiosConfig]
 * @param {{ allowWhenAutomationDormant?: boolean, siteId?: number|null }} [safetyOptions]
 */
async function axiosGetReadOnly(url, axiosConfig = {}, safetyOptions = {}) {
  try {
    const response = await monitoringSafeGet(url, {
      timeout: FETCH_TIMEOUT_MS,
      headers: { ...FETCH_HEADERS, ...(axiosConfig.headers || {}) },
      responseType: axiosConfig.responseType || "text",
      transformResponse: axiosConfig.transformResponse || [(data) => data],
      params: axiosConfig.params,
      allowWhenAutomationDormant: safetyOptions.allowWhenAutomationDormant === true,
      siteId: safetyOptions.siteId != null ? safetyOptions.siteId : null,
      requireOfficialHost: true
    });

    const status = Number(response.status || 0);
    if (status < 200 || status >= 300) {
      const err = new Error(`Request failed with status code ${status}`);
      err.response = { status, headers: response.headers || {}, data: response.data };
      throw err;
    }

    return {
      status,
      data: response.data,
      headers: response.headers || {},
      finalUrl: response.finalUrl,
      redirectChain: response.redirectChain
    };
  } catch (err) {
    if (err instanceof MonitoringHttpSafetyError) {
      throw err;
    }
    const classification = classifyMonitoringHttpError(err);
    if (classification.rateLimited) {
      noteHostRateLimited(
        url,
        classification.retryAfter ||
          (err.response && err.response.headers && err.response.headers["retry-after"])
      );
    }
    throw createMonitoringFetchError(classification, err);
  }
}

async function fetchHtml(url, options = {}) {
  const crawlDelayMs = Number(options.crawlDelayMs) || 0;
  return withHostPoliteness(
    url,
    async () => {
      const response = await axiosGetReadOnly(
        url,
        {
          responseType: "text",
          transformResponse: [(data) => data]
        },
        {
          allowWhenAutomationDormant: options.allowWhenAutomationDormant === true,
          siteId: options.siteId != null ? options.siteId : null
        }
      );
      const data = response.data;
      return typeof data === "string" ? data : String(data || "");
    },
    { crawlDelayMs }
  );
}

function extractLatestItems(html, site) {
  const $ = cheerio.load(html);
  const roots = selectLatestRoots($, site);

  if (!roots.length) {
    logger.warn("updates: selector not found (structure changed?)", {
      siteId: site.id,
      siteName: site.name,
      selector: site.selector
    });
    return { invalid: true, reason: "selector_miss" };
  }
  const maxItems = Math.min(10, Math.max(1, parseInt(process.env.UPDATE_MAX_ITEMS_PER_SITE || "5", 10)));
  const items = [];
  roots.slice(0, maxItems).each((_, node) => {
    const root = $(node);
    const title = normalizeText(root.text());
    const href = root.is("a") ? root.attr("href") : root.find("a").first().attr("href");
    const link = absolutizeLink(site.url, href);
    if (!title) return;
    const merged = normalizeText(`${title} ${link}`);
    items.push({
      title,
      link,
      latestContent: merged,
      fingerprint: buildSignature(merged)
    });
  });
  if (!items.length) {
    return { invalid: true, reason: "empty_text" };
  }
  return { items };
}

async function extractSourceItems(site, options = {}) {
  const method = resolveSourceMethod(site);
  const allowWhenAutomationDormant = options.allowWhenAutomationDormant === true;
  if (method === SOURCE_METHODS.SSC_JSON) {
    logger.info("updates: using SSC API handler", { siteId: site.id, name: site.name, method });
    const robots = await evaluateRobotsAccessPolicy(site.url, {
      allowWhenAutomationDormant
    });
    if (!robots.allowed) {
      return {
        method,
        invalid: true,
        reason: "robots_denied",
        policySkip: true,
        robots
      };
    }
    noteHostCrawlDelay(site.url, robots.crawlDelayMs || 0);
    const extracted = await withHostPoliteness(
      site.url,
      async () =>
        extractSscNoticeItems(site, { buildSignature, normalizeText }, { allowWhenAutomationDormant }),
      { crawlDelayMs: robots.crawlDelayMs || 0 }
    );
    return extracted
      ? { method, ...extracted }
      : { method, invalid: true, reason: "selector_miss" };
  }

  const robots = await evaluateRobotsAccessPolicy(site.url, { allowWhenAutomationDormant });
  if (!robots.allowed) {
    logger.warn("updates: skip fetch; robots/policy denied", {
      siteId: site.id,
      url: site.url,
      reason: robots.reason
    });
    return {
      method,
      invalid: true,
      reason: "robots_denied",
      policySkip: true,
      robots
    };
  }
  noteHostCrawlDelay(site.url, robots.crawlDelayMs || 0);

  const html = await fetchHtml(site.url, {
    crawlDelayMs: robots.crawlDelayMs || 0,
    allowWhenAutomationDormant,
    siteId: site && site.id
  });
  logger.info("updates: fetched html", { siteId: site.id, bytes: html.length, method });
  const extracted = extractLatestItems(html, site);
  return extracted ? { method, ...extracted } : { method, invalid: true, reason: "selector_miss" };
}

/**
 * @param {object} site — full row including lastContent
 * @param {{ allowWhenAutomationDormant?: boolean }} [options]
 */
async function checkSite(site, options = {}) {
  logger.info("updates: checking site", {
    siteId: site.id,
    name: site.name,
    hasBaseline: Boolean(String(site.lastContent || "").trim())
  });

  try {
    const policy = buildSourcePolicy(site);
    // URL binding only here — enablement is enforced by scheduler/worker/ACC gates.
    const binding = assertExactUrlBinding(policy, policy.approvedUrl, { requireEnabled: false });
    if (!binding.allowed) {
      await recordBlockedSecurityEvent({
        eventType: binding.code || SECURITY_EVENT_TYPES.POLICY_REJECTION,
        reason: binding.reason,
        action: "SOURCE_URL_BINDING",
        requestedMethod: "GET",
        requestedUrl: policy.approvedUrl,
        siteId: site.id
      }).catch(() => null);
      return {
        changed: false,
        invalid: true,
        reason: binding.code || "policy_rejection",
        policySkip: true,
        blocked: true
      };
    }

    const extracted = await extractSourceItems(site, options);
    if (!extracted) {
      return { changed: false, reason: "selector_miss", invalid: true };
    }
    if (extracted.invalid) {
      return {
        changed: false,
        invalid: true,
        reason: extracted.reason,
        policySkip: Boolean(extracted.policySkip),
        robots: extracted.robots || null
      };
    }

    const items = extracted.items || [];
    const baseline = normalizeStoredBaseline(site.lastContent);
    const minTitleLen = parseInt(process.env.UPDATE_MIN_TITLE_LENGTH || "8", 10);

    if (!baseline.hasBaseline) {
      const top = items[0];
      return {
        changed: false,
        shouldNotify: false,
        establishBaseline: true,
        baselineFingerprint: top.fingerprint,
        reason: "baseline_established",
        items: []
      };
    }

    const topItem = items[0];
    if (itemMatchesBaseline(topItem.fingerprint, baseline)) {
      return {
        changed: false,
        shouldNotify: false,
        reason: "no_change",
        baselineFingerprint: baseline.fingerprint,
        items: []
      };
    }

    const changedItems = items.filter((item) => !itemMatchesBaseline(item.fingerprint, baseline));
    const filteredItems = changedItems.filter((item) => normalizeText(item.title).length >= minTitleLen);
    const shouldNotify = filteredItems.length > 0;

    return {
      changed: true,
      shouldNotify,
      reason: !filteredItems.length ? "title_too_short" : "ok",
      baselineFingerprint: topItem.fingerprint,
      items: filteredItems
    };
  } catch (err) {
    if (err instanceof MonitoringHttpSafetyError) {
      logger.warn("updates: monitoring HTTP safety blocked fetch", {
        siteId: site && site.id,
        code: err.code,
        message: err.message
      });
      return {
        changed: false,
        invalid: true,
        reason: err.code || "policy_blocked",
        policySkip: true,
        blocked: true,
        safetyCode: err.code
      };
    }
    if (err && err.code === "MONITORING_FETCH_ERROR" && err.classification) {
      const classification = err.classification;
      logger.warn("updates: classified fetch failure", {
        siteId: site && site.id,
        kind: classification.kind,
        status: classification.status,
        rateLimited: classification.rateLimited
      });
      return {
        changed: false,
        invalid: true,
        reason: classification.kind,
        httpStatus: classification.status,
        rateLimited: classification.rateLimited === true,
        retryable: classification.retryable === true,
        policySkip: classification.kind === "access_denied"
      };
    }
    throw err;
  }
}

module.exports = {
  checkSite,
  buildSignature,
  normalizeStoredBaseline,
  isStoredFingerprint,
  itemMatchesBaseline,
  SOURCE_METHODS,
  resolveSourceMethod,
  extractLatestItems,
  extractSourceItems,
  fetchHtml,
  axiosGetReadOnly
};
