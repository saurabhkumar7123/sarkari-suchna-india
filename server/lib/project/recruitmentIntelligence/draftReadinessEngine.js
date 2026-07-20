'use strict';

/**
 * AMP-1 — Draft Readiness Engine
 *
 * Evaluates whether recruitment is ready for draft generation.
 */

const { deepFreeze } = require('./utils');
const { MISSING_INFO_CODES } = require('./missingInformationEngine');

const DRAFT_READINESS_VERSION = 'AMP1.1.0.0';

const REQUIRED_FOR_DRAFT = Object.freeze([
  MISSING_INFO_CODES.MISSING_RECRUITMENT_NAME,
  MISSING_INFO_CODES.MISSING_ADVERTISEMENT_NUMBER,
  MISSING_INFO_CODES.MISSING_ELIGIBILITY,
  MISSING_INFO_CODES.MISSING_SELECTION,
  MISSING_INFO_CODES.MISSING_VACANCY,
]);

function evaluateDraftReadiness(input = {}) {
  const recruitment = input.recruitment || {};
  const missingResult = input.missingResult || {};
  const validation = input.validation || {};
  const confidence = input.confidence || {};
  const updateDecision = input.updateDecision || {};

  const reasons = [];
  const missing = missingResult.missingInformation || [];

  for (let i = 0; i < REQUIRED_FOR_DRAFT.length; i += 1) {
    const code = REQUIRED_FOR_DRAFT[i];
    const found = missing.find((m) => m.code === code);
    if (found) {
      reasons.push(`Missing required field: ${found.field} (${found.code})`);
    }
  }

  if (!validation.valid) {
    reasons.push(`Validation failed with ${validation.errorCount || 0} error(s)`);
  }

  if ((confidence.score || 0) < 50) {
    reasons.push(`Confidence score too low: ${confidence.score || 0}/100`);
  }

  if (updateDecision.decision === 'MANUAL_REVIEW_REQUIRED') {
    reasons.push('Manual review required before draft generation');
  }

  if (updateDecision.decision === 'IGNORE_DUPLICATE') {
    reasons.push('Duplicate notification — no draft action needed');
  }

  const ready = reasons.length === 0;

  return deepFreeze({
    version: DRAFT_READINESS_VERSION,
    ready,
    reasons,
    recommendedAction: ready ? 'PROCEED_TO_DRAFT_PREPARATION' : 'RESOLVE_GAPS_FIRST',
    blockingReasonCount: reasons.length,
  });
}

module.exports = {
  DRAFT_READINESS_VERSION,
  REQUIRED_FOR_DRAFT,
  evaluateDraftReadiness,
};
