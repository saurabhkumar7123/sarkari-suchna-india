"use strict";

/**
 * PWP Phase 2 — Duplicate / superseded policy.
 * Reuses Stage 3D duplicateAnalysis marks. Never creates duplicate drafts.
 */

const { DUPLICATE_TYPES } = require("../../contentIntelligence/multiSourceCorrelation/correlationTypes");

function resolvePrimaryDocumentId(correlation, workflowContext = {}) {
  if (workflowContext.primaryDocumentId) return workflowContext.primaryDocumentId;
  if (correlation && correlation.summary && correlation.summary.primaryNotificationDocumentId) {
    return correlation.summary.primaryNotificationDocumentId;
  }
  if (
    correlation &&
    correlation.relationshipGraph &&
    correlation.relationshipGraph.primaryNotificationId
  ) {
    return correlation.relationshipGraph.primaryNotificationId;
  }
  if (correlation && Array.isArray(correlation.documents) && correlation.documents.length) {
    return correlation.documents[0].documentId || correlation.documents[0].id || null;
  }
  return null;
}

function getDuplicateMarks(correlation, documentId) {
  if (!correlation || !documentId) return null;
  const analysis = correlation.duplicateAnalysis || {};
  if (analysis.marks && analysis.marks[documentId]) return analysis.marks[documentId];
  const doc =
    Array.isArray(correlation.documents) &&
    correlation.documents.find((d) => (d.documentId || d.id) === documentId);
  return (doc && doc.duplicateMarks) || null;
}

/**
 * Evaluate Stage 3D duplicate / replacement signals for the primary document.
 */
function evaluateDuplicatePolicy(correlation, workflowContext = {}) {
  if (workflowContext.forceDuplicate === true) {
    return {
      isDuplicate: true,
      isSuperseded: false,
      isReplacement: false,
      duplicateType: DUPLICATE_TYPES.EXACT_DUPLICATE,
      primaryDocumentId: resolvePrimaryDocumentId(correlation, workflowContext),
      supersededDocumentId: null,
      replacementDocumentId: null,
      newestDocumentId: null,
      reason: "workflow_force_duplicate",
      evidence: ["workflowContext.forceDuplicate"]
    };
  }

  if (workflowContext.isDuplicateNotification === true) {
    return {
      isDuplicate: true,
      isSuperseded: false,
      isReplacement: false,
      duplicateType: DUPLICATE_TYPES.EXACT_DUPLICATE,
      primaryDocumentId: resolvePrimaryDocumentId(correlation, workflowContext),
      supersededDocumentId: null,
      replacementDocumentId: null,
      newestDocumentId: null,
      reason: "explicit_duplicate_notification",
      evidence: ["workflowContext.isDuplicateNotification"]
    };
  }

  const primaryDocumentId = resolvePrimaryDocumentId(correlation, workflowContext);
  const marks = getDuplicateMarks(correlation, primaryDocumentId);
  const pairs =
    (correlation && correlation.duplicateAnalysis && correlation.duplicateAnalysis.pairs) || [];

  if (!marks && !pairs.length) {
    return {
      isDuplicate: false,
      isSuperseded: false,
      isReplacement: false,
      duplicateType: null,
      primaryDocumentId,
      supersededDocumentId: null,
      replacementDocumentId: null,
      newestDocumentId: primaryDocumentId,
      reason: "no_duplicate_signals",
      evidence: []
    };
  }

  const exactOf = (marks && marks.exactDuplicateOf) || [];
  const nearOf = (marks && marks.nearDuplicateOf) || [];
  const supersededBy = (marks && marks.supersededBy) || [];
  const replacedBy = (marks && marks.replacedBy) || [];
  const replaces = (marks && marks.replaces) || [];

  if (exactOf.length || nearOf.length) {
    return {
      isDuplicate: true,
      isSuperseded: false,
      isReplacement: false,
      duplicateType: exactOf.length
        ? DUPLICATE_TYPES.EXACT_DUPLICATE
        : DUPLICATE_TYPES.NEAR_DUPLICATE,
      primaryDocumentId,
      supersededDocumentId: null,
      replacementDocumentId: null,
      newestDocumentId: null,
      reason: exactOf.length ? "exact_duplicate_marked" : "near_duplicate_marked",
      evidence: exactOf.length
        ? exactOf.map((id) => `exact_duplicate_of:${id}`)
        : nearOf.map((id) => `near_duplicate_of:${id}`),
      marks
    };
  }

  if (supersededBy.length || replacedBy.length) {
    const newest = supersededBy[0] || replacedBy[0];
    return {
      isDuplicate: false,
      isSuperseded: true,
      isReplacement: false,
      duplicateType: DUPLICATE_TYPES.SUPERSEDED,
      primaryDocumentId,
      supersededDocumentId: primaryDocumentId,
      replacementDocumentId: newest,
      newestDocumentId: newest,
      reason: "document_superseded_by_newer",
      evidence: [`superseded_by:${newest}`],
      marks
    };
  }

  if (replaces.length) {
    return {
      isDuplicate: false,
      isSuperseded: false,
      isReplacement: true,
      duplicateType: DUPLICATE_TYPES.REPLACEMENT,
      primaryDocumentId,
      supersededDocumentId: replaces[0],
      replacementDocumentId: primaryDocumentId,
      newestDocumentId: primaryDocumentId,
      reason: "document_replaces_older",
      evidence: replaces.map((id) => `replaces:${id}`),
      marks
    };
  }

  // Pair-level fallback when marks are incomplete.
  for (const pair of pairs) {
    if (
      pair.duplicateType === DUPLICATE_TYPES.EXACT_DUPLICATE ||
      pair.duplicateType === DUPLICATE_TYPES.NEAR_DUPLICATE
    ) {
      if (
        pair.documentIdA === primaryDocumentId ||
        pair.documentIdB === primaryDocumentId
      ) {
        return {
          isDuplicate: true,
          isSuperseded: false,
          isReplacement: false,
          duplicateType: pair.duplicateType,
          primaryDocumentId,
          supersededDocumentId: null,
          replacementDocumentId: null,
          newestDocumentId: null,
          reason: "duplicate_pair_detected",
          evidence: pair.evidence || [`pair:${pair.duplicateType}`]
        };
      }
    }
    if (pair.duplicateType === DUPLICATE_TYPES.REPLACEMENT) {
      if (pair.supersededDocumentId === primaryDocumentId) {
        return {
          isDuplicate: false,
          isSuperseded: true,
          isReplacement: false,
          duplicateType: DUPLICATE_TYPES.SUPERSEDED,
          primaryDocumentId,
          supersededDocumentId: primaryDocumentId,
          replacementDocumentId: pair.replacementDocumentId,
          newestDocumentId: pair.replacementDocumentId,
          reason: "superseded_in_replacement_pair",
          evidence: pair.evidence || []
        };
      }
      if (pair.replacementDocumentId === primaryDocumentId) {
        return {
          isDuplicate: false,
          isSuperseded: false,
          isReplacement: true,
          duplicateType: DUPLICATE_TYPES.REPLACEMENT,
          primaryDocumentId,
          supersededDocumentId: pair.supersededDocumentId,
          replacementDocumentId: primaryDocumentId,
          newestDocumentId: primaryDocumentId,
          reason: "replacement_newest_in_pair",
          evidence: pair.evidence || []
        };
      }
    }
  }

  return {
    isDuplicate: false,
    isSuperseded: false,
    isReplacement: false,
    duplicateType: null,
    primaryDocumentId,
    supersededDocumentId: null,
    replacementDocumentId: null,
    newestDocumentId: primaryDocumentId,
    reason: "no_actionable_duplicate",
    evidence: [],
    marks
  };
}

module.exports = {
  resolvePrimaryDocumentId,
  getDuplicateMarks,
  evaluateDuplicatePolicy
};
