'use strict';

/**
 * AMP-1 — Validation Engine
 *
 * Validates URLs, PDFs, timeline, dates, links, and recruitment consistency.
 */

const { deepFreeze, pickString, normalizeUrl } = require('./utils');

const VALIDATION_CODES = Object.freeze({
  INVALID_OFFICIAL_URL: 'INVALID_OFFICIAL_URL',
  INVALID_NOTIFICATION_URL: 'INVALID_NOTIFICATION_URL',
  INVALID_PDF_URL: 'INVALID_PDF_URL',
  INVALID_DATE_FORMAT: 'INVALID_DATE_FORMAT',
  INVALID_LINK: 'INVALID_LINK',
  TIMELINE_INCONSISTENT: 'TIMELINE_INCONSISTENT',
  STAGE_ORDER_VIOLATION: 'STAGE_ORDER_VIOLATION',
  CONFLICTING_DATES: 'CONFLICTING_DATES',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
});

function isValidUrl(value) {
  const raw = pickString(value);
  if (!raw) return false;
  try {
    const url = new URL(raw);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function isValidDate(value) {
  const raw = pickString(value);
  if (!raw) return false;
  const parsed = Date.parse(raw);
  return !Number.isNaN(parsed);
}

function validateRecruitment(recruitment = {}) {
  const issues = [];

  if (recruitment.officialWebsite && !isValidUrl(recruitment.officialWebsite)) {
    issues.push({ code: VALIDATION_CODES.INVALID_OFFICIAL_URL, field: 'officialWebsite', severity: 'error' });
  }
  if (recruitment.officialNotification && !isValidUrl(recruitment.officialNotification)) {
    issues.push({ code: VALIDATION_CODES.INVALID_NOTIFICATION_URL, field: 'officialNotification', severity: 'error' });
  }

  const links = Array.isArray(recruitment.importantLinks) ? recruitment.importantLinks : [];
  for (let i = 0; i < links.length; i += 1) {
    const link = links[i];
    if (link && link.url && !isValidUrl(link.url)) {
      issues.push({ code: VALIDATION_CODES.INVALID_LINK, field: `importantLinks[${i}]`, severity: 'error' });
    }
    if (link && link.url && /\.pdf/i.test(link.url) && !isValidUrl(link.url)) {
      issues.push({ code: VALIDATION_CODES.INVALID_PDF_URL, field: `importantLinks[${i}]`, severity: 'error' });
    }
  }

  const dates = Array.isArray(recruitment.importantDates) ? recruitment.importantDates : [];
  for (let i = 0; i < dates.length; i += 1) {
    const entry = dates[i];
    if (entry && entry.date && !isValidDate(entry.date)) {
      issues.push({ code: VALIDATION_CODES.INVALID_DATE_FORMAT, field: `importantDates[${i}]`, severity: 'warning' });
    }
  }

  const timeline = Array.isArray(recruitment.timeline) ? recruitment.timeline : [];
  let lastOrder = -1;
  for (let i = 0; i < timeline.length; i += 1) {
    const entry = timeline[i];
    if (entry && typeof entry.order === 'number' && entry.order < lastOrder) {
      issues.push({ code: VALIDATION_CODES.STAGE_ORDER_VIOLATION, field: 'timeline', severity: 'warning' });
      break;
    }
    if (entry && typeof entry.order === 'number') lastOrder = entry.order;
  }

  if (timeline.length > 1) {
    const urls = timeline.map((t) => normalizeUrl(t.url)).filter(Boolean);
    const uniqueUrls = new Set(urls);
    if (urls.length !== uniqueUrls.size) {
      issues.push({ code: VALIDATION_CODES.TIMELINE_INCONSISTENT, field: 'timeline', severity: 'warning' });
    }
  }

  const errorCount = issues.filter((i) => i.severity === 'error').length;

  return deepFreeze({
    valid: errorCount === 0,
    issues,
    issueCount: issues.length,
    errorCount,
    warningCount: issues.length - errorCount,
  });
}

module.exports = {
  VALIDATION_CODES,
  isValidUrl,
  isValidDate,
  validateRecruitment,
};
