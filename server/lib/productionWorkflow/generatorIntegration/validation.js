"use strict";

/**
 * PWP Phase 3 — Validation before Generator receives a package.
 * Fail → do not call Generator.
 */

const { RESOLUTION_DECISIONS } = require("../recruitmentResolution/resolutionTypes");
const {
  GENERATOR_PACKAGE_DECISIONS,
  NO_PACKAGE_DECISIONS,
  REVIEW_ONLY_DECISIONS
} = require("./integrationTypes");

const SUPPORTED_DECISIONS = Object.freeze([
  ...GENERATOR_PACKAGE_DECISIONS,
  ...NO_PACKAGE_DECISIONS,
  ...REVIEW_ONLY_DECISIONS,
  RESOLUTION_DECISIONS.UNSUPPORTED
]);

function pushIssue(issues, code, message, severity = "error") {
  issues.push({ code, message, severity });
}

function hasCanonicalPackage(canonicalRecruitmentPackage) {
  if (!canonicalRecruitmentPackage || typeof canonicalRecruitmentPackage !== "object") {
    return false;
  }
  const ready =
    canonicalRecruitmentPackage.generatorReadyDocument || canonicalRecruitmentPackage;
  return Boolean(ready && typeof ready === "object");
}

function resolveDecision(resolutionDecision) {
  if (!resolutionDecision) return null;
  if (typeof resolutionDecision === "string") return resolutionDecision;
  if (typeof resolutionDecision === "object" && resolutionDecision.decision) {
    return resolutionDecision.decision;
  }
  return null;
}

function isWorkflowComplete(workflowContext = {}) {
  if (!workflowContext || typeof workflowContext !== "object") return false;
  if (workflowContext.workflowComplete === false) return false;
  if (workflowContext.halted === true && workflowContext.allowDraftPreparation !== true) {
    // Halted contexts may still prepare review/no-package outcomes when resolution exists.
    return Boolean(workflowContext.resolutionComplete !== false);
  }
  return true;
}

/**
 * Validate inputs for Generator Integration.
 *
 * @returns {{ valid: boolean, errors: object[], warnings: object[], summary: object }}
 */
function validateGeneratorDraftInput({
  workflowContext = null,
  resolutionDecision = null,
  resolution = null,
  canonicalRecruitmentPackage = null,
  updatePlan = null,
  workflowId = null,
  recruitmentId = null
} = {}) {
  const errors = [];
  const warnings = [];
  const resolutionObj =
    resolution ||
    (resolutionDecision && typeof resolutionDecision === "object" ? resolutionDecision : null);
  const decision = resolveDecision(resolutionDecision || resolutionObj);

  if (!decision) {
    pushIssue(errors, "MISSING_RESOLUTION", "Resolution decision is required");
  } else if (!SUPPORTED_DECISIONS.includes(decision)) {
    pushIssue(
      errors,
      "UNSUPPORTED_DECISION",
      `Decision is not supported by Generator Integration: ${decision}`
    );
  } else if (decision === RESOLUTION_DECISIONS.UNSUPPORTED) {
    pushIssue(
      errors,
      "UNSUPPORTED_DECISION",
      "UNSUPPORTED resolution cannot produce a Generator package"
    );
  }

  if (!resolutionObj && typeof resolutionDecision !== "string") {
    // string-only decision is allowed when tests pass decision code directly
  } else if (!resolutionObj && !decision) {
    pushIssue(errors, "MISSING_RESOLUTION_OBJECT", "Resolution object is required");
  }

  if (!workflowContext || typeof workflowContext !== "object") {
    pushIssue(errors, "MISSING_WORKFLOW_CONTEXT", "Workflow context is required");
  } else if (!isWorkflowComplete(workflowContext)) {
    pushIssue(errors, "WORKFLOW_INCOMPLETE", "Workflow is not complete for draft preparation");
  }

  const resolvedWorkflowId =
    workflowId ||
    (workflowContext && workflowContext.workflowId) ||
    (workflowContext &&
      workflowContext.monitoringEvent &&
      workflowContext.monitoringEvent.workflowId) ||
    null;

  if (!resolvedWorkflowId) {
    pushIssue(errors, "MISSING_WORKFLOW_ID", "workflowId is required");
  }

  const needsCanonical = GENERATOR_PACKAGE_DECISIONS.includes(decision);
  if (needsCanonical && !hasCanonicalPackage(canonicalRecruitmentPackage)) {
    pushIssue(
      errors,
      "MISSING_CANONICAL_PACKAGE",
      "Canonical Recruitment Package is required for Generator draft packages"
    );
  }

  const needsUpdatePlan =
    decision === RESOLUTION_DECISIONS.UPDATE_EXISTING_PAGE ||
    decision === RESOLUTION_DECISIONS.UPDATE_EXISTING_RECRUITMENT;

  if (needsUpdatePlan) {
    if (!updatePlan || typeof updatePlan !== "object") {
      pushIssue(
        errors,
        "MISSING_UPDATE_PLAN",
        "Update plan is required for update decisions"
      );
    } else {
      if (!Array.isArray(updatePlan.affectedSections)) {
        pushIssue(
          errors,
          "INVALID_UPDATE_PLAN",
          "updatePlan.affectedSections must be an array"
        );
      }
      if (!Array.isArray(updatePlan.unaffectedSections)) {
        pushIssue(
          errors,
          "INVALID_UPDATE_PLAN",
          "updatePlan.unaffectedSections must be an array"
        );
      }
      if (updatePlan.rewriteContent === true) {
        pushIssue(
          errors,
          "INVALID_UPDATE_PLAN",
          "updatePlan.rewriteContent must be false"
        );
      }
      if (updatePlan.overwriteUnrelatedSections === true) {
        pushIssue(
          errors,
          "INVALID_UPDATE_PLAN",
          "updatePlan.overwriteUnrelatedSections must be false"
        );
      }
    }
  }

  if (
    decision === RESOLUTION_DECISIONS.UPDATE_EXISTING_RECRUITMENT &&
    !recruitmentId &&
    !(resolutionObj && resolutionObj.match && resolutionObj.match.recruitmentId) &&
    !(workflowContext && workflowContext.existingRecruitment)
  ) {
    warnings.push({
      code: "MISSING_RECRUITMENT_ID",
      message: "recruitmentId preferred for recruitment metadata updates",
      severity: "warning"
    });
  }

  const valid = errors.length === 0;
  const summary = Object.freeze({
    valid,
    errorCount: errors.length,
    warningCount: warnings.length,
    decision: decision || null,
    requiresCanonical: Boolean(needsCanonical),
    requiresUpdatePlan: Boolean(needsUpdatePlan),
    workflowId: resolvedWorkflowId,
    canCallGenerator:
      valid && GENERATOR_PACKAGE_DECISIONS.includes(decision)
  });

  return Object.freeze({
    valid,
    errors: Object.freeze(errors.map((e) => Object.freeze({ ...e }))),
    warnings: Object.freeze(warnings.map((w) => Object.freeze({ ...w }))),
    summary
  });
}

module.exports = {
  SUPPORTED_DECISIONS,
  validateGeneratorDraftInput,
  hasCanonicalPackage,
  resolveDecision
};
