"use strict";

/**
 * CIP Stage 2E — Editorial Decision Support Engine.
 *
 * Analyzes a Stage 2D Generator-ready document and produces explainable
 * editorial decision support for human reviewers.
 *
 * Boundaries:
 *   - No AI / network / SDK
 *   - Never publishes, modifies content, or auto-approves
 *   - Manual approval remains mandatory
 *   - Shared by manual PDF and automation workflows
 */

const { deepClone } = require("../aiDraftGeneration/responseNormalizer");
const { GENERATOR_READY_FORMAT_ID } = require("../canonicalDraftTransformation/transformationTypes");
const { analyzeEditorialDocument } = require("./editorialAnalyzer");
const { buildChangeSummary } = require("./changeSummary");
const { determineReviewPriority } = require("./reviewPrioritizer");
const { generateReviewChecklist } = require("./checklistGenerator");
const { buildDecisionSupport } = require("./decisionSupport");
const { buildTelegramSummary } = require("./telegramSummary");
const {
  ENGINE_ID,
  STAGE_ID,
  ENGINE_VERSION,
  DECISION_VERSION,
  DECISION_SUPPORT_FORMAT_ID
} = require("./decisionTypes");

function deepFreeze(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.keys(value).forEach((key) => deepFreeze(value[key]));
  return value;
}

/**
 * Resolve Generator-ready document from flexible Stage 2D / wrapper inputs.
 */
function resolveInput(input) {
  const value = input && typeof input === "object" ? input : {};

  let generatorReadyDocument = null;
  let transformationResult = null;
  let governanceResult = value.governanceResult || null;
  let validationResult = value.validationResult || null;

  if (value.generatorReadyDocument && typeof value.generatorReadyDocument === "object") {
    generatorReadyDocument = value.generatorReadyDocument;
    transformationResult = value.transformationResult || value;
  } else if (value.formatId === GENERATOR_READY_FORMAT_ID && value.mappedSections) {
    // Bare generator-ready document or 2D result root that embeds the document fields.
    if (value.generatorReadyDocument) {
      generatorReadyDocument = value.generatorReadyDocument;
      transformationResult = value;
    } else if (value.sections && value.generatorCompatibility) {
      generatorReadyDocument = value;
      transformationResult = value;
    } else {
      // Stage 2D result shape: fields at root + nested generatorReadyDocument optional
      generatorReadyDocument = {
        formatId: value.formatId,
        transformationVersion: value.transformationVersion,
        metadata: value.generatorMetadata || value.metadata,
        sections: value.mappedSections || value.sections,
        mappedSections: value.mappedSections || value.sections,
        mappedBlocks: value.mappedBlocks,
        generatorMetadata: value.generatorMetadata || value.metadata,
        generatorCompatibility: value.generatorCompatibility,
        transformationWarnings: value.transformationWarnings,
        transformationSummary: value.transformationSummary,
        generatorText: value.generatorText,
        traceability: value.traceability
      };
      transformationResult = value;
    }
  } else if (value.transformationResult && value.transformationResult.generatorReadyDocument) {
    transformationResult = value.transformationResult;
    generatorReadyDocument = transformationResult.generatorReadyDocument;
    governanceResult = governanceResult || value.transformationResult.governanceResult || null;
  } else if (value.mappedSections && value.generatorCompatibility) {
    generatorReadyDocument = {
      formatId: value.formatId || GENERATOR_READY_FORMAT_ID,
      metadata: value.generatorMetadata || value.metadata,
      sections: value.mappedSections,
      mappedSections: value.mappedSections,
      generatorMetadata: value.generatorMetadata || value.metadata,
      generatorCompatibility: value.generatorCompatibility,
      transformationWarnings: value.transformationWarnings || [],
      transformationSummary: value.transformationSummary || {},
      generatorText: value.generatorText || ""
    };
    transformationResult = value;
  } else {
    generatorReadyDocument = value.document || value || {};
    transformationResult = value;
  }

  // Prefer nested source governance when provided via transformation wrapper.
  if (!governanceResult && value.sourceGovernanceResult) {
    governanceResult = value.sourceGovernanceResult;
  }

  return {
    generatorReadyDocument: generatorReadyDocument || {},
    transformationResult,
    governanceResult,
    validationResult,
    pipeline: value.pipeline || (transformationResult && transformationResult.pipeline) || null,
    freeze: value.freeze !== false
  };
}

function supportEditorialDecision(input = {}) {
  const resolved = resolveInput(input);
  const generatorReadyDocument = deepClone(resolved.generatorReadyDocument || {});
  const governanceResult = resolved.governanceResult
    ? deepClone(resolved.governanceResult)
    : null;
  const validationResult = resolved.validationResult
    ? deepClone(resolved.validationResult)
    : null;

  const analysis = analyzeEditorialDocument({
    generatorReadyDocument,
    governanceResult,
    validationResult
  });

  const changeSummary = buildChangeSummary({
    analysis,
    generatorReadyDocument,
    governanceResult
  });

  const priorityResult = determineReviewPriority(analysis, changeSummary);
  const checklist = generateReviewChecklist(analysis, generatorReadyDocument);
  const decisionSupport = buildDecisionSupport({
    analysis,
    changeSummary,
    priorityResult,
    checklist
  });
  const telegramSummary = buildTelegramSummary(analysis, decisionSupport);

  const result = {
    formatId: DECISION_SUPPORT_FORMAT_ID,
    version: DECISION_VERSION,
    decisionVersion: DECISION_VERSION,
    engineId: ENGINE_ID,
    stageId: STAGE_ID,
    engineVersion: ENGINE_VERSION,
    pipeline: resolved.pipeline,
    source: {
      formatId: generatorReadyDocument.formatId || GENERATOR_READY_FORMAT_ID,
      stageId: "CIP_2D",
      transformationVersion: generatorReadyDocument.transformationVersion || null
    },
    editorialAnalysis: analysis,
    changeSummary,
    reviewPriority: priorityResult.priority,
    priorityExplanation: priorityResult.explanations,
    decisionSupport,
    telegramSummary,
    // Convenience top-level mirrors of decision support fields
    publishReadiness: decisionSupport.publishReadiness,
    editorialRisk: decisionSupport.editorialRisk,
    keyFindings: decisionSupport.keyFindings,
    suggestedReviewAreas: decisionSupport.suggestedReviewAreas,
    reviewChecklist: decisionSupport.reviewChecklist,
    decisionSummary: decisionSupport.decisionSummary,
    explanation: decisionSupport.explanation,
    extensions: {
      deterministic: true,
      executedModel: false,
      providerAgnostic: true,
      publishes: false,
      modifiesContent: false,
      autoApproves: false,
      humanApprovalMandatory: true,
      sharedEngine: true,
      upstreamStageIds: [
        "CIP_1A",
        "CIP_1B",
        "CIP_1C_1D",
        "CIP_1E",
        "CIP_2A",
        "CIP_2B",
        "CIP_2C",
        "CIP_2D"
      ]
    }
  };

  const cloned = deepClone(result);
  return resolved.freeze ? deepFreeze(cloned) : cloned;
}

function supportFromGeneratorReadyDocument(generatorReadyDocument, extra = {}) {
  return supportEditorialDecision({ ...extra, generatorReadyDocument });
}

function supportFromTransformationResult(transformationResult, extra = {}) {
  return supportEditorialDecision({ ...transformationResult, transformationResult, ...extra });
}

module.exports = {
  ENGINE_ID,
  STAGE_ID,
  ENGINE_VERSION,
  DECISION_VERSION,
  supportEditorialDecision,
  supportFromGeneratorReadyDocument,
  supportFromTransformationResult,
  resolveInput,
  deepFreeze
};
