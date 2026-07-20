'use strict';

/**
 * AMP-1 — Duplicate Detection Engine
 *
 * Detects duplicate notifications, PDFs, pages, recruitments, and updates.
 */

const { deepFreeze, normalizeUrl, normalizeText, pickString, stableHash } = require('./utils');

const DUPLICATE_TYPES = Object.freeze({
  NOTIFICATION: 'NOTIFICATION',
  PDF: 'PDF',
  PAGE: 'PAGE',
  RECRUITMENT: 'RECRUITMENT',
  UPDATE: 'UPDATE',
});

function fingerprintNotification(notification) {
  const parts = [
    normalizeText(notification.title),
    normalizeUrl(notification.url),
    normalizeUrl(notification.pdfUrl),
    pickString(notification.advertisementNumber).toUpperCase(),
  ].filter(Boolean);
  return stableHash(parts.join('|'));
}

function detectDuplicates(input = {}) {
  const notification = input.notification || {};
  const existingNotifications = Array.isArray(input.existingNotifications)
    ? input.existingNotifications
    : [];
  const existingRecruitments = Array.isArray(input.existingRecruitments)
    ? input.existingRecruitments
    : [];
  const existingPages = Array.isArray(input.existingPages) ? input.existingPages : [];

  const fingerprint = fingerprintNotification(notification);
  const duplicates = [];

  for (let i = 0; i < existingNotifications.length; i += 1) {
    const existing = existingNotifications[i];
    if (fingerprintNotification(existing) === fingerprint) {
      duplicates.push({
        type: DUPLICATE_TYPES.NOTIFICATION,
        id: existing.id || existing.notificationId,
        reason: 'IDENTICAL_FINGERPRINT',
      });
    }
    if (
      normalizeUrl(notification.url) &&
      normalizeUrl(notification.url) === normalizeUrl(existing.url)
    ) {
      duplicates.push({
        type: DUPLICATE_TYPES.NOTIFICATION,
        id: existing.id || existing.notificationId,
        reason: 'SAME_URL',
      });
    }
    if (
      normalizeUrl(notification.pdfUrl) &&
      normalizeUrl(notification.pdfUrl) === normalizeUrl(existing.pdfUrl)
    ) {
      duplicates.push({ type: DUPLICATE_TYPES.PDF, id: existing.id, reason: 'SAME_PDF' });
    }
  }

  for (let i = 0; i < existingPages.length; i += 1) {
    const page = existingPages[i];
    if (
      normalizeUrl(notification.url) &&
      normalizeUrl(notification.url) === normalizeUrl(page.pageUrl)
    ) {
      duplicates.push({ type: DUPLICATE_TYPES.PAGE, id: page.id || page.pageId, reason: 'SAME_PAGE_URL' });
    }
  }

  const notifAdv = pickString(notification.advertisementNumber).toUpperCase();
  for (let i = 0; i < existingRecruitments.length; i += 1) {
    const recruitment = existingRecruitments[i];
    if (
      notifAdv &&
      notifAdv === pickString(recruitment.advertisementNumber).toUpperCase() &&
      normalizeText(notification.title) === normalizeText(recruitment.recruitmentName)
    ) {
      duplicates.push({
        type: DUPLICATE_TYPES.RECRUITMENT,
        id: recruitment.recruitmentId || recruitment.id,
        reason: 'SAME_ADV_AND_TITLE',
      });
    }
  }

  const isDuplicate = duplicates.length > 0;
  const uniqueTypes = [...new Set(duplicates.map((d) => d.type))];

  return deepFreeze({
    isDuplicate,
    fingerprint,
    duplicates,
    duplicateTypes: uniqueTypes,
    confidence: isDuplicate ? 95 : 0,
    reason: isDuplicate ? duplicates[0].reason : null,
  });
}

module.exports = {
  DUPLICATE_TYPES,
  fingerprintNotification,
  detectDuplicates,
};
