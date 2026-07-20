"use strict";

/**
 * Package 4F — Content freshness indicators (display only).
 *
 * Exposes created / updated / last review dates and a freshness status.
 * No automatic updates.
 */

const FRESHNESS_STATUSES = Object.freeze({
  FRESH: "fresh",
  AGING: "aging",
  STALE: "stale",
  UNKNOWN: "unknown"
});

const FRESHNESS_LABELS = Object.freeze({
  [FRESHNESS_STATUSES.FRESH]: "Fresh",
  [FRESHNESS_STATUSES.AGING]: "Aging",
  [FRESHNESS_STATUSES.STALE]: "Stale",
  [FRESHNESS_STATUSES.UNKNOWN]: "Unknown"
});

const DEFAULT_FRESH_DAYS = 30;
const DEFAULT_AGING_DAYS = 90;

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toIsoDate(value) {
  const d = toDate(value);
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

function daysBetween(from, to = new Date()) {
  const a = toDate(from);
  const b = toDate(to);
  if (!a || !b) return null;
  const ms = b.getTime() - a.getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

/**
 * @param {object} input
 * @param {string|Date} [input.createdAt]
 * @param {string|Date} [input.updatedAt]
 * @param {string|Date} [input.contentUpdatedAt]
 * @param {string|Date} [input.lastReviewDate]
 * @param {Date} [input.now]
 * @param {number} [input.freshDays]
 * @param {number} [input.agingDays]
 */
function buildContentFreshnessIndicator(input = {}) {
  const now = toDate(input.now) || new Date();
  const createdAt = toDate(input.createdAt || input.created_at);
  const updatedAt = toDate(input.updatedAt || input.updated_at);
  const contentUpdatedAt = toDate(input.contentUpdatedAt || input.content_updated_at);
  const lastReviewDate = toDate(input.lastReviewDate || input.last_review_date);

  const reference = lastReviewDate || contentUpdatedAt || updatedAt || createdAt;
  const ageDays = daysBetween(reference, now);
  const freshDays = Number.isFinite(Number(input.freshDays))
    ? Number(input.freshDays)
    : DEFAULT_FRESH_DAYS;
  const agingDays = Number.isFinite(Number(input.agingDays))
    ? Number(input.agingDays)
    : DEFAULT_AGING_DAYS;

  let status = FRESHNESS_STATUSES.UNKNOWN;
  if (ageDays != null) {
    if (ageDays <= freshDays) status = FRESHNESS_STATUSES.FRESH;
    else if (ageDays <= agingDays) status = FRESHNESS_STATUSES.AGING;
    else status = FRESHNESS_STATUSES.STALE;
  }

  return {
    advisory: true,
    autoUpdate: false,
    createdDate: toIsoDate(createdAt),
    updatedDate: toIsoDate(updatedAt || contentUpdatedAt),
    contentUpdatedDate: toIsoDate(contentUpdatedAt),
    lastReviewDate: toIsoDate(lastReviewDate),
    referenceDate: toIsoDate(reference),
    ageDays,
    freshnessStatus: status,
    freshnessLabel: FRESHNESS_LABELS[status],
    thresholds: {
      freshDays,
      agingDays
    },
    note: "Display only — freshness is not updated automatically."
  };
}

module.exports = {
  FRESHNESS_STATUSES,
  FRESHNESS_LABELS,
  DEFAULT_FRESH_DAYS,
  DEFAULT_AGING_DAYS,
  buildContentFreshnessIndicator,
  toIsoDate,
  daysBetween
};
