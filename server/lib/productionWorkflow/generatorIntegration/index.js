"use strict";

/**
 * PWP Phase 3 — Generator Integration Layer.
 *
 * Converts Phase 2 Resolution output into a structured Generator Draft Package.
 * Prepares data only. Does not render HTML, call AI, publish, or mutate pages.
 *
 * Shared API: prepareGeneratorDraft()
 * Returns: Draft Package + Validation Report + Generator Contract
 */

const { deepFreeze } = require("../../contentIntelligence/multiSourceCorrelation/correlationUtils");
const { RESOLUTION_DECISIONS } = require("../recruitmentResolution/resolutionTypes");
const {
  ENGINE_ID,
  ENGINE_VERSION,
  PHASE,
  DRAFT_TYPES,
  SECTION_ACTIONS,
  EDITORIAL_NOTE_CODES,
  GENERATOR_PACKAGE_DECISIONS,
  NO_PACKAGE_DECISIONS,
  REVIEW_ONLY_DECISIONS,
  DRAFT_PACKAGE_FORMAT_ID,
  GENERATOR_CONTRACT_FORMAT_ID
} = require("./integrationTypes");
const { validateGeneratorDraftInput, resolveDecision } = require("./validation");
const { buildDraftPackage, decisionToDraftType, createDraftId } = require("./draftPackage");
const { buildUpdatePackage } = require("./updatePackage");
const { buildEditorialNotes } = require("./editorialNotes");
const { buildGeneratorContract } = require("./generatorContract");

function normalizeInput(input = {}) {
  const resolution =
    input.resolution ||
    (input.resolutionDecision && typeof input.resolutionDecision === "object"
      ? input.resolutionDecision
      : null);

  const decision =
    resolveDecision(input.resolutionDecision) ||
    resolveDecision(resolution) ||
    resolveDecision(input.decision);

  const workflowContext =
    input.workflowContext && typeof input.workflowContext === "object"
      ? input.workflowContext
      : {};

  const updatePlan =
    input.updatePlan ||
    (resolution && resolution.updatePlan) ||
    null;

  const canonicalRecruitmentPackage =
    input.canonicalRecruitmentPackage ||
    input.canonicalPackage ||
    null;

  const existingPageMetadata =
    input.existingPageMetadata ||
    input.existingPage ||
    (workflowContext.existingPageMetadata) ||
    (workflowContext.existingPage) ||
    null;

  const existingRecruitment =
    input.existingRecruitment ||
    workflowContext.existingRecruitment ||
    null;

  const workflowId =
    input.workflowId ||
    workflowContext.workflowId ||
    (workflowContext.monitoringEvent && workflowContext.monitoringEvent.workflowId) ||
    null;

  const recruitmentId =
    input.recruitmentId ||
    (resolution && resolution.match && resolution.match.recruitmentId) ||
    (existingRecruitment &&
      (existingRecruitment.recruitmentId || existingRecruitment.id)) ||
    null;

  return {
    workflowContext,
    resolution,
    decision,
    resolutionDecision: input.resolutionDecision || resolution || decision,
    canonicalRecruitmentPackage,
    updatePlan,
    existingPageMetadata,
    existingPage: input.existingPage || workflowContext.existingPage || existingPageMetadata,
    existingRecruitment,
    workflowId,
    recruitmentId
  };
}

/**
 * Prepare a Generator Draft Package from Phase 2 outputs.
 *
 * Accepts only:
 * - Workflow Context
 * - Resolution Decision
 * - Canonical Recruitment Package
 * - Update Plan (if applicable)
 * - Existing Page Metadata (if available)
 *
 * @param {object} input
 * @returns {{
 *   engineId: string,
 *   engineVersion: string,
 *   phase: string,
 *   draftPackage: object|null,
 *   validationReport: object,
 *   generatorContract: object,
 *   skipped: boolean,
 *   skipReason: string|null,
 *   effects: object
 * }}
 */
function prepareGeneratorDraft(input = {}) {
  const normalized = normalizeInput(input);
  const decision = normalized.decision;

  const validationReport = validateGeneratorDraftInput({
    workflowContext: normalized.workflowContext,
    resolutionDecision: normalized.resolutionDecision,
    resolution: normalized.resolution,
    canonicalRecruitmentPackage: normalized.canonicalRecruitmentPackage,
    updatePlan: normalized.updatePlan,
    workflowId: normalized.workflowId,
    recruitmentId: normalized.recruitmentId
  });

  // Validation failure → do not call Generator; no draft package.
  if (!validationReport.valid) {
    const generatorContract = buildGeneratorContract({
      draftPackage: null,
      validationReport,
      callGenerator: false
    });

    return deepFreeze({
      engineId: ENGINE_ID,
      engineVersion: ENGINE_VERSION,
      phase: PHASE,
      draftPackage: null,
      validationReport,
      generatorContract,
      skipped: true,
      skipReason: "VALIDATION_FAILED",
      draftType: decisionToDraftType(decision),
      decision: decision || null,
      effects: Object.freeze({
        preparesPackage: false,
        rendersHtml: false,
        publishes: false,
        usesAi: false,
        callsGenerator: false
      })
    });
  }

  // IGNORE_DUPLICATE / SUPERSEDED_DOCUMENT → no Generator package.
  if (NO_PACKAGE_DECISIONS.includes(decision)) {
    const generatorContract = buildGeneratorContract({
      draftPackage: null,
      validationReport,
      callGenerator: false
    });

    return deepFreeze({
      engineId: ENGINE_ID,
      engineVersion: ENGINE_VERSION,
      phase: PHASE,
      draftPackage: null,
      validationReport,
      generatorContract,
      skipped: true,
      skipReason: decision,
      draftType: DRAFT_TYPES.NONE,
      decision,
      editorialNotes: Object.freeze(
        buildEditorialNotes({
          decision,
          updatePlan: normalized.updatePlan,
          workflowContext: normalized.workflowContext,
          existingRecruitment: normalized.existingRecruitment
        })
      ),
      effects: Object.freeze({
        preparesPackage: false,
        rendersHtml: false,
        publishes: false,
        usesAi: false,
        callsGenerator: false
      })
    });
  }

  const draftPackage = buildDraftPackage({
    decision,
    workflowContext: normalized.workflowContext,
    resolution: normalized.resolution,
    canonicalRecruitmentPackage: normalized.canonicalRecruitmentPackage,
    updatePlan: normalized.updatePlan,
    existingPageMetadata: normalized.existingPageMetadata,
    existingPage: normalized.existingPage,
    existingRecruitment: normalized.existingRecruitment,
    workflowId: normalized.workflowId,
    recruitmentId: normalized.recruitmentId,
    validationSummary: validationReport.summary,
    warnings: validationReport.warnings.slice()
  });

  const isReviewOnly = decision === RESOLUTION_DECISIONS.MANUAL_REVIEW_REQUIRED;
  const callGenerator =
    !isReviewOnly && GENERATOR_PACKAGE_DECISIONS.includes(decision);

  const generatorContract = buildGeneratorContract({
    draftPackage,
    validationReport,
    callGenerator
  });

  return deepFreeze({
    engineId: ENGINE_ID,
    engineVersion: ENGINE_VERSION,
    phase: PHASE,
    draftPackage,
    validationReport,
    generatorContract,
    skipped: false,
    skipReason: null,
    draftType: draftPackage ? draftPackage.draftType : DRAFT_TYPES.NONE,
    decision,
    effects: Object.freeze({
      preparesPackage: true,
      rendersHtml: false,
      publishes: false,
      usesAi: false,
      callsGenerator: false, // contract prepared; engine not invoked
      reviewOnly: isReviewOnly
    })
  });
}

module.exports = {
  ENGINE_ID,
  ENGINE_VERSION,
  PHASE,
  DRAFT_TYPES,
  SECTION_ACTIONS,
  EDITORIAL_NOTE_CODES,
  GENERATOR_PACKAGE_DECISIONS,
  NO_PACKAGE_DECISIONS,
  REVIEW_ONLY_DECISIONS,
  DRAFT_PACKAGE_FORMAT_ID,
  GENERATOR_CONTRACT_FORMAT_ID,
  prepareGeneratorDraft,
  validateGeneratorDraftInput: require("./validation").validateGeneratorDraftInput,
  buildDraftPackage,
  buildUpdatePackage,
  buildEditorialNotes,
  buildGeneratorContract,
  decisionToDraftType,
  createDraftId,
  normalizeInput
};
