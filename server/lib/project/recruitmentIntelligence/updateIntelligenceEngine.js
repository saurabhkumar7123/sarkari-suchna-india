'use strict';

/**
 * AMP-1 — Update Intelligence Engine
 *
 * Decides: Create New / Update Existing / Merge / Ignore Duplicate / Manual Review.
 */

const { deepFreeze } = require('./utils');
const { MATCH_DECISION } = require('./recruitmentMatchingEngine');

const UPDATE_DECISION = Object.freeze({
  CREATE_NEW_RECRUITMENT: 'CREATE_NEW_RECRUITMENT',
  UPDATE_EXISTING_RECRUITMENT: 'UPDATE_EXISTING_RECRUITMENT',
  MERGE_INFORMATION: 'MERGE_INFORMATION',
  IGNORE_DUPLICATE: 'IGNORE_DUPLICATE',
  MANUAL_REVIEW_REQUIRED: 'MANUAL_REVIEW_REQUIRED',
});

function decideUpdateAction(input = {}) {
  const matchResult = input.matchResult || {};
  const duplicateResult = input.duplicateResult || {};
  const notification = input.notification || {};

  if (duplicateResult.isDuplicate === true) {
    return deepFreeze({
      decision: UPDATE_DECISION.IGNORE_DUPLICATE,
      reason: duplicateResult.reason || 'DUPLICATE_NOTIFICATION',
      confidence: duplicateResult.confidence || 90,
      explanation: 'Notification identified as duplicate of existing update.',
    });
  }

  if (matchResult.decision === MATCH_DECISION.MATCH_EXISTING) {
    const isSupplemental = notification.supplemental === true;
    return deepFreeze({
      decision: isSupplemental
        ? UPDATE_DECISION.MERGE_INFORMATION
        : UPDATE_DECISION.UPDATE_EXISTING_RECRUITMENT,
      reason: 'CONFIDENT_MATCH',
      confidence: matchResult.confidence || 80,
      recruitmentId: matchResult.recruitmentId,
      explanation: isSupplemental
        ? 'Matched existing recruitment; merge supplemental information.'
        : 'Matched existing recruitment; apply stage update.',
    });
  }

  if (matchResult.decision === MATCH_DECISION.MANUAL_REVIEW) {
    return deepFreeze({
      decision: UPDATE_DECISION.MANUAL_REVIEW_REQUIRED,
      reason: matchResult.reason || 'AMBIGUOUS_MATCH',
      confidence: matchResult.confidence || 40,
      recruitmentId: matchResult.recruitmentId || null,
      explanation: 'Match confidence insufficient or conflicting signals detected.',
    });
  }

  return deepFreeze({
    decision: UPDATE_DECISION.CREATE_NEW_RECRUITMENT,
    reason: 'NO_MATCH',
    confidence: 70,
    recruitmentId: null,
    explanation: 'No existing recruitment match; create new recruitment object.',
  });
}

module.exports = {
  UPDATE_DECISION,
  decideUpdateAction,
};
