"use strict";

/**
 * Phase 138 — Recruitment Workflow Runtime Migration Planner (Advisory Only).
 *
 * Pure advisory migration planner that defines staged migration sequences for
 * future recruitment workflow runtime integration contract upgrades.
 * No database access, no persistence, no runtime imports, no side effects.
 * No automation. Never mutates input. Never persists output.
 */

const RECRUITMENT_WORKFLOW_RUNTIME_MIGRATION_PLANNER_PHASE = 138;

const RECRUITMENT_WORKFLOW_RUNTIME_MIGRATION_PLANNER_ENTITY =
  "recruitment_workflow_runtime_migration_planner";

const MIGRATION_STAGE_STATUS = Object.freeze({
  RECOMMENDED: "RECOMMENDED",
  OPTIONAL: "OPTIONAL",
  NOT_RECOMMENDED: "NOT_RECOMMENDED",
  BLOCKED: "BLOCKED",
  UNKNOWN: "UNKNOWN"
});

const MIGRATION_POSTURE = Object.freeze({
  MIGRATION_READY: "MIGRATION_READY",
  MIGRATION_REVIEW_REQUIRED: "MIGRATION_REVIEW_REQUIRED",
  MIGRATION_BLOCKED: "MIGRATION_BLOCKED",
  NO_MIGRATION_NEEDED: "NO_MIGRATION_NEEDED",
  UNKNOWN: "UNKNOWN"
});

const MIGRATION_STAGE_IDS = Object.freeze({
  VALIDATE_SOURCE_VERSION: "VALIDATE_SOURCE_VERSION",
  ASSESS_COMPATIBILITY: "ASSESS_COMPATIBILITY",
  MAP_CONTRACT_SURFACES: "MAP_CONTRACT_SURFACES",
  ALIGN_ADAPTER_CAPABILITIES: "ALIGN_ADAPTER_CAPABILITIES",
  PLAN_ROLLBACK_BOUNDARY: "PLAN_ROLLBACK_BOUNDARY",
  STAGING_VERIFICATION: "STAGING_VERIFICATION",
  DOCUMENT_MIGRATION_COMPLETION: "DOCUMENT_MIGRATION_COMPLETION"
});

const MIGRATION_STAGE_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: MIGRATION_STAGE_IDS.VALIDATE_SOURCE_VERSION,
    order: 1,
    label: "Validate source contract version lifecycle metadata",
    prerequisiteStageIds: Object.freeze([])
  }),
  Object.freeze({
    id: MIGRATION_STAGE_IDS.ASSESS_COMPATIBILITY,
    order: 2,
    label: "Assess advisory compatibility between source and target versions",
    prerequisiteStageIds: Object.freeze([MIGRATION_STAGE_IDS.VALIDATE_SOURCE_VERSION])
  }),
  Object.freeze({
    id: MIGRATION_STAGE_IDS.MAP_CONTRACT_SURFACES,
    order: 3,
    label: "Map integration contract surfaces across version boundaries",
    prerequisiteStageIds: Object.freeze([MIGRATION_STAGE_IDS.ASSESS_COMPATIBILITY])
  }),
  Object.freeze({
    id: MIGRATION_STAGE_IDS.ALIGN_ADAPTER_CAPABILITIES,
    order: 4,
    label: "Align runtime adapter capabilities with target contract requirements",
    prerequisiteStageIds: Object.freeze([MIGRATION_STAGE_IDS.MAP_CONTRACT_SURFACES])
  }),
  Object.freeze({
    id: MIGRATION_STAGE_IDS.PLAN_ROLLBACK_BOUNDARY,
    order: 5,
    label: "Plan advisory rollback boundary for migration reversal",
    prerequisiteStageIds: Object.freeze([MIGRATION_STAGE_IDS.ALIGN_ADAPTER_CAPABILITIES])
  }),
  Object.freeze({
    id: MIGRATION_STAGE_IDS.STAGING_VERIFICATION,
    order: 6,
    label: "Verify migration staging without production execution",
    prerequisiteStageIds: Object.freeze([MIGRATION_STAGE_IDS.PLAN_ROLLBACK_BOUNDARY])
  }),
  Object.freeze({
    id: MIGRATION_STAGE_IDS.DOCUMENT_MIGRATION_COMPLETION,
    order: 7,
    label: "Document advisory migration completion and baseline verification",
    prerequisiteStageIds: Object.freeze([MIGRATION_STAGE_IDS.STAGING_VERIFICATION])
  })
]);

const RECRUITMENT_WORKFLOW_RUNTIME_MIGRATION_PLANNER_METADATA = Object.freeze({
  phase: RECRUITMENT_WORKFLOW_RUNTIME_MIGRATION_PLANNER_PHASE,
  advisoryOnly: true,
  persistent: false,
  generatedBy: "phase_138",
  descriptiveOnly: true,
  architectureOnly: true,
  runtimeIntegration: false,
  persistenceEnabled: false,
  integrationPersistence: false,
  automationEnabled: false,
  alertingEnabled: false,
  historyTracking: false,
  sideEffects: false,
  mutatesInput: false,
  mutatesProduction: false,
  executed: false,
  migrationPlannerOnly: true,
  executesMigration: false,
  sourcePhases: Object.freeze([
    114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131,
    132, 133, 134, 135, 136, 137
  ])
});

function isPlainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

/**
 * @param {*} value
 * @returns {*}
 */
function deepFreeze(value) {
  if (value == null || typeof value !== "object") {
    return value;
  }
  if (Object.isFrozen(value)) {
    return value;
  }
  Object.freeze(value);
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      deepFreeze(value[i]);
    }
    return value;
  }
  const keys = Object.keys(value);
  for (let i = 0; i < keys.length; i += 1) {
    deepFreeze(value[keys[i]]);
  }
  return value;
}

/**
 * @param {*} input
 * @returns {boolean}
 */
function isRecognizedMigrationInput(input) {
  if (!isPlainObject(input)) {
    return false;
  }

  const fields = [
    "sourceVersion",
    "targetVersion",
    "compatibilityValidation",
    "versionComparison",
    "migrationRequested"
  ];

  for (let i = 0; i < fields.length; i += 1) {
    const field = fields[i];
    const value = input[field];
    if (value == null) {
      continue;
    }
    if (typeof value === "string" || typeof value === "boolean") {
      continue;
    }
    if (!isPlainObject(value)) {
      return false;
    }
  }

  return true;
}

/**
 * @param {Readonly<Object>} input
 * @returns {boolean}
 */
function hasMeaningfulMigrationSignals(input) {
  return (
    input.sourceVersion != null ||
    input.targetVersion != null ||
    input.compatibilityValidation != null ||
    input.versionComparison != null ||
    input.migrationRequested === true
  );
}

/**
 * @param {Readonly<Object>} input
 * @returns {string}
 */
function resolveMigrationPosture(input) {
  const sourceVersion = typeof input.sourceVersion === "string" ? input.sourceVersion : null;
  const targetVersion = typeof input.targetVersion === "string" ? input.targetVersion : null;
  const compatibilityStatus = input.compatibilityValidation?.compatibilityStatus;
  const upgradePermitted = input.versionComparison?.upgradePermitted;

  if (!sourceVersion && !targetVersion) {
    return MIGRATION_POSTURE.UNKNOWN;
  }

  if (sourceVersion && targetVersion && sourceVersion === targetVersion) {
    return MIGRATION_POSTURE.NO_MIGRATION_NEEDED;
  }

  if (upgradePermitted === false) {
    return MIGRATION_POSTURE.MIGRATION_BLOCKED;
  }

  if (compatibilityStatus === "INCOMPATIBLE") {
    return MIGRATION_POSTURE.MIGRATION_BLOCKED;
  }

  if (compatibilityStatus === "COMPATIBLE" && upgradePermitted !== false) {
    return MIGRATION_POSTURE.MIGRATION_READY;
  }

  if (compatibilityStatus === "PARTIALLY_COMPATIBLE" && upgradePermitted !== false) {
    return input.migrationRequested === true
      ? MIGRATION_POSTURE.MIGRATION_READY
      : MIGRATION_POSTURE.MIGRATION_REVIEW_REQUIRED;
  }

  if (compatibilityStatus === "COMPATIBLE" || input.migrationRequested === true) {
    return MIGRATION_POSTURE.MIGRATION_REVIEW_REQUIRED;
  }

  return MIGRATION_POSTURE.UNKNOWN;
}

/**
 * @param {string} migrationPosture
 * @param {Readonly<Object>} definition
 * @returns {string}
 */
function resolveStageStatus(migrationPosture, definition) {
  if (migrationPosture === MIGRATION_POSTURE.UNKNOWN) {
    return MIGRATION_STAGE_STATUS.UNKNOWN;
  }

  if (migrationPosture === MIGRATION_POSTURE.NO_MIGRATION_NEEDED) {
    return MIGRATION_STAGE_STATUS.NOT_RECOMMENDED;
  }

  if (migrationPosture === MIGRATION_POSTURE.MIGRATION_BLOCKED) {
    if (definition.id === MIGRATION_STAGE_IDS.VALIDATE_SOURCE_VERSION) {
      return MIGRATION_STAGE_STATUS.RECOMMENDED;
    }
    return MIGRATION_STAGE_STATUS.BLOCKED;
  }

  if (migrationPosture === MIGRATION_POSTURE.MIGRATION_READY) {
    return MIGRATION_STAGE_STATUS.RECOMMENDED;
  }

  if (migrationPosture === MIGRATION_POSTURE.MIGRATION_REVIEW_REQUIRED) {
    if (definition.id === MIGRATION_STAGE_IDS.DOCUMENT_MIGRATION_COMPLETION) {
      return MIGRATION_STAGE_STATUS.OPTIONAL;
    }
    return MIGRATION_STAGE_STATUS.RECOMMENDED;
  }

  return MIGRATION_STAGE_STATUS.UNKNOWN;
}

/**
 * @param {string} migrationPosture
 * @returns {string}
 */
function buildMigrationSummary(migrationPosture) {
  if (migrationPosture === MIGRATION_POSTURE.MIGRATION_READY) {
    return "Recruitment workflow runtime migration plan ready for advisory staging review";
  }

  if (migrationPosture === MIGRATION_POSTURE.MIGRATION_REVIEW_REQUIRED) {
    return "Recruitment workflow runtime migration plan requires advisory review before staging";
  }

  if (migrationPosture === MIGRATION_POSTURE.MIGRATION_BLOCKED) {
    return "Recruitment workflow runtime migration plan blocked by compatibility or lifecycle signals";
  }

  if (migrationPosture === MIGRATION_POSTURE.NO_MIGRATION_NEEDED) {
    return "Recruitment workflow runtime migration plan reports no migration needed";
  }

  return "Recruitment workflow runtime migration plan could not be determined";
}

/**
 * Create recruitment workflow runtime migration plan from supplied inputs.
 * Pure: no I/O, no mutation of inputs, no persistence, no runtime coupling.
 *
 * @param {Object|null|undefined} input
 * @returns {Readonly<Object>}
 */
function createRecruitmentWorkflowRuntimeMigrationPlan(input) {
  if (!isRecognizedMigrationInput(input) || !hasMeaningfulMigrationSignals(input)) {
    const unknownStages = MIGRATION_STAGE_DEFINITIONS.map((definition) =>
      deepFreeze({
        id: definition.id,
        order: definition.order,
        label: definition.label,
        status: MIGRATION_STAGE_STATUS.UNKNOWN,
        prerequisiteStageIds: definition.prerequisiteStageIds
      })
    );

    return deepFreeze({
      migrationPosture: MIGRATION_POSTURE.UNKNOWN,
      migrationSummary: buildMigrationSummary(MIGRATION_POSTURE.UNKNOWN),
      migrationStages: Object.freeze(unknownStages),
      recommendedCount: 0,
      optionalCount: 0,
      blockedCount: 0,
      recommendedStages: Object.freeze([]),
      recognized: false,
      advisoryMetadata: deepFreeze({
        advisoryOnly: true,
        persistent: false,
        generatedBy: "phase_138",
        phase: RECRUITMENT_WORKFLOW_RUNTIME_MIGRATION_PLANNER_PHASE,
        architectureOnly: true,
        executed: false,
        persistenceEnabled: false,
        integrationPersistence: false,
        automationEnabled: false,
        alertingEnabled: false,
        historyTracking: false,
        sideEffects: false,
        mutatesInput: false,
        migrationPlannerOnly: true,
        executesMigration: false
      })
    });
  }

  const migrationPosture = resolveMigrationPosture(input);
  const migrationStages = MIGRATION_STAGE_DEFINITIONS.map((definition) =>
    deepFreeze({
      id: definition.id,
      order: definition.order,
      label: definition.label,
      status: resolveStageStatus(migrationPosture, definition),
      prerequisiteStageIds: definition.prerequisiteStageIds
    })
  );

  let recommendedCount = 0;
  let optionalCount = 0;
  let blockedCount = 0;
  const recommendedStages = [];

  for (let i = 0; i < migrationStages.length; i += 1) {
    const stage = migrationStages[i];

    if (stage.status === MIGRATION_STAGE_STATUS.RECOMMENDED) {
      recommendedCount += 1;
      recommendedStages.push(stage.id);
    } else if (stage.status === MIGRATION_STAGE_STATUS.OPTIONAL) {
      optionalCount += 1;
    } else if (stage.status === MIGRATION_STAGE_STATUS.BLOCKED) {
      blockedCount += 1;
    }
  }

  return deepFreeze({
    sourceVersion: typeof input.sourceVersion === "string" ? input.sourceVersion : null,
    targetVersion: typeof input.targetVersion === "string" ? input.targetVersion : null,
    migrationPosture,
    migrationSummary: buildMigrationSummary(migrationPosture),
    migrationStages: Object.freeze(migrationStages),
    recommendedCount,
    optionalCount,
    blockedCount,
    recommendedStages: Object.freeze(recommendedStages),
    recognized: true,
    advisoryMetadata: deepFreeze({
      advisoryOnly: true,
      persistent: false,
      generatedBy: "phase_138",
      phase: RECRUITMENT_WORKFLOW_RUNTIME_MIGRATION_PLANNER_PHASE,
      architectureOnly: true,
      executed: false,
      persistenceEnabled: false,
      integrationPersistence: false,
      automationEnabled: false,
      alertingEnabled: false,
      historyTracking: false,
      sideEffects: false,
      mutatesInput: false,
      migrationPlannerOnly: true,
      executesMigration: false
    })
  });
}

module.exports = {
  RECRUITMENT_WORKFLOW_RUNTIME_MIGRATION_PLANNER_PHASE,
  RECRUITMENT_WORKFLOW_RUNTIME_MIGRATION_PLANNER_ENTITY,
  MIGRATION_STAGE_STATUS,
  MIGRATION_POSTURE,
  MIGRATION_STAGE_IDS,
  MIGRATION_STAGE_DEFINITIONS,
  RECRUITMENT_WORKFLOW_RUNTIME_MIGRATION_PLANNER_METADATA,
  createRecruitmentWorkflowRuntimeMigrationPlan
};
