"use strict";

const axios = require("axios");
const cheerio = require("cheerio");
const crypto = require("crypto");
const logger = require("../../utils/logger");
const { extractHostname } = require("../../lib/contentIntelligence/sourceIntelligence/officialDomains");
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

const SOURCE_METHODS = Object.freeze({
  HTML_SELECTOR: "HTML_SELECTOR",
  SSC_JSON: "SSC_JSON"
});

const FETCH_TIMEOUT_MS = 25000;
const FETCH_HEADERS = Object.freeze({
  "User-Agent": MONITORING_BOT_UA,
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

function isUpscOfficialSite(site) {
  const host = extractHostname(site && site.url);
  return host === "upsc.gov.in" || Boolean(host && host.endsWith(".upsc.gov.in"));
}

function parseHrefContainsSelector(selector) {
  const raw = String(selector || "").trim();
  const match = raw.match(/^a\[href\*=["']([^"']+)["']\]$/i);
  return match ? match[1] : null;
}

function selectLatestRoots($, site) {
  const roots = $(site.selector);
  if (roots.length) return roots;
  if (!isUpscOfficialSite(site)) return roots;

  const needle = parseHrefContainsSelector(site.selector);
  if (!needle) return roots;

  const lower = needle.toLowerCase();
  const matched = $("a[href]").filter((_, el) =>
    String($(el).attr("href") || "")
      .toLowerCase()
      .includes(lower)
  );
  if (matched.length) {
    logger.info("updates: UPSC href selector matched case-insensitively", {
      siteId: site && site.id,
      selector: site && site.selector,
      matched: matched.length
    });
  }
  return matched;
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

async function axiosGetReadOnly(url, axiosConfig = {}) {
  try {
    const response = await axios.get(url, {
      timeout: FETCH_TIMEOUT_MS,
      maxRedirects: 5,
      headers: { ...FETCH_HEADERS, ...(axiosConfig.headers || {}) },
      ...axiosConfig,
      method: "GET"
    });
    return response;
  } catch (err) {
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
      const response = await axiosGetReadOnly(url, {
        responseType: "text",
        transformResponse: [(data) => data],
        validateStatus: (status) => status >= 200 && status < 300
      });
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

async function extractSourceItems(site) {
  const method = resolveSourceMethod(site);
  if (method === SOURCE_METHODS.SSC_JSON) {
    logger.info("updates: using SSC API handler", { siteId: site.id, name: site.name, method });
    const robots = await evaluateRobotsAccessPolicy(site.url);
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
      async () => extractSscNoticeItems(site, { buildSignature, normalizeText }),
      { crawlDelayMs: robots.crawlDelayMs || 0 }
    );
    return extracted
      ? { method, ...extracted }
      : { method, invalid: true, reason: "selector_miss" };
  }

  const robots = await evaluateRobotsAccessPolicy(site.url);
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

  const html = await fetchHtml(site.url, { crawlDelayMs: robots.crawlDelayMs || 0 });
  logger.info("updates: fetched html", { siteId: site.id, bytes: html.length, method });
  const extracted = extractLatestItems(html, site);
  return extracted ? { method, ...extracted } : { method, invalid: true, reason: "selector_miss" };
}

/**
 * @param {object} site — full row including lastContent
 */
async function checkSite(site) {
  logger.info("updates: checking site", {
    siteId: site.id,
    name: site.name,
    hasBaseline: Boolean(String(site.lastContent || "").trim())
  });

  try {
    const extracted = await extractSourceItems(site);
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
  isUpscOfficialSite,
  fetchHtml,
  axiosGetReadOnly
};
