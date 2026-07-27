"use strict";

/**
 * Phase 138 — Recruitment Workflow Contract Compatibility Validator (Advisory Only).
 *
 * Pure advisory validator that classifies recruitment workflow runtime integration
 * contract compatibility. No database access, no persistence, no runtime imports,
 * no side effects. No auto-correction. No automation.
 * Never mutates input. Never persists output.
 */

const RECRUITMENT_WORKFLOW_CONTRACT_COMPATIBILITY_VALIDATOR_PHASE = 138;

const RECRUITMENT_WORKFLOW_CONTRACT_COMPATIBILITY_VALIDATOR_ENTITY =
  "recruitment_workflow_contract_compatibility_validator";

const COMPATIBILITY_STATUS = Object.freeze({
  COMPATIBLE: "COMPATIBLE",
  PARTIALLY_COMPATIBLE: "PARTIALLY_COMPATIBLE",
  INCOMPATIBLE: "INCOMPATIBLE",
  UNKNOWN: "UNKNOWN"
});

const COMPATIBILITY_RULE_STATUS = Object.freeze({
  SATISFIED: "SATISFIED",
  PARTIAL: "PARTIAL",
  VIOLATED: "VIOLATED",
  NOT_APPLICABLE: "NOT_APPLICABLE",
  UNKNOWN: "UNKNOWN"
});

const COMPATIBILITY_RULE_IDS = Object.freeze({
  VERSION_ALIGNMENT: "VERSION_ALIGNMENT",
  SURFACE_COVERAGE: "SURFACE_COVERAGE",
  LIFECYCLE_COMPATIBILITY: "LIFECYCLE_COMPATIBILITY",
  ADAPTER_CAPABILITY_MATCH: "ADAPTER_CAPABILITY_MATCH",
  SCHEMA_COMPATIBILITY: "SCHEMA_COMPATIBILITY",
  ADVISORY_BOUNDARY_PRESERVED: "ADVISORY_BOUNDARY_PRESERVED"
});

const VERSION_LIFECYCLE = Object.freeze({
  DRAFT: "DRAFT",
  ACTIVE: "ACTIVE",
  STABLE: "STABLE",
  DEPRECATED: "DEPRECATED",
  RETIRED: "RETIRED"
});

const COMPATIBILITY_RULE_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: COMPATIBILITY_RULE_IDS.VERSION_ALIGNMENT,
    label: "Source and target contract versions must align for migration"
  }),
  Object.freeze({
    id: COMPATIBILITY_RULE_IDS.SURFACE_COVERAGE,
    label: "Integration surfaces must be satisfied or partially covered"
  }),
  Object.freeze({
    id: COMPATIBILITY_RULE_IDS.LIFECYCLE_COMPATIBILITY,
    label: "Contract version lifecycle must permit advisory coupling"
  }),
  Object.freeze({
    id: COMPATIBILITY_RULE_IDS.ADAPTER_CAPABILITY_MATCH,
    label: "Adapter capabilities must satisfy interface requirements"
  }),
  Object.freeze({
    id: COMPATIBILITY_RULE_IDS.SCHEMA_COMPATIBILITY,
    label: "Contract schema versions must be compatible"
  }),
  Object.freeze({
    id: COMPATIBILITY_RULE_IDS.ADVISORY_BOUNDARY_PRESERVED,
    label: "Advisory-only boundary must be preserved"
  })
]);

const RECRUITMENT_WORKFLOW_CONTRACT_COMPATIBILITY_VALIDATOR_METADATA = Object.freeze({
  phase: RECRUITMENT_WORKFLOW_CONTRACT_COMPATIBILITY_VALIDATOR_PHASE,
  advisoryOnly: true,
  persistent: false,
  generatedBy: "phase_138",
  descriptiveOnly: true,
  architectureOnly: true,
  runtimeIntegration: false,
  persistenceEnabled: false,
  integrationPersistence: false,
  autoCorrectionEnabled: false,
  automationEnabled: false,
  alertingEnabled: false,
  historyTracking: false,
  sideEffects: false,
  mutatesInput: false,
  mutatesProduction: false,
  executed: false,
  compatibilityValidatorOnly: true,
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
function isRecognizedCompatibilityInput(input) {
  if (!isPlainObject(input)) {
    return false;
  }

  const fields = [
    "sourceVersion",
    "targetVersion",
    "sourceLifecycle",
    "targetLifecycle",
    "integrationContract",
    "adapterCapabilities",
    "schemaVersion"
  ];

  for (let i = 0; i < fields.length; i += 1) {
    const field = fields[i];
    const value = input[field];
    if (value == null) {
      continue;
    }
    if (typeof value === "string") {
      continue;
    }
    if (!isPlainObject(value)) {
      return false;
    }
  }

  return true;
}

/**
 * @param {string|null|undefined} sourceVersion
 * @param {string|null|undefined} targetVersion
 * @returns {string}
 */
function evaluateVersionAlignment(sourceVersion, targetVersion) {
  if (!sourceVersion || !targetVersion) {
    return COMPATIBILITY_RULE_STATUS.UNKNOWN;
  }

  if (sourceVersion === targetVersion) {
    return COMPATIBILITY_RULE_STATUS.SATISFIED;
  }

  const sourceParts = sourceVersion.split(".").map(Number);
  const targetParts = targetVersion.split(".").map(Number);

  if (sourceParts[0] === targetParts[0]) {
    return COMPATIBILITY_RULE_STATUS.PARTIAL;
  }

  if (Math.abs(targetParts[0] - sourceParts[0]) === 1) {
    return COMPATIBILITY_RULE_STATUS.PARTIAL;
  }

  return COMPATIBILITY_RULE_STATUS.VIOLATED;
}

/**
 * @param {Readonly<Object>|null|undefined} contract
 * @returns {string}
 */
function evaluateSurfaceCoverage(contract) {
  if (!isPlainObject(contract) || !Array.isArray(contract.integrationSurfaces)) {
    return COMPATIBILITY_RULE_STATUS.UNKNOWN;
  }

  const surfaces = contract.integrationSurfaces;
  let satisfiedCount = 0;
  let partialCount = 0;
  let blockedCount = 0;

  for (let i = 0; i < surfaces.length; i += 1) {
    const status = surfaces[i].status;

    if (status === "SATISFIED") {
      satisfiedCount += 1;
    } else if (status === "PARTIAL") {
      partialCount += 1;
    } else if (status === "BLOCKED") {
      blockedCount += 1;
    }
  }

  if (blockedCount > 0) {
    return COMPATIBILITY_RULE_STATUS.VIOLATED;
  }

  if (satisfiedCount === surfaces.length) {
    return COMPATIBILITY_RULE_STATUS.SATISFIED;
  }

  if (satisfiedCount > 0 || partialCount > 0) {
    return COMPATIBILITY_RULE_STATUS.PARTIAL;
  }

  return COMPATIBILITY_RULE_STATUS.UNKNOWN;
}

/**
 * @param {string|null|undefined} sourceLifecycle
 * @param {string|null|undefined} targetLifecycle
 * @returns {string}
 */
function evaluateLifecycleCompatibility(sourceLifecycle, targetLifecycle) {
  if (!sourceLifecycle || !targetLifecycle) {
    return COMPATIBILITY_RULE_STATUS.UNKNOWN;
  }

  if (sourceLifecycle === VERSION_LIFECYCLE.RETIRED || targetLifecycle === VERSION_LIFECYCLE.RETIRED) {
    return COMPATIBILITY_RULE_STATUS.VIOLATED;
  }

  if (
    sourceLifecycle === VERSION_LIFECYCLE.DEPRECATED ||
    targetLifecycle === VERSION_LIFECYCLE.DEPRECATED
  ) {
    return COMPATIBILITY_RULE_STATUS.PARTIAL;
  }

  if (
    sourceLifecycle === VERSION_LIFECYCLE.ACTIVE ||
    sourceLifecycle === VERSION_LIFECYCLE.STABLE ||
    targetLifecycle === VERSION_LIFECYCLE.ACTIVE ||
    targetLifecycle === VERSION_LIFECYCLE.STABLE
  ) {
    return COMPATIBILITY_RULE_STATUS.SATISFIED;
  }

  if (sourceLifecycle === VERSION_LIFECYCLE.DRAFT || targetLifecycle === VERSION_LIFECYCLE.DRAFT) {
    return COMPATIBILITY_RULE_STATUS.PARTIAL;
  }

  return COMPATIBILITY_RULE_STATUS.UNKNOWN;
}

/**
 * @param {Readonly<Object>|null|undefined} adapterCapabilities
 * @returns {string}
 */
function evaluateAdapterCapabilityMatch(adapterCapabilities) {
  if (!isPlainObject(adapterCapabilities)) {
    return COMPATIBILITY_RULE_STATUS.UNKNOWN;
  }

  const requiredKeys = [
    "ADVISORY_ONLY",
    "INPUT_IMMUTABILITY",
    "DETERMINISTIC_OUTPUT",
    "DEEP_FREEZE_OUTPUT",
    "NO_PERSISTENCE",
    "NO_SCHEDULER",
    "NO_WORKERS",
    "NO_API",
    "NO_PUBLISHING"
  ];

  let satisfiedCount = 0;

  for (let i = 0; i < requiredKeys.length; i += 1) {
    if (adapterCapabilities[requiredKeys[i]] === true) {
      satisfiedCount += 1;
    }
  }

  if (satisfiedCount === requiredKeys.length) {
    return COMPATIBILITY_RULE_STATUS.SATISFIED;
  }

  if (satisfiedCount > 0) {
    return COMPATIBILITY_RULE_STATUS.PARTIAL;
  }

  return COMPATIBILITY_RULE_STATUS.VIOLATED;
}

/**
 * @param {string|null|undefined} sourceVersion
 * @param {string|null|undefined} targetVersion
 * @param {string|null|undefined} schemaVersion
 * @returns {string}
 */
function evaluateSchemaCompatibility(sourceVersion, targetVersion, schemaVersion) {
  if (!schemaVersion) {
    return COMPATIBILITY_RULE_STATUS.UNKNOWN;
  }

  if (sourceVersion && targetVersion) {
    const sourceMajor = Number(sourceVersion.split(".")[0]);
    const targetMajor = Number(targetVersion.split(".")[0]);

    if (Math.abs(targetMajor - sourceMajor) > 1) {
      return COMPATIBILITY_RULE_STATUS.VIOLATED;
    }

    if (sourceMajor !== targetMajor) {
      return COMPATIBILITY_RULE_STATUS.PARTIAL;
    }
  }

  if (schemaVersion === "1.0.0") {
    return COMPATIBILITY_RULE_STATUS.SATISFIED;
  }

  const schemaMajor = schemaVersion.split(".")[0];

  if (schemaMajor === "1") {
    return COMPATIBILITY_RULE_STATUS.PARTIAL;
  }

  return COMPATIBILITY_RULE_STATUS.UNKNOWN;
}

/**
 * @param {Readonly<Object>|null|undefined} contract
 * @param {Readonly<Object>|null|undefined} adapterCapabilities
 * @returns {string}
 */
function evaluateAdvisoryBoundary(contract, adapterCapabilities) {
  const contractAdvisory =
    isPlainObject(contract) &&
  contract.advisoryMetadata?.advisoryOnly === true &&
    contract.advisoryMetadata?.executed === false;

  const adapterAdvisory =
    isPlainObject(adapterCapabilities) && adapterCapabilities.ADVISORY_ONLY === true;

  if (contractAdvisory && adapterAdvisory) {
    return COMPATIBILITY_RULE_STATUS.SATISFIED;
  }

  if (contractAdvisory || adapterAdvisory) {
    return COMPATIBILITY_RULE_STATUS.PARTIAL;
  }

  if (!isPlainObject(contract) && !isPlainObject(adapterCapabilities)) {
    return COMPATIBILITY_RULE_STATUS.UNKNOWN;
  }

  return COMPATIBILITY_RULE_STATUS.VIOLATED;
}

/**
 * @param {Readonly<Array>} rules
 * @returns {string}
 */
function resolveCompatibilityStatus(rules) {
  let satisfiedCount = 0;
  let partialCount = 0;
  let violatedCount = 0;
  let unknownCount = 0;

  for (let i = 0; i < rules.length; i += 1) {
    const status = rules[i].status;

    if (status === COMPATIBILITY_RULE_STATUS.SATISFIED) {
      satisfiedCount += 1;
    } else if (status === COMPATIBILITY_RULE_STATUS.PARTIAL) {
      partialCount += 1;
    } else if (status === COMPATIBILITY_RULE_STATUS.VIOLATED) {
      violatedCount += 1;
    } else if (status === COMPATIBILITY_RULE_STATUS.UNKNOWN) {
      unknownCount += 1;
    }
  }

  if (violatedCount > 0) {
    return COMPATIBILITY_STATUS.INCOMPATIBLE;
  }

  if (unknownCount === rules.length) {
    return COMPATIBILITY_STATUS.UNKNOWN;
  }

  if (satisfiedCount === rules.length) {
    return COMPATIBILITY_STATUS.COMPATIBLE;
  }

  if (satisfiedCount > 0 || partialCount > 0) {
    return COMPATIBILITY_STATUS.PARTIALLY_COMPATIBLE;
  }

  return COMPATIBILITY_STATUS.UNKNOWN;
}

/**
 * @param {string} compatibilityStatus
 * @returns {string}
 */
function buildCompatibilitySummary(compatibilityStatus) {
  if (compatibilityStatus === COMPATIBILITY_STATUS.COMPATIBLE) {
    return "Recruitment workflow contract compatibility validated as fully compatible";
  }

  if (compatibilityStatus === COMPATIBILITY_STATUS.PARTIALLY_COMPATIBLE) {
    return "Recruitment workflow contract compatibility validated as partially compatible";
  }

  if (compatibilityStatus === COMPATIBILITY_STATUS.INCOMPATIBLE) {
    return "Recruitment workflow contract compatibility validated as incompatible";
  }

  return "Recruitment workflow contract compatibility could not be determined";
}

/**
 * Validate recruitment workflow contract compatibility from supplied inputs.
 * Pure: no I/O, no mutation of inputs, no persistence, no runtime coupling.
 *
 * @param {Object|null|undefined} input
 * @returns {Readonly<Object>}
 */
function validateRecruitmentWorkflowContractCompatibility(input) {
  if (!isRecognizedCompatibilityInput(input)) {
    const unknownRules = COMPATIBILITY_RULE_DEFINITIONS.map((definition) =>
      deepFreeze({
        id: definition.id,
        label: definition.label,
        status: COMPATIBILITY_RULE_STATUS.UNKNOWN
      })
    );

    return deepFreeze({
      compatibilityStatus: COMPATIBILITY_STATUS.UNKNOWN,
      compatibilitySummary: buildCompatibilitySummary(COMPATIBILITY_STATUS.UNKNOWN),
      compatibilityRules: Object.freeze(unknownRules),
      satisfiedCount: 0,
      partialCount: 0,
      violatedCount: 0,
      unknownCount: unknownRules.length,
      recognized: false,
      advisoryMetadata: deepFreeze({
        advisoryOnly: true,
        persistent: false,
        generatedBy: "phase_138",
        phase: RECRUITMENT_WORKFLOW_CONTRACT_COMPATIBILITY_VALIDATOR_PHASE,
        architectureOnly: true,
        executed: false,
        persistenceEnabled: false,
        integrationPersistence: false,
        automationEnabled: false,
        alertingEnabled: false,
        historyTracking: false,
        sideEffects: false,
        mutatesInput: false,
        compatibilityValidatorOnly: true
      })
    });
  }

  const sourceVersion = typeof input.sourceVersion === "string" ? input.sourceVersion : null;
  const targetVersion = typeof input.targetVersion === "string" ? input.targetVersion : null;
  const sourceLifecycle = typeof input.sourceLifecycle === "string" ? input.sourceLifecycle : null;
  const targetLifecycle = typeof input.targetLifecycle === "string" ? input.targetLifecycle : null;
  const schemaVersion = typeof input.schemaVersion === "string" ? input.schemaVersion : null;
  const integrationContract = isPlainObject(input.integrationContract)
    ? input.integrationContract
    : null;
  const adapterCapabilities = isPlainObject(input.adapterCapabilities)
    ? input.adapterCapabilities
    : null;

  const ruleStatuses = [
    evaluateVersionAlignment(sourceVersion, targetVersion),
    evaluateSurfaceCoverage(integrationContract),
    evaluateLifecycleCompatibility(sourceLifecycle, targetLifecycle),
    evaluateAdapterCapabilityMatch(adapterCapabilities),
    evaluateSchemaCompatibility(sourceVersion, targetVersion, schemaVersion),
    evaluateAdvisoryBoundary(integrationContract, adapterCapabilities)
  ];

  const compatibilityRules = COMPATIBILITY_RULE_DEFINITIONS.map((definition, index) =>
    deepFreeze({
      id: definition.id,
      label: definition.label,
      status: ruleStatuses[index]
    })
  );

  let satisfiedCount = 0;
  let partialCount = 0;
  let violatedCount = 0;
  let unknownCount = 0;

  for (let i = 0; i < compatibilityRules.length; i += 1) {
    const status = compatibilityRules[i].status;

    if (status === COMPATIBILITY_RULE_STATUS.SATISFIED) {
      satisfiedCount += 1;
    } else if (status === COMPATIBILITY_RULE_STATUS.PARTIAL) {
      partialCount += 1;
    } else if (status === COMPATIBILITY_RULE_STATUS.VIOLATED) {
      violatedCount += 1;
    } else {
      unknownCount += 1;
    }
  }

  const compatibilityStatus = resolveCompatibilityStatus(compatibilityRules);

  return deepFreeze({
    compatibilityStatus,
    compatibilitySummary: buildCompatibilitySummary(compatibilityStatus),
    compatibilityRules: Object.freeze(compatibilityRules),
    satisfiedCount,
    partialCount,
    violatedCount,
    unknownCount,
    recognized: true,
    advisoryMetadata: deepFreeze({
      advisoryOnly: true,
      persistent: false,
      generatedBy: "phase_138",
      phase: RECRUITMENT_WORKFLOW_CONTRACT_COMPATIBILITY_VALIDATOR_PHASE,
      architectureOnly: true,
      executed: false,
      persistenceEnabled: false,
      integrationPersistence: false,
      automationEnabled: false,
      alertingEnabled: false,
      historyTracking: false,
      sideEffects: false,
      mutatesInput: false,
      compatibilityValidatorOnly: true
    })
  });
}

module.exports = {
  RECRUITMENT_WORKFLOW_CONTRACT_COMPATIBILITY_VALIDATOR_PHASE,
  RECRUITMENT_WORKFLOW_CONTRACT_COMPATIBILITY_VALIDATOR_ENTITY,
  COMPATIBILITY_STATUS,
  COMPATIBILITY_RULE_STATUS,
  COMPATIBILITY_RULE_IDS,
  COMPATIBILITY_RULE_DEFINITIONS,
  VERSION_LIFECYCLE,
  RECRUITMENT_WORKFLOW_CONTRACT_COMPATIBILITY_VALIDATOR_METADATA,
  validateRecruitmentWorkflowContractCompatibility
};
