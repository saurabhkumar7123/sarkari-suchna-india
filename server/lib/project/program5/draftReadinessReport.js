'use strict';

/**
 * PROGRAM 5 — Package 5D
 * Draft Readiness Report (Read-Only / Advisory)
 *
 * Reusable advisory report including:
 *   - Draft completeness
 *   - Remaining validation issues
 *   - Missing fields
 *   - Editorial status
 *   - SEO status
 *   - Recommended next step
 */

const { deepFreeze, REUSED_MODULE_IDS } = require('./draftPreparationContract');

const DRAFT_READINESS_REPORT_VERSION = '5D.1.0.0';

function recommendNextStep({
  validation,
  assembly,
  generatorAdapter,
  preview,
}) {
  if (!assembly || !assembly.assembled) {
    return {
      code: 'ASSEMBLE_DRAFT',
      priority: 'HIGH',
      message:
        'Assemble a draft from an approved Human Review payload before evaluating readiness.',
    };
  }

  if (validation && !validation.valid) {
    return {
      code: 'RESOLVE_VALIDATION_ISSUES',
      priority: 'HIGH',
      message:
        'Resolve remaining validation diagnostics. No automatic correction is performed.',
      remainingIssues: (validation.diagnostics || [])
        .filter((d) => d.severity === 'ERROR')
        .map((d) => d.code),
    };
  }

  if (validation && validation.missingChecklist && validation.missingChecklist.length) {
    return {
      code: 'COMPLETE_EDITORIAL_CHECKLIST',
      priority: 'MEDIUM',
      message: `Complete editorial checklist items: ${validation.missingChecklist.join(', ')}`,
      missingChecklist: validation.missingChecklist,
    };
  }

  if (validation && validation.missingSeo && validation.missingSeo.length) {
    return {
      code: 'COMPLETE_SEO_METADATA',
      priority: 'MEDIUM',
      message: `Complete SEO metadata fields: ${validation.missingSeo.join(', ')}`,
      missingSeo: validation.missingSeo,
    };
  }

  if (generatorAdapter && !generatorAdapter.compatible) {
    return {
      code: 'FIX_GENERATOR_COMPATIBILITY',
      priority: 'HIGH',
      message:
        'Prepared draft is not compatible with the Generator contract. Review missing critical fields.',
      missingCritical: generatorAdapter.missingCritical || [],
    };
  }

  if (preview && !preview.ready) {
    return {
      code: 'REFRESH_DRAFT_PREVIEW',
      priority: 'MEDIUM',
      message: 'Draft preview is not ready for operator inspection.',
    };
  }

  return {
    code: 'OPERATOR_REVIEW_PREPARED_DRAFT',
    priority: 'INFO',
    message:
      'Draft preparation is ready for operator review. No production draft will be created automatically.',
  };
}

/**
 * Generate a read-only draft readiness report.
 *
 * @param {object} [input]
 * @param {object} [input.assembly]
 * @param {object} [input.validation]
 * @param {object} [input.generatorAdapter]
 * @param {object} [input.preview]
 */
function generateDraftReadinessReport(input = {}) {
  const assembly = input.assembly || null;
  const validation = input.validation || null;
  const generatorAdapter = input.generatorAdapter || null;
  const preview = input.preview || null;

  const draft = (assembly && assembly.assembled) || null;
  const recruitment = (draft && draft.recruitmentMetadata) || {};

  const presentFieldCount = [
    'title',
    'department',
    'qualification',
    'state',
    'importantDates',
    'eligibility',
    'selectionProcess',
    'applicationProcess',
  ].filter((key) => {
    const value = recruitment[key];
    if (value == null) return false;
    if (Array.isArray(value)) return value.length > 0;
    return String(value).trim().length > 0;
  }).length;

  const completeness = {
    score: presentFieldCount / 8,
    presentFieldCount,
    totalTrackedFields: 8,
    missingRequired:
      (validation && validation.missingSections) ||
      (assembly && assembly.missingRequired) ||
      [],
    ready: Boolean(
      validation &&
        validation.valid &&
        generatorAdapter &&
        generatorAdapter.compatible
    ),
  };

  const remainingValidationIssues = validation
    ? (validation.diagnostics || [])
        .filter((d) => d.severity === 'ERROR' || d.severity === 'WARNING')
        .map((d) => ({
          severity: d.severity,
          code: d.code,
          message: d.message,
        }))
    : [];

  const missingFields = {
    sections: completeness.missingRequired.slice(),
    metadata: (validation && validation.missingMetadata) || [],
    editorialChecklist: (validation && validation.missingChecklist) || [],
    seo: (validation && validation.missingSeo) || [],
    generatorCritical: (generatorAdapter && generatorAdapter.missingCritical) || [],
  };

  const editorialStatus = {
    ready: validation ? Boolean(validation.editorialReady) : false,
    approved: validation ? Boolean(validation.reviewApproved) : false,
    workflowState:
      draft && draft.editorialMetadata
        ? draft.editorialMetadata.workflowState
        : null,
    reusedModule: REUSED_MODULE_IDS.EDITORIAL_REVIEW,
  };

  const seoStatus = {
    ready: validation ? Boolean(validation.seoReady) : false,
    missingFields: missingFields.seo.slice(),
    reusedModule: REUSED_MODULE_IDS.SEO_DIAGNOSTICS,
  };

  const recommendedNextStep = recommendNextStep({
    validation,
    assembly,
    generatorAdapter,
    preview,
  });

  return deepFreeze({
    reportVersion: DRAFT_READINESS_REPORT_VERSION,
    advisoryOnly: true,
    readOnly: true,
    automaticDraftCreation: false,
    productionDraftCreated: false,
    published: false,
    draftId: draft && draft.draftId ? draft.draftId : null,
    sourceCandidateId:
      draft && draft.sourceCandidateId ? draft.sourceCandidateId : null,
    draftCompleteness: completeness,
    remainingValidationIssues,
    missingFields,
    editorialStatus,
    seoStatus,
    generatorCompatibility: generatorAdapter
      ? {
          compatible: Boolean(generatorAdapter.compatible),
          ready: Boolean(generatorAdapter.ready),
        }
      : null,
    previewAvailability: preview
      ? {
          ready: Boolean(preview.ready),
          previewOnly: true,
        }
      : null,
    recommendedNextStep,
    reusedModules: [
      REUSED_MODULE_IDS.EDITORIAL_REVIEW,
      REUSED_MODULE_IDS.SEO_DIAGNOSTICS,
      REUSED_MODULE_IDS.SHARED_PREVIEW,
      REUSED_MODULE_IDS.GENERATOR,
    ],
  });
}

module.exports = {
  DRAFT_READINESS_REPORT_VERSION,
  generateDraftReadinessReport,
};
