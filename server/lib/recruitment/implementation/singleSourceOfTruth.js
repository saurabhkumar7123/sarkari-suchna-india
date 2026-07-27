'use strict';

/**
 * PROGRAM 1 — Package 1A
 * Single Source of Truth
 * (Implementation Planning Only)
 *
 * Defines the official implementation references for the Recruitment
 * project. This becomes the ONLY implementation authority mapping to
 * Stages 8–12, WP specifications, existing production code, and
 * existing recruitment implementation artifacts.
 *
 * Conceptual path references only. No runtime module loading.
 * No production coupling. No execution.
 *
 * Functions:
 *   getSingleSourceOfTruth()
 */

const SINGLE_SOURCE_OF_TRUTH_VERSION = '1.0.0';

function deepFreeze(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Object.isFrozen(value)) return value;
  Object.freeze(value);
  const keys = Array.isArray(value) ? value.keys() : Object.keys(value);
  for (const key of keys) deepFreeze(value[key]);
  return value;
}

const SINGLE_SOURCE_OF_TRUTH = deepFreeze({
  version: SINGLE_SOURCE_OF_TRUTH_VERSION,
  program: 'PROGRAM_1_IMPLEMENTATION_AUTHORITY_AND_PROJECT_FREEZE',
  package: 'PACKAGE_1A_ARCHITECTURE_FREEZE_AND_SINGLE_SOURCE_OF_TRUTH',
  implementationPlanning: true,
  architectureFrozen: true,
  singleSourceOfTruth: true,
  productionSafe: true,
  runtimeActivated: false,
  databaseExecuted: false,
  apiActivated: false,
  publishingExecuted: false,
  architectureExpanded: false,
  productionCoupled: false,
  packageStage: 'SINGLE_SOURCE_OF_TRUTH_DEFINED',

  authorityStatement: {
    statementIdentity: 'STATEMENT_SSOT_AUTHORITY',
    statement:
      'Package 1A establishes the only implementation authority baseline. All implementation work must trace to the mappings defined here.',
    soleAuthority: true,
    competingReferencesDenied: true,
  },

  stageReferences: {
    referencesIdentity: 'REFERENCES_STAGES_8_THROUGH_12',
    stages: [
      {
        stage: 8,
        stageName: 'Production Implementation Blueprint',
        completionPhase: 433,
        status: 'COMPLETE',
        conceptualPath:
          'server/lib/recruitment/shadow/shadowStage8CompletionCertificationFramework.js',
        role: 'IMPLEMENTATION_BLUEPRINT_AUTHORITY',
      },
      {
        stage: 9,
        stageName: 'Database Implementation Design & Migration Planning',
        completionPhase: 456,
        status: 'COMPLETE',
        conceptualPath:
          'server/lib/recruitment/shadow/shadowStage9DatabaseCompletionCertificationFramework.js',
        role: 'DATABASE_IMPLEMENTATION_AUTHORITY',
      },
      {
        stage: 10,
        stageName: 'Application Layer Implementation Blueprint',
        completionPhase: 479,
        status: 'COMPLETE',
        conceptualPath:
          'server/lib/recruitment/shadow/shadowStage10ApplicationCompletionCertificationFramework.js',
        role: 'APPLICATION_IMPLEMENTATION_AUTHORITY',
      },
      {
        stage: 11,
        stageName: 'API Layer & Interface Architecture Blueprint',
        completionPhase: 502,
        status: 'COMPLETE',
        conceptualPath:
          'server/lib/recruitment/shadow/shadowStage11ApiCompletionCertificationFramework.js',
        role: 'API_IMPLEMENTATION_AUTHORITY',
      },
      {
        stage: 12,
        stageName: 'Admin & Management Layer Architecture Blueprint',
        completionPhase: 529,
        status: 'COMPLETE',
        conceptualPath:
          'server/lib/recruitment/shadow/shadowStage12AdminCompletionCertificationFramework.js',
        role: 'ADMIN_IMPLEMENTATION_AUTHORITY',
      },
    ],
    supportingStageArtifacts: [
      {
        artifact: 'IMPLEMENTATION_WORK_PACKAGE_REGISTRY',
        conceptualPath:
          'server/lib/recruitment/shadow/shadowImplementationWorkPackageRegistry.js',
        role: 'WP_LAYER_REGISTRY_AUTHORITY',
      },
      {
        artifact: 'IMPLEMENTATION_LAYER_MAP',
        conceptualPath:
          'server/lib/recruitment/shadow/shadowImplementationLayerMap.js',
        role: 'LAYER_MAPPING_AUTHORITY',
      },
    ],
  },

  workPackageSpecifications: {
    specificationsIdentity: 'SPECIFICATIONS_RECRUITMENT_WORK_PACKAGES',
    directory: 'server/lib/recruitment/workPackages',
    packages: [
      {
        packageId: 'WP_SHADOW_UPDATE_INGESTION',
        conceptualPath:
          'server/lib/recruitment/workPackages/WP_SHADOW_UPDATE_INGESTION.js',
        role: 'SHADOW_INGESTION_SPEC',
      },
      {
        packageId: 'WP_RECRUITMENT_IDENTIFICATION',
        conceptualPath:
          'server/lib/recruitment/workPackages/WP_RECRUITMENT_IDENTIFICATION.js',
        role: 'IDENTIFICATION_SPEC',
      },
      {
        packageId: 'WP_LIFECYCLE_CLASSIFICATION',
        conceptualPath:
          'server/lib/recruitment/workPackages/WP_LIFECYCLE_CLASSIFICATION.js',
        role: 'LIFECYCLE_SPEC',
      },
      {
        packageId: 'WP_DRAFT_LINKAGE',
        conceptualPath:
          'server/lib/recruitment/workPackages/WP_DRAFT_LINKAGE.js',
        role: 'LINKAGE_SPEC',
      },
      {
        packageId: 'WP_RECRUITMENT_GROUPING',
        conceptualPath:
          'server/lib/recruitment/workPackages/WP_RECRUITMENT_GROUPING.js',
        role: 'GROUPING_SPEC',
      },
      {
        packageId: 'WP_TIMELINE_GENERATION',
        conceptualPath:
          'server/lib/recruitment/workPackages/WP_TIMELINE_GENERATION.js',
        role: 'TIMELINE_SPEC',
      },
      {
        packageId: 'WP_VALIDATION_AND_QUALITY_GATES',
        conceptualPath:
          'server/lib/recruitment/workPackages/WP_VALIDATION_AND_QUALITY_GATES.js',
        role: 'VALIDATION_SPEC',
      },
      {
        packageId: 'WP_PUBLISH_READINESS',
        conceptualPath:
          'server/lib/recruitment/workPackages/WP_PUBLISH_READINESS.js',
        role: 'PUBLISH_READINESS_SPEC',
      },
      {
        packageId: 'WP_CONTROLLED_PUBLISHING',
        conceptualPath:
          'server/lib/recruitment/workPackages/WP_CONTROLLED_PUBLISHING.js',
        role: 'CONTROLLED_PUBLISHING_SPEC',
      },
      {
        packageId: 'WP_IMPLEMENTATION_TRANSITION_PLAN',
        conceptualPath:
          'server/lib/recruitment/workPackages/WP_IMPLEMENTATION_TRANSITION_PLAN.js',
        role: 'TRANSITION_PLAN_SPEC',
      },
    ],
    layerWorkPackages: [
      'WP-FOUNDATION',
      'WP-DOMAIN',
      'WP-APPLICATION',
      'WP-INFRASTRUCTURE',
      'WP-INTEGRATION',
      'WP-PUBLISHING',
      'WP-MONITORING',
      'WP-ADMIN',
      'WP-GENERATOR',
      'WP-PRESENTATION',
    ],
  },

  existingProductionCode: {
    productionIdentity: 'EXISTING_PRODUCTION_CODE_REFERENCES',
    role: 'PROTECTED_RUNTIME_REFERENCE_ONLY',
    surfaces: [
      {
        surface: 'orchestrator',
        conceptualPath: 'server/lib/recruitment/orchestrator.js',
        rule: 'REFERENCE_ONLY_DO_NOT_MODIFY_FROM_PACKAGE_1A',
      },
      {
        surface: 'coordinator',
        conceptualPath: 'server/lib/recruitment/coordinator.js',
        rule: 'REFERENCE_ONLY_DO_NOT_MODIFY_FROM_PACKAGE_1A',
      },
      {
        surface: 'gateway',
        conceptualPath: 'server/lib/recruitment/gateway.js',
        rule: 'REFERENCE_ONLY_DO_NOT_MODIFY_FROM_PACKAGE_1A',
      },
      {
        surface: 'pipeline',
        conceptualPath: 'server/lib/recruitment/pipeline.js',
        rule: 'REFERENCE_ONLY_DO_NOT_MODIFY_FROM_PACKAGE_1A',
      },
      {
        surface: 'worker',
        conceptualPath: 'server/worker.js',
        rule: 'REFERENCE_ONLY_DO_NOT_MODIFY_FROM_PACKAGE_1A',
      },
    ],
    couplingDenied: true,
    importDenied: true,
    activationDenied: true,
  },

  existingRecruitmentImplementation: {
    implementationIdentity: 'EXISTING_RECRUITMENT_IMPLEMENTATION_REFERENCES',
    role: 'EXISTING_IMPLEMENTATION_CONTEXT_ONLY',
    references: [
      {
        reference: 'SHADOW_PLANNING_CORPUS',
        conceptualPath: 'server/lib/recruitment/shadow',
        role: 'COMPLETED_ARCHITECTURE_PLANNING_CORPUS',
      },
      {
        reference: 'WORK_PACKAGE_SPECIFICATIONS',
        conceptualPath: 'server/lib/recruitment/workPackages',
        role: 'COMPLETED_WP_SPECIFICATION_CORPUS',
      },
      {
        reference: 'IMPLEMENTATION_PLANNING_ROOT',
        conceptualPath: 'server/lib/recruitment/implementation',
        role: 'IMPLEMENTATION_AUTHORITY_ROOT',
      },
    ],
    executionDenied: true,
  },

  mappingRules: {
    rulesIdentity: 'RULES_SSOT_MAPPING',
    rules: [
      'ALL_IMPLEMENTATION_MUST_TRACE_TO_STAGE_8_THROUGH_12',
      'WP_SPECIFICATIONS_ARE_BINDING_IMPLEMENTATION_INPUTS',
      'EXISTING_PRODUCTION_CODE_IS_PROTECTED_REFERENCE',
      'NO_RUNTIME_IMPORT_OF_SSOT_TARGETS_FROM_THIS_PACKAGE',
      'CONCEPTUAL_PATHS_ARE_DOCUMENTATION_NOT_MODULE_LOADING',
      'THIS_PACKAGE_IS_THE_ONLY_IMPLEMENTATION_AUTHORITY',
    ],
  },

  runtimeEffects: {
    effectsIdentity: 'RUNTIME_EFFECTS_SINGLE_SOURCE_OF_TRUTH',
    runtimeActivated: false,
    databaseExecuted: false,
    apiActivated: false,
    publishingExecuted: false,
    schedulerModified: false,
    workerModified: false,
    pageGenerationTriggered: false,
    filesystemWritten: false,
    networkAccessed: false,
    moduleLoaded: false,
    productionImpact: false,
  },

  recommendation: 'SSOT_ESTABLISHED_IMPLEMENT_FROM_MAPPED_REFERENCES_ONLY',
});

function getSingleSourceOfTruth() {
  return SINGLE_SOURCE_OF_TRUTH;
}

module.exports = {
  getSingleSourceOfTruth,
};
