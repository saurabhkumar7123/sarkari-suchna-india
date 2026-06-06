"use strict";

/** Must stay in sync with public/assets/js/index.js HOMEPAGE_BADGE_CSS */
const HOMEPAGE_BADGE_CSS = {
  NEW: "tag new",
  OUT: "tag out",
  DECLARED: "tag declared"
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
 * @param {unknown} badges
 * @returns {string}
 */
function renderHomepageBadgesHtml(badges) {
  if (!Array.isArray(badges) || badges.length === 0) return "";
  const seen = new Set();
  const html = [];
  for (const raw of badges) {
    if (html.length >= HOMEPAGE_BADGE_MAX) break;
    const code = String(raw || "").trim().toUpperCase();
    if (!code || seen.has(code)) continue;
    const cssClass = HOMEPAGE_BADGE_CSS[code];
    if (!cssClass) continue;
    seen.add(code);
    html.push(`<span class="${cssClass}">${escapeHtml(code)}</span>`);
  }
  return html.join(" ");
}

/**
 * @param {Record<string, unknown> | null | undefined} item
 * @returns {string}
 */
function resolveHomepageBadgeHtmlFromItem(item) {
  if (!item || typeof item !== "object") return "";
  return renderHomepageBadgesHtml(item.badges);
}

module.exports = {
  HOMEPAGE_BADGE_CSS,
  HOMEPAGE_BADGE_MAX,
  renderHomepageBadgesHtml,
  resolveHomepageBadgeHtmlFromItem
};
