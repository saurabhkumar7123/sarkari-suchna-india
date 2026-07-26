'use strict';

/**
 * GOVERNMENT MONITORING BOT — Package TG-1
 * Telegram Notification Templates (Advisory / Formatting Only)
 */

const { deepFreeze } = require('../governmentSourceRegistry');

const NOTIFICATION_TEMPLATES_VERSION = 'TG1.1.0.0';

const TEMPLATE_KINDS = Object.freeze({
  SUCCESS: 'SUCCESS',
  DUPLICATE: 'DUPLICATE',
  EXTRACTION_WARNING: 'EXTRACTION_WARNING',
  VALIDATION_WARNING: 'VALIDATION_WARNING',
});

function safeText(value, fallback = 'N/A') {
  if (value == null) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function formatConfidence(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value <= 1) return `${Math.round(value * 100)}%`;
    return String(value);
  }
  return safeText(value);
}

/**
 * Build a structured notification template payload.
 * @param {object} [input]
 */
function buildNotificationTemplatePayload(input = {}) {
  const src = input && typeof input === 'object' ? input : {};
  const kind =
    typeof src.kind === 'string' && TEMPLATE_KINDS[src.kind]
      ? src.kind
      : TEMPLATE_KINDS.SUCCESS;

  return deepFreeze({
    templatesVersion: NOTIFICATION_TEMPLATES_VERSION,
    kind,
    recruitmentTitle: safeText(src.recruitmentTitle || src.title, 'Untitled'),
    department: safeText(src.department, 'Unknown Department'),
    source: safeText(src.source || src.sourceId, 'UNKNOWN'),
    confidence: formatConfidence(src.confidence),
    confidenceRaw:
      typeof src.confidence === 'number' && Number.isFinite(src.confidence)
        ? src.confidence
        : null,
    detectionTime: safeText(src.detectionTime, new Date().toISOString()),
    reviewIdentifier: safeText(
      src.reviewIdentifier || src.candidateId || src.reviewId,
      'UNASSIGNED'
    ),
    summary: safeText(src.summary, 'Advisory recruitment candidate ready for review.'),
    officialUrl: safeText(src.officialUrl || src.sourceUrl, 'N/A'),
  });
}

/**
 * Format a Telegram-style plain text message from template fields.
 * @param {object} [input]
 */
function formatTelegramMessage(input = {}) {
  const payload = buildNotificationTemplatePayload(input);
  const kindLabel = {
    SUCCESS: 'Advisory Candidate',
    DUPLICATE: 'Duplicate Advisory',
    EXTRACTION_WARNING: 'Extraction Warning',
    VALIDATION_WARNING: 'Validation Warning',
  }[payload.kind];

  const lines = [
    `🔔 ${kindLabel}`,
    `Title: ${payload.recruitmentTitle}`,
    `Department: ${payload.department}`,
    `Source: ${payload.source}`,
    `Confidence: ${payload.confidence}`,
    `Detection Time: ${payload.detectionTime}`,
    `Review ID: ${payload.reviewIdentifier}`,
    `Summary: ${payload.summary}`,
    `Official URL: ${payload.officialUrl}`,
    '',
    'Manual operator review required. No automatic publishing.',
  ];

  return deepFreeze({
    templatesVersion: NOTIFICATION_TEMPLATES_VERSION,
    kind: payload.kind,
    text: lines.join('\n'),
    payload,
    formatting: 'PLAIN_TEXT',
  });
}

module.exports = {
  NOTIFICATION_TEMPLATES_VERSION,
  TEMPLATE_KINDS,
  buildNotificationTemplatePayload,
  formatTelegramMessage,
};
