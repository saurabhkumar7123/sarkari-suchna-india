'use strict';

/**
 * Package AMP-1 — Product-side Recruitment Intelligence Brain facade.
 *
 * Thin composition layer over AMP-1 governance framework.
 * Reuses Draft Preparation, Controlled Lifecycle Engine,
 * Monitoring Review Integration, and Generator identities.
 *
 * No production automation. No publishing. No runtime activation.
 * RECRUITMENT_PIPELINE_ENABLED must remain FALSE.
 */

const path = require('path');

const frameworkPath = path.resolve(
  __dirname,
  '../../project/program5/packageAMP1RecruitmentIntelligenceBrainFramework.js'
);

const framework = require(frameworkPath);

const { buildPreviewSnapshot, SHARED_PREVIEW_SCHEMA_VERSION } = require('../sharedPreviewModel');

/**
 * Process notification through Recruitment Intelligence Brain with optional preview alignment.
 * Advisory only — never persists, publishes, or activates pipeline.
 *
 * @param {object} [input]
 */
function processProductRecruitmentIntelligence(input = {}) {
  let sharedPreviewSnapshot = input.sharedPreviewSnapshot || null;
  if (!sharedPreviewSnapshot && input.sharedPreviewInput) {
    sharedPreviewSnapshot = buildPreviewSnapshot(input.sharedPreviewInput);
  }

  const result = framework.processRecruitmentIntelligence({
    ...input,
    generatedAt: input.generatedAt || new Date(0).toISOString(),
  });

  const editorialAlignment = {
    reusedModule: 'RECRUITMENT_INTELLIGENCE_BRAIN',
    previewAttached: Boolean(sharedPreviewSnapshot),
    previewSchemaVersion: SHARED_PREVIEW_SCHEMA_VERSION,
    draftReadinessAligned: Boolean(result.draftReadiness),
    lifecycleAligned: Boolean(result.stageClassification),
  };

  return framework.deepFreeze({
    ...result,
    editorialAlignment,
    productReuse: {
      recruitmentOperations: true,
      draftPreparation: true,
      controlledLifecycleEngine: true,
      monitoringReviewIntegration: true,
      sharedPreview: true,
      generator: true,
    },
    effects: {
      ...result.effects,
      productionDraftCreated: false,
      pipelineEnabled: false,
      recruitmentPipelineActivated: false,
    },
  });
}

module.exports = {
  PACKAGE_ID: framework.PACKAGE_ID,
  PACKAGE_CODE: framework.PACKAGE_CODE,
  FRAMEWORK_VERSION: framework.FRAMEWORK_VERSION,
  RECRUITMENT_OBJECT_SCHEMA_VERSION: framework.RECRUITMENT_OBJECT_SCHEMA_VERSION,
  REVIEW_FLAG_CODES: framework.REVIEW_FLAG_CODES,
  RECRUITMENT_STATUS: framework.RECRUITMENT_STATUS,
  MATCH_DECISION: framework.MATCH_DECISION,
  UPDATE_DECISION: framework.UPDATE_DECISION,
  PAGE_DECISION: framework.PAGE_DECISION,
  CANONICAL_SECTIONS: framework.CANONICAL_SECTIONS,
  processProductRecruitmentIntelligence,
  processRecruitmentIntelligence: framework.processRecruitmentIntelligence,
  createEmptyRecruitmentObject: framework.createEmptyRecruitmentObject,
  deriveRecruitmentId: framework.deriveRecruitmentId,
  classifyStageFromNotification: framework.classifyStageFromNotification,
  detectStageContext: framework.detectStageContext,
  listAllStages: framework.listAllStages,
  matchRecruitment: framework.matchRecruitment,
  recoverRecruitmentHistory: framework.recoverRecruitmentHistory,
  buildTimeline: framework.buildTimeline,
  decideUpdateAction: framework.decideUpdateAction,
  detectDuplicates: framework.detectDuplicates,
  computeConfidence: framework.computeConfidence,
  detectMissingInformation: framework.detectMissingInformation,
  validateRecruitment: framework.validateRecruitment,
  evaluateDraftReadiness: framework.evaluateDraftReadiness,
  decidePageAction: framework.decidePageAction,
  mapToRendererSections: framework.mapToRendererSections,
  buildGeneratorPayload: framework.buildGeneratorPayload,
  buildGeneratorDataField: framework.buildGeneratorDataField,
  getRecruitmentIntelligenceBrainFramework: framework.getRecruitmentIntelligenceBrainFramework,
  getRecruitmentIntelligenceBrainFrameworkIdentity:
    framework.getRecruitmentIntelligenceBrainFrameworkIdentity,
};
