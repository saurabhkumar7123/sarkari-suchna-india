"use strict";

/**
 * Phase AI-4 — Link validation (notification, apply, official site, etc.).
 * Flags broken / placeholder / duplicate links. Does not fetch URLs.
 */

const { LINK_CATEGORIES, LINK_CATEGORY_TO_LABEL, VALIDATION_CODES, SEVERITY } = require("./types");
const { assessLinkHealth, toKey } = require("./draftUtils");

const TRACKED_CATEGORIES = Object.freeze([
  LINK_CATEGORIES.NOTIFICATION_PDF,
  LINK_CATEGORIES.APPLY_ONLINE,
  LINK_CATEGORIES.OFFICIAL_WEBSITE,
  LINK_CATEGORIES.REGISTRATION,
  LINK_CATEGORIES.LOGIN,
  LINK_CATEGORIES.CORRECTION,
  LINK_CATEGORIES.ADMIT_CARD,
  LINK_CATEGORIES.RESULT,
  LINK_CATEGORIES.ANSWER_KEY,
  LINK_CATEGORIES.SYLLABUS
]);

/**
 * @param {object} draft
 * @returns {{
 *   links: object[],
 *   byCategory: object,
 *   issues: object[],
 *   duplicates: object[],
 *   broken: object[],
 *   coverage: object,
 *   explanation: string
 * }}
 */
function validateLinks(draft) {
  const links = (draft.links || []).map((link) => {
    const health = link.broken != null ? { broken: link.broken, reason: link.reason } : assessLinkHealth(link.url);
    return {
      label: link.label,
      url: link.url,
      category: link.category,
      categoryLabel: LINK_CATEGORY_TO_LABEL[link.category] || link.category,
      sectionTitle: link.sectionTitle || null,
      broken: Boolean(health.broken),
      reason: health.reason || null,
      duplicate: Boolean(link.duplicate),
      tracked: TRACKED_CATEGORIES.includes(link.category)
    };
  });

  const byCategory = {};
  for (const cat of TRACKED_CATEGORIES) byCategory[cat] = [];
  for (const link of links) {
    if (!byCategory[link.category]) byCategory[link.category] = [];
    byCategory[link.category].push(link);
  }

  const issues = [];
  const duplicates = [];
  const broken = [];
  const seen = new Map();

  for (const link of links) {
    const key = toKey(link.url);
    if (seen.has(key)) {
      duplicates.push(link);
      issues.push({
        code: VALIDATION_CODES.DUPLICATE_LINK,
        severity: SEVERITY.MEDIUM,
        message: `Duplicate link: ${link.url}`,
        url: link.url,
        label: link.label,
        firstSeenLabel: seen.get(key),
        advisoryOnly: true
      });
    } else {
      seen.set(key, link.label);
    }

    if (link.broken) {
      broken.push(link);
      issues.push({
        code: VALIDATION_CODES.BROKEN_OR_PLACEHOLDER_LINK,
        severity: SEVERITY.HIGH,
        message: `Broken or placeholder link (${link.reason}): ${link.url || "(empty)"}`,
        url: link.url,
        label: link.label,
        reason: link.reason,
        advisoryOnly: true
      });
    }
  }

  const expected = draft.expectedLinks || [];
  const presentCategories = new Set(links.filter((l) => !l.broken).map((l) => l.category));
  const coverage = {
    expected,
    present: expected.filter((c) => presentCategories.has(c)),
    missing: expected.filter((c) => !presentCategories.has(c)),
    percentage: expected.length
      ? Math.round((expected.filter((c) => presentCategories.has(c)).length / expected.length) * 100)
      : 100
  };

  return {
    links,
    byCategory,
    issues,
    duplicates,
    broken,
    coverage,
    explanation:
      issues.length === 0
        ? `Validated ${links.length} link(s); no broken or duplicate links.`
        : `Validated ${links.length} link(s): ${broken.length} broken/placeholder, ${duplicates.length} duplicate.`
  };
}

module.exports = {
  TRACKED_CATEGORIES,
  validateLinks
};
