"use strict";

const { deepClone } = require("../aiDraftGeneration/responseNormalizer");
const { buildDraftPolicy } = require("../aiDraftGeneration/draftPolicy");
const { validateSchema } = require("./schemaValidator");
const { repairStructure } = require("./structuralRepair");
const { validatePolicy } = require("./policyValidator");
const { validateGeneratorCompatibility } = require("./generatorCompatibility");
const { assessEditorialRisk } = require("./editorialRiskAssessor");
const { buildCapabilityProfile } = require("./capabilityProfile");
const {
  ENGINE_ID,
  STAGE_ID,
  ENGINE_VERSION,
  CONTRACT_VERSION,
  GOVERNED_DRAFT_FORMAT_ID
} = require("./governanceTypes");

function deepFreeze(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.keys(value).forEach((key) => deepFreeze(value[key]));
  return value;
}

function resolveInput(input) {
  const value = input && typeof input === "object" ? input : {};
  const generationResult =
    value.generationResult && typeof value.generationResult === "object"
      ? value.generationResult
      : null;
  const normalizedResponse =
    value.normalizedResponse !== undefined
      ? value.normalizedResponse
      : generationResult
        ? generationResult.normalizedResponse
        : value.formatId
          ? value
          : null;
  const requestPackage =
    value.requestPackage || (generationResult && generationResult.requestPackage) || null;
  const baselinePayload =
    value.payload || (requestPackage && requestPackage.structuredPayload) || null;
  const draftPolicy =
    value.draftPolicy ||
    (requestPackage && requestPackage.draftPolicy) ||
    (generationResult && generationResult.draftPolicy) ||
    buildDraftPolicy();
  return {
    normalizedResponse,
    requestPackage,
    baselinePayload,
    draftPolicy,
    pipeline: value.pipeline || (requestPackage && requestPackage.pipeline) || null,
    capabilityProfile: value.capabilityProfile,
    freeze: value.freeze !== false
  };
}

function governAiResponse(input = {}) {
  const resolved = resolveInput(input);
  const originalAiResponse = deepClone(resolved.normalizedResponse);
  const schema = validateSchema(originalAiResponse);
  const repaired = repairStructure(originalAiResponse);
  const policy = validatePolicy(
    repaired.governedDraft,
    resolved.baselinePayload,
    resolved.draftPolicy
  );
  const generatorCompatibility = validateGeneratorCompatibility(repaired.governedDraft);
  const validationFindings = schema.findings.slice();
  const policyFindings = policy.findings.slice();
  const allFindings = validationFindings
    .concat(policyFindings)
    .concat(generatorCompatibility.findings);
  const editorial = assessEditorialRisk(allFindings, generatorCompatibility);

  const result = {
    formatId: GOVERNED_DRAFT_FORMAT_ID,
    version: CONTRACT_VERSION,
    engineId: ENGINE_ID,
    stageId: STAGE_ID,
    engineVersion: ENGINE_VERSION,
    pipeline: resolved.pipeline,
    originalAiResponse,
    governedDraft: repaired.governedDraft,
    validationFindings,
    repairsApplied: repaired.repairsApplied,
    policyFindings,
    generatorCompatibility,
    editorialRisks: {
      overall: editorial.overallRisk,
      findings: editorial.risks
    },
    reviewRecommendations: editorial.reviewRecommendations,
    readinessStatus: {
      status: editorial.readinessStatus,
      ready: editorial.readinessStatus === "ready",
      schemaValid: schema.valid,
      policyValid: policy.valid,
      generatorCompatible: generatorCompatibility.compatible
    },
    capabilityProfile: buildCapabilityProfile(resolved.capabilityProfile),
    extensions: {
      deterministic: true,
      executedModel: false,
      providerAgnostic: true,
      originalPreserved: true,
      repairsTraceable: true,
      schemaCompatible: schema.compatible,
      baselineAvailable: policy.baselineAvailable,
      upstreamStageIds: ["CIP_1A", "CIP_1B", "CIP_1C_1D", "CIP_1E", "CIP_2A", "CIP_2B"]
    }
  };

  const cloned = deepClone(result);
  return resolved.freeze ? deepFreeze(cloned) : cloned;
}

function governAiResponseFromNormalized(normalizedResponse, extra = {}) {
  return governAiResponse({ ...extra, normalizedResponse });
}

function governAiResponseFromGenerationResult(generationResult, extra = {}) {
  return governAiResponse({ ...extra, generationResult });
}

module.exports = {
  ENGINE_ID,
  STAGE_ID,
  ENGINE_VERSION,
  CONTRACT_VERSION,
  governAiResponse,
  governAiResponseFromNormalized,
  governAiResponseFromGenerationResult,
  deepFreeze
};
