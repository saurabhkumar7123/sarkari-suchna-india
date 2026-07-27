'use strict';

/**
 * PROGRAM 1 — Package 1A
 * Implementation Rules
 * (Implementation Planning Only)
 *
 * Defines allowed work, blocked work, production safety, feature flag
 * policy, implementation sequencing, and review policy for the
 * Recruitment implementation program.
 *
 * Planning only. No runtime activation. No production coupling.
 *
 * Functions:
 *   getImplementationRules()
 */

const IMPLEMENTATION_RULES_VERSION = '1.0.0';

function deepFreeze(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Object.isFrozen(value)) return value;
  Object.freeze(value);
  const keys = Array.isArray(value) ? value.keys() : Object.keys(value);
  for (const key of keys) deepFreeze(value[key]);
  return value;
}

const IMPLEMENTATION_RULES = deepFreeze({
  version: IMPLEMENTATION_RULES_VERSION,
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
  packageStage: 'IMPLEMENTATION_RULES_DEFINED',

  allowedWork: {
    allowedIdentity: 'ALLOWED_IMPLEMENTATION_WORK',
    allowed: [
      'IMPLEMENTATION_PLANNING_ARTIFACTS',
      'TRACEABILITY_TO_FROZEN_ARCHITECTURE',
      'DATABASE_IMPLEMENTATION_PREPARATION_PLANNING',
      'APPLICATION_IMPLEMENTATION_PREPARATION_PLANNING',
      'API_IMPLEMENTATION_PREPARATION_PLANNING',
      'ADMIN_IMPLEMENTATION_PREPARATION_PLANNING',
      'INTEGRATION_IMPLEMENTATION_PREPARATION_PLANNING',
      'DEPLOYMENT_IMPLEMENTATION_PREPARATION_PLANNING',
      'FEATURE_FLAG_POLICY_DEFINITION',
      'REVIEW_AND_GOVERNANCE_CHECKLISTS',
      'TEST_COVERAGE_FOR_PLANNING_MODULES',
    ],
    allowedRules: [
      'ALLOWED_WORK_MUST_REMAIN_PRODUCTION_SAFE',
      'ALLOWED_WORK_MUST_TRACE_TO_SSOT',
      'ALLOWED_WORK_MUST_NOT_ACTIVATE_RUNTIME',
    ],
  },

  blockedWork: {
    blockedIdentity: 'BLOCKED_IMPLEMENTATION_WORK',
    blocked: [
      'NEW_ARCHITECTURE_DOMAINS',
      'ARCHITECTURE_EXPANSION_PACKAGES',
      'RUNTIME_ACTIVATION',
      'DATABASE_MIGRATION_EXECUTION',
      'API_ROUTE_CONTROLLER_MIDDLEWARE_ACTIVATION',
      'SCHEDULER_ACTIVATION',
      'WORKER_ACTIVATION',
      'PUBLISHING_EXECUTION',
      'PAGE_GENERATION',
      'PRODUCTION_MODULE_IMPORTS_FROM_PLANNING_PACKAGES',
      'UNAPPROVED_FEATURE_FLAG_ACTIVATION',
      'BYPASSING_REVIEW_POLICY',
    ],
    blockedRules: [
      'BLOCKED_WORK_IS_HARD_DENIED_IN_PACKAGE_1A',
      'BLOCKED_WORK_REMAINS_DENIED_UNTIL_LATER_AUTHORIZED_PACKAGES',
      'NO_IMPLICIT_AUTHORIZATION_FROM_PLANNING_COMPLETION',
    ],
  },

  productionSafety: {
    safetyIdentity: 'SAFETY_PRODUCTION_IMPLEMENTATION',
    productionSafeByDefault: true,
    safetyRules: [
      'NO_RUNTIME_SIDE_EFFECTS_FROM_PLANNING_MODULES',
      'NO_DATABASE_EXECUTION_FROM_PLANNING_MODULES',
      'NO_API_ACTIVATION_FROM_PLANNING_MODULES',
      'NO_PUBLISHING_FROM_PLANNING_MODULES',
      'NO_SCHEDULER_OR_WORKER_CHANGES_FROM_PLANNING_MODULES',
      'PROTECTED_RUNTIME_SURFACES_REMAIN_UNTOUCHED',
      'PRODUCTION_COUPLING_REQUIRES_EXPLICIT_LATER_AUTHORIZATION',
    ],
    protectedSurfaces: [
      'orchestrator',
      'coordinator',
      'gateway',
      'pipeline',
      'worker',
      'scheduler',
      'publishing',
      'feature-flags-runtime',
    ],
  },

  featureFlagPolicy: {
    policyIdentity: 'POLICY_FEATURE_FLAGS',
    policyStatus: 'DEFINED_NOT_ACTIVATED',
    principles: [
      'ALL_RUNTIME_ACTIVATION_MUST_BE_FLAG_GATED',
      'FLAGS_DEFAULT_TO_OFF',
      'FLAG_ACTIVATION_REQUIRES_REVIEW_APPROVAL',
      'FLAG_NAMES_ARE_DESCRIPTIVE_ONLY_IN_PACKAGE_1A',
      'PACKAGE_1A_DOES_NOT_MUTATE_OR_ACTIVATE_FLAGS',
    ],
    plannedFlagFamilies: [
      'FLAG_DATABASE_IMPLEMENTATION',
      'FLAG_APPLICATION_IMPLEMENTATION',
      'FLAG_API_IMPLEMENTATION',
      'FLAG_ADMIN_IMPLEMENTATION',
      'FLAG_INTEGRATION_IMPLEMENTATION',
      'FLAG_PUBLISHING_IMPLEMENTATION',
    ],
    activationDenied: true,
    mutationDenied: true,
  },

  implementationSequencing: {
    sequencingIdentity: 'SEQUENCING_IMPLEMENTATION',
    sequence: [
      {
        order: 1,
        step: 'AUTHORITY_AND_FREEZE',
        status: 'IN_PROGRESS_PACKAGE_1A',
      },
      {
        order: 2,
        step: 'DATABASE_IMPLEMENTATION_PREPARATION',
        status: 'NOT_STARTED',
      },
      {
        order: 3,
        step: 'APPLICATION_IMPLEMENTATION_PREPARATION',
        status: 'NOT_STARTED',
      },
      {
        order: 4,
        step: 'API_IMPLEMENTATION_PREPARATION',
        status: 'NOT_STARTED',
      },
      {
        order: 5,
        step: 'ADMIN_IMPLEMENTATION_PREPARATION',
        status: 'NOT_STARTED',
      },
      {
        order: 6,
        step: 'INTEGRATION_PREPARATION',
        status: 'NOT_STARTED',
      },
      {
        order: 7,
        step: 'DEPLOYMENT_PREPARATION',
        status: 'NOT_STARTED',
      },
      {
        order: 8,
        step: 'CONTROLLED_RUNTIME_ACTIVATION',
        status: 'NOT_STARTED_AND_DENIED_HERE',
      },
    ],
    sequencingRules: [
      'NO_STEP_MAY_SKIP_PRIOR_REQUIRED_GATES',
      'RUNTIME_ACTIVATION_IS_LAST',
      'PACKAGE_1A_ONLY_COMPLETES_AUTHORITY_AND_FREEZE',
    ],
  },

  reviewPolicy: {
    policyIdentity: 'POLICY_IMPLEMENTATION_REVIEW',
    requiredReviews: [
      'TRACEABILITY_REVIEW_AGAINST_SSOT',
      'ARCHITECTURE_FREEZE_COMPLIANCE_REVIEW',
      'PRODUCTION_SAFETY_REVIEW',
      'FEATURE_FLAG_POLICY_REVIEW',
      'SEQUENCING_COMPLIANCE_REVIEW',
    ],
    reviewRules: [
      'NO_PRODUCTION_SENSITIVE_CHANGE_WITHOUT_REVIEW',
      'GOVERNANCE_OWNER_AND_SAFETY_OWNER_MUST_APPROVE_ACTIVATION',
      'REVIEW_FAILURE_BLOCKS_PROGRESSION',
      'PACKAGE_1A_ITSELF_REQUIRES_TEST_VERIFICATION_ONLY',
    ],
  },

  runtimeEffects: {
    effectsIdentity: 'RUNTIME_EFFECTS_IMPLEMENTATION_RULES',
    runtimeActivated: false,
    databaseExecuted: false,
    apiActivated: false,
    publishingExecuted: false,
    schedulerModified: false,
    workerModified: false,
    pageGenerationTriggered: false,
    featureFlagActivated: false,
    filesystemWritten: false,
    networkAccessed: false,
    productionImpact: false,
  },

  recommendation: 'IMPLEMENTATION_RULES_ENFORCED_FOR_ALL_FUTURE_PACKAGES',
});

function getImplementationRules() {
  return IMPLEMENTATION_RULES;
}

module.exports = {
  getImplementationRules,
};
