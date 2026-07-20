'use strict';

/**
 * PROGRAM 5 — Package 5D
 * Draft Preparation Contract (Versioned / Configuration-Driven)
 *
 * Versioned draft preparation model converting approved Human Review
 * payloads into draft-ready recruitment artifacts.
 *
 * Advisory only. Does NOT create production drafts.
 * Does NOT publish. Does NOT activate runtime automation.
 */

function deepFreeze(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Object.isFrozen(value)) return value;
  Object.freeze(value);
  const keys = Array.isArray(value) ? value.keys() : Object.keys(value);
  for (const key of keys) deepFreeze(value[key]);
  return value;
}

const DRAFT_PREPARATION_CONTRACT_VERSION = '5D.1.0.0';

const DRAFT_LIFECYCLE_STATES = Object.freeze({
  PENDING_ASSEMBLY: 'pending_assembly',
  ASSEMBLED: 'assembled',
  VALIDATED: 'validated',
  GENERATOR_READY: 'generator_ready',
  PREVIEW_READY: 'preview_ready',
  BLOCKED: 'blocked',
});

const REUSED_MODULE_IDS = Object.freeze({
  RECRUITMENT_OPERATIONS: 'RECRUITMENT_OPERATIONS',
  EDITORIAL_REVIEW: 'EDITORIAL_REVIEW',
  SHARED_PREVIEW: 'SHARED_PREVIEW',
  CONTROLLED_LIFECYCLE_ENGINE: 'CONTROLLED_LIFECYCLE_ENGINE',
  MONITORING_REVIEW_INTEGRATION: 'MONITORING_REVIEW_INTEGRATION',
  SEO_DIAGNOSTICS: 'SEO_DIAGNOSTICS',
  GENERATOR: 'GENERATOR',
});

/**
 * Default field catalog — configuration-driven and extensible.
 */
const DEFAULT_DRAFT_FIELD_CATALOG = deepFreeze([
  {
    fieldId: 'draftId',
    label: 'Draft ID',
    required: true,
    category: 'identity',
  },
  {
    fieldId: 'sourceCandidateId',
    label: 'Source Candidate ID',
    required: true,
    category: 'identity',
  },
  {
    fieldId: 'lifecycleState',
    label: 'Lifecycle State',
    required: true,
    category: 'lifecycle',
  },
  {
    fieldId: 'reviewReference',
    label: 'Review Reference',
    required: true,
    category: 'review',
  },
  {
    fieldId: 'recruitmentMetadata',
    label: 'Recruitment Metadata',
    required: true,
    category: 'recruitment',
  },
  {
    fieldId: 'seoMetadata',
    label: 'SEO Metadata',
    required: false,
    category: 'seo',
  },
  {
    fieldId: 'editorialMetadata',
    label: 'Editorial Metadata',
    required: true,
    category: 'editorial',
  },
  {
    fieldId: 'validationSummary',
    label: 'Validation Summary',
    required: true,
    category: 'validation',
  },
  {
    fieldId: 'generatedTimestamp',
    label: 'Generated Timestamp',
    required: true,
    category: 'audit',
  },
  {
    fieldId: 'advisoryNotes',
    label: 'Advisory Notes',
    required: false,
    category: 'advisory',
  },
]);

function normalizeDraftLifecycleState(value) {
  if (value == null || value === '') return null;
  const raw = String(value).trim();
  const upper = raw.toUpperCase().replace(/[\s-]+/g, '_');
  if (Object.prototype.hasOwnProperty.call(DRAFT_LIFECYCLE_STATES, upper)) {
    return DRAFT_LIFECYCLE_STATES[upper];
  }
  const lower = raw.toLowerCase().replace(/[\s-]+/g, '_');
  const match = Object.values(DRAFT_LIFECYCLE_STATES).find((s) => s === lower);
  return match || null;
}

/**
 * Create a configuration-driven draft preparation contract definition.
 *
 * @param {object} [options]
 * @param {string} [options.version]
 * @param {object[]} [options.fields]
 * @param {object} [options.extensions] extensible advisory metadata
 */
function createDraftPreparationContract(options = {}) {
  const fields =
    Array.isArray(options.fields) && options.fields.length
      ? options.fields.map((f) => ({
          fieldId: String(f.fieldId),
          label: f.label != null ? String(f.label) : String(f.fieldId),
          required: Boolean(f.required),
          category: f.category != null ? String(f.category) : 'custom',
        }))
      : DEFAULT_DRAFT_FIELD_CATALOG.map((f) => ({ ...f }));

  const fieldIds = fields.map((f) => f.fieldId);
  const byId = {};
  for (const field of fields) {
    byId[field.fieldId] = field;
  }

  return deepFreeze({
    contractVersion: options.version || DRAFT_PREPARATION_CONTRACT_VERSION,
    configurationDriven: true,
    advisoryOnly: true,
    extensible: true,
    productionDraftCreationDenied: true,
    publishingDenied: true,
    runtimeAutomationDenied: true,
    fieldCount: fields.length,
    fieldIds,
    fields,
    byId,
    lifecycleStates: Object.assign({}, DRAFT_LIFECYCLE_STATES),
    reusedModules: REUSED_MODULE_IDS,
    extensions:
      options.extensions && typeof options.extensions === 'object'
        ? options.extensions
        : {},
  });
}

function getDefaultDraftPreparationContract() {
  return createDraftPreparationContract();
}

/**
 * Build a versioned draft preparation model instance (advisory artifact).
 *
 * @param {object} [input]
 */
function createDraftPreparationModel(input = {}) {
  const contract =
    input.contract || getDefaultDraftPreparationContract();

  const lifecycleState =
    normalizeDraftLifecycleState(input.lifecycleState) ||
    DRAFT_LIFECYCLE_STATES.PENDING_ASSEMBLY;

  const model = {
    contractVersion: contract.contractVersion,
    advisoryOnly: true,
    productionDraft: false,
    persisted: false,
    published: false,
    draftId: input.draftId != null ? String(input.draftId) : null,
    sourceCandidateId:
      input.sourceCandidateId != null ? String(input.sourceCandidateId) : null,
    lifecycleState,
    reviewReference:
      input.reviewReference && typeof input.reviewReference === 'object'
        ? {
            candidateId:
              input.reviewReference.candidateId != null
                ? String(input.reviewReference.candidateId)
                : null,
            workflowState:
              input.reviewReference.workflowState != null
                ? String(input.reviewReference.workflowState)
                : null,
            recruitmentId:
              input.reviewReference.recruitmentId != null
                ? Number(input.reviewReference.recruitmentId)
                : null,
            draftBindingId:
              input.reviewReference.draftBindingId != null
                ? Number(input.reviewReference.draftBindingId)
                : null,
            approved: Boolean(input.reviewReference.approved),
          }
        : {
            candidateId: null,
            workflowState: null,
            recruitmentId: null,
            draftBindingId: null,
            approved: false,
          },
    recruitmentMetadata:
      input.recruitmentMetadata && typeof input.recruitmentMetadata === 'object'
        ? input.recruitmentMetadata
        : {},
    seoMetadata:
      input.seoMetadata && typeof input.seoMetadata === 'object'
        ? input.seoMetadata
        : {},
    editorialMetadata:
      input.editorialMetadata && typeof input.editorialMetadata === 'object'
        ? input.editorialMetadata
        : {},
    validationSummary:
      input.validationSummary && typeof input.validationSummary === 'object'
        ? input.validationSummary
        : {
            status: 'pending',
            errorCount: 0,
            warningCount: 0,
            issues: [],
          },
    generatedTimestamp:
      input.generatedTimestamp != null
        ? String(input.generatedTimestamp)
        : '1970-01-01T00:00:00.000Z',
    advisoryNotes: Array.isArray(input.advisoryNotes)
      ? input.advisoryNotes.map(String)
      : [],
    extensions:
      input.extensions && typeof input.extensions === 'object'
        ? input.extensions
        : {},
  };

  return deepFreeze(model);
}

module.exports = {
  DRAFT_PREPARATION_CONTRACT_VERSION,
  DRAFT_LIFECYCLE_STATES,
  REUSED_MODULE_IDS,
  DEFAULT_DRAFT_FIELD_CATALOG,
  deepFreeze,
  normalizeDraftLifecycleState,
  createDraftPreparationContract,
  getDefaultDraftPreparationContract,
  createDraftPreparationModel,
};
