"use strict";

/**
 * Phase 145 — Recruitment Implementation Validator (Advisory Only).
 *
 * Pure validator that evaluates whether a future implementation plan satisfies
 * the Implementation Readiness Contract. Returns validation status, findings,
 * missing requirements, warnings, and readiness score. No database access,
 * no persistence, no runtime imports, no side effects. No automation.
 * Never mutates input. Never persists output.
 *
 * No Express. No database. No filesystem. No network access.
 * No worker. No routing. No publishing. No execution changes.
 * No runtime module imports. No storage assumptions.
 */

const RECRUITMENT_IMPLEMENTATION_VALIDATOR_PHASE = 145;

const RECRUITMENT_IMPLEMENTATION_VALIDATOR_ENTITY =
  "recruitment_implementation_validator";

const VALIDATOR_SCHEMA_VERSION = "1.0.0";

const EXPECTED_CONTRACT_VERSION = "1.0.0";

const VALIDATION_STATUS = Object.freeze({
  VALID: "VALID",
  PARTIALLY_VALID: "PARTIALLY_VALID",
  INVALID: "INVALID",
  UNKNOWN: "UNKNOWN"
});

const FINDING_SEVERITY = Object.freeze({
  INFO: "INFO",
  WARNING: "WARNING",
  ERROR: "ERROR"
});

const REQUIRED_STAGE_IDS = Object.freeze([
  "STAGE_CONTRACT_ALIGNMENT",
  "STAGE_ADAPTER_SCAFFOLD",
  "STAGE_FEATURE_FLAG_INFRASTRUCTURE",
  "STAGE_SHADOW_OBSERVATION",
  "STAGE_GOVERNANCE_GATES",
  "STAGE_CONTROLLED_COUPLING",
  "STAGE_MONITORING_VERIFICATION",
  "STAGE_ROLLBACK_READINESS"
]);

const REQUIRED_CAPABILITY_IDS = Object.freeze([
  "CAP_RUNTIME_ADAPTER",
  "CAP_FEATURE_FLAGS",
  "CAP_SHADOW_MODE",
  "CAP_GOVERNANCE_GATES",
  "CAP_CONTROLLED_COUPLING",
  "CAP_MONITORING",
  "CAP_ROLLBACK",
  "CAP_BOUNDARY_ISOLATION"
]);

const REQUIRED_EXECUTION_IDS = Object.freeze([
  "EXEC_NO_RUNTIME_WIRING",
  "EXEC_NO_FEATURE_FLAG_ACTIVATION",
  "EXEC_NO_ROLLOUT",
  "EXEC_NO_DB_WRITES",
  "EXEC_NO_FILESYSTEM_WRITES",
  "EXEC_NO_PUBLISHING",
  "EXEC_DETERMINISTIC_PLANNING"
]);

const REQUIRED_ROLLBACK_IDS = Object.freeze([
  "RB_DISABLE_FLAGS",
  "RB_DISCONNECT_ADAPTER",
  "RB_RESTORE_ISOLATION",
  "RB_NO_PERSISTED_SIDE_EFFECTS",
  "RB_VERIFICATION_CHECKPOINT"
]);

const REQUIRED_BOUNDARY_IDS = Object.freeze([
  "BOUNDARY_ORCHESTRATOR",
  "BOUNDARY_COORDINATOR",
  "BOUNDARY_WORKER",
  "BOUNDARY_GATEWAY",
  "BOUNDARY_PIPELINE"
]);

const RECRUITMENT_IMPLEMENTATION_VALIDATOR_METADATA = Object.freeze({
  phase: RECRUITMENT_IMPLEMENTATION_VALIDATOR_PHASE,
  advisoryOnly: true,
  descriptiveOnly: true,
  readOnly: true,
  validationOnly: true,
  architectureOnly: true,
  runtimeIntegration: false,
  persistenceEnabled: false,
  persistent: false,
  queriesDatabase: false,
  sideEffects: false,
  mutatesInput: false,
  mutatesProduction: false,
  performsStateTransitions: false,
  flagExecutionEnabled: false,
  rolloutActivationEnabled: false,
  runtimeWiringEnabled: false,
  executed: false,
  activatesAnything: false,
  sourcePhases: Object.freeze([
    114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131,
    132, 133, 134, 135, 136, 137, 138, 139, 140, 141, 142, 143, 144
  ])
});

const RECRUITMENT_IMPLEMENTATION_VALIDATOR_DESCRIPTOR = Object.freeze({
  entity: RECRUITMENT_IMPLEMENTATION_VALIDATOR_ENTITY,
  domain: "recruitment",
  phase: RECRUITMENT_IMPLEMENTATION_VALIDATOR_PHASE,
  description:
    "Pure validator assessing whether a future implementation plan satisfies the readiness contract.",
  schemaVersion: VALIDATOR_SCHEMA_VERSION,
  metadata: RECRUITMENT_IMPLEMENTATION_VALIDATOR_METADATA
});

const EXPECTED_RESULT_KEYS = Object.freeze([
  "recruitmentId",
  "valid",
  "validationStatus",
  "findings",
  "missingRequirements",
  "warnings",
  "readinessScore",
  "generatedMetadata",
  "advisoryMetadata"
]);

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
 * @param {*} recruitmentId
 * @returns {string}
 */
function resolveRecruitmentId(recruitmentId) {
  if (recruitmentId == null || recruitmentId === "") {
    return "UNKNOWN";
  }
  return String(recruitmentId);
}

/**
 * @param {*} value
 * @returns {ReadonlyArray<string>}
 */
function normalizeIdList(value) {
  if (!Array.isArray(value)) {
    return Object.freeze([]);
  }
  const result = [];
  const seen = Object.create(null);
  for (let i = 0; i < value.length; i += 1) {
    const item = value[i];
    let id = null;
    if (typeof item === "string") {
      id = item;
    } else if (isPlainObject(item) && typeof item.id === "string") {
      id = item.id;
    }
    if (id != null && seen[id] !== true) {
      seen[id] = true;
      result.push(id);
    }
  }
  result.sort();
  return Object.freeze(result);
}

/**
 * @param {ReadonlyArray<string>} present
 * @param {ReadonlyArray<string>} required
 * @returns {ReadonlyArray<string>}
 */
function findMissingIds(present, required) {
  const presentSet = Object.create(null);
  for (let i = 0; i < present.length; i += 1) {
    presentSet[present[i]] = true;
  }
  const missing = [];
  for (let i = 0; i < required.length; i += 1) {
    if (presentSet[required[i]] !== true) {
      missing.push(required[i]);
    }
  }
  return Object.freeze(missing);
}

/**
 * @param {*} plan
 * @returns {Readonly<Object>}
 */
function extractPlanSignals(plan) {
  if (!isPlainObject(plan)) {
    return Object.freeze({
      hasPlan: false,
      contractVersion: null,
      stages: Object.freeze([]),
      capabilities: Object.freeze([]),
      executionRequirements: Object.freeze([]),
      rollbackRequirements: Object.freeze([]),
      runtimeBoundaries: Object.freeze([]),
      activatesRuntime: false,
      enablesRollout: false,
      enablesFlags: false,
      performsDbWrites: false,
      performsFilesystemWrites: false
    });
  }

  return Object.freeze({
    hasPlan: true,
    contractVersion:
      typeof plan.contractVersion === "string" ? plan.contractVersion : null,
    stages: normalizeIdList(
      plan.implementationStages || plan.stages || plan.requestedStages
    ),
    capabilities: normalizeIdList(
      plan.supportedCapabilities || plan.capabilities || plan.requestedCapabilities
    ),
    executionRequirements: normalizeIdList(
      plan.executionRequirements || plan.acknowledgedExecutionRequirements
    ),
    rollbackRequirements: normalizeIdList(
      plan.rollbackRequirements || plan.acknowledgedRollbackRequirements
    ),
    runtimeBoundaries: normalizeIdList(
      plan.runtimeBoundaries || plan.acknowledgedRuntimeBoundaries
    ),
    activatesRuntime: plan.runtimeWiringEnabled === true || plan.activateRuntime === true,
    enablesRollout: plan.rolloutActivationEnabled === true || plan.activateRollout === true,
    enablesFlags: plan.flagExecutionEnabled === true || plan.activateFlags === true,
    performsDbWrites: plan.persistenceEnabled === true || plan.dbWrites === true,
    performsFilesystemWrites: plan.filesystemWrites === true
  });
}

/**
 * @param {string} id
 * @param {string} severity
 * @param {string} message
 * @param {string} category
 * @returns {Readonly<Object>}
 */
function buildFinding(id, severity, message, category) {
  return Object.freeze({
    id,
    severity,
    message,
    category
  });
}

/**
 * @param {Readonly<Object>} signals
 * @returns {{ findings: Array, missingRequirements: Array, warnings: Array }}
 */
function evaluatePlan(signals) {
  const findings = [];
  const missingRequirements = [];
  const warnings = [];

  if (!signals.hasPlan) {
    findings.push(
      buildFinding(
        "FIND_NO_PLAN",
        FINDING_SEVERITY.ERROR,
        "No implementation plan provided for contract validation.",
        "input"
      )
    );
    missingRequirements.push("IMPLEMENTATION_PLAN");
    return { findings, missingRequirements, warnings };
  }

  if (signals.contractVersion == null) {
    findings.push(
      buildFinding(
        "FIND_MISSING_CONTRACT_VERSION",
        FINDING_SEVERITY.ERROR,
        "Implementation plan is missing contractVersion.",
        "contractVersion"
      )
    );
    missingRequirements.push("VAL_CONTRACT_VERSION");
  } else if (signals.contractVersion !== EXPECTED_CONTRACT_VERSION) {
    findings.push(
      buildFinding(
        "FIND_INCOMPATIBLE_CONTRACT_VERSION",
        FINDING_SEVERITY.ERROR,
        "Implementation plan contractVersion is incompatible with expected " +
          EXPECTED_CONTRACT_VERSION +
          ".",
        "contractVersion"
      )
    );
    missingRequirements.push("VAL_CONTRACT_VERSION");
  } else {
    findings.push(
      buildFinding(
        "FIND_CONTRACT_VERSION_OK",
        FINDING_SEVERITY.INFO,
        "Implementation plan declares compatible contractVersion.",
        "contractVersion"
      )
    );
  }

  const missingStages = findMissingIds(signals.stages, REQUIRED_STAGE_IDS);
  for (let i = 0; i < missingStages.length; i += 1) {
    missingRequirements.push(missingStages[i]);
    findings.push(
      buildFinding(
        "FIND_MISSING_STAGE_" + missingStages[i],
        FINDING_SEVERITY.ERROR,
        "Missing required implementation stage: " + missingStages[i],
        "implementationStages"
      )
    );
  }
  if (missingStages.length === 0) {
    findings.push(
      buildFinding(
        "FIND_STAGES_OK",
        FINDING_SEVERITY.INFO,
        "All required implementation stages are present.",
        "implementationStages"
      )
    );
  }

  const missingCapabilities = findMissingIds(signals.capabilities, REQUIRED_CAPABILITY_IDS);
  for (let i = 0; i < missingCapabilities.length; i += 1) {
    missingRequirements.push(missingCapabilities[i]);
    findings.push(
      buildFinding(
        "FIND_MISSING_CAPABILITY_" + missingCapabilities[i],
        FINDING_SEVERITY.ERROR,
        "Missing required capability: " + missingCapabilities[i],
        "supportedCapabilities"
      )
    );
  }
  if (missingCapabilities.length === 0) {
    findings.push(
      buildFinding(
        "FIND_CAPABILITIES_OK",
        FINDING_SEVERITY.INFO,
        "All required supported capabilities are present.",
        "supportedCapabilities"
      )
    );
  }

  const missingExecution = findMissingIds(signals.executionRequirements, REQUIRED_EXECUTION_IDS);
  for (let i = 0; i < missingExecution.length; i += 1) {
    missingRequirements.push(missingExecution[i]);
    findings.push(
      buildFinding(
        "FIND_MISSING_EXEC_" + missingExecution[i],
        FINDING_SEVERITY.ERROR,
        "Missing mandatory execution requirement: " + missingExecution[i],
        "executionRequirements"
      )
    );
  }

  const missingRollback = findMissingIds(signals.rollbackRequirements, REQUIRED_ROLLBACK_IDS);
  for (let i = 0; i < missingRollback.length; i += 1) {
    missingRequirements.push(missingRollback[i]);
    findings.push(
      buildFinding(
        "FIND_MISSING_ROLLBACK_" + missingRollback[i],
        FINDING_SEVERITY.ERROR,
        "Missing mandatory rollback requirement: " + missingRollback[i],
        "rollbackRequirements"
      )
    );
  }

  const missingBoundaries = findMissingIds(signals.runtimeBoundaries, REQUIRED_BOUNDARY_IDS);
  for (let i = 0; i < missingBoundaries.length; i += 1) {
    missingRequirements.push(missingBoundaries[i]);
    findings.push(
      buildFinding(
        "FIND_MISSING_BOUNDARY_" + missingBoundaries[i],
        FINDING_SEVERITY.ERROR,
        "Missing runtime boundary acknowledgment: " + missingBoundaries[i],
        "runtimeBoundaries"
      )
    );
  }

  if (signals.activatesRuntime) {
    const warning =
      "Plan enables runtime wiring which violates execution requirements.";
    warnings.push(warning);
    findings.push(
      buildFinding("FIND_RUNTIME_WIRING", FINDING_SEVERITY.WARNING, warning, "execution")
    );
  }
  if (signals.enablesRollout) {
    const warning = "Plan enables rollout activation which is prohibited by contract.";
    warnings.push(warning);
    findings.push(
      buildFinding("FIND_ROLLOUT_ENABLED", FINDING_SEVERITY.WARNING, warning, "execution")
    );
  }
  if (signals.enablesFlags) {
    const warning = "Plan enables feature flag execution which is prohibited by contract.";
    warnings.push(warning);
    findings.push(
      buildFinding("FIND_FLAGS_ENABLED", FINDING_SEVERITY.WARNING, warning, "execution")
    );
  }
  if (signals.performsDbWrites) {
    const warning = "Plan indicates database writes which violate execution requirements.";
    warnings.push(warning);
    findings.push(
      buildFinding("FIND_DB_WRITES", FINDING_SEVERITY.WARNING, warning, "execution")
    );
  }
  if (signals.performsFilesystemWrites) {
    const warning = "Plan indicates filesystem writes which violate execution requirements.";
    warnings.push(warning);
    findings.push(
      buildFinding("FIND_FS_WRITES", FINDING_SEVERITY.WARNING, warning, "execution")
    );
  }

  findings.sort(function compareFindings(a, b) {
    if (a.category < b.category) {
      return -1;
    }
    if (a.category > b.category) {
      return 1;
    }
    if (a.id < b.id) {
      return -1;
    }
    if (a.id > b.id) {
      return 1;
    }
    return 0;
  });
  missingRequirements.sort();
  warnings.sort();

  return { findings, missingRequirements, warnings };
}

/**
 * @param {ReadonlyArray<string>} missingRequirements
 * @param {ReadonlyArray<string>} warnings
 * @param {boolean} hasPlan
 * @returns {number}
 */
function calculateReadinessScore(missingRequirements, warnings, hasPlan) {
  if (!hasPlan) {
    return 0;
  }

  const totalChecks =
    1 +
    REQUIRED_STAGE_IDS.length +
    REQUIRED_CAPABILITY_IDS.length +
    REQUIRED_EXECUTION_IDS.length +
    REQUIRED_ROLLBACK_IDS.length +
    REQUIRED_BOUNDARY_IDS.length;

  const satisfied = totalChecks - missingRequirements.length;
  let score = Math.round((satisfied / totalChecks) * 100);

  score -= warnings.length * 5;
  if (score < 0) {
    return 0;
  }
  if (score > 100) {
    return 100;
  }
  return score;
}

/**
 * @param {number} readinessScore
 * @param {ReadonlyArray<string>} missingRequirements
 * @param {ReadonlyArray<string>} warnings
 * @param {boolean} hasPlan
 * @returns {{ valid: boolean, validationStatus: string }}
 */
function resolveValidationOutcome(readinessScore, missingRequirements, warnings, hasPlan) {
  if (!hasPlan) {
    return { valid: false, validationStatus: VALIDATION_STATUS.UNKNOWN };
  }
  if (missingRequirements.length === 0 && warnings.length === 0 && readinessScore >= 100) {
    return { valid: true, validationStatus: VALIDATION_STATUS.VALID };
  }
  if (missingRequirements.length === 0 && readinessScore >= 80) {
    return { valid: true, validationStatus: VALIDATION_STATUS.PARTIALLY_VALID };
  }
  if (missingRequirements.length > 0 && readinessScore >= 40) {
    return { valid: false, validationStatus: VALIDATION_STATUS.PARTIALLY_VALID };
  }
  if (missingRequirements.length > 0) {
    return { valid: false, validationStatus: VALIDATION_STATUS.INVALID };
  }
  return { valid: false, validationStatus: VALIDATION_STATUS.INVALID };
}

/**
 * @param {*} input
 * @returns {*|null}
 */
function resolveImplementationPlan(input) {
  if (!isPlainObject(input)) {
    return null;
  }
  if (isPlainObject(input.implementationPlan)) {
    return input.implementationPlan;
  }

  const planFields = [
    "contractVersion",
    "implementationStages",
    "stages",
    "requestedStages",
    "supportedCapabilities",
    "capabilities",
    "requestedCapabilities",
    "executionRequirements",
    "rollbackRequirements",
    "runtimeBoundaries"
  ];
  for (let i = 0; i < planFields.length; i += 1) {
    if (Object.prototype.hasOwnProperty.call(input, planFields[i])) {
      return input;
    }
  }
  return null;
}

/**
 * @param {*} input
 * @returns {Readonly<Object>}
 */
function validateRecruitmentImplementationPlan(input) {
  const hasInput = isPlainObject(input);
  const safeInput = hasInput ? input : {};
  const recruitmentId = resolveRecruitmentId(safeInput.recruitmentId);
  const signals = extractPlanSignals(resolveImplementationPlan(input));

  const evaluation = evaluatePlan(signals);
  const readinessScore = calculateReadinessScore(
    evaluation.missingRequirements,
    evaluation.warnings,
    signals.hasPlan
  );
  const outcome = resolveValidationOutcome(
    readinessScore,
    evaluation.missingRequirements,
    evaluation.warnings,
    signals.hasPlan
  );

  return deepFreeze({
    recruitmentId,
    valid: outcome.valid,
    validationStatus: outcome.validationStatus,
    findings: Object.freeze(evaluation.findings.slice()),
    missingRequirements: Object.freeze(evaluation.missingRequirements.slice()),
    warnings: Object.freeze(evaluation.warnings.slice()),
    readinessScore,
    generatedMetadata: Object.freeze({
      generatedAt: "deterministic",
      generatedBy: "phase_145",
      schemaVersion: VALIDATOR_SCHEMA_VERSION,
      deterministic: true,
      phase: RECRUITMENT_IMPLEMENTATION_VALIDATOR_PHASE,
      advisoryOnly: true,
      runtimeImpact: "none",
      validationOnly: true,
      expectedContractVersion: EXPECTED_CONTRACT_VERSION
    }),
    advisoryMetadata: Object.freeze({
      advisoryOnly: true,
      descriptiveOnly: true,
      persistent: false,
      generatedBy: "phase_145",
      phase: RECRUITMENT_IMPLEMENTATION_VALIDATOR_PHASE,
      validationOnly: true,
      executed: false,
      runtimeIntegration: false,
      persistenceEnabled: false,
      sideEffects: false,
      mutatesInput: false,
      mutatesProduction: false,
      flagExecutionEnabled: false,
      rolloutActivationEnabled: false,
      runtimeWiringEnabled: false,
      activatesAnything: false
    })
  });
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function isRecruitmentImplementationValidation(value) {
  if (!isPlainObject(value)) {
    return false;
  }
  for (let i = 0; i < EXPECTED_RESULT_KEYS.length; i += 1) {
    if (!Object.prototype.hasOwnProperty.call(value, EXPECTED_RESULT_KEYS[i])) {
      return false;
    }
  }
  if (value.advisoryMetadata == null || value.advisoryMetadata.advisoryOnly !== true) {
    return false;
  }
  if (value.advisoryMetadata.executed !== false) {
    return false;
  }
  if (!Object.isFrozen(value)) {
    return false;
  }
  return true;
}

module.exports = {
  RECRUITMENT_IMPLEMENTATION_VALIDATOR_PHASE,
  RECRUITMENT_IMPLEMENTATION_VALIDATOR_ENTITY,
  VALIDATOR_SCHEMA_VERSION,
  EXPECTED_CONTRACT_VERSION,
  VALIDATION_STATUS,
  FINDING_SEVERITY,
  REQUIRED_STAGE_IDS,
  REQUIRED_CAPABILITY_IDS,
  REQUIRED_EXECUTION_IDS,
  REQUIRED_ROLLBACK_IDS,
  REQUIRED_BOUNDARY_IDS,
  RECRUITMENT_IMPLEMENTATION_VALIDATOR_METADATA,
  RECRUITMENT_IMPLEMENTATION_VALIDATOR_DESCRIPTOR,
  EXPECTED_RESULT_KEYS,
  validateRecruitmentImplementationPlan,
  isRecruitmentImplementationValidation
};
