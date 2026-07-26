'use strict';

/**
 * GOVERNMENT MONITORING BOT — Package TG-1
 * Notification Policy (Configuration-Driven)
 */

const { deepFreeze } = require('../governmentSourceRegistry');
const { TEMPLATE_KINDS } = require('./notificationTemplates');

const NOTIFICATION_POLICY_VERSION = 'TG1.1.0.0';

const DEFAULT_POLICY = deepFreeze({
  successNotification: true,
  duplicateNotification: true,
  extractionWarning: true,
  validationWarning: true,
  automaticSendingDenied: true,
  requireExplicitDelivery: true,
  productionCredentialsDenied: true,
});

/**
 * Create a notification policy configuration.
 * @param {object} [input]
 */
function createNotificationPolicy(input = {}) {
  const src = input && typeof input === 'object' ? input : {};
  return deepFreeze({
    policyVersion: NOTIFICATION_POLICY_VERSION,
    successNotification:
      typeof src.successNotification === 'boolean'
        ? src.successNotification
        : DEFAULT_POLICY.successNotification,
    duplicateNotification:
      typeof src.duplicateNotification === 'boolean'
        ? src.duplicateNotification
        : DEFAULT_POLICY.duplicateNotification,
    extractionWarning:
      typeof src.extractionWarning === 'boolean'
        ? src.extractionWarning
        : DEFAULT_POLICY.extractionWarning,
    validationWarning:
      typeof src.validationWarning === 'boolean'
        ? src.validationWarning
        : DEFAULT_POLICY.validationWarning,
    automaticSendingDenied: true,
    requireExplicitDelivery: true,
    productionCredentialsDenied: true,
  });
}

/**
 * Resolve which notification kind (if any) should be emitted.
 * @param {object} [context]
 * @param {object} [policyInput]
 */
function resolveNotificationDecision(context = {}, policyInput = {}) {
  const policy = createNotificationPolicy(policyInput);
  const ctx = context && typeof context === 'object' ? context : {};

  const duplicateStatus = String(
    ctx.duplicateStatus ||
      (ctx.duplicate && ctx.duplicate.duplicateStatus) ||
      ''
  ).toUpperCase();
  const isDuplicate =
    ctx.isDuplicate === true ||
    duplicateStatus === 'DUPLICATE' ||
    duplicateStatus === 'LIKELY_DUPLICATE';

  const extractionWarnings = Array.isArray(ctx.extractionWarnings)
    ? ctx.extractionWarnings
    : [];
  const validationIssues = Array.isArray(ctx.validationIssues)
    ? ctx.validationIssues
    : [];
  const hasExtractionWarning =
    ctx.extractionWarning === true || extractionWarnings.length > 0;
  const hasValidationWarning =
    ctx.validationWarning === true || validationIssues.length > 0;

  let kind = null;
  let enabled = false;
  let reason = 'NO_NOTIFICATION';

  if (isDuplicate && policy.duplicateNotification) {
    kind = TEMPLATE_KINDS.DUPLICATE;
    enabled = true;
    reason = 'DUPLICATE_POLICY_ENABLED';
  } else if (hasExtractionWarning && policy.extractionWarning) {
    kind = TEMPLATE_KINDS.EXTRACTION_WARNING;
    enabled = true;
    reason = 'EXTRACTION_WARNING_POLICY_ENABLED';
  } else if (hasValidationWarning && policy.validationWarning) {
    kind = TEMPLATE_KINDS.VALIDATION_WARNING;
    enabled = true;
    reason = 'VALIDATION_WARNING_POLICY_ENABLED';
  } else if (policy.successNotification && ctx.success !== false) {
    kind = TEMPLATE_KINDS.SUCCESS;
    enabled = true;
    reason = 'SUCCESS_POLICY_ENABLED';
  } else if (isDuplicate && !policy.duplicateNotification) {
    reason = 'DUPLICATE_POLICY_DISABLED';
  } else if (hasExtractionWarning && !policy.extractionWarning) {
    reason = 'EXTRACTION_WARNING_POLICY_DISABLED';
  } else if (hasValidationWarning && !policy.validationWarning) {
    reason = 'VALIDATION_WARNING_POLICY_DISABLED';
  } else if (!policy.successNotification) {
    reason = 'SUCCESS_POLICY_DISABLED';
  }

  return deepFreeze({
    policyVersion: NOTIFICATION_POLICY_VERSION,
    policy,
    enabled,
    kind,
    reason,
    automaticSendingDenied: true,
  });
}

module.exports = {
  NOTIFICATION_POLICY_VERSION,
  DEFAULT_POLICY,
  createNotificationPolicy,
  resolveNotificationDecision,
};
