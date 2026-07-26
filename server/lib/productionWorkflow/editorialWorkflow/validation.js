"use strict";

/**
 * PWP Phase 4 — Validation before entering the editorial review queue.
 * Fail → do not enter review queue.
 */

const {
  GENERATOR_CONTRACT_FORMAT_ID,
  DRAFT_PACKAGE_FORMAT_ID,
  DRAFT_TYPES
} = require("../generatorIntegration/integrationTypes");

function pushIssue(issues, code, message, severity = "error") {
  issues.push({ code, message, severity });
}

function isWorkflowComplete(workflowContext = {}) {
  if (!workflowContext || typeof workflowContext !== "object") return false;
  if (workflowContext.workflowComplete === false) return false;
  if (workflowContext.halted === true && workflowContext.allowEditorialReview !== true) {
    return Boolean(workflowContext.resolutionComplete !== false);
  }
  return true;
}

function resolveValidationSummary(input = {}) {
  if (input.validationSummary && typeof input.validationSummary === "object") {
    return input.validationSummary;
  }
  if (
    input.draftPackage &&
    input.draftPackage.validationSummary &&
    typeof input.draftPackage.validationSummary === "object"
  ) {
    return input.draftPackage.validationSummary;
  }
  if (
    input.generatorContract &&
    input.generatorContract.validation &&
    typeof input.generatorContract.validation === "object"
  ) {
    return input.generatorContract.validation;
  }
  return null;
}

function isDraftPackagePresent(draftPackage) {
  return Boolean(draftPackage && typeof draftPackage === "object");
}

function isGeneratorContractValid(generatorContract, draftPackage) {
  if (!generatorContract || typeof generatorContract !== "object") {
    return { ok: false, code: "MISSING_GENERATOR_CONTRACT", message: "Generator Contract is required" };
  }
  if (
    generatorContract.formatId &&
    generatorContract.formatId !== GENERATOR_CONTRACT_FORMAT_ID
  ) {
    return {
      ok: false,
      code: "INVALID_GENERATOR_CONTRACT",
      message: `Unexpected Generator Contract formatId: ${generatorContract.formatId}`
    };
  }
  if (generatorContract.boundaries) {
    if (generatorContract.boundaries.mayPublish === true) {
      return {
        ok: false,
        code: "INVALID_GENERATOR_CONTRACT",
        message: "Generator Contract must not allow publishing"
      };
    }
    if (generatorContract.boundaries.mayUseAi === true) {
      return {
        ok: false,
        code: "INVALID_GENERATOR_CONTRACT",
        message: "Generator Contract must not allow AI"
      };
    }
  }
  // Structural validity only — callGenerator may be false for REVIEW_ONLY.
  if (
    draftPackage &&
    draftPackage.draftType === DRAFT_TYPES.REVIEW_ONLY &&
    generatorContract.callGenerator === true
  ) {
    return {
      ok: false,
      code: "INVALID_GENERATOR_CONTRACT",
      message: "REVIEW_ONLY drafts must not call Generator"
    };
  }
  return { ok: true };
}

/**
 * Validate inputs before entering editorial review.
 *
 * @returns {{ valid: boolean, errors: object[], warnings: object[], summary: object }}
 */
function validateEditorialReviewInput({
  workflowContext = null,
  draftPackage = null,
  generatorContract = null,
  validationSummary = null,
  editorialNotes = null,
  existingPageMetadata = null,
  workflowId = null
} = {}) {
  const errors = [];
  const warnings = [];

  if (!workflowContext || typeof workflowContext !== "object") {
    pushIssue(errors, "MISSING_WORKFLOW_CONTEXT", "Workflow context is required");
  } else if (!isWorkflowComplete(workflowContext)) {
    pushIssue(errors, "WORKFLOW_INCOMPLETE", "Workflow is not complete for editorial review");
  }

  const resolvedWorkflowId =
    workflowId ||
    (workflowContext && workflowContext.workflowId) ||
    (workflowContext &&
      workflowContext.monitoringEvent &&
      workflowContext.monitoringEvent.workflowId) ||
    (draftPackage && draftPackage.workflowId) ||
    null;

  if (!resolvedWorkflowId) {
    pushIssue(errors, "MISSING_WORKFLOW_ID", "workflowId is required");
  }

  if (!isDraftPackagePresent(draftPackage)) {
    pushIssue(errors, "MISSING_DRAFT_PACKAGE", "Draft Package is required to enter review");
  } else {
    if (
      draftPackage.formatId &&
      draftPackage.formatId !== DRAFT_PACKAGE_FORMAT_ID
    ) {
      pushIssue(
        errors,
        "INVALID_DRAFT_PACKAGE",
        `Unexpected Draft Package formatId: ${draftPackage.formatId}`
      );
    }
    if (!draftPackage.draftId) {
      pushIssue(errors, "MISSING_DRAFT_ID", "draftId is required on Draft Package");
    }
    if (draftPackage.draftType === DRAFT_TYPES.NONE) {
      pushIssue(
        errors,
        "NO_REVIEWABLE_DRAFT",
        "NONE draft type cannot enter editorial review"
      );
    }
  }

  const contractCheck = isGeneratorContractValid(generatorContract, draftPackage);
  if (!contractCheck.ok) {
    pushIssue(errors, contractCheck.code, contractCheck.message);
  }

  const resolvedSummary = resolveValidationSummary({
    validationSummary,
    draftPackage,
    generatorContract
  });

  if (!resolvedSummary || typeof resolvedSummary !== "object") {
    pushIssue(
      errors,
      "MISSING_VALIDATION_SUMMARY",
      "Validation Summary is required to enter review"
    );
  } else if (resolvedSummary.valid === false) {
    pushIssue(
      errors,
      "VALIDATION_SUMMARY_INVALID",
      "Validation Summary reports invalid — cannot enter review"
    );
  }

  if (editorialNotes != null && !Array.isArray(editorialNotes) && typeof editorialNotes !== "string") {
    warnings.push({
      code: "UNEXPECTED_EDITORIAL_NOTES_SHAPE",
      message: "editorialNotes expected array or string",
      severity: "warning"
    });
  }

  if (
    existingPageMetadata != null &&
    typeof existingPageMetadata !== "object"
  ) {
    warnings.push({
      code: "UNEXPECTED_PAGE_METADATA_SHAPE",
      message: "existingPageMetadata expected object when supplied",
      severity: "warning"
    });
  }

  const valid = errors.length === 0;
  const summary = Object.freeze({
    valid,
    errorCount: errors.length,
    warningCount: warnings.length,
    workflowId: resolvedWorkflowId,
    draftId: draftPackage && draftPackage.draftId ? draftPackage.draftId : null,
    draftType: draftPackage && draftPackage.draftType ? draftPackage.draftType : null,
    canEnterReview: valid,
    hasValidationSummary: Boolean(resolvedSummary),
    hasGeneratorContract: Boolean(generatorContract)
  });

  return Object.freeze({
    valid,
    errors: Object.freeze(errors.map((e) => Object.freeze({ ...e }))),
    warnings: Object.freeze(warnings.map((w) => Object.freeze({ ...w }))),
    summary,
    validationSummary: resolvedSummary
      ? Object.freeze({ ...resolvedSummary })
      : null
  });
}

module.exports = {
  validateEditorialReviewInput,
  isWorkflowComplete,
  resolveValidationSummary,
  isGeneratorContractValid
};
