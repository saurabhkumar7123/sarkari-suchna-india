'use strict';

/**
 * PROGRAM 5 — Package 5D
 * Draft Validation (Diagnostics Only)
 *
 * Validates required sections, metadata completeness, lifecycle readiness,
 * editorial checklist, and SEO readiness.
 *
 * Generates diagnostics only. Never modifies generated data automatically.
 */

const {
  deepFreeze,
  REUSED_MODULE_IDS,
  DRAFT_LIFECYCLE_STATES,
} = require('./draftPreparationContract');

const DRAFT_VALIDATION_VERSION = '5D.1.0.0';

const DIAGNOSTIC_SEVERITY = Object.freeze({
  INFO: 'INFO',
  WARNING: 'WARNING',
  ERROR: 'ERROR',
});

const DIAGNOSTIC_CODES = Object.freeze({
  MISSING_REQUIRED_SECTION: 'MISSING_REQUIRED_SECTION',
  METADATA_INCOMPLETE: 'METADATA_INCOMPLETE',
  LIFECYCLE_NOT_READY: 'LIFECYCLE_NOT_READY',
  EDITORIAL_CHECKLIST_INCOMPLETE: 'EDITORIAL_CHECKLIST_INCOMPLETE',
  SEO_NOT_READY: 'SEO_NOT_READY',
  REVIEW_NOT_APPROVED: 'REVIEW_NOT_APPROVED',
  VALIDATION_PASSED: 'VALIDATION_PASSED',
});

const DEFAULT_REQUIRED_SECTIONS = Object.freeze([
  'title',
  'department',
  'qualification',
  'state',
  'importantDates',
  'recruitmentMetadata',
]);

const DEFAULT_EDITORIAL_CHECKLIST = Object.freeze([
  'required_blocks',
  'dates',
  'eligibility',
  'selection_process',
  'application_process',
]);

const DEFAULT_SEO_REQUIRED_FIELDS = Object.freeze([
  'metaTitle',
  'metaDescription',
  'slugHint',
]);

function hasValue(value) {
  if (value == null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return String(value).trim().length > 0;
}

function pushDiagnostic(list, severity, code, message, details) {
  list.push({
    severity,
    code,
    message,
    details: details || null,
    automaticCorrection: false,
    dataModified: false,
  });
}

/**
 * Validate a prepared draft assembly. Diagnostics only — never mutates data.
 *
 * @param {object} [input]
 * @param {object} [input.assembly] result of assembleDraftFromReviewPayload
 * @param {object} [input.draft] prepared draft model
 * @param {string[]} [input.requiredSections]
 * @param {string[]} [input.editorialChecklist]
 * @param {object} [input.editorialChecklistStatus] map of checklistId -> boolean
 * @param {string[]} [input.seoRequiredFields]
 * @param {string} [input.lifecycleStateHint]
 * @param {string[]} [input.satisfiedLifecycleGates]
 */
function validatePreparedDraft(input = {}) {
  const assembly = input.assembly || null;
  const draft =
    (assembly && assembly.assembled) ||
    input.draft ||
    null;

  const diagnostics = [];
  const requiredSections = Array.isArray(input.requiredSections)
    ? input.requiredSections.map(String)
    : DEFAULT_REQUIRED_SECTIONS.slice();

  const editorialChecklist = Array.isArray(input.editorialChecklist)
    ? input.editorialChecklist.map(String)
    : DEFAULT_EDITORIAL_CHECKLIST.slice();

  const seoRequiredFields = Array.isArray(input.seoRequiredFields)
    ? input.seoRequiredFields.map(String)
    : DEFAULT_SEO_REQUIRED_FIELDS.slice();

  const recruitment =
    (draft && draft.recruitmentMetadata) || {};
  const seo = (draft && draft.seoMetadata) || {};
  const editorial = (draft && draft.editorialMetadata) || {};
  const extensions = (draft && draft.extensions) || {};
  const assembledSections = extensions.assembledSections || recruitment;

  const missingSections = [];
  for (const sectionId of requiredSections) {
    const value =
      assembledSections[sectionId] !== undefined
        ? assembledSections[sectionId]
        : recruitment[sectionId];
    if (!hasValue(value)) {
      missingSections.push(sectionId);
      pushDiagnostic(
        diagnostics,
        DIAGNOSTIC_SEVERITY.ERROR,
        DIAGNOSTIC_CODES.MISSING_REQUIRED_SECTION,
        `Required section missing: ${sectionId}`,
        { sectionId }
      );
    }
  }

  const missingMetadata = [];
  for (const key of ['title', 'department', 'qualification', 'state']) {
    if (!hasValue(recruitment[key])) {
      missingMetadata.push(key);
    }
  }
  if (missingMetadata.length) {
    pushDiagnostic(
      diagnostics,
      DIAGNOSTIC_SEVERITY.ERROR,
      DIAGNOSTIC_CODES.METADATA_INCOMPLETE,
      `Recruitment metadata incomplete: ${missingMetadata.join(', ')}`,
      { missingMetadata }
    );
  }

  const approved =
    (draft && draft.reviewReference && draft.reviewReference.approved) ||
    Boolean(editorial.approved);
  if (!approved) {
    pushDiagnostic(
      diagnostics,
      DIAGNOSTIC_SEVERITY.WARNING,
      DIAGNOSTIC_CODES.REVIEW_NOT_APPROVED,
      'Human Review payload is not marked approved',
      { workflowState: editorial.workflowState || null }
    );
  }

  const lifecycleHint =
    input.lifecycleStateHint ||
    (extensions.controlledLifecycleHint != null
      ? extensions.controlledLifecycleHint
      : null);
  const readyLifecycleStates = new Set([
    'APPROVED',
    'DRAFT_READY',
    'PREVIEW_READY',
    'SEO_READY',
    'PUBLISH_READY',
  ]);
  const lifecycleReady =
    lifecycleHint == null ||
    readyLifecycleStates.has(String(lifecycleHint).toUpperCase().replace(/[\s-]+/g, '_'));

  if (!lifecycleReady) {
    pushDiagnostic(
      diagnostics,
      DIAGNOSTIC_SEVERITY.WARNING,
      DIAGNOSTIC_CODES.LIFECYCLE_NOT_READY,
      `Lifecycle state hint is not draft-ready: ${lifecycleHint}`,
      { lifecycleStateHint: lifecycleHint }
    );
  }

  const checklistStatus =
    input.editorialChecklistStatus && typeof input.editorialChecklistStatus === 'object'
      ? input.editorialChecklistStatus
      : {};
  const missingChecklist = [];
  for (const itemId of editorialChecklist) {
    if (Object.prototype.hasOwnProperty.call(checklistStatus, itemId)) {
      if (!checklistStatus[itemId]) {
        missingChecklist.push(itemId);
      }
    } else {
      // Infer from assembled content when status not provided
      const inferred =
        (itemId === 'dates' && hasValue(recruitment.importantDates)) ||
        (itemId === 'eligibility' && hasValue(recruitment.eligibility || recruitment.qualification)) ||
        (itemId === 'selection_process' && hasValue(recruitment.selectionProcess)) ||
        (itemId === 'application_process' && hasValue(recruitment.applicationProcess)) ||
        (itemId === 'required_blocks' &&
          hasValue(recruitment.title) &&
          hasValue(recruitment.department));
      if (!inferred) {
        missingChecklist.push(itemId);
      }
    }
  }
  if (missingChecklist.length) {
    pushDiagnostic(
      diagnostics,
      DIAGNOSTIC_SEVERITY.WARNING,
      DIAGNOSTIC_CODES.EDITORIAL_CHECKLIST_INCOMPLETE,
      `Editorial checklist incomplete: ${missingChecklist.join(', ')}`,
      {
        missingChecklist,
        reusedModule: REUSED_MODULE_IDS.EDITORIAL_REVIEW,
      }
    );
  }

  const missingSeo = seoRequiredFields.filter((field) => !hasValue(seo[field]));
  if (missingSeo.length) {
    pushDiagnostic(
      diagnostics,
      DIAGNOSTIC_SEVERITY.WARNING,
      DIAGNOSTIC_CODES.SEO_NOT_READY,
      `SEO metadata incomplete: ${missingSeo.join(', ')}`,
      {
        missingSeo,
        reusedModule: REUSED_MODULE_IDS.SEO_DIAGNOSTICS,
      }
    );
  }

  const errorCount = diagnostics.filter((d) => d.severity === DIAGNOSTIC_SEVERITY.ERROR)
    .length;
  const warningCount = diagnostics.filter(
    (d) => d.severity === DIAGNOSTIC_SEVERITY.WARNING
  ).length;

  const valid = errorCount === 0;
  if (valid) {
    pushDiagnostic(
      diagnostics,
      DIAGNOSTIC_SEVERITY.INFO,
      DIAGNOSTIC_CODES.VALIDATION_PASSED,
      'Draft preparation validation passed with diagnostics only; no data modified.',
      null
    );
  }

  const status = valid
    ? warningCount > 0
      ? 'valid_with_warnings'
      : 'valid'
    : 'invalid';

  return deepFreeze({
    validationVersion: DRAFT_VALIDATION_VERSION,
    advisoryOnly: true,
    diagnosticsOnly: true,
    automaticCorrection: false,
    dataModified: false,
    productionDraftCreated: false,
    valid,
    status,
    errorCount,
    warningCount,
    diagnostics,
    missingSections,
    missingMetadata,
    missingChecklist,
    missingSeo,
    lifecycleReady,
    editorialReady: missingChecklist.length === 0,
    seoReady: missingSeo.length === 0,
    reviewApproved: approved,
    draftLifecycleState: valid
      ? DRAFT_LIFECYCLE_STATES.VALIDATED
      : DRAFT_LIFECYCLE_STATES.BLOCKED,
    summary: {
      status,
      errorCount,
      warningCount,
      issues: diagnostics.map((d) => ({
        severity: d.severity,
        code: d.code,
        message: d.message,
      })),
    },
    reusedModules: [
      REUSED_MODULE_IDS.EDITORIAL_REVIEW,
      REUSED_MODULE_IDS.SEO_DIAGNOSTICS,
      REUSED_MODULE_IDS.CONTROLLED_LIFECYCLE_ENGINE,
    ],
  });
}

module.exports = {
  DRAFT_VALIDATION_VERSION,
  DIAGNOSTIC_SEVERITY,
  DIAGNOSTIC_CODES,
  DEFAULT_REQUIRED_SECTIONS,
  DEFAULT_EDITORIAL_CHECKLIST,
  DEFAULT_SEO_REQUIRED_FIELDS,
  validatePreparedDraft,
};
