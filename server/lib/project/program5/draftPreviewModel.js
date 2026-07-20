'use strict';

/**
 * PROGRAM 5 — Package 5D
 * Draft Preview Model
 *
 * Reuses Shared Preview identities so operators can inspect the generated
 * draft without persistence or publishing.
 *
 * Exposes: content summary, missing sections, validation status,
 * SEO readiness, editorial readiness.
 *
 * Preview only.
 */

const crypto = require('crypto');
const { deepFreeze, REUSED_MODULE_IDS } = require('./draftPreparationContract');

const DRAFT_PREVIEW_MODEL_VERSION = '5D.1.0.0';

const SHARED_PREVIEW_REUSE = Object.freeze({
  moduleId: REUSED_MODULE_IDS.SHARED_PREVIEW,
  reuseMode: 'identity_and_snapshot_shape',
  persistenceDelegated: false,
});

function canonicalSerialize(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value === undefined ? null : value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalSerialize(item)).join(',')}]`;
  }
  const keys = Object.keys(value).sort();
  const parts = keys.map(
    (key) => `${JSON.stringify(key)}:${canonicalSerialize(value[key])}`
  );
  return `{${parts.join(',')}}`;
}

function computePreviewVersion(content) {
  const hash = crypto
    .createHash('sha256')
    .update(canonicalSerialize(content))
    .digest('hex');
  return `5d-draft-preview-${hash.slice(0, 16)}`;
}

/**
 * Build an operator draft preview model (preview only — no persistence).
 *
 * @param {object} [input]
 * @param {object} [input.assembly]
 * @param {object} [input.draft]
 * @param {object} [input.validation]
 * @param {object} [input.generatorAdapter]
 * @param {object} [input.sharedPreviewSnapshot] optional Shared Preview reuse
 * @param {string} [input.generatedAt]
 */
function buildDraftPreviewModel(input = {}) {
  const assembly = input.assembly || null;
  const draft =
    (assembly && assembly.assembled) ||
    input.draft ||
    null;
  const validation = input.validation || null;
  const generatorAdapter = input.generatorAdapter || null;
  const generatedAt = input.generatedAt || '1970-01-01T00:00:00.000Z';

  const recruitment = (draft && draft.recruitmentMetadata) || {};
  const seo = (draft && draft.seoMetadata) || {};
  const editorial = (draft && draft.editorialMetadata) || {};

  const contentSummary = {
    draftId: draft && draft.draftId ? draft.draftId : null,
    sourceCandidateId:
      draft && draft.sourceCandidateId ? draft.sourceCandidateId : null,
    title: recruitment.title || null,
    department: recruitment.department || null,
    qualification: recruitment.qualification || null,
    state: recruitment.state || null,
    importantDates: Array.isArray(recruitment.importantDates)
      ? recruitment.importantDates
      : [],
    eligibility: recruitment.eligibility || null,
    selectionProcess: recruitment.selectionProcess || null,
    applicationProcess: recruitment.applicationProcess || null,
  };

  const missingSections =
    (validation && validation.missingSections) ||
    (assembly && assembly.missingRequired) ||
    [];

  const validationStatus = validation
    ? {
        status: validation.status,
        valid: validation.valid,
        errorCount: validation.errorCount,
        warningCount: validation.warningCount,
      }
    : {
        status: 'pending',
        valid: null,
        errorCount: 0,
        warningCount: 0,
      };

  const seoReadiness = {
    ready: validation ? Boolean(validation.seoReady) : Boolean(seo.metaTitle),
    metaTitle: seo.metaTitle || null,
    metaDescription: seo.metaDescription || null,
    slugHint: seo.slugHint || null,
    missingFields: (validation && validation.missingSeo) || [],
    reusedModule: REUSED_MODULE_IDS.SEO_DIAGNOSTICS,
  };

  const editorialReadiness = {
    ready: validation
      ? Boolean(validation.editorialReady)
      : Boolean(editorial.approved),
    approved: Boolean(editorial.approved),
    workflowState: editorial.workflowState || null,
    missingChecklist: (validation && validation.missingChecklist) || [],
    reusedModule: REUSED_MODULE_IDS.EDITORIAL_REVIEW,
  };

  const content = {
    schemaVersion: 1,
    previewKind: 'DRAFT_PREPARATION_PREVIEW',
    reusedModule: SHARED_PREVIEW_REUSE.moduleId,
    contentSummary,
    missingSections,
    validationStatus,
    seoReadiness,
    editorialReadiness,
    generatorCompatibility: generatorAdapter
      ? {
          compatible: Boolean(generatorAdapter.compatible),
          ready: Boolean(generatorAdapter.ready),
          missingCritical: generatorAdapter.missingCritical || [],
        }
      : null,
    sharedPreview: input.sharedPreviewSnapshot
      ? {
          reused: true,
          snapshotVersion: input.sharedPreviewSnapshot.snapshotVersion || null,
          integrityStatus:
            input.sharedPreviewSnapshot.integrity &&
            input.sharedPreviewSnapshot.integrity.status
              ? input.sharedPreviewSnapshot.integrity.status
              : null,
        }
      : {
          reused: false,
          snapshotVersion: null,
          integrityStatus: null,
        },
  };

  const previewVersion = computePreviewVersion(content);

  return deepFreeze({
    previewVersion: DRAFT_PREVIEW_MODEL_VERSION,
    advisoryOnly: true,
    previewOnly: true,
    persisted: false,
    published: false,
    productionDraftCreated: false,
    ready: Boolean(draft && draft.draftId),
    sharedPreviewReuse: SHARED_PREVIEW_REUSE,
    generatedAt,
    contentVersion: previewVersion,
    contentSummary,
    missingSections,
    validationStatus,
    seoReadiness,
    editorialReadiness,
    preview: {
      ...content,
      timestamp: generatedAt,
      contentVersion: previewVersion,
    },
  });
}

module.exports = {
  DRAFT_PREVIEW_MODEL_VERSION,
  SHARED_PREVIEW_REUSE,
  buildDraftPreviewModel,
  computePreviewVersion,
};
