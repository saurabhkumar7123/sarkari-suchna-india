'use strict';

/**
 * PROGRAM 5 — Package 5B
 * Integration Diagnostics (Read-Only)
 *
 * Surfaces normalization status, validation status, review payload
 * readiness, missing prerequisites, warnings, and mapping summary.
 */

const { deepFreeze } = require('./monitoringCandidateContract');

const INTEGRATION_DIAGNOSTICS_VERSION = '5B.1.0.0';

const PREREQUISITES = Object.freeze([
  'PACKAGE_5A_PIPELINE_HEALTH',
  'EDITORIAL_REVIEW_FRAMEWORK',
  'SHARED_PREVIEW_FRAMEWORK',
  'RECRUITMENT_OPERATIONS',
  'SEO_DIAGNOSTICS',
]);

/**
 * Build read-only integration diagnostics for a processed candidate.
 *
 * @param {object} input
 * @param {object} [input.normalization]
 * @param {object} [input.validation]
 * @param {object} [input.adapter]
 * @param {object} [input.confidence]
 * @param {object} [input.preview]
 * @param {string[]} [input.availablePrerequisites]
 */
function buildIntegrationDiagnostics(input = {}) {
  const normalization = input.normalization || null;
  const validation = input.validation || null;
  const adapter = input.adapter || null;
  const confidence = input.confidence || (adapter && adapter.confidence) || null;
  const preview = input.preview || null;

  const available = new Set(
    (Array.isArray(input.availablePrerequisites)
      ? input.availablePrerequisites
      : PREREQUISITES
    ).map(String)
  );
  const missingPrerequisites = PREREQUISITES.filter((p) => !available.has(p));

  const warnings = [];
  if (normalization && normalization.status !== 'normalized') {
    warnings.push({
      code: 'NORMALIZATION_INCOMPLETE',
      message: 'Candidate normalization did not complete successfully',
    });
  }
  if (validation && validation.warningCount > 0) {
    warnings.push({
      code: 'VALIDATION_WARNINGS_PRESENT',
      message: `${validation.warningCount} validation warning(s) present`,
    });
  }
  if (validation && validation.errorCount > 0) {
    warnings.push({
      code: 'VALIDATION_ERRORS_PRESENT',
      message: `${validation.errorCount} validation diagnostic error(s) present (advisory — not auto-rejected)`,
    });
  }
  if (adapter && !adapter.ready) {
    warnings.push({
      code: 'REVIEW_PAYLOAD_NOT_READY',
      message: 'Review payload is not ready for operator submission',
    });
  }
  if (missingPrerequisites.length) {
    warnings.push({
      code: 'MISSING_PREREQUISITES',
      message: `Missing prerequisites: ${missingPrerequisites.join(', ')}`,
    });
  }
  if (confidence && confidence.band === 'unknown') {
    warnings.push({
      code: 'CONFIDENCE_UNKNOWN',
      message: 'Confidence band is unknown',
    });
  }

  const reviewPayloadReadiness = {
    ready: Boolean(adapter && adapter.ready),
    insertedIntoProductionQueue: false,
    automaticInsertDenied: true,
    payloadKind:
      adapter && adapter.reviewPayload
        ? adapter.reviewPayload.payloadKind
        : null,
  };

  const mappingSummary = {
    normalization: normalization ? normalization.mappingSummary || null : null,
    adapter: adapter && adapter.reviewPayload
      ? adapter.reviewPayload.mappingSummary
      : null,
    confidenceBand: confidence ? confidence.band : null,
    previewReady: Boolean(preview && preview.ready),
  };

  return deepFreeze({
    diagnosticsVersion: INTEGRATION_DIAGNOSTICS_VERSION,
    readOnly: true,
    advisoryOnly: true,
    normalizationStatus: normalization ? normalization.status : 'not_run',
    validationStatus: validation ? validation.status : 'not_run',
    reviewPayloadReadiness,
    missingPrerequisites,
    warnings,
    mappingSummary,
    confidence: confidence
      ? {
          band: confidence.band,
          score: confidence.confidence,
          advisoryOnly: true,
          automaticApproval: false,
        }
      : null,
    preview: preview
      ? {
          ready: Boolean(preview.ready),
          persisted: Boolean(preview.persisted),
          simulationOnly: preview.simulationOnly !== false,
        }
      : null,
    summary: {
      canPreview: Boolean(adapter && adapter.ready),
      canSubmitToProductionQueue: false,
      monitoringExecuted: false,
      automationActive: false,
    },
  });
}

module.exports = {
  INTEGRATION_DIAGNOSTICS_VERSION,
  PREREQUISITES,
  buildIntegrationDiagnostics,
};
