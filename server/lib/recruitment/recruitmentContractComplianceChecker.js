"use strict";

/**
 * Phase 146 — Recruitment Contract Compliance Checker (Advisory Only).
 *
 * Pure advisory checker verifying whether a simulated implementation satisfies
 * the Phase 145 implementation contract. Returns compliance status, satisfied
 * and missing requirements, warnings, and overall compliance score.
 * No database access, no persistence, no runtime imports, no side effects.
 * Never mutates input. Never persists output.
 *
 * No Express. No database. No filesystem. No network access.
 * No worker. No routing. No publishing. No execution changes.
 * No runtime module imports. No storage assumptions.
 */

const RECRUITMENT_CONTRACT_COMPLIANCE_CHECKER_PHASE = 146;

const RECRUITMENT_CONTRACT_COMPLIANCE_CHECKER_ENTITY =
  "recruitment_contract_compliance_checker";

const COMPLIANCE_CHECKER_SCHEMA_VERSION = "1.0.0";

const EXPECTED_CONTRACT_VERSION = "1.0.0";

const COMPLIANCE_STATUS = Object.freeze({
  COMPLIANT: "COMPLIANT",
  PARTIALLY_COMPLIANT: "PARTIALLY_COMPLIANT",
  NON_COMPLIANT: "NON_COMPLIANT",
  UNKNOWN: "UNKNOWN"
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

const REQUIRED_VALIDATION_IDS = Object.freeze([
  "VAL_CONTRACT_VERSION",
  "VAL_STAGE_COVERAGE",
  "VAL_CAPABILITY_COVERAGE",
  "VAL_EXECUTION_CONSTRAINTS",
  "VAL_ROLLBACK_PLAN",
  "VAL_RUNTIME_BOUNDARIES"
]);

const RECRUITMENT_CONTRACT_COMPLIANCE_CHECKER_METADATA = Object.freeze({
  phase: RECRUITMENT_CONTRACT_COMPLIANCE_CHECKER_PHASE,
  advisoryOnly: true,
  descriptiveOnly: true,
  readOnly: true,
  complianceOnly: true,
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
    132, 133, 134, 135, 136, 137, 138, 139, 140, 141, 142, 143, 144, 145
  ])
});

const RECRUITMENT_CONTRACT_COMPLIANCE_CHECKER_DESCRIPTOR = Object.freeze({
  entity: RECRUITMENT_CONTRACT_COMPLIANCE_CHECKER_ENTITY,
  domain: "recruitment",
  phase: RECRUITMENT_CONTRACT_COMPLIANCE_CHECKER_PHASE,
  description:
    "Pure advisory compliance checker against Phase 145 implementation contract.",
  schemaVersion: COMPLIANCE_CHECKER_SCHEMA_VERSION,
  metadata: RECRUITMENT_CONTRACT_COMPLIANCE_CHECKER_METADATA
});

const EXPECTED_RESULT_KEYS = Object.freeze([
  "recruitmentId",
  "complianceStatus",
  "satisfiedRequirements",
  "missingRequirements",
  "warnings",
  "overallComplianceScore",
  "confidence",
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
    } else if (isPlainObject(item) && typeof item.capabilityId === "string") {
      id = item.capabilityId;
    } else if (isPlainObject(item) && typeof item.stageId === "string") {
      id = item.stageId;
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
 * @param {*} input
 * @returns {*|null}
 */
function resolvePlanSource(input) {
  if (!isPlainObject(input)) {
    return null;
  }
  if (isPlainObject(input.implementationPlan)) {
    return input.implementationPlan;
  }
  if (isPlainObject(input.simulatedPlan)) {
    return input.simulatedPlan;
  }
  if (isPlainObject(input.dryRun) && isPlainObject(input.dryRun.implementationPlan)) {
    return input.dryRun.implementationPlan;
  }

  const planFields = [
    "contractVersion",
    "implementationStages",
    "stages",
    "supportedCapabilities",
    "capabilities",
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
 * @param {*} plan
 * @param {*} input
 * @returns {Readonly<Object>}
 */
function extractComplianceSignals(plan, input) {
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
      performsFilesystemWrites: false,
      publishesContent: false,
      dryRunSimulationStatus: null,
      dryRunReadinessScore: null
    });
  }

  const dryRun = isPlainObject(input) && isPlainObject(input.dryRun) ? input.dryRun : null;
  const simulation =
    isPlainObject(input) && isPlainObject(input.simulation) ? input.simulation : null;

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
    performsFilesystemWrites: plan.filesystemWrites === true,
    publishesContent: plan.publishContent === true || plan.publishingEnabled === true,
    dryRunSimulationStatus:
      dryRun && typeof dryRun.simulationStatus === "string"
        ? dryRun.simulationStatus
        : simulation && typeof simulation.simulationStatus === "string"
          ? simulation.simulationStatus
          : null,
    dryRunReadinessScore:
      dryRun &&
      isPlainObject(dryRun.simulatedReadiness) &&
      typeof dryRun.simulatedReadiness.readinessScore === "number"
        ? dryRun.simulatedReadiness.readinessScore
        : null
  });
}

/**
 * @param {ReadonlyArray<string>} present
 * @returns {Readonly<Object>}
 */
function buildPresentSet(present) {
  const set = Object.create(null);
  for (let i = 0; i < present.length; i += 1) {
    set[present[i]] = true;
  }
  return Object.freeze(set);
}

/**
 * @param {ReadonlyArray<string>} required
 * @param {Readonly<Object>} presentSet
 * @param {string} prefix
 * @returns {{ satisfied: Array<string>, missing: Array<string> }}
 */
function partitionRequirements(required, presentSet, prefix) {
  const satisfied = [];
  const missing = [];
  for (let i = 0; i < required.length; i += 1) {
    const id = required[i];
    const labeled = prefix ? prefix + ":" + id : id;
    if (presentSet[id] === true) {
      satisfied.push(labeled);
    } else {
      missing.push(labeled);
    }
  }
  return { satisfied, missing };
}

/**
 * @param {Readonly<Object>} signals
 * @returns {{
 *   satisfiedRequirements: Array<string>,
 *   missingRequirements: Array<string>,
 *   warnings: Array<string>
 * }}
 */
function evaluateCompliance(signals) {
  const satisfiedRequirements = [];
  const missingRequirements = [];
  const warnings = [];

  if (!signals.hasPlan) {
    missingRequirements.push("IMPLEMENTATION_PLAN");
    return { satisfiedRequirements, missingRequirements, warnings };
  }

  if (signals.contractVersion === EXPECTED_CONTRACT_VERSION) {
    satisfiedRequirements.push("VAL_CONTRACT_VERSION");
  } else {
    missingRequirements.push("VAL_CONTRACT_VERSION");
    if (signals.contractVersion != null) {
      warnings.push(
        "Contract version " +
          signals.contractVersion +
          " is incompatible with expected " +
          EXPECTED_CONTRACT_VERSION +
          "."
      );
    }
  }

  const stageSet = buildPresentSet(signals.stages);
  const stagePartition = partitionRequirements(REQUIRED_STAGE_IDS, stageSet, "STAGE");
  for (let i = 0; i < stagePartition.satisfied.length; i += 1) {
    satisfiedRequirements.push(stagePartition.satisfied[i]);
  }
  for (let i = 0; i < stagePartition.missing.length; i += 1) {
    missingRequirements.push(stagePartition.missing[i]);
  }
  if (stagePartition.missing.length === 0) {
    satisfiedRequirements.push("VAL_STAGE_COVERAGE");
  } else {
    missingRequirements.push("VAL_STAGE_COVERAGE");
  }

  const capabilitySet = buildPresentSet(signals.capabilities);
  const capPartition = partitionRequirements(
    REQUIRED_CAPABILITY_IDS,
    capabilitySet,
    "CAPABILITY"
  );
  for (let i = 0; i < capPartition.satisfied.length; i += 1) {
    satisfiedRequirements.push(capPartition.satisfied[i]);
  }
  for (let i = 0; i < capPartition.missing.length; i += 1) {
    missingRequirements.push(capPartition.missing[i]);
  }
  if (capPartition.missing.length === 0) {
    satisfiedRequirements.push("VAL_CAPABILITY_COVERAGE");
  } else {
    missingRequirements.push("VAL_CAPABILITY_COVERAGE");
  }

  const execSet = buildPresentSet(signals.executionRequirements);
  const execPartition = partitionRequirements(REQUIRED_EXECUTION_IDS, execSet, null);
  for (let i = 0; i < execPartition.satisfied.length; i += 1) {
    satisfiedRequirements.push(execPartition.satisfied[i]);
  }
  for (let i = 0; i < execPartition.missing.length; i += 1) {
    missingRequirements.push(execPartition.missing[i]);
  }
  if (execPartition.missing.length === 0) {
    satisfiedRequirements.push("VAL_EXECUTION_CONSTRAINTS");
  } else {
    missingRequirements.push("VAL_EXECUTION_CONSTRAINTS");
  }

  const rollbackSet = buildPresentSet(signals.rollbackRequirements);
  const rollbackPartition = partitionRequirements(REQUIRED_ROLLBACK_IDS, rollbackSet, null);
  for (let i = 0; i < rollbackPartition.satisfied.length; i += 1) {
    satisfiedRequirements.push(rollbackPartition.satisfied[i]);
  }
  for (let i = 0; i < rollbackPartition.missing.length; i += 1) {
    missingRequirements.push(rollbackPartition.missing[i]);
  }
  if (rollbackPartition.missing.length === 0) {
    satisfiedRequirements.push("VAL_ROLLBACK_PLAN");
  } else {
    missingRequirements.push("VAL_ROLLBACK_PLAN");
  }

  const boundarySet = buildPresentSet(signals.runtimeBoundaries);
  const boundaryPartition = partitionRequirements(REQUIRED_BOUNDARY_IDS, boundarySet, null);
  for (let i = 0; i < boundaryPartition.satisfied.length; i += 1) {
    satisfiedRequirements.push(boundaryPartition.satisfied[i]);
  }
  for (let i = 0; i < boundaryPartition.missing.length; i += 1) {
    missingRequirements.push(boundaryPartition.missing[i]);
  }
  if (boundaryPartition.missing.length === 0) {
    satisfiedRequirements.push("VAL_RUNTIME_BOUNDARIES");
  } else {
    missingRequirements.push("VAL_RUNTIME_BOUNDARIES");
  }

  if (signals.activatesRuntime) {
    warnings.push("Plan enables runtime wiring which violates Phase 145 execution requirements.");
  }
  if (signals.enablesRollout) {
    warnings.push("Plan enables rollout activation which violates Phase 145 execution requirements.");
  }
  if (signals.enablesFlags) {
    warnings.push(
      "Plan enables feature flag execution which violates Phase 145 execution requirements."
    );
  }
  if (signals.performsDbWrites) {
    warnings.push("Plan indicates database writes which violate Phase 145 execution requirements.");
  }
  if (signals.performsFilesystemWrites) {
    warnings.push(
      "Plan indicates filesystem writes which violate Phase 145 execution requirements."
    );
  }
  if (signals.publishesContent) {
    warnings.push("Plan indicates content publishing which violates Phase 145 execution requirements.");
  }

  if (
    signals.dryRunSimulationStatus === "SIMULATION_BLOCKED" ||
    signals.dryRunSimulationStatus === "SIMULATION_EMPTY"
  ) {
    warnings.push(
      "Dry-run simulation status " +
        signals.dryRunSimulationStatus +
        " indicates incomplete contract satisfaction."
    );
  }

  if (
    typeof signals.dryRunReadinessScore === "number" &&
    signals.dryRunReadinessScore < 80
  ) {
    warnings.push(
      "Dry-run readiness score " +
        signals.dryRunReadinessScore +
        " is below preferred compliance threshold."
    );
  }

  satisfiedRequirements.sort();
  missingRequirements.sort();
  warnings.sort();

  return { satisfiedRequirements, missingRequirements, warnings };
}

/**
 * @param {ReadonlyArray<string>} satisfiedRequirements
 * @param {ReadonlyArray<string>} missingRequirements
 * @param {ReadonlyArray<string>} warnings
 * @param {boolean} hasPlan
 * @returns {number}
 */
function calculateOverallComplianceScore(
  satisfiedRequirements,
  missingRequirements,
  warnings,
  hasPlan
) {
  if (!hasPlan) {
    return 0;
  }

  const totalChecks =
    1 +
    REQUIRED_STAGE_IDS.length +
    REQUIRED_CAPABILITY_IDS.length +
    REQUIRED_EXECUTION_IDS.length +
    REQUIRED_ROLLBACK_IDS.length +
    REQUIRED_BOUNDARY_IDS.length +
    REQUIRED_VALIDATION_IDS.length;

  const uniqueSatisfied = satisfiedRequirements.length;
  const uniqueMissing = missingRequirements.length;
  const accounted = uniqueSatisfied + uniqueMissing;
  const denominator = accounted > 0 ? accounted : totalChecks;

  let score = Math.round((uniqueSatisfied / denominator) * 100);
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
 * @param {number} overallComplianceScore
 * @param {ReadonlyArray<string>} missingRequirements
 * @param {ReadonlyArray<string>} warnings
 * @param {boolean} hasPlan
 * @returns {string}
 */
function resolveComplianceStatus(
  overallComplianceScore,
  missingRequirements,
  warnings,
  hasPlan
) {
  if (!hasPlan) {
    return COMPLIANCE_STATUS.UNKNOWN;
  }
  if (missingRequirements.length === 0 && warnings.length === 0 && overallComplianceScore >= 100) {
    return COMPLIANCE_STATUS.COMPLIANT;
  }
  if (missingRequirements.length === 0 && overallComplianceScore >= 80) {
    return COMPLIANCE_STATUS.PARTIALLY_COMPLIANT;
  }
  if (missingRequirements.length > 0 && overallComplianceScore >= 40) {
    return COMPLIANCE_STATUS.PARTIALLY_COMPLIANT;
  }
  if (missingRequirements.length > 0) {
    return COMPLIANCE_STATUS.NON_COMPLIANT;
  }
  return COMPLIANCE_STATUS.NON_COMPLIANT;
}

/**
 * @param {number} overallComplianceScore
 * @param {ReadonlyArray<string>} warnings
 * @param {boolean} hasPlan
 * @returns {number}
 */
function calculateConfidence(overallComplianceScore, warnings, hasPlan) {
  if (!hasPlan) {
    return 0;
  }
  let score = Math.round(overallComplianceScore * 0.85) + 10;
  score -= warnings.length * 3;
  if (score < 0) {
    return 0;
  }
  if (score > 100) {
    return 100;
  }
  return score;
}

/**
 * @param {*} input
 * @returns {Readonly<Object>}
 */
function checkRecruitmentContractCompliance(input) {
  const hasInput = isPlainObject(input);
  const safeInput = hasInput ? input : {};
  const recruitmentId = resolveRecruitmentId(safeInput.recruitmentId);
  const plan = resolvePlanSource(input);
  const signals = extractComplianceSignals(plan, input);
  const evaluation = evaluateCompliance(signals);
  const overallComplianceScore = calculateOverallComplianceScore(
    evaluation.satisfiedRequirements,
    evaluation.missingRequirements,
    evaluation.warnings,
    signals.hasPlan
  );
  const complianceStatus = resolveComplianceStatus(
    overallComplianceScore,
    evaluation.missingRequirements,
    evaluation.warnings,
    signals.hasPlan
  );
  const confidence = calculateConfidence(
    overallComplianceScore,
    evaluation.warnings,
    signals.hasPlan
  );

  return deepFreeze({
    recruitmentId,
    complianceStatus,
    satisfiedRequirements: Object.freeze(evaluation.satisfiedRequirements.slice()),
    missingRequirements: Object.freeze(evaluation.missingRequirements.slice()),
    warnings: Object.freeze(evaluation.warnings.slice()),
    overallComplianceScore,
    confidence,
    generatedMetadata: Object.freeze({
      generatedAt: "deterministic",
      generatedBy: "phase_146",
      schemaVersion: COMPLIANCE_CHECKER_SCHEMA_VERSION,
      deterministic: true,
      phase: RECRUITMENT_CONTRACT_COMPLIANCE_CHECKER_PHASE,
      advisoryOnly: true,
      runtimeImpact: "none",
      complianceOnly: true,
      expectedContractVersion: EXPECTED_CONTRACT_VERSION,
      sourceContractPhase: 145
    }),
    advisoryMetadata: Object.freeze({
      advisoryOnly: true,
      descriptiveOnly: true,
      persistent: false,
      generatedBy: "phase_146",
      phase: RECRUITMENT_CONTRACT_COMPLIANCE_CHECKER_PHASE,
      complianceOnly: true,
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
function isRecruitmentContractComplianceResult(value) {
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
  RECRUITMENT_CONTRACT_COMPLIANCE_CHECKER_PHASE,
  RECRUITMENT_CONTRACT_COMPLIANCE_CHECKER_ENTITY,
  COMPLIANCE_CHECKER_SCHEMA_VERSION,
  EXPECTED_CONTRACT_VERSION,
  COMPLIANCE_STATUS,
  REQUIRED_STAGE_IDS,
  REQUIRED_CAPABILITY_IDS,
  REQUIRED_EXECUTION_IDS,
  REQUIRED_ROLLBACK_IDS,
  REQUIRED_BOUNDARY_IDS,
  REQUIRED_VALIDATION_IDS,
  RECRUITMENT_CONTRACT_COMPLIANCE_CHECKER_METADATA,
  RECRUITMENT_CONTRACT_COMPLIANCE_CHECKER_DESCRIPTOR,
  EXPECTED_RESULT_KEYS,
  checkRecruitmentContractCompliance,
  isRecruitmentContractComplianceResult
};
