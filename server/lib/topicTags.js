"use strict";

const { isBoardSlug } = require("./boardHubs");
const { buildDepartmentPath } = require("./taxonomySlugs");

function createSlug(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function stripInvisible(value) {
  return String(value || "").replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
}

/**
 * @param {unknown} category
 * @returns {string[]}
 */
function parseCategoryTags(category) {
  const raw = stripInvisible(category);
  if (!raw) return [];
  return [
    ...new Set(
      raw
        .split(/[,;|]+/)
        .map((part) => stripInvisible(part))
        .filter((part) => part.length >= 2)
    )
  ];
}

/**
 * @param {unknown} raw
 * @returns {string}
 */
function normalizeTopicSlug(raw) {
  return createSlug(raw);
}

/**
 * Human-readable label from URL slug (ssc-cgl → Ssc Cgl — title-cased words).
 * @param {unknown} slug
 */
function formatTopicLabel(slug) {
  return String(slug || "")
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Resolve href for on-page tag link: board hubs use /department/, topics use /topic/.
 * @param {unknown} categoryText
 * @param {unknown} tagSlug
 */
function resolveTagLinkHref(categoryText, tagSlug) {
  const tags = parseCategoryTags(categoryText);
  const slug = normalizeTopicSlug(tagSlug || categoryText);
  if (!slug) return "/search";

  if (tags.length > 1) {
    return `/topic/${encodeURIComponent(slug)}`;
  }

  const primarySlug = createSlug(tags[0] || stripInvisible(categoryText));
  if (primarySlug && isBoardSlug(primarySlug)) {
    return buildDepartmentPath(primarySlug);
  }

  return `/topic/${encodeURIComponent(slug)}`;
}

/**
 * SQL LIKE tokens for topic slug (ssc-cgl → ssc + cgl).
 * @param {unknown} topicSlug
 * @returns {string[]}
 */
function topicSearchTokens(topicSlug) {
  const slug = normalizeTopicSlug(topicSlug);
  if (!slug) return [];
  const parts = slug.split("-").filter((part) => part.length >= 2);
  return parts.length ? parts : [slug];
}

module.exports = {
  createSlug,
  parseCategoryTags,
  normalizeTopicSlug,
  formatTopicLabel,
  resolveTagLinkHref,
  topicSearchTokens
};
