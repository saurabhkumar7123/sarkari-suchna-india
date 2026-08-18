"use strict";

/**
 * Link detection + classification for Generator Important Links.
 */

const { LINK_CATEGORIES, LINK_CATEGORY_TO_LABEL } = require("./types");

/**
 * @param {string} text
 * @returns {string[]}
 */
function extractUrls(text) {
  const s = String(text || "");
  const found = [];
  const re = /https?:\/\/[^\s)\]>"']+/gi;
  let m;
  while ((m = re.exec(s)) !== null) {
    found.push(m[0].replace(/[.,;:]+$/, ""));
  }
  const www = s.match(/\bwww\.[^\s)\]>"']+/gi) || [];
  for (const w of www) {
    found.push(`https://${w.replace(/[.,;:]+$/, "")}`);
  }
  const seen = new Set();
  const out = [];
  for (const u of found) {
    const k = u.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(u);
  }
  return out;
}

/**
 * @param {string} label
 * @param {string} url
 * @returns {string}
 */
function classifyLink(label, url) {
  const blob = `${String(label || "")} ${String(url || "")}`.toLowerCase();

  if (/\b(admit[\s_-]*card|hall[\s_-]*ticket|call[\s_-]*letter|एडमिट)\b/.test(blob)) {
    return LINK_CATEGORIES.ADMIT_CARD;
  }
  if (/\b(answer[\s_-]*key|final[\s_-]*key|keys?\b|उत्तर[\s_-]*कुंजी)\b/.test(blob)) {
    return LINK_CATEGORIES.ANSWER_KEY;
  }
  if (/\b(result|merit[\s_-]*list|select[\s_-]*list|परिणाम)\b/.test(blob)) {
    return LINK_CATEGORIES.RESULT;
  }
  if (/\b(syllabus|पाठ्यक्रम)\b/.test(blob)) return LINK_CATEGORIES.SYLLABUS;
  if (/\b(correct(ion)?|edit\s*form|form\s*correction|ओम[रR]?)\b/.test(blob)) {
    return LINK_CATEGORIES.CORRECTION;
  }
  if (/\b(regist(er|ration)|sign[\s_-]*up|new\s*registration|पंजीकरण)\b/.test(blob)) {
    return LINK_CATEGORIES.REGISTRATION;
  }
  if (/\b(login|sign[\s_-]*in|candidate\s*login|लॉग[\s_-]*इन)\b/.test(blob)) {
    return LINK_CATEGORIES.LOGIN;
  }
  if (
    /\b(apply\s*online|online\s*apply|online\s*application|आवेदन)\b/.test(blob) ||
    /\/apply\b|applicationform|onlineapplication/i.test(blob)
  ) {
    return LINK_CATEGORIES.APPLY_ONLINE;
  }
  if (
    /\b(notification|advertisement|advt|detailed\s*advt|विज्ञापन)\b/.test(blob) ||
    /\.pdf(\?|$)/i.test(String(url || ""))
  ) {
    if (/\.pdf(\?|$)/i.test(String(url || "")) || /\b(notification|advertisement|advt)\b/.test(blob)) {
      return LINK_CATEGORIES.NOTIFICATION_PDF;
    }
  }
  if (/\b(official\s*website|official\s*site|home\s*page|website|आधिकारिक)\b/.test(blob)) {
    return LINK_CATEGORIES.OFFICIAL_WEBSITE;
  }
  if (/nic\.in|gov\.in|ssc\.nic|upsc\.gov|nta\.ac|rrb|railway/i.test(blob) && !/\.pdf(\?|$)/i.test(url)) {
    return LINK_CATEGORIES.OFFICIAL_WEBSITE;
  }
  return LINK_CATEGORIES.OTHER;
}

/**
 * @param {string} category
 * @returns {string}
 */
function labelForCategory(category) {
  return LINK_CATEGORY_TO_LABEL[category] || LINK_CATEGORY_TO_LABEL[LINK_CATEGORIES.OTHER];
}

/**
 * Parse a raw link line into { label, url, category }.
 * Supports "Label=https://…", "Label : https://…", or bare URL.
 * @param {string} line
 * @returns {{ label: string, url: string, category: string } | null}
 */
function parseLinkLine(line) {
  const t = String(line || "")
    .replace(/^[-*•]\s*/, "")
    .trim();
  if (!t) return null;

  const eqIdx = t.indexOf("=");
  if (eqIdx > 0) {
    const left = t.slice(0, eqIdx).trim();
    const right = t.slice(eqIdx + 1).trim().split(/\s/)[0];
    if (left && /^(https?:\/\/|www\.|\/)/i.test(right)) {
      const url = right.startsWith("www.") ? `https://${right}` : right;
      const category = classifyLink(left, url);
      return { label: sanitizeLinkLabel(left, category), url, category };
    }
  }

  const urls = extractUrls(t);
  if (!urls.length) {
    const root = t.match(/\/[A-Za-z0-9_\-./?=&#%]+/);
    if (!root) return null;
    const url = root[0];
    const label = t.replace(url, "").replace(/[=:\-–|]+/g, " ").trim() || labelForCategory(LINK_CATEGORIES.OTHER);
    const category = classifyLink(label, url);
    return { label: sanitizeLinkLabel(label, category), url, category };
  }

  const url = urls[0];
  let label = t.replace(url, "").replace(/https?:\/\/\S+/gi, "").replace(/www\.\S+/gi, "");
  label = label.replace(/[=:\-–|]+/g, " ").replace(/\s+/g, " ").trim();
  const category = classifyLink(label, url);
  return {
    label: sanitizeLinkLabel(label, category),
    url,
    category
  };
}

/**
 * Drop punctuation-only or sentence-wrap leftovers such as "()".
 * @param {string} label
 * @param {string} category
 */
function sanitizeLinkLabel(label, category) {
  const fallback = labelForCategory(category);
  const t = String(label || "")
    .replace(/[()[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!t || !/[A-Za-z\u0900-\u097F]{3,}/.test(t) || t.length > 48) return fallback;
  if (
    category &&
    category !== "other" &&
    !new RegExp(`^${fallback.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i").test(t) &&
    /\b(from|while|designated|website of|login module|visit|choosing)\b/i.test(t)
  ) {
    return fallback;
  }
  return t;
}

/**
 * Dedupe by URL; prefer more specific category over OTHER.
 * @param {Array<{ label: string, url: string, category: string }>} links
 */
function dedupeLinks(links) {
  const rank = {
    [LINK_CATEGORIES.APPLY_ONLINE]: 10,
    [LINK_CATEGORIES.NOTIFICATION_PDF]: 9,
    [LINK_CATEGORIES.ADMIT_CARD]: 8,
    [LINK_CATEGORIES.RESULT]: 8,
    [LINK_CATEGORIES.ANSWER_KEY]: 7,
    [LINK_CATEGORIES.CORRECTION]: 7,
    [LINK_CATEGORIES.REGISTRATION]: 6,
    [LINK_CATEGORIES.LOGIN]: 6,
    [LINK_CATEGORIES.SYLLABUS]: 5,
    [LINK_CATEGORIES.OFFICIAL_WEBSITE]: 4,
    [LINK_CATEGORIES.OTHER]: 1
  };
  const map = new Map();
  for (const link of links) {
    if (!link || !link.url) continue;
    const key = String(link.url).toLowerCase();
    const prev = map.get(key);
    if (!prev || (rank[link.category] || 0) > (rank[prev.category] || 0)) {
      map.set(key, link);
    }
  }
  return Array.from(map.values());
}

/**
 * @param {string[]} lines
 * @returns {Array<{ label: string, url: string, category: string }>}
 */
function detectAndClassifyLinks(lines) {
  const out = [];
  for (const line of lines || []) {
    const parsed = parseLinkLine(line);
    if (parsed) out.push(parsed);
  }
  return dedupeLinks(out);
}

/**
 * Format for Generator Important Links section: Label=url
 * @param {Array<{ label: string, url: string, category: string }>} links
 * @returns {string}
 */
function formatLinksForPublisher(links) {
  if (!links || !links.length) return "";
  return links
    .map((l) => {
      const label = l.label || labelForCategory(l.category);
      return `${label}=${l.url}`;
    })
    .join("\n");
}

module.exports = {
  extractUrls,
  classifyLink,
  labelForCategory,
  parseLinkLine,
  dedupeLinks,
  detectAndClassifyLinks,
  formatLinksForPublisher,
  sanitizeLinkLabel
};
