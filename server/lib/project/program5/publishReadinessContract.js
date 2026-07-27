'use strict';

/**
 * PROGRAM 5 — Package 5F
 * Publish Readiness Contract (Versioned / Configuration-Driven)
 *
 * Versioned readiness model for controlled publish authorization assessment.
 * Advisory only. Does NOT publish, deploy, or mutate production state.
 */

function deepFreeze(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Object.isFrozen(value)) return value;
  Object.freeze(value);
  const keys = Array.isArray(value) ? value.keys() : Object.keys(value);
  for (const key of keys) deepFreeze(value[key]);
  return value;
}

const PUBLISH_READINESS_CONTRACT_VERSION = '5F.1.0.0';

const REUSED_MODULE_IDS = Object.freeze({
  PIPELINE_HEALTH: 'PIPELINE_HEALTH',
  MONITORING_REVIEW_INTEGRATION: 'MONITORING_REVIEW_INTEGRATION',
  CONTROLLED_LIFECYCLE_ENGINE: 'CONTROLLED_LIFECYCLE_ENGINE',
  DRAFT_PREPARATION: 'DRAFT_PREPARATION',
  CANDIDATE_RESOLUTION: 'CANDIDATE_RESOLUTION',
  EDITORIAL_REVIEW: 'EDITORIAL_REVIEW',
  SHARED_PREVIEW: 'SHARED_PREVIEW',
  SEO_DIAGNOSTICS: 'SEO_DIAGNOSTICS',
});

const LIFECYCLE_STATUS = Object.freeze({
  UNKNOWN: 'UNKNOWN',
  IN_PROGRESS: 'IN_PROGRESS',
  PUBLISH_READY: 'PUBLISH_READY',
  NOT_READY: 'NOT_READY',
  ARCHIVED: 'ARCHIVED',
});

const AUTHORIZATION_STATUS = Object.freeze({
  PENDING: 'PENDING',
  AUTHORIZED_FOR_ASSESSMENT: 'AUTHORIZED_FOR_ASSESSMENT',
  NOT_AUTHORIZED: 'NOT_AUTHORIZED',
  BLOCKED: 'BLOCKED',
});

/**
 * Default readiness field catalog — configuration-driven and extensible.
 */
const DEFAULT_READINESS_FIELD_CATALOG = deepFreeze([
  {
    fieldId: 'readinessId',
    label: 'Readiness ID',
    required: true,
    category: 'identity',
  },
  {
    fieldId: 'evaluationTimestamp',
    label: 'Evaluation Timestamp',
    required: true,
    category: 'identity',
  },
  {
    fieldId: 'platformVersion',
    label: 'Platform Version',
    required: true,
    category: 'platform',
  },
  {
    fieldId: 'lifecycleStatus',
    label: 'Lifecycle Status',
    required: true,
    category: 'lifecycle',
  },
  {
    fieldId: 'validationSummary',
    label: 'Validation Summary',
    required: true,
    category: 'validation',
  },
  {
    fieldId: 'authorizationStatus',
    label: 'Authorization Status',
    required: true,
    category: 'authorization',
  },
  {
    fieldId: 'outstandingRisks',
    label: 'Outstanding Risks',
    required: true,
    category: 'risk',
  },
  {
    fieldId: 'advisoryNotes',
    label: 'Advisory Notes',
    required: true,
    category: 'advisory',
  },
]);

function normalizeStringList(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (let i = 0; i < value.length; i += 1) {
    if (typeof value[i] === 'string' && value[i].trim()) {
      out.push(value[i].trim());
    }
  }
  return out;
}

function normalizeLifecycleStatus(value) {
  if (typeof value !== 'string') return LIFECYCLE_STATUS.UNKNOWN;
  const upper = value.trim().toUpperCase();
  if (Object.prototype.hasOwnProperty.call(LIFECYCLE_STATUS, upper)) {
    return upper;
  }
  if (upper === 'PUBLISH_READY') return LIFECYCLE_STATUS.PUBLISH_READY;
  return LIFECYCLE_STATUS.UNKNOWN;
}

function normalizeAuthorizationStatus(value) {
  if (typeof value !== 'string') return AUTHORIZATION_STATUS.NOT_AUTHORIZED;
  const upper = value.trim().toUpperCase();
  if (Object.prototype.hasOwnProperty.call(AUTHORIZATION_STATUS, upper)) {
    return upper;
  }
  return AUTHORIZATION_STATUS.NOT_AUTHORIZED;
}

/**
 * Create a versioned publish readiness contract.
 * Configuration-driven and extensible.
 *
 * @param {object} [options]
 * @param {string} [options.version]
 * @param {object[]} [options.fields]
 * @param {object} [options.extensions]
 */
function createPublishReadinessContract(options = {}) {
  const version =
    typeof options.version === 'string' && options.version.trim()
      ? options.version.trim()
      : PUBLISH_READINESS_CONTRACT_VERSION;

  const fields =
    Array.isArray(options.fields) && options.fields.length
      ? options.fields.map((f) => ({
          fieldId: String(f.fieldId),
          label: typeof f.label === 'string' ? f.label : String(f.fieldId),
          required: Boolean(f.required),
          category: typeof f.category === 'string' ? f.category : 'custom',
        }))
      : DEFAULT_READINESS_FIELD_CATALOG.map((f) => ({
          fieldId: f.fieldId,
          label: f.label,
          required: f.required,
          category: f.category,
        }));

  const fieldIds = fields.map((f) => f.fieldId);
  const extensions =
    options.extensions && typeof options.extensions === 'object'
      ? { ...options.extensions }
      : {};

  return deepFreeze({
    contractId: 'PUBLISH_READINESS_CONTRACT',
    contractVersion: version,
    packageId: 'PACKAGE_5F_CONTROLLED_PUBLISH_READINESS_AUTHORIZATION',
    configurationDriven: true,
    extensible: true,
    advisoryOnly: true,
    publishingDenied: true,
    deploymentDenied: true,
    productionMutationDenied: true,
    automaticApprovalDenied: true,
    fieldCount: fields.length,
    fieldIds,
    fields,
    lifecycleStatuses: Object.values(LIFECYCLE_STATUS),
    authorizationStatuses: Object.values(AUTHORIZATION_STATUS),
    reusedModules: REUSED_MODULE_IDS,
    extensions,
  });
}

function getDefaultPublishReadinessContract() {
  return createPublishReadinessContract();
}

/**
 * Build a versioned readiness model instance from evaluation inputs.
 *
 * @param {object} [input]
 * @param {string} [input.readinessId]
 * @param {string} [input.evaluationTimestamp]
 * @param {string} [input.platformVersion]
 * @param {string} [input.lifecycleStatus]
 * @param {object} [input.validationSummary]
 * @param {string} [input.authorizationStatus]
 * @param {string[]|object[]} [input.outstandingRisks]
 * @param {string[]} [input.advisoryNotes]
 * @param {object} [input.contract]
 * @param {object} [input.extensions]
 */
function createPublishReadinessModel(input = {}) {
  const contract = input.contract || getDefaultPublishReadinessContract();

  const readinessId =
    typeof input.readinessId === 'string' && input.readinessId.trim()
      ? input.readinessId.trim()
      : 'READINESS_UNASSIGNED';

  const evaluationTimestamp =
    typeof input.evaluationTimestamp === 'string' &&
    input.evaluationTimestamp.trim()
      ? input.evaluationTimestamp.trim()
      : '1970-01-01T00:00:00.000Z';

  const platformVersion =
    typeof input.platformVersion === 'string' && input.platformVersion.trim()
      ? input.platformVersion.trim()
      : '1.0.0';

  const lifecycleStatus = normalizeLifecycleStatus(input.lifecycleStatus);
  const authorizationStatus = normalizeAuthorizationStatus(
    input.authorizationStatus
  );

  const validationSummary =
    input.validationSummary && typeof input.validationSummary === 'object'
      ? {
          valid: Boolean(input.validationSummary.valid),
          gatePassCount: Number(input.validationSummary.gatePassCount) || 0,
          gateWarningCount:
            Number(input.validationSummary.gateWarningCount) || 0,
          gateBlockedCount:
            Number(input.validationSummary.gateBlockedCount) || 0,
          summary:
            typeof input.validationSummary.summary === 'string'
              ? input.validationSummary.summary
              : '',
        }
      : {
          valid: false,
          gatePassCount: 0,
          gateWarningCount: 0,
          gateBlockedCount: 0,
          summary: 'Validation not evaluated',
        };

  const outstandingRisks = Array.isArray(input.outstandingRisks)
    ? input.outstandingRisks.map((risk) => {
        if (typeof risk === 'string') {
          return { code: risk, severity: 'WARNING', message: risk };
        }
        return {
          code: typeof risk.code === 'string' ? risk.code : 'UNKNOWN_RISK',
          severity:
            typeof risk.severity === 'string' ? risk.severity : 'WARNING',
          message:
            typeof risk.message === 'string' ? risk.message : String(risk.code),
        };
      })
    : [];

  const advisoryNotes = normalizeStringList(input.advisoryNotes);
  const extensions =
    input.extensions && typeof input.extensions === 'object'
      ? { ...input.extensions }
      : {};

  return deepFreeze({
    modelId: 'PUBLISH_READINESS_MODEL',
    contractVersion: contract.contractVersion,
    advisoryOnly: true,
    productionRecord: false,
    published: false,
    deployed: false,
    readinessId,
    evaluationTimestamp,
    platformVersion,
    lifecycleStatus,
    validationSummary,
    authorizationStatus,
    outstandingRisks,
    advisoryNotes,
    reusedModules: REUSED_MODULE_IDS,
    extensions,
  });
}

module.exports = {
  PUBLISH_READINESS_CONTRACT_VERSION,
  REUSED_MODULE_IDS,
  LIFECYCLE_STATUS,
  AUTHORIZATION_STATUS,
  DEFAULT_READINESS_FIELD_CATALOG,
  deepFreeze,
  createPublishReadinessContract,
  getDefaultPublishReadinessContract,
  createPublishReadinessModel,
  normalizeLifecycleStatus,
  normalizeAuthorizationStatus,
};
