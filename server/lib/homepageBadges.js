"use strict";

/** Must stay in sync with admin.validation.js and public/assets/js/generator.js */
const ALLOWED_BADGE_CODES = ["NEW", "OUT", "START", "SOON"];

/** Legacy DB values — render/display as OUT, not stored on new saves. */
const BADGE_CODE_ALIASES = {
  DECLARED: "OUT"
};

/** Breaking news rotator — unified home-badge pills (max 1), same visual language as cards. */
const HOMEPAGE_BREAKING_BADGE_CSS = {
  NEW: "home-badge home-badge--new",
  OUT: "home-badge home-badge--out",
  START: "home-badge home-badge--start",
  SOON: "home-badge home-badge--soon"
};

const HOMEPAGE_BREAKING_BADGE_MAX = 1;

/** Homepage card grid (#dynamicSections) — compact government-style pills. */
const HOMEPAGE_CARD_BADGE_CSS = {
  NEW: "home-badge home-badge--new",
  OUT: "home-badge home-badge--out",
  START: "home-badge home-badge--start",
  SOON: "home-badge home-badge--soon"
};

const HOMEPAGE_BADGE_MAX = 2;

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * @param {unknown} raw
 * @returns {string}
 */
function normalizeBadgeCode(raw) {
  const code = String(raw || "").trim().toUpperCase();
  if (!code) return "";
  return BADGE_CODE_ALIASES[code] || code;
}

/**
 * Whitelist + max count for storage (Generator + Homepage Management).
 * @param {unknown} value
 * @returns {string[]}
 */
function sanitizeBadgeCodesForStorage(value) {
  if (value == null || value === "") return [];
  let arr = value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      arr = Array.isArray(parsed) ? parsed : [];
    } catch {
      arr = [];
    }
  }
  if (!Array.isArray(arr)) return [];
  const normalized = [];
  const seen = new Set();
  for (const raw of arr) {
    const code = normalizeBadgeCode(raw);
    if (!code || !ALLOWED_BADGE_CODES.includes(code)) continue;
    if (seen.has(code)) continue;
    seen.add(code);
    normalized.push(code);
    if (normalized.length >= HOMEPAGE_BADGE_MAX) break;
  }
  return normalized;
}

/**
 * @param {unknown} badges
 * @param {Record<string, string>} cssMap
 * @returns {string}
 */
function renderBadgesHtmlWithMap(badges, cssMap, max = HOMEPAGE_BADGE_MAX) {
  if (!Array.isArray(badges) || badges.length === 0) return "";
  const seen = new Set();
  const html = [];
  for (const raw of badges) {
    if (html.length >= max) break;
    const code = normalizeBadgeCode(raw);
    if (!code || seen.has(code)) continue;
    const cssClass = cssMap[code];
    if (!cssClass) continue;
    seen.add(code);
    html.push(`<span class="${cssClass}">${escapeHtml(code)}</span>`);
  }
  return html.join(" ");
}

/**
 * Breaking news rotator — single home-badge, no en-dash separator.
 * @param {unknown} badges
 * @returns {string}
 */
function renderHomepageBadgesHtml(badges) {
  return renderBadgesHtmlWithMap(badges, HOMEPAGE_BREAKING_BADGE_CSS, HOMEPAGE_BREAKING_BADGE_MAX);
}

/**
 * Homepage card rows — professional pills + en-dash separator.
 * @param {unknown} badges
 * @returns {string}
 */
function renderHomeCardBadgesHtml(badges) {
  const badgeHtml = renderBadgesHtmlWithMap(badges, HOMEPAGE_CARD_BADGE_CSS);
  if (!badgeHtml) return "";
  return `<span class="home-card-badge-group"><span class="home-card-badge-sep" aria-hidden="true">–</span>${badgeHtml}</span>`;
}

/**
 * @param {Record<string, unknown> | null | undefined} item
 * @returns {string}
 */
function resolveHomepageBadgeHtmlFromItem(item) {
  if (!item || typeof item !== "object") return "";
  return renderHomepageBadgesHtml(item.badges);
}

/**
 * @param {Record<string, unknown> | null | undefined} item
 * @returns {string}
 */
function resolveHomeCardBadgeHtmlFromItem(item) {
  if (!item || typeof item !== "object") return "";
  return renderHomeCardBadgesHtml(item.badges);
}

module.exports = {
  ALLOWED_BADGE_CODES,
  BADGE_CODE_ALIASES,
  HOMEPAGE_BREAKING_BADGE_CSS,
  HOMEPAGE_BREAKING_BADGE_MAX,
  HOMEPAGE_CARD_BADGE_CSS,
  HOMEPAGE_BADGE_MAX,
  normalizeBadgeCode,
  sanitizeBadgeCodesForStorage,
  renderHomepageBadgesHtml,
  renderHomeCardBadgesHtml,
  resolveHomepageBadgeHtmlFromItem,
  resolveHomeCardBadgeHtmlFromItem
};
