'use strict';

/**
 * AMP-1 — Page Decision Engine
 *
 * Decides: Create New Page / Update Existing / Merge / No Action / Manual Review.
 */

const { deepFreeze } = require('./utils');
const { UPDATE_DECISION } = require('./updateIntelligenceEngine');

const PAGE_DECISION = Object.freeze({
  CREATE_NEW_PAGE: 'CREATE_NEW_PAGE',
  UPDATE_EXISTING_PAGE: 'UPDATE_EXISTING_PAGE',
  MERGE_EXISTING_PAGE: 'MERGE_EXISTING_PAGE',
  NO_ACTION: 'NO_ACTION',
  MANUAL_REVIEW: 'MANUAL_REVIEW',
});

function decidePageAction(input = {}) {
  const updateDecision = input.updateDecision || {};
  const draftReadiness = input.draftReadiness || {};
  const existingPage = input.existingPage || null;
  const duplicateResult = input.duplicateResult || {};

  if (duplicateResult.isDuplicate) {
    return deepFreeze({
      decision: PAGE_DECISION.NO_ACTION,
      reason: 'DUPLICATE_NOTIFICATION',
      explanation: 'Duplicate detected; no page change required.',
    });
  }

  if (updateDecision.decision === UPDATE_DECISION.MANUAL_REVIEW_REQUIRED) {
    return deepFreeze({
      decision: PAGE_DECISION.MANUAL_REVIEW,
      reason: 'MANUAL_REVIEW_REQUIRED',
      explanation: 'Ambiguous recruitment match requires human review before page action.',
    });
  }

  if (!draftReadiness.ready) {
    return deepFreeze({
      decision: PAGE_DECISION.NO_ACTION,
      reason: 'NOT_DRAFT_READY',
      explanation: 'Recruitment not ready for page generation.',
      blockingReasons: draftReadiness.reasons || [],
    });
  }

  if (updateDecision.decision === UPDATE_DECISION.CREATE_NEW_RECRUITMENT) {
    return deepFreeze({
      decision: PAGE_DECISION.CREATE_NEW_PAGE,
      reason: 'NEW_RECRUITMENT',
      explanation: 'New recruitment ready for page creation.',
    });
  }

  if (existingPage) {
    const isMerge = updateDecision.decision === UPDATE_DECISION.MERGE_INFORMATION;
    return deepFreeze({
      decision: isMerge ? PAGE_DECISION.MERGE_EXISTING_PAGE : PAGE_DECISION.UPDATE_EXISTING_PAGE,
      reason: isMerge ? 'MERGE_INFORMATION' : 'STAGE_UPDATE',
      pageId: existingPage.id || existingPage.pageId,
      explanation: isMerge
        ? 'Merge supplemental information into existing page.'
        : 'Update existing page with new stage information.',
    });
  }

  return deepFreeze({
    decision: PAGE_DECISION.CREATE_NEW_PAGE,
    reason: 'NO_EXISTING_PAGE',
    explanation: 'Recruitment matched but no page exists; create new page.',
  });
}

module.exports = {
  PAGE_DECISION,
  decidePageAction,
};
