const axios = require("axios");
const cheerio = require("cheerio");
const crypto = require("crypto");
const logger = require("../../utils/logger");
const {
  isSscApiEnabled,
  isSscApiSite,
  extractSscNoticeItems
} = require("./sscNoticeChecker");

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

function absolutizeLink(siteUrl, href) {
  const raw = String(href || "").trim();
  if (!raw) return "";
  try {
    return new URL(raw, siteUrl).toString();
  } catch {
    return raw;
  }
}

async function fetchHtml(url) {
  const { data } = await axios.get(url, {
    timeout: 25000,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
    }
  });
  return typeof data === "string" ? data : String(data || "");
}

function extractLatestItems(html, site) {
  const $ = cheerio.load(html);
  const roots = $(site.selector);

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

/**
 * @param {object} site — full row including lastContent
 */
async function checkSite(site) {
  logger.info("updates: checking site", {
    siteId: site.id,
    name: site.name,
    hasBaseline: Boolean(String(site.lastContent || "").trim())
  });

  let extracted;
  if (isSscApiEnabled() && isSscApiSite(site)) {
    logger.info("updates: using SSC API handler", { siteId: site.id, name: site.name });
    extracted = await extractSscNoticeItems(site, { buildSignature, normalizeText });
  } else {
    const html = await fetchHtml(site.url);
    logger.info("updates: fetched html", { siteId: site.id, bytes: html.length });
    extracted = extractLatestItems(html, site);
  }
  if (!extracted) {
    return { changed: false, reason: "selector_miss", invalid: true };
  }
  if (extracted.invalid) {
    return { changed: false, invalid: true, reason: extracted.reason };
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
}

module.exports = {
  checkSite,
  buildSignature,
  normalizeStoredBaseline,
  isStoredFingerprint,
  itemMatchesBaseline
};
