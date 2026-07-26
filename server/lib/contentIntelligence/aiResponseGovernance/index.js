"use strict";

/**
 * CIP Stage 2C — Shared AI Response Governance Engine.
 *
 * Deterministically validates and safely repairs a normalized Stage 2B
 * response. It never calls a model, network, Generator, or provider SDK.
 * Manual PDF and automation workflows use the same exported engine.
 */

const engine = require("./aiResponseGovernanceEngine");
const types = require("./governanceTypes");
const schema = require("./schemaValidator");
const repair = require("./structuralRepair");
const policy = require("./policyValidator");
const generator = require("./generatorCompatibility");
const editorial = require("./editorialRiskAssessor");
const capabilities = require("./capabilityProfile");

module.exports = {
  ENGINE_ID: engine.ENGINE_ID,
  STAGE_ID: engine.STAGE_ID,
  ENGINE_VERSION: engine.ENGINE_VERSION,
  CONTRACT_VERSION: engine.CONTRACT_VERSION,
  GOVERNED_DRAFT_FORMAT_ID: types.GOVERNED_DRAFT_FORMAT_ID,
  RISK_LEVELS: types.RISK_LEVELS,
  READINESS_STATUSES: types.READINESS_STATUSES,

  governAiResponse: engine.governAiResponse,
  governAiResponseFromNormalized: engine.governAiResponseFromNormalized,
  governAiResponseFromGenerationResult: engine.governAiResponseFromGenerationResult,

  validateSchema: schema.validateSchema,
  repairStructure: repair.repairStructure,
  validatePolicy: policy.validatePolicy,
  validateGeneratorCompatibility: generator.validateGeneratorCompatibility,
  assessEditorialRisk: editorial.assessEditorialRisk,
  buildCapabilityProfile: capabilities.buildCapabilityProfile,
  CAPABILITY_KEYS: capabilities.CAPABILITY_KEYS,
  deepFreeze: engine.deepFreeze
};
