'use strict';

/**
 * PROGRAM 5 — Package 5D
 * Controlled Draft Preparation Framework
 *
 * Converts an approved Human Review payload into a draft-ready
 * recruitment artifact.
 *
 * This package prepares draft data only.
 * It must NOT create production drafts.
 * It must NOT publish content.
 * It must NOT activate runtime automation.
 *
 * Deep frozen. Deterministic. Version 1.0.0.
 *
 * Reuses Program 4 / 5A / 5B / 5C module identities:
 *   Recruitment Operations, Editorial Review, Shared Preview,
 *   Controlled Lifecycle Engine, Monitoring Review Integration,
 *   SEO Diagnostics, Existing Generator.
 */

const {
  DRAFT_PREPARATION_CONTRACT_VERSION,
  DRAFT_LIFECYCLE_STATES,
  REUSED_MODULE_IDS,
  DEFAULT_DRAFT_FIELD_CATALOG,
  deepFreeze,
  normalizeDraftLifecycleState,
  createDraftPreparationContract,
  getDefaultDraftPreparationContract,
  createDraftPreparationModel,
} = require('./draftPreparationContract');

const {
  DRAFT_ASSEMBLY_ENGINE_VERSION,
  DEFAULT_ASSEMBLY_SECTION_CONFIG,
  createDraftAssemblyDefinition,
  getDefaultDraftAssemblyDefinition,
  assembleDraftFromReviewPayload,
} = require('./draftAssemblyEngine');

const {
  DRAFT_VALIDATION_VERSION,
  DIAGNOSTIC_SEVERITY,
  DIAGNOSTIC_CODES,
  DEFAULT_REQUIRED_SECTIONS,
  DEFAULT_EDITORIAL_CHECKLIST,
  DEFAULT_SEO_REQUIRED_FIELDS,
  validatePreparedDraft,
} = require('./draftValidation');

const {
  GENERATOR_ADAPTER_VERSION,
  GENERATOR_PAYLOAD_FIELDS,
  adaptPreparedDraftToGenerator,
} = require('./generatorAdapter');

const {
  DRAFT_PREVIEW_MODEL_VERSION,
  SHARED_PREVIEW_REUSE,
  buildDraftPreviewModel,
  computePreviewVersion,
} = require('./draftPreviewModel');

const {
  DRAFT_READINESS_REPORT_VERSION,
  generateDraftReadinessReport,
} = require('./draftReadinessReport');

const {
  DRAFT_DIAGNOSTICS_VERSION,
  REMAINING_GATES,
  buildDraftDiagnostics,
} = require('./draftDiagnostics');

const FRAMEWORK_VERSION = '1.0.0';

const PROGRAM_ID = 'PROGRAM_5_CONTROLLED_AUTOMATION_WIRING';
const PACKAGE_ID = 'PACKAGE_5D_DRAFT_PREPARATION_FRAMEWORK';
const PACKAGE_NAME = 'Controlled Draft Preparation Framework';
const PACKAGE_CODE = '5D';

const GAP_ADDRESSED = 'GAP_FC_DRAFT_PREPARATION_FRAMEWORK';

const OBJECTIVE =
  'Create a controlled Draft Preparation Framework that converts an approved Human Review payload into a draft-ready recruitment artifact — preparation only, no production drafts.';

const OUT_OF_SCOPE = Object.freeze([
  'DRAFT_PERSISTENCE',
  'DATABASE_WRITES',
  'AUTOMATIC_DRAFT_CREATION',
  'AUTOMATIC_SAVING',
  'PUBLISHING',
  'SCHEDULERS',
  'WORKERS',
  'REDIS',
  'POLLING',
  'AI_CONTENT_GENERATION',
  'RUNTIME_ACTIVATION',
]);

const PROHIBITED = Object.freeze([
  'DEPLOYMENT',
  'GITHUB',
  'VPS',
  'SQL_SCHEMA_REDESIGN',
  'RUNTIME_WIRING',
  'AUTOMATIC_DRAFT_GENERATION',
  'PRODUCTION_DRAFT_INSERTION',
]);

const CAPABILITIES = Object.freeze([
  'DRAFT_PREPARATION_CONTRACT',
  'DRAFT_ASSEMBLY_ENGINE',
  'DRAFT_VALIDATION',
  'GENERATOR_ADAPTER',
  'DRAFT_PREVIEW_MODEL',
  'DRAFT_READINESS_REPORT',
  'DRAFT_DIAGNOSTICS',
]);

/**
 * Run the full advisory Draft Preparation pipeline.
 * Pure / deterministic. No side effects. No production drafts.
 *
 * @param {object} [input]
 * @param {object} [input.reviewPayload] approved Human Review payload
 * @param {object} [input.sections]
 * @param {object} [input.seoHints]
 * @param {object} [input.assemblyOptions]
 * @param {object} [input.validationOptions]
 * @param {object} [input.adapterOverrides]
 * @param {object} [input.sharedPreviewSnapshot]
 * @param {string} [input.generatedTimestamp]
 * @param {string} [input.draftId]
 * @param {string} [input.lifecycleStateHint]
 * @param {boolean} [input.approved]
 * @param {string[]} [input.satisfiedGates]
 * @param {string[]} [input.availablePrerequisites]
 */
function prepareDraftFromReviewPayload(input = {}) {
  const assembly = assembleDraftFromReviewPayload({
    reviewPayload: input.reviewPayload,
    sections: input.sections,
    seoHints: input.seoHints,
    assemblyOptions: input.assemblyOptions,
    generatedTimestamp: input.generatedTimestamp,
    draftId: input.draftId,
    lifecycleStateHint: input.lifecycleStateHint,
    approved: input.approved,
    reviewApproved: input.reviewApproved,
    editorialChecklistHints: input.editorialChecklistHints,
    sourceCandidateId: input.sourceCandidateId,
  });

  const validation = validatePreparedDraft({
    assembly,
    ...(input.validationOptions || {}),
    lifecycleStateHint:
      (input.validationOptions && input.validationOptions.lifecycleStateHint) ||
      input.lifecycleStateHint,
  });

  const generatorAdapter = adaptPreparedDraftToGenerator({
    assembly,
    validation,
    overrides: input.adapterOverrides,
  });

  const preview = buildDraftPreviewModel({
    assembly,
    validation,
    generatorAdapter,
    sharedPreviewSnapshot: input.sharedPreviewSnapshot,
    generatedAt: input.generatedTimestamp || '1970-01-01T00:00:00.000Z',
  });

  const readiness = generateDraftReadinessReport({
    assembly,
    validation,
    generatorAdapter,
    preview,
  });

  const diagnostics = buildDraftDiagnostics({
    assembly,
    validation,
    generatorAdapter,
    preview,
    readiness,
    satisfiedGates: input.satisfiedGates,
    availablePrerequisites: input.availablePrerequisites,
  });

  return deepFreeze({
    advisoryOnly: true,
    packageId: PACKAGE_ID,
    packageCode: PACKAGE_CODE,
    configurationDriven: true,
    assembly,
    validation,
    generatorAdapter,
    preview,
    readiness,
    diagnostics,
    effects: {
      productionDraftCreated: false,
      draftSaved: false,
      draftPersisted: false,
      contentPublished: false,
      runtimeAutomationActivated: false,
      schedulerStarted: false,
      workerStarted: false,
      redisUsed: false,
      aiGenerated: false,
      externalApiCalled: false,
      databaseWritten: false,
    },
  });
}

function getDraftPreparationFrameworkIdentity() {
  return deepFreeze({
    frameworkVersion: FRAMEWORK_VERSION,
    programId: PROGRAM_ID,
    packageId: PACKAGE_ID,
    packageCode: PACKAGE_CODE,
    packageName: PACKAGE_NAME,
    gapAddressed: GAP_ADDRESSED,
    advisoryOnly: true,
  });
}

function getDraftPreparationFramework() {
  return deepFreeze({
    frameworkVersion: FRAMEWORK_VERSION,
    programId: PROGRAM_ID,
    packageId: PACKAGE_ID,
    packageCode: PACKAGE_CODE,
    packageName: PACKAGE_NAME,
    gapAddressed: GAP_ADDRESSED,
    objective: OBJECTIVE,
    advisoryOnly: true,
    configurationDriven: true,
    productionSafe: true,
    program5PackageStarted: true,
    program5AutomationAuthorized: false,
    package5AComplete: true,
    package5BComplete: true,
    package5CComplete: true,
    package5EReady: true,

    advisoryOnlyFlags: {
      advisoryOnly: true,
      preparesDraftDataOnly: true,
      createsProductionDrafts: false,
      automaticDraftCreation: false,
      automaticSaving: false,
      publishesContent: false,
      activatesRuntimeAutomation: false,
      aiContentGeneration: false,
      executionEngine: false,
    },

    capabilities: CAPABILITIES.slice(),
    outOfScope: OUT_OF_SCOPE.slice(),
    prohibited: PROHIBITED.slice(),

    contractVersion: DRAFT_PREPARATION_CONTRACT_VERSION,
    assemblyVersion: DRAFT_ASSEMBLY_ENGINE_VERSION,
    validationVersion: DRAFT_VALIDATION_VERSION,
    generatorAdapterVersion: GENERATOR_ADAPTER_VERSION,
    previewModelVersion: DRAFT_PREVIEW_MODEL_VERSION,
    readinessReportVersion: DRAFT_READINESS_REPORT_VERSION,
    diagnosticsVersion: DRAFT_DIAGNOSTICS_VERSION,

    draftLifecycleStates: Object.assign({}, DRAFT_LIFECYCLE_STATES),
    diagnosticSeverities: Object.values(DIAGNOSTIC_SEVERITY),
    diagnosticCodes: Object.values(DIAGNOSTIC_CODES),
    generatorPayloadFields: GENERATOR_PAYLOAD_FIELDS.slice(),
    remainingGates: REMAINING_GATES.slice(),
    reusedModules: REUSED_MODULE_IDS,
    defaultFieldCatalog: DEFAULT_DRAFT_FIELD_CATALOG,
    defaultAssemblySections: DEFAULT_ASSEMBLY_SECTION_CONFIG,
    defaultRequiredSections: DEFAULT_REQUIRED_SECTIONS.slice(),
    defaultEditorialChecklist: DEFAULT_EDITORIAL_CHECKLIST.slice(),
    defaultSeoRequiredFields: DEFAULT_SEO_REQUIRED_FIELDS.slice(),
    sharedPreviewReuse: SHARED_PREVIEW_REUSE,

    safetyBoundaries: {
      boundariesIdentity: 'SAFETY_PACKAGE_5D_DRAFT_PREPARATION_FRAMEWORK',
      advisoryOnly: true,
      runtimeIntegrationDenied: true,
      featureActivationDenied: true,
      sqlSchemaRedesignDenied: true,
      databaseChangesDenied: true,
      apiCreationDenied: true,
      routeCreationDenied: true,
      schedulerDenied: true,
      workerDenied: true,
      redisDenied: true,
      pollingDenied: true,
      publishingDenied: true,
      draftPersistenceDenied: true,
      automaticDraftCreationDenied: true,
      automaticSavingDenied: true,
      productionDraftInsertionDenied: true,
      aiContentGenerationDenied: true,
      runtimeActivationDenied: true,
      githubDenied: true,
      deploymentDenied: true,
      vpsDenied: true,
      productionChangesDenied: true,
      hardDeniedActions: [
        'DENIED_RUNTIME_WIRING',
        'DENIED_FEATURE_ACTIVATION',
        'DENIED_SQL_SCHEMA_REDESIGN',
        'DENIED_DRAFT_PERSISTENCE',
        'DENIED_DATABASE_WRITES',
        'DENIED_AUTOMATIC_DRAFT_CREATION',
        'DENIED_AUTOMATIC_SAVING',
        'DENIED_PUBLISHING',
        'DENIED_SCHEDULERS',
        'DENIED_WORKERS',
        'DENIED_REDIS',
        'DENIED_POLLING',
        'DENIED_AI_CONTENT_GENERATION',
        'DENIED_RUNTIME_ACTIVATION',
        'DENIED_PRODUCTION_DRAFT_INSERTION',
        'DENIED_GITHUB',
        'DENIED_DEPLOYMENT',
        'DENIED_VPS',
        'DENIED_PRODUCTION_CHANGES',
      ],
    },

    runtimeEffects: {
      effectsIdentity: 'RUNTIME_EFFECTS_PACKAGE_5D',
      runtimeActivated: false,
      databaseChanged: false,
      sqlExecuted: false,
      apiCreated: false,
      routesCreated: false,
      schedulerModified: false,
      workerModified: false,
      redisUsed: false,
      pollingEnabled: false,
      publishingExecuted: false,
      draftPersisted: false,
      productionDraftCreated: false,
      automaticDraftGenerated: false,
      filesystemWritten: false,
      networkAccessed: false,
      githubAccessed: false,
      deploymentExecuted: false,
      productionImpact: false,
      productionBehaviorChanged: false,
      featureActivated: false,
      automaticProcessingEnabled: false,
    },

    packageSummary: {
      summaryIdentity: 'SUMMARY_PACKAGE_5D',
      status: 'DRAFT_PREPARATION_FRAMEWORK_COMPLETE',
      purpose:
        'Deliver a complete advisory Draft Preparation Framework that converts approved review payloads into draft-ready artifacts without creating production drafts.',
      nextPackage: '5E',
      automatesRecruitment: false,
      deploymentAuthorized: false,
      automaticDraftCreationAuthorized: false,
      productionDraftInsertionAuthorized: false,
    },

    recommendation:
      'DRAFT_PREPARATION_FRAMEWORK_COMPLETE_ADVISORY_ONLY_READY_FOR_PACKAGE_5E',
  });
}

module.exports = {
  FRAMEWORK_VERSION,
  PROGRAM_ID,
  PACKAGE_ID,
  PACKAGE_NAME,
  PACKAGE_CODE,
  GAP_ADDRESSED,
  OBJECTIVE,
  OUT_OF_SCOPE,
  PROHIBITED,
  CAPABILITIES,
  DRAFT_PREPARATION_CONTRACT_VERSION,
  DRAFT_LIFECYCLE_STATES,
  REUSED_MODULE_IDS,
  DEFAULT_DRAFT_FIELD_CATALOG,
  DRAFT_ASSEMBLY_ENGINE_VERSION,
  DEFAULT_ASSEMBLY_SECTION_CONFIG,
  DRAFT_VALIDATION_VERSION,
  DIAGNOSTIC_SEVERITY,
  DIAGNOSTIC_CODES,
  DEFAULT_REQUIRED_SECTIONS,
  DEFAULT_EDITORIAL_CHECKLIST,
  DEFAULT_SEO_REQUIRED_FIELDS,
  GENERATOR_ADAPTER_VERSION,
  GENERATOR_PAYLOAD_FIELDS,
  DRAFT_PREVIEW_MODEL_VERSION,
  SHARED_PREVIEW_REUSE,
  DRAFT_READINESS_REPORT_VERSION,
  DRAFT_DIAGNOSTICS_VERSION,
  REMAINING_GATES,
  deepFreeze,
  normalizeDraftLifecycleState,
  createDraftPreparationContract,
  getDefaultDraftPreparationContract,
  createDraftPreparationModel,
  createDraftAssemblyDefinition,
  getDefaultDraftAssemblyDefinition,
  assembleDraftFromReviewPayload,
  validatePreparedDraft,
  adaptPreparedDraftToGenerator,
  buildDraftPreviewModel,
  computePreviewVersion,
  generateDraftReadinessReport,
  buildDraftDiagnostics,
  prepareDraftFromReviewPayload,
  getDraftPreparationFramework,
  getDraftPreparationFrameworkIdentity,
};
