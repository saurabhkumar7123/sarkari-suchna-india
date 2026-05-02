const axios = require("axios");
const cheerio = require("cheerio");
const crypto = require("crypto");
const logger = require("../../utils/logger");

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

async function checkSite(site) {
  logger.warn("updates: checking site", { siteId: site.id, name: site.name, url: site.url });
  const html = await fetchHtml(site.url);
  logger.warn("updates: fetched html", { siteId: site.id, bytes: html.length });
  const extracted = extractLatestItems(html, site);

  if (!extracted) {
    return { changed: false, reason: "selector_miss" };
  }
  if (extracted.invalid) {
    return { changed: false, invalid: true, reason: extracted.reason };
  }
  const previousSig = buildSignature(site.lastContent || "");
  const items = extracted.items || [];
  const changedItems = items.filter((item) => item.fingerprint !== previousSig);
  const changed = changedItems.length > 0;

  // Basic filtering to avoid spam notifications from empty/noisy selector output.
  const minTitleLen = parseInt(process.env.UPDATE_MIN_TITLE_LENGTH || "8", 10);
  const filteredItems = changedItems.filter((item) => normalizeText(item.title).length >= minTitleLen);
  const shouldNotify = changed && filteredItems.length > 0;

  return {
    changed,
    shouldNotify,
    reason: !changed ? "no_change" : !filteredItems.length ? "title_too_short" : "ok",
    previousContent: normalizeText(site.lastContent),
    items: filteredItems
  };
}

module.exports = {
  checkSite
};
