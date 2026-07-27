'use strict';

/**
 * PROGRAM 1 — Package 1A
 * Architecture Freeze Definition
 * (Implementation Planning Only)
 *
 * Formal architecture freeze for the Recruitment project after
 * Stage 12 / Phase 529 completion. Frozen planning scope is locked.
 * Allowed future architecture changes are narrowly defined.
 * Architecture expansion is blocked.
 *
 * This is NOT architecture expansion. No new architecture domains.
 * No production execution. No runtime activation.
 *
 * Functions:
 *   getArchitectureFreeze()
 */

const ARCHITECTURE_FREEZE_VERSION = '1.0.0';

function deepFreeze(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Object.isFrozen(value)) return value;
  Object.freeze(value);
  const keys = Array.isArray(value) ? value.keys() : Object.keys(value);
  for (const key of keys) deepFreeze(value[key]);
  return value;
}

const ARCHITECTURE_FREEZE = deepFreeze({
  version: ARCHITECTURE_FREEZE_VERSION,
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
  packageStage: 'ARCHITECTURE_FREEZE_DEFINED',

  freezeDeclaration: {
    declarationIdentity: 'DECLARATION_ARCHITECTURE_FREEZE',
    freezeStatus: 'FROZEN',
    freezeEffectiveMarker: {
      completedStage: 12,
      completedPhase: 529,
      architectureProgramStatus: 'COMPLETE',
    },
    freezeStatement:
      'Architecture program is complete through Stage 12 Phase 529. From this point forward, work is implementation planning and eventual production implementation against the frozen baseline only.',
    newArchitectureDomainsDenied: true,
    architectureExpansionBlocked: true,
  },

  completedArchitecture: {
    inventoryIdentity: 'INVENTORY_COMPLETED_ARCHITECTURE',
    stages: [
      {
        stage: 8,
        stageName: 'Production Implementation Blueprint',
        completionPhase: 433,
        status: 'COMPLETE',
        certification:
          'shadowStage8CompletionCertificationFramework',
      },
      {
        stage: 9,
        stageName: 'Database Implementation Design & Migration Planning',
        completionPhase: 456,
        status: 'COMPLETE',
        certification:
          'shadowStage9DatabaseCompletionCertificationFramework',
      },
      {
        stage: 10,
        stageName: 'Application Layer Implementation Blueprint',
        completionPhase: 479,
        status: 'COMPLETE',
        certification:
          'shadowStage10ApplicationCompletionCertificationFramework',
      },
      {
        stage: 11,
        stageName: 'API Layer & Interface Architecture Blueprint',
        completionPhase: 502,
        status: 'COMPLETE',
        certification:
          'shadowStage11ApiCompletionCertificationFramework',
      },
      {
        stage: 12,
        stageName: 'Admin & Management Layer Architecture Blueprint',
        completionPhase: 529,
        status: 'COMPLETE',
        certification:
          'shadowStage12AdminCompletionCertificationFramework',
      },
    ],
    finalCompletionMarker: {
      stage: 12,
      phase: 529,
      status: 'COMPLETE',
      architectureProgramClosed: true,
    },
  },

  frozenPlanningScope: {
    scopeIdentity: 'SCOPE_FROZEN_PLANNING',
    frozenArtifacts: [
      'STAGE_8_PRODUCTION_IMPLEMENTATION_BLUEPRINT',
      'STAGE_9_DATABASE_IMPLEMENTATION_DESIGN',
      'STAGE_10_APPLICATION_LAYER_BLUEPRINT',
      'STAGE_11_API_LAYER_INTERFACE_BLUEPRINT',
      'STAGE_12_ADMIN_MANAGEMENT_LAYER_BLUEPRINT',
      'IMPLEMENTATION_WORK_PACKAGE_REGISTRY',
      'IMPLEMENTATION_LAYER_MAP',
      'EXISTING_RECRUITMENT_WORK_PACKAGE_SPECIFICATIONS',
    ],
    frozenRules: [
      'FROZEN_ARTIFACTS_ARE_IMPLEMENTATION_INPUTS_ONLY',
      'FROZEN_ARTIFACTS_MAY_NOT_BE_REDESIGNED_AS_NEW_ARCHITECTURE',
      'IMPLEMENTATION_MUST_TRACE_TO_FROZEN_ARTIFACTS',
      'DRIFT_FROM_FROZEN_SCOPE_REQUIRES_GOVERNANCE_EXCEPTION',
    ],
  },

  allowedFutureArchitectureChanges: {
    allowedIdentity: 'ALLOWED_FUTURE_ARCHITECTURE_CHANGES',
    allowed: [
      {
        changeType: 'DEFECT_CORRECTION',
        condition: 'DOCUMENTED_DEFECT_IN_FROZEN_ARTIFACT',
        requiresApproval: true,
      },
      {
        changeType: 'CLARIFICATION_ANNOTATION',
        condition: 'NON_SEMANTIC_DOCUMENTATION_CLARIFICATION',
        requiresApproval: true,
      },
      {
        changeType: 'IMPLEMENTATION_MAPPING_UPDATE',
        condition: 'MAPPING_TO_EXISTING_FROZEN_SCOPE_ONLY',
        requiresApproval: true,
      },
      {
        changeType: 'GOVERNANCE_EXCEPTION',
        condition: 'EXPLICIT_GOVERNANCE_AND_SAFETY_APPROVAL',
        requiresApproval: true,
      },
    ],
    allowedRules: [
      'ALLOWED_CHANGES_MUST_NOT_INTRODUCE_NEW_DOMAINS',
      'ALLOWED_CHANGES_MUST_NOT_REOPEN_ARCHITECTURE_PROGRAM',
      'ALLOWED_CHANGES_REQUIRE_TRACEABLE_JUSTIFICATION',
    ],
  },

  blockedArchitectureExpansion: {
    blockedIdentity: 'BLOCKED_ARCHITECTURE_EXPANSION',
    blocked: [
      'NEW_ARCHITECTURE_STAGES',
      'NEW_ARCHITECTURE_DOMAINS',
      'NEW_BLUEPRINT_FAMILIES',
      'REOPENING_STAGE_8_THROUGH_12_AS_ARCHITECTURE_WORK',
      'PARALLEL_ARCHITECTURE_AUTHORITIES',
      'SHADOW_ARCHITECTURE_EXPANSION_PACKAGES',
      'UNAPPROVED_SEMANTIC_MODEL_CHANGES',
    ],
    blockedRules: [
      'ARCHITECTURE_EXPANSION_IS_HARD_DENIED',
      'IMPLEMENTATION_PROGRAM_IS_NOT_ARCHITECTURE_PROGRAM',
      'PACKAGE_1A_DOES_NOT_AUTHORIZE_EXPANSION',
    ],
  },

  runtimeEffects: {
    effectsIdentity: 'RUNTIME_EFFECTS_ARCHITECTURE_FREEZE',
    runtimeActivated: false,
    databaseExecuted: false,
    apiActivated: false,
    publishingExecuted: false,
    schedulerModified: false,
    workerModified: false,
    pageGenerationTriggered: false,
    filesystemWritten: false,
    networkAccessed: false,
    productionImpact: false,
  },

  recommendation: 'ARCHITECTURE_FROZEN_IMPLEMENT_AGAINST_BASELINE_ONLY',
});

function getArchitectureFreeze() {
  return ARCHITECTURE_FREEZE;
}

module.exports = {
  getArchitectureFreeze,
};
