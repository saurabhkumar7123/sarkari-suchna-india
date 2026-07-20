'use strict';

/**
 * Package 5A — Pipeline Health observation adapters (product-side, advisory).
 *
 * Maps existing Program 4 module outputs into pipeline stage observations
 * without duplicating business logic and without runtime wiring.
 *
 * Reuses:
 *   - Shared Preview integrity diagnostics
 *   - SEO diagnostics panel summary
 *   - Editorial workflow status signals
 *   - Feature completion / admin dashboard readiness hints
 *
 * No routes. No feature activation. No monitoring execution.
 */

const {
  validatePreviewIntegrity,
} = require("../sharedPreviewModel");
const {
  buildSeoDiagnosticsPanel,
} = require("../../seo/seoDiagnostics");

/**
 * @param {object} [input]
 * @returns {object[]} stage observations for Package 5A evaluators
 */
function buildPipelineHealthObservationsFromProgram4(input = {}) {
  const observations = [];
  const lastEvaluatedAt =
    typeof input.lastEvaluatedAt === "string" ? input.lastEvaluatedAt : null;

  // Recruitment Operations stages — observation passthrough only (no re-logic).
  const ops = input.recruitmentOperations && typeof input.recruitmentOperations === "object"
    ? input.recruitmentOperations
    : {};

  const opsStages = [
    "SOURCE_DETECTION",
    "CANDIDATE_COLLECTION",
    "CLASSIFICATION",
    "NORMALIZATION",
    "DEDUPLICATION",
    "HUMAN_REVIEW",
  ];

  for (const stageId of opsStages) {
    const stageObs = ops[stageId] && typeof ops[stageId] === "object" ? ops[stageId] : null;
    if (stageObs) {
      observations.push({
        stageId,
        ...stageObs,
        lastEvaluatedAt: stageObs.lastEvaluatedAt || lastEvaluatedAt,
      });
    } else if (ops.healthy === true) {
      observations.push({
        stageId,
        healthy: true,
        lastEvaluatedAt,
      });
    } else {
      observations.push({ stageId, lastEvaluatedAt });
    }
  }

  // Draft preparation from editorial / generator binding signals.
  const draft = input.draftPreparation && typeof input.draftPreparation === "object"
    ? input.draftPreparation
    : input.editorialWorkflow && typeof input.editorialWorkflow === "object"
      ? input.editorialWorkflow
      : {};

  observations.push({
    stageId: "DRAFT_PREPARATION",
    lastEvaluatedAt,
    healthy: draft.ready === true || draft.draftReady === true || draft.ok === true,
    warnings: Array.isArray(draft.warnings) ? draft.warnings : [],
    validationFailures: Array.isArray(draft.validationFailures)
      ? draft.validationFailures
      : [],
    missingPrerequisites: Array.isArray(draft.missingPrerequisites)
      ? draft.missingPrerequisites
      : draft.ready || draft.draftReady || draft.ok
        ? []
        : undefined,
    status: draft.status,
    evaluated: draft.evaluated === true || draft.ready === true || draft.ok === true,
  });

  // Shared Preview — reuse integrity validator (no duplicate logic).
  const previewInput = input.sharedPreview || input.previewSnapshot || null;
  if (previewInput && typeof previewInput === "object") {
    const integrity =
      typeof previewInput.integrity === "object" && previewInput.integrity
        ? previewInput.integrity
        : validatePreviewIntegrity(previewInput);

    const issues = Array.isArray(integrity.issues) ? integrity.issues : [];
    const errorIssues = issues
      .filter((i) => i && i.severity === "error")
      .map((i) => i.code || i.message || String(i));
    const warningIssues = issues
      .filter((i) => i && i.severity === "warning")
      .map((i) => i.code || i.message || String(i));

    observations.push({
      stageId: "SHARED_PREVIEW",
      lastEvaluatedAt,
      healthy: errorIssues.length === 0,
      validationFailures: errorIssues,
      warnings: warningIssues,
      evaluated: true,
    });
  } else {
    observations.push({ stageId: "SHARED_PREVIEW", lastEvaluatedAt });
  }

  // Editorial Review — reuse supplied editorial signals only.
  const editorial = input.editorialReview && typeof input.editorialReview === "object"
    ? input.editorialReview
    : {};

  observations.push({
    stageId: "EDITORIAL_REVIEW",
    lastEvaluatedAt,
    status: editorial.status,
    healthy:
      editorial.approved === true ||
      editorial.reviewComplete === true ||
      editorial.ok === true,
    warnings: Array.isArray(editorial.warnings) ? editorial.warnings : [],
    validationFailures: Array.isArray(editorial.validationFailures)
      ? editorial.validationFailures
      : [],
    missingPrerequisites: Array.isArray(editorial.missingPrerequisites)
      ? editorial.missingPrerequisites
      : [],
    blocked: editorial.blocked === true,
    evaluated:
      editorial.evaluated === true ||
      editorial.approved === true ||
      editorial.reviewComplete === true ||
      editorial.ok === true,
  });

  // SEO Validation — reuse SEO diagnostics panel builder.
  if (input.seoDiagnosticsInput && typeof input.seoDiagnosticsInput === "object") {
    const panel = buildSeoDiagnosticsPanel(input.seoDiagnosticsInput);
    const missingMeta = (panel.missingMetadata || []).length;
    const missingSchema = (panel.missingSchema || []).length;
    const broken = (panel.brokenInternalLinks || []).length;
    const duplicates = (panel.duplicateTitles || []).length;
    const failures = [];
    if (missingMeta) failures.push(`MISSING_METADATA_${missingMeta}`);
    if (missingSchema) failures.push(`MISSING_SCHEMA_${missingSchema}`);
    if (broken) failures.push(`BROKEN_INTERNAL_LINKS_${broken}`);
    if (duplicates) failures.push(`DUPLICATE_TITLES_${duplicates}`);

    observations.push({
      stageId: "SEO_VALIDATION",
      lastEvaluatedAt,
      healthy: failures.length === 0,
      validationFailures: failures,
      warnings: Array.isArray(panel.warnings) ? panel.warnings : [],
      evaluated: true,
    });
  } else if (input.seoValidation && typeof input.seoValidation === "object") {
    observations.push({
      stageId: "SEO_VALIDATION",
      lastEvaluatedAt,
      ...input.seoValidation,
    });
  } else {
    observations.push({ stageId: "SEO_VALIDATION", lastEvaluatedAt });
  }

  // Publish readiness — advisory composition of SEO + editorial hints only.
  const publish = input.publishReadiness && typeof input.publishReadiness === "object"
    ? input.publishReadiness
    : {};

  const seoObs = observations.find((o) => o.stageId === "SEO_VALIDATION") || {};
  const editorialObs = observations.find((o) => o.stageId === "EDITORIAL_REVIEW") || {};
  const seoBlocked =
    (seoObs.validationFailures && seoObs.validationFailures.length > 0) ||
    seoObs.blocked === true;
  const editorialBlocked =
    editorialObs.blocked === true ||
    (editorialObs.missingPrerequisites &&
      editorialObs.missingPrerequisites.length > 0);

  observations.push({
    stageId: "PUBLISH_READINESS",
    lastEvaluatedAt,
    healthy:
      publish.ready === true ||
      (!seoBlocked &&
        !editorialBlocked &&
        (editorialObs.healthy === true || editorialObs.evaluated === true) &&
        (seoObs.healthy === true || seoObs.evaluated === true) &&
        publish.ready !== false),
    blocked: publish.blocked === true || seoBlocked || editorialBlocked,
    dependencyIssues: [
      ...(seoBlocked ? ["UPSTREAM_SEO_VALIDATION_DEGRADED"] : []),
      ...(editorialBlocked ? ["UPSTREAM_EDITORIAL_REVIEW_BLOCKED"] : []),
    ],
    warnings: Array.isArray(publish.warnings) ? publish.warnings : [],
    validationFailures: Array.isArray(publish.validationFailures)
      ? publish.validationFailures
      : [],
    evaluated: publish.evaluated === true || publish.ready != null,
    status: publish.status,
  });

  return observations.map((obs) => {
    const cleaned = { ...obs };
    if (cleaned.missingPrerequisites === undefined) {
      delete cleaned.missingPrerequisites;
    }
    if (cleaned.healthy === false && cleaned.evaluated !== true && cleaned.status == null) {
      delete cleaned.healthy;
    }
    return cleaned;
  });
}

module.exports = {
  buildPipelineHealthObservationsFromProgram4,
};
