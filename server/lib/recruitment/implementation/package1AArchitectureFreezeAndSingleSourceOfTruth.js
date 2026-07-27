'use strict';

/**
 * PROGRAM 1 — Package 1A
 * Architecture Freeze & Single Source of Truth
 * (Implementation Planning Only)
 *
 * Package entry consolidating the implementation authority foundation:
 *   1. Implementation Authority
 *   2. Architecture Freeze
 *   3. Single Source of Truth
 *   4. Implementation Rules
 *   5. Implementation Objectives
 *
 * Deep frozen. Deterministic. Version 1.0.0.
 * No production execution. No runtime activation. No database migration.
 * No API changes. No scheduler changes. No worker activation.
 * No imports into production. No architecture expansion.
 *
 * Sibling planning modules are composed by value via require of local
 * implementation-planning getters only. No production module loading.
 *
 * Functions:
 *   getPackage1AArchitectureFreezeAndSingleSourceOfTruth()
 */

const { getImplementationAuthority } = require('./implementationAuthority.js');
const { getArchitectureFreeze } = require('./architectureFreeze.js');
const { getSingleSourceOfTruth } = require('./singleSourceOfTruth.js');
const { getImplementationRules } = require('./implementationRules.js');
const {
  getImplementationObjectives,
} = require('./implementationObjectives.js');

const PACKAGE_1A_VERSION = '1.0.0';

function deepFreeze(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Object.isFrozen(value)) return value;
  Object.freeze(value);
  const keys = Array.isArray(value) ? value.keys() : Object.keys(value);
  for (const key of keys) deepFreeze(value[key]);
  return value;
}

const PACKAGE_1A = deepFreeze({
  version: PACKAGE_1A_VERSION,
  program: 'PROGRAM_1_IMPLEMENTATION_AUTHORITY_AND_PROJECT_FREEZE',
  package: 'PACKAGE_1A_ARCHITECTURE_FREEZE_AND_SINGLE_SOURCE_OF_TRUTH',
  packageName: 'Architecture Freeze & Single Source of Truth',
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
  packageStage: 'PACKAGE_1A_ARCHITECTURE_FREEZE_AND_SSOT_DEFINED',

  architectureCompletionMarker: {
    completedStage: 12,
    completedPhase: 529,
    status: 'COMPLETE',
    architectureProgramClosed: true,
    implementationProgramStarted: true,
    implementationExecutionStarted: false,
  },

  sections: {
    implementationAuthority: getImplementationAuthority(),
    architectureFreeze: getArchitectureFreeze(),
    singleSourceOfTruth: getSingleSourceOfTruth(),
    implementationRules: getImplementationRules(),
    implementationObjectives: getImplementationObjectives(),
  },

  packageSummary: {
    summaryIdentity: 'SUMMARY_PACKAGE_1A',
    program: 'PROGRAM 1 — Implementation Authority & Project Freeze',
    package: 'PACKAGE 1A — Architecture Freeze & Single Source of Truth',
    version: PACKAGE_1A_VERSION,
    status: 'COMPLETE',
    purpose:
      'Establish one authoritative implementation baseline for the Recruitment project.',
    sectionsDefined: [
      'implementationAuthority',
      'architectureFreeze',
      'singleSourceOfTruth',
      'implementationRules',
      'implementationObjectives',
    ],
    nextPackage: 'PACKAGE_1B_OR_NEXT_IMPLEMENTATION_PLANNING_PACKAGE',
    implementationPlanning: true,
    architectureFrozen: true,
    singleSourceOfTruth: true,
    productionSafe: true,
    runtimeActivated: false,
    databaseExecuted: false,
    apiActivated: false,
    publishingExecuted: false,
  },

  runtimeEffects: {
    effectsIdentity: 'RUNTIME_EFFECTS_PACKAGE_1A',
    runtimeActivated: false,
    databaseExecuted: false,
    apiActivated: false,
    publishingExecuted: false,
    schedulerModified: false,
    workerModified: false,
    pageGenerationTriggered: false,
    filesystemWritten: false,
    networkAccessed: false,
    environmentAccessed: false,
    productionImpact: false,
  },

  safetyBoundaries: {
    boundariesIdentity: 'SAFETY_PACKAGE_1A',
    productionActivationDenied: true,
    architectureExpansionDenied: true,
    runtimeActivationDenied: true,
    databaseExecutionDenied: true,
    apiActivationDenied: true,
    publishingExecutionDenied: true,
    hardDeniedActions: [
      'DENIED_ARCHITECTURE_EXPANSION',
      'DENIED_RUNTIME_ACTIVATION',
      'DENIED_DATABASE_EXECUTION',
      'DENIED_API_ACTIVATION',
      'DENIED_SCHEDULER_OR_WORKER_ACTIVATION',
      'DENIED_PUBLISHING_OR_PAGE_GENERATION',
      'DENIED_PRODUCTION_COUPLING',
    ],
    safetyFlags: [
      'FLAG_IMPLEMENTATION_PLANNING_ONLY',
      'FLAG_ARCHITECTURE_FROZEN',
      'FLAG_SINGLE_SOURCE_OF_TRUTH',
      'FLAG_PRODUCTION_SAFE',
      'FLAG_RUNTIME_ACTIVATION_BLOCKED',
      'FLAG_DATABASE_EXECUTION_BLOCKED',
      'FLAG_API_ACTIVATION_BLOCKED',
      'FLAG_PUBLISHING_EXECUTION_BLOCKED',
    ],
  },

  recommendation: 'PACKAGE_1A_COMPLETE_IMPLEMENTATION_AUTHORITY_BASELINE_READY',
  recommendedNextPlanningTarget:
    'TARGET_NEXT_IMPLEMENTATION_PLANNING_PACKAGE',
});

function getPackage1AArchitectureFreezeAndSingleSourceOfTruth() {
  return PACKAGE_1A;
}

module.exports = {
  getPackage1AArchitectureFreezeAndSingleSourceOfTruth,
  getImplementationAuthority,
  getArchitectureFreeze,
  getSingleSourceOfTruth,
  getImplementationRules,
  getImplementationObjectives,
};
