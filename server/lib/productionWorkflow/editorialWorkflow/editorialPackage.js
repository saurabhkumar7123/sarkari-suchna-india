"use strict";

/**
 * PWP Phase 4 — Immutable Editorial Package model.
 * Review operations only — no HTML, no AI, no publishing.
 */

const crypto = require("crypto");
const { deepFreeze } = require("../../contentIntelligence/multiSourceCorrelation/correlationUtils");
const {
  ENGINE_ID,
  ENGINE_VERSION,
  PHASE,
  EDITORIAL_PACKAGE_FORMAT_ID,
  EDITORIAL_CONTRACT_FORMAT_ID,
  REVIEW_STATES,
  REVIEW_ACTIONS
} = require("./editorialTypes");
const { buildDiffModel } = require("./diffModel");
const { createHistoryEntry } = require("./reviewHistory");

/**
 * Deterministic review id from stable inputs (no random).
 */
function createReviewId({ workflowId, draftId, recruitmentId }) {
  const material = [
    workflowId || "",
    draftId || "",
    recruitmentId == null ? "" : String(recruitmentId)
  ].join("|");
  const hash = crypto.createHash("sha256").update(material).digest("hex").slice(0, 16);
  return `pwp_review_${hash}`;
}

function normalizeEditorialNotes(editorialNotes, draftPackage) {
  if (Array.isArray(editorialNotes)) {
    return editorialNotes.slice();
  }
  if (typeof editorialNotes === "string" && editorialNotes.trim()) {
    return [editorialNotes.trim()];
  }
  if (draftPackage && Array.isArray(draftPackage.editorialNotes)) {
    return draftPackage.editorialNotes.slice();
  }
  return [];
}

/**
 * Build an immutable Editorial Package for the review queue.
 */
function buildEditorialPackage({
  workflowContext = {},
  draftPackage,
  generatorContract = null,
  validationSummary = null,
  editorialNotes = null,
  existingPageMetadata = null,
  workflowId = null,
  reviewState = REVIEW_STATES.QUEUED,
  reviewHistory = null,
  warnings = []
} = {}) {
  const resolvedWorkflowId =
    workflowId ||
    (draftPackage && draftPackage.workflowId) ||
    (workflowContext && workflowContext.workflowId) ||
    (workflowContext &&
      workflowContext.monitoringEvent &&
      workflowContext.monitoringEvent.workflowId) ||
    null;

  const draftId = draftPackage && draftPackage.draftId ? draftPackage.draftId : null;
  const recruitmentId =
    (draftPackage && draftPackage.recruitmentId) ||
    (existingPageMetadata && existingPageMetadata.recruitmentId) ||
    null;

  const reviewId = createReviewId({
    workflowId: resolvedWorkflowId,
    draftId,
    recruitmentId
  });

  const diff = buildDiffModel({ draftPackage, existingPageMetadata });
  const notes = normalizeEditorialNotes(editorialNotes, draftPackage);
  const resolvedValidationSummary =
    validationSummary ||
    (draftPackage && draftPackage.validationSummary) ||
    null;

  const initialHistory =
    Array.isArray(reviewHistory) && reviewHistory.length > 0
      ? reviewHistory.map((e) => createHistoryEntry(e))
      : [
          createHistoryEntry({
            timestamp: "deterministic",
            previousState: null,
            newState: REVIEW_STATES.QUEUED,
            action: "QUEUE_CREATED",
            reason: "Entered editorial review queue",
            reviewerId: null
          })
        ];

  const packageWarnings = Array.isArray(warnings) ? warnings.slice() : [];
  if (draftPackage && Array.isArray(draftPackage.warnings)) {
    for (const w of draftPackage.warnings) {
      packageWarnings.push(w);
    }
  }

  const editorialPackage = {
    formatId: EDITORIAL_PACKAGE_FORMAT_ID,
    engineId: ENGINE_ID,
    engineVersion: ENGINE_VERSION,
    phase: PHASE,
    reviewId,
    workflowId: resolvedWorkflowId,
    draftId,
    recruitmentId,
    decision: draftPackage ? draftPackage.decision : null,
    draftType: draftPackage ? draftPackage.draftType : null,
    reviewState,
    reviewActions: Object.freeze(Object.values(REVIEW_ACTIONS)),
    changeSummary: diff.changeSummary,
    affectedSections: diff.affectedSections,
    unaffectedSections: diff.unaffectedSections,
    addedSections: diff.addedSections,
    removedSections: diff.removedSections,
    modifiedSections: diff.modifiedSections,
    diff,
    editorialNotes: Object.freeze(notes),
    validationSummary: resolvedValidationSummary
      ? Object.freeze({ ...resolvedValidationSummary })
      : null,
    warnings: Object.freeze(
      packageWarnings.map((w) =>
        typeof w === "object" && w ? Object.freeze({ ...w }) : Object.freeze({ message: String(w) })
      )
    ),
    reviewHistory: Object.freeze(initialHistory.slice()),
    /**
     * Reference snapshot of accepted inputs (no upstream system access).
     * Editorial layer consumes this package only.
     */
    references: Object.freeze({
      draftId,
      draftType: draftPackage ? draftPackage.draftType : null,
      generatorContractFormatId:
        generatorContract && generatorContract.formatId
          ? generatorContract.formatId
          : null,
      generatorCallGenerator: generatorContract
        ? Boolean(generatorContract.callGenerator)
        : false,
      pageReference: draftPackage ? draftPackage.pageReference || null : null,
      existingPageId:
        (existingPageMetadata &&
          (existingPageMetadata.pageId || existingPageMetadata.id)) ||
        null
    }),
    effects: Object.freeze({
      entersReviewQueue: true,
      rendersHtml: false,
      publishes: false,
      usesAi: false,
      modifiesPages: false,
      modifiesDatabase: false,
      automaticApproval: false
    }),
    createdAt: "deterministic",
    immutable: true
  };

  return deepFreeze(editorialPackage);
}

/**
 * Clone package with updated state + history (immutable).
 */
function withReviewTransition(editorialPackage, { newState, historyEntry, reviewHistory }) {
  const next = {
    ...editorialPackage,
    reviewState: newState,
    reviewHistory: Object.freeze(
      (reviewHistory || editorialPackage.reviewHistory || []).slice()
    ),
    lastAction: historyEntry
      ? Object.freeze({
          action: historyEntry.action,
          previousState: historyEntry.previousState,
          newState: historyEntry.newState,
          reason: historyEntry.reason,
          reviewerId: historyEntry.reviewerId,
          timestamp: historyEntry.timestamp
        })
      : editorialPackage.lastAction || null
  };
  return deepFreeze(next);
}

/**
 * Editorial Contract — single object the editorial layer may consume.
 * Must not access Monitoring / Programs 1–3 / Resolution / Generator internals.
 */
function buildEditorialContract({
  editorialPackage = null,
  validationReport = null
} = {}) {
  const allowed = Boolean(editorialPackage) && Boolean(validationReport && validationReport.valid);

  return deepFreeze({
    formatId: EDITORIAL_CONTRACT_FORMAT_ID,
    engineId: ENGINE_ID,
    engineVersion: ENGINE_VERSION,
    phase: PHASE,
    acceptPackage: allowed,
    reviewId: editorialPackage ? editorialPackage.reviewId : null,
    workflowId: editorialPackage ? editorialPackage.workflowId : null,
    draftId: editorialPackage ? editorialPackage.draftId : null,
    reviewState: editorialPackage ? editorialPackage.reviewState : null,
    package: allowed ? editorialPackage : null,
    boundaries: Object.freeze({
      mayAccessMonitoring: false,
      mayAccessProgram1: false,
      mayAccessProgram2: false,
      mayAccessProgram3: false,
      mayAccessResolutionEngine: false,
      mayAccessGeneratorInternals: false,
      mayConsumeEditorialPackageOnly: true,
      mayPublish: false,
      mayRenderHtml: false,
      mayUseAi: false,
      mayAutoApprove: false
    }),
    validation: validationReport
      ? Object.freeze({
          valid: validationReport.valid,
          errorCount: validationReport.summary ? validationReport.summary.errorCount : 0,
          warningCount: validationReport.summary ? validationReport.summary.warningCount : 0
        })
      : null,
    effects: Object.freeze({
      preparesEditorialPackage: true,
      entersReviewQueue: allowed,
      rendersHtml: false,
      publishes: false
    })
  });
}

module.exports = {
  createReviewId,
  buildEditorialPackage,
  withReviewTransition,
  buildEditorialContract,
  normalizeEditorialNotes
};
