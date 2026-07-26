"use strict";

/**
 * PWP Phase 3 — Generator Contract.
 * Generator receives ONE object only and must not access upstream systems.
 */

const { deepFreeze } = require("../../contentIntelligence/multiSourceCorrelation/correlationUtils");
const {
  ENGINE_ID,
  ENGINE_VERSION,
  PHASE,
  GENERATOR_CONTRACT_FORMAT_ID,
  DRAFT_TYPES
} = require("./integrationTypes");

/**
 * Build the single object the existing Generator may consume.
 * Does not invoke the Generator. Does not render HTML.
 */
function buildGeneratorContract({
  draftPackage = null,
  validationReport = null,
  callGenerator = false
} = {}) {
  const allowed =
    Boolean(callGenerator) &&
    Boolean(draftPackage) &&
    draftPackage.draftType !== DRAFT_TYPES.REVIEW_ONLY &&
    draftPackage.draftType !== DRAFT_TYPES.NONE &&
    Boolean(validationReport && validationReport.valid);

  const contract = {
    formatId: GENERATOR_CONTRACT_FORMAT_ID,
    engineId: ENGINE_ID,
    engineVersion: ENGINE_VERSION,
    phase: PHASE,
    callGenerator: allowed,
    draftId: draftPackage ? draftPackage.draftId : null,
    workflowId: draftPackage ? draftPackage.workflowId : null,
    recruitmentId: draftPackage ? draftPackage.recruitmentId : null,
    decision: draftPackage ? draftPackage.decision : null,
    draftType: draftPackage ? draftPackage.draftType : null,
    /**
     * Single payload object for Generator rendering.
     * Generator must use only this object — no Monitoring / P1 / P2 / P3 / Resolution access.
     */
    package: allowed
      ? Object.freeze({
          draftId: draftPackage.draftId,
          workflowId: draftPackage.workflowId,
          recruitmentId: draftPackage.recruitmentId,
          decision: draftPackage.decision,
          draftType: draftPackage.draftType,
          generatorPayload: draftPackage.generatorPayload,
          updatePlan: draftPackage.updatePackage || draftPackage.updatePlan || null,
          pageReference: draftPackage.pageReference,
          changeSummary: draftPackage.changeSummary,
          editorialNotes: draftPackage.editorialNotes,
          warnings: draftPackage.warnings,
          validationSummary: draftPackage.validationSummary
        })
      : null,
    boundaries: Object.freeze({
      mayAccessMonitoring: false,
      mayAccessProgram1: false,
      mayAccessProgram2: false,
      mayAccessProgram3: false,
      mayAccessResolutionEngine: false,
      mayRenderFromSuppliedPackageOnly: true,
      mayPublish: false,
      mayUseAi: false
    }),
    validation: validationReport
      ? Object.freeze({
          valid: validationReport.valid,
          errorCount: validationReport.summary ? validationReport.summary.errorCount : 0,
          warningCount: validationReport.summary ? validationReport.summary.warningCount : 0
        })
      : null,
    effects: Object.freeze({
      preparesPackage: true,
      invokesGeneratorEngine: false,
      rendersHtml: false,
      publishes: false
    })
  };

  return deepFreeze(contract);
}

module.exports = {
  buildGeneratorContract
};
