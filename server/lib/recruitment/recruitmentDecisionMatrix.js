"use strict";

/**
 * Phase 147 — Recruitment Decision Matrix (Advisory Only).
 *
 * Pure advisory implementation decision generator. No database access,
 * no persistence, no runtime imports, no side effects. No automation.
 * Never mutates input. Never persists output.
 *
 * No Express. No database. No filesystem. No network access.
 * No worker. No routing. No publishing. No execution changes.
 * No runtime module imports. No storage assumptions.
 */

const RECRUITMENT_DECISION_MATRIX_PHASE = 147;

const RECRUITMENT_DECISION_MATRIX_ENTITY = "recruitment_decision_matrix";

const DECISION_MATRIX_SCHEMA_VERSION = "1.0.0";

const IMPLEMENTATION_DECISION = Object.freeze({
  PROCEED_TO_NEXT_REVIEW: "PROCEED_TO_NEXT_REVIEW",
  COMPLETE_PREREQUISITES: "COMPLETE_PREREQUISITES",
  REVISE_IMPLEMENTATION_PLAN: "REVISE_IMPLEMENTATION_PLAN",
  PERFORM_ADDITIONAL_VALIDATION: "PERFORM_ADDITIONAL_VALIDATION",
  ROLLBACK_RECOMMENDED: "ROLLBACK_RECOMMENDED",
  REVIEW_REQUIRED: "REVIEW_REQUIRED"
});

const DECISION_PRIORITY = Object.freeze({
  PROCEED_TO_NEXT_REVIEW: 1,
  COMPLETE_PREREQUISITES: 2,
  PERFORM_ADDITIONAL_VALIDATION: 3,
  REVISE_IMPLEMENTATION_PLAN: 4,
  REVIEW_REQUIRED: 5,
  ROLLBACK_RECOMMENDED: 6
});

const SCENARIO_STATUS = Object.freeze({
  MATCHED: "SCENARIO_MATCHED",
  PARTIAL: "SCENARIO_PARTIAL",
  UNMATCHED: "SCENARIO_UNMATCHED",
  INVALID: "SCENARIO_INVALID",
  EMPTY: "SCENARIO_EMPTY",
  UNKNOWN: "SCENARIO_UNKNOWN"
});

const IMPLEMENTATION_SCENARIO_IDS = Object.freeze({
  COMPLETE_IMPLEMENTATION: "COMPLETE_IMPLEMENTATION",
  PARTIAL_IMPLEMENTATION: "PARTIAL_IMPLEMENTATION",
  MISSING_PREREQUISITES: "MISSING_PREREQUISITES",
  DEPENDENCY_FAILURE: "DEPENDENCY_FAILURE",
  ROLLBACK_REQUIRED: "ROLLBACK_REQUIRED",
  VALIDATION_FAILURE: "VALIDATION_FAILURE",
  OBSERVABILITY_INCOMPLETE: "OBSERVABILITY_INCOMPLETE",
  GOVERNANCE_REVIEW_REQUIRED: "GOVERNANCE_REVIEW_REQUIRED"
});

const RECRUITMENT_DECISION_MATRIX_METADATA = Object.freeze({
  phase: RECRUITMENT_DECISION_MATRIX_PHASE,
  advisoryOnly: true,
  descriptiveOnly: true,
  readOnly: true,
  simulationOnly: true,
  decisionMatrixOnly: true,
  architectureOnly: true,
  runtimeIntegration: false,
  persistenceEnabled: false,
  automationEnabled: false,
  alertingEnabled: false,
  historyTracking: false,
  sideEffects: false,
  mutatesInput: false,
  mutatesProduction: false,
  executed: false,
  activated: false,
  activatesAnything: false,
  flagExecutionEnabled: false,
  rolloutActivationEnabled: false,
  runtimeWiringEnabled: false,
  sourcePhases: Object.freeze([145, 146, 147])
});

const RECRUITMENT_DECISION_MATRIX_DESCRIPTOR = Object.freeze({
  phase: RECRUITMENT_DECISION_MATRIX_PHASE,
  entity: RECRUITMENT_DECISION_MATRIX_ENTITY,
  schemaVersion: DECISION_MATRIX_SCHEMA_VERSION,
  description:
    "Pure advisory implementation decision matrix without execution or activation.",
  advisoryOnly: true
});

const EXPECTED_RESULT_KEYS = Object.freeze([
  "recruitmentId",
  "decision",
  "rationale",
  "supportingFactors",
  "blockingFactors",
  "confidence",
  "scenarioId",
  "generatedMetadata",
  "advisoryMetadata"
]);

const DECISION_RATIONALE = Object.freeze({
  PROCEED_TO_NEXT_REVIEW:
    "Scenario evaluation matched complete implementation conditions with sufficient confidence for next advisory review.",
  COMPLETE_PREREQUISITES:
    "Missing prerequisites block further advisory progression; complete prerequisites before continuing.",
  REVISE_IMPLEMENTATION_PLAN:
    "Implementation plan coverage is partial or mismatched; revise the plan to restore advisory alignment.",
  PERFORM_ADDITIONAL_VALIDATION:
    "Validation or observability gaps require additional advisory validation before progression.",
  ROLLBACK_RECOMMENDED:
    "Rollback or dependency failure signals indicate advisory rollback should be recommended.",
  REVIEW_REQUIRED:
    "Governance or ambiguous evaluation signals require advisory human review before progression."
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
 * @param {*} value
 * @returns {string}
 */
function resolveRecruitmentId(value) {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return "UNKNOWN";
}

/**
 * @param {*} value
 * @returns {number}
 */
function resolveConfidence(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }
  if (value < 0) {
    return 0;
  }
  if (value > 100) {
    return 100;
  }
  return Math.round(value);
}

/**
 * @param {*} input
 * @returns {Readonly<Object>}
 */
function extractDecisionSignals(input) {
  if (!isPlainObject(input)) {
    return Object.freeze({
      available: false,
      recruitmentId: "UNKNOWN",
      scenarioId: "UNKNOWN",
      scenarioStatus: SCENARIO_STATUS.EMPTY,
      evaluationConfidence: 0,
      matchedCount: 0,
      unmetCount: 0,
      findingsCount: 0,
      rollbackTriggered: false,
      prerequisitesComplete: null,
      dependenciesHealthy: null,
      validationPassed: null,
      observabilityComplete: null,
      governanceApproved: null
    });
  }

  const evaluation = isPlainObject(input.evaluation) ? input.evaluation : input;
  const plan = isPlainObject(input.implementationPlan)
    ? input.implementationPlan
    : isPlainObject(input.plan)
      ? input.plan
      : null;

  const scenarioId =
    typeof evaluation.scenarioId === "string"
      ? evaluation.scenarioId
      : typeof input.scenarioId === "string"
        ? input.scenarioId
        : "UNKNOWN";

  const scenarioStatus =
    typeof evaluation.scenarioStatus === "string"
      ? evaluation.scenarioStatus
      : typeof input.scenarioStatus === "string"
        ? input.scenarioStatus
        : SCENARIO_STATUS.UNKNOWN;

  const matchedCount = Array.isArray(evaluation.matchedConditions)
    ? evaluation.matchedConditions.length
    : 0;
  const unmetCount = Array.isArray(evaluation.unmetConditions)
    ? evaluation.unmetConditions.length
    : 0;
  const findingsCount = Array.isArray(evaluation.findings)
    ? evaluation.findings.length
    : 0;

  let rollbackTriggered = false;
  let prerequisitesComplete = null;
  let dependenciesHealthy = null;
  let validationPassed = null;
  let observabilityComplete = null;
  let governanceApproved = null;

  if (plan != null) {
    if (typeof plan.rollbackTriggered === "boolean") {
      rollbackTriggered = plan.rollbackTriggered;
    }
    if (typeof plan.prerequisitesComplete === "boolean") {
      prerequisitesComplete = plan.prerequisitesComplete;
    }
    if (typeof plan.dependenciesHealthy === "boolean") {
      dependenciesHealthy = plan.dependenciesHealthy;
    }
    if (typeof plan.validationPassed === "boolean") {
      validationPassed = plan.validationPassed;
    }
    if (typeof plan.observabilityComplete === "boolean") {
      observabilityComplete = plan.observabilityComplete;
    }
    if (typeof plan.governanceApproved === "boolean") {
      governanceApproved = plan.governanceApproved;
    }
  }

  if (typeof input.rollbackTriggered === "boolean") {
    rollbackTriggered = input.rollbackTriggered;
  }
  if (typeof input.prerequisitesComplete === "boolean") {
    prerequisitesComplete = input.prerequisitesComplete;
  }
  if (typeof input.dependenciesHealthy === "boolean") {
    dependenciesHealthy = input.dependenciesHealthy;
  }
  if (typeof input.validationPassed === "boolean") {
    validationPassed = input.validationPassed;
  }
  if (typeof input.observabilityComplete === "boolean") {
    observabilityComplete = input.observabilityComplete;
  }
  if (typeof input.governanceApproved === "boolean") {
    governanceApproved = input.governanceApproved;
  }

  return Object.freeze({
    available: true,
    recruitmentId: resolveRecruitmentId(
      input.recruitmentId != null ? input.recruitmentId : evaluation.recruitmentId
    ),
    scenarioId: scenarioId,
    scenarioStatus: scenarioStatus,
    evaluationConfidence: resolveConfidence(evaluation.confidence),
    matchedCount: matchedCount,
    unmetCount: unmetCount,
    findingsCount: findingsCount,
    rollbackTriggered: rollbackTriggered,
    prerequisitesComplete: prerequisitesComplete,
    dependenciesHealthy: dependenciesHealthy,
    validationPassed: validationPassed,
    observabilityComplete: observabilityComplete,
    governanceApproved: governanceApproved
  });
}

/**
 * @param {Readonly<Object>} signals
 * @returns {string}
 */
function resolveDecision(signals) {
  if (!signals.available) {
    return IMPLEMENTATION_DECISION.REVIEW_REQUIRED;
  }

  if (
    signals.scenarioStatus === SCENARIO_STATUS.INVALID ||
    signals.scenarioStatus === SCENARIO_STATUS.EMPTY ||
    signals.scenarioStatus === SCENARIO_STATUS.UNKNOWN
  ) {
    return IMPLEMENTATION_DECISION.REVIEW_REQUIRED;
  }

  // Scenario-id driven decisions (matched profiles) take precedence.
  if (signals.scenarioId === IMPLEMENTATION_SCENARIO_IDS.ROLLBACK_REQUIRED) {
    return IMPLEMENTATION_DECISION.ROLLBACK_RECOMMENDED;
  }
  if (signals.scenarioId === IMPLEMENTATION_SCENARIO_IDS.DEPENDENCY_FAILURE) {
    return IMPLEMENTATION_DECISION.ROLLBACK_RECOMMENDED;
  }
  if (signals.scenarioId === IMPLEMENTATION_SCENARIO_IDS.MISSING_PREREQUISITES) {
    return IMPLEMENTATION_DECISION.COMPLETE_PREREQUISITES;
  }
  if (
    signals.scenarioId === IMPLEMENTATION_SCENARIO_IDS.VALIDATION_FAILURE ||
    signals.scenarioId === IMPLEMENTATION_SCENARIO_IDS.OBSERVABILITY_INCOMPLETE
  ) {
    return IMPLEMENTATION_DECISION.PERFORM_ADDITIONAL_VALIDATION;
  }
  if (signals.scenarioId === IMPLEMENTATION_SCENARIO_IDS.GOVERNANCE_REVIEW_REQUIRED) {
    return IMPLEMENTATION_DECISION.REVIEW_REQUIRED;
  }
  if (signals.scenarioId === IMPLEMENTATION_SCENARIO_IDS.PARTIAL_IMPLEMENTATION) {
    return IMPLEMENTATION_DECISION.REVISE_IMPLEMENTATION_PLAN;
  }
  if (
    signals.scenarioId === IMPLEMENTATION_SCENARIO_IDS.COMPLETE_IMPLEMENTATION &&
    signals.scenarioStatus === SCENARIO_STATUS.MATCHED &&
    signals.evaluationConfidence >= 80
  ) {
    return IMPLEMENTATION_DECISION.PROCEED_TO_NEXT_REVIEW;
  }
  if (
    signals.scenarioId === IMPLEMENTATION_SCENARIO_IDS.COMPLETE_IMPLEMENTATION &&
    (signals.scenarioStatus === SCENARIO_STATUS.PARTIAL ||
      signals.scenarioStatus === SCENARIO_STATUS.UNMATCHED)
  ) {
    return IMPLEMENTATION_DECISION.REVISE_IMPLEMENTATION_PLAN;
  }

  // Signal-driven fallbacks when scenario id is absent or unmatched.
  if (signals.rollbackTriggered === true) {
    return IMPLEMENTATION_DECISION.ROLLBACK_RECOMMENDED;
  }
  if (signals.dependenciesHealthy === false) {
    return IMPLEMENTATION_DECISION.REVISE_IMPLEMENTATION_PLAN;
  }
  if (signals.prerequisitesComplete === false) {
    return IMPLEMENTATION_DECISION.COMPLETE_PREREQUISITES;
  }
  if (signals.validationPassed === false || signals.observabilityComplete === false) {
    return IMPLEMENTATION_DECISION.PERFORM_ADDITIONAL_VALIDATION;
  }
  if (signals.governanceApproved === false) {
    return IMPLEMENTATION_DECISION.REVIEW_REQUIRED;
  }
  if (
    signals.scenarioStatus === SCENARIO_STATUS.PARTIAL ||
    signals.scenarioStatus === SCENARIO_STATUS.UNMATCHED
  ) {
    return IMPLEMENTATION_DECISION.REVISE_IMPLEMENTATION_PLAN;
  }

  return IMPLEMENTATION_DECISION.REVIEW_REQUIRED;
}

/**
 * @param {Readonly<Object>} signals
 * @param {string} decision
 * @returns {ReadonlyArray<string>}
 */
function buildSupportingFactors(signals, decision) {
  const factors = [];
  if (signals.scenarioStatus === SCENARIO_STATUS.MATCHED) {
    factors.push("Scenario evaluation status is MATCHED.");
  }
  if (signals.evaluationConfidence >= 80) {
    factors.push("Evaluation confidence is at or above 80.");
  }
  if (signals.matchedCount > 0) {
    factors.push("Matched conditions count=" + String(signals.matchedCount) + ".");
  }
  if (
    decision === IMPLEMENTATION_DECISION.PROCEED_TO_NEXT_REVIEW &&
    signals.scenarioId === IMPLEMENTATION_SCENARIO_IDS.COMPLETE_IMPLEMENTATION
  ) {
    factors.push("Complete implementation scenario conditions are satisfied.");
  }
  if (
    decision === IMPLEMENTATION_DECISION.COMPLETE_PREREQUISITES &&
    signals.prerequisitesComplete === false
  ) {
    factors.push("Prerequisites are explicitly incomplete.");
  }
  if (
    decision === IMPLEMENTATION_DECISION.ROLLBACK_RECOMMENDED &&
    signals.rollbackTriggered === true
  ) {
    factors.push("Rollback has been triggered by advisory signals.");
  }
  if (
    decision === IMPLEMENTATION_DECISION.PERFORM_ADDITIONAL_VALIDATION &&
    (signals.validationPassed === false || signals.observabilityComplete === false)
  ) {
    factors.push("Validation or observability signals indicate additional checks are needed.");
  }
  if (
    decision === IMPLEMENTATION_DECISION.REVIEW_REQUIRED &&
    signals.governanceApproved === false
  ) {
    factors.push("Governance approval is pending.");
  }
  factors.sort();
  return Object.freeze(factors);
}

/**
 * @param {Readonly<Object>} signals
 * @param {string} decision
 * @returns {ReadonlyArray<string>}
 */
function buildBlockingFactors(signals, decision) {
  const factors = [];
  if (signals.unmetCount > 0) {
    factors.push("Unmet conditions count=" + String(signals.unmetCount) + ".");
  }
  if (signals.findingsCount > 0) {
    factors.push("Findings count=" + String(signals.findingsCount) + ".");
  }
  if (signals.scenarioStatus === SCENARIO_STATUS.PARTIAL) {
    factors.push("Scenario evaluation is only partially matched.");
  }
  if (signals.scenarioStatus === SCENARIO_STATUS.UNMATCHED) {
    factors.push("Scenario evaluation did not match.");
  }
  if (signals.scenarioStatus === SCENARIO_STATUS.INVALID) {
    factors.push("Scenario selection is invalid.");
  }
  if (signals.scenarioStatus === SCENARIO_STATUS.EMPTY) {
    factors.push("Evaluation input was empty.");
  }
  if (signals.prerequisitesComplete === false) {
    factors.push("Prerequisites are incomplete.");
  }
  if (signals.dependenciesHealthy === false) {
    factors.push("Dependencies are unhealthy.");
  }
  if (signals.validationPassed === false) {
    factors.push("Validation did not pass.");
  }
  if (signals.observabilityComplete === false) {
    factors.push("Observability is incomplete.");
  }
  if (signals.governanceApproved === false) {
    factors.push("Governance is not approved.");
  }
  if (signals.rollbackTriggered === true) {
    factors.push("Rollback is triggered.");
  }
  if (
    decision !== IMPLEMENTATION_DECISION.PROCEED_TO_NEXT_REVIEW &&
    signals.evaluationConfidence < 80
  ) {
    factors.push("Evaluation confidence is below 80.");
  }
  factors.sort();
  return Object.freeze(factors);
}

/**
 * @param {Readonly<Object>} signals
 * @param {string} decision
 * @returns {number}
 */
function calculateDecisionConfidence(signals, decision) {
  if (!signals.available) {
    return 10;
  }

  let score = signals.evaluationConfidence;

  if (decision === IMPLEMENTATION_DECISION.PROCEED_TO_NEXT_REVIEW) {
    score = Math.max(score, 85);
  } else if (decision === IMPLEMENTATION_DECISION.ROLLBACK_RECOMMENDED) {
    score = Math.max(score, 75);
  } else if (decision === IMPLEMENTATION_DECISION.COMPLETE_PREREQUISITES) {
    score = Math.max(score, 70);
  } else if (decision === IMPLEMENTATION_DECISION.PERFORM_ADDITIONAL_VALIDATION) {
    score = Math.max(score, 65);
  } else if (decision === IMPLEMENTATION_DECISION.REVISE_IMPLEMENTATION_PLAN) {
    score = Math.max(score, 60);
  } else {
    score = Math.max(score, 40);
  }

  if (signals.unmetCount > 0 && decision === IMPLEMENTATION_DECISION.PROCEED_TO_NEXT_REVIEW) {
    score = Math.min(score, 79);
  }

  if (signals.scenarioStatus === SCENARIO_STATUS.INVALID) {
    score = Math.min(score, 20);
  }
  if (signals.scenarioStatus === SCENARIO_STATUS.EMPTY) {
    score = Math.min(score, 15);
  }

  return resolveConfidence(score);
}

/**
 * @param {*} input
 * @returns {Readonly<Object>}
 */
function generateRecruitmentImplementationDecision(input) {
  const signals = extractDecisionSignals(input);
  const decision = resolveDecision(signals);
  const rationale =
    DECISION_RATIONALE[decision] != null
      ? DECISION_RATIONALE[decision]
      : DECISION_RATIONALE.REVIEW_REQUIRED;
  const supportingFactors = buildSupportingFactors(signals, decision);
  const blockingFactors = buildBlockingFactors(signals, decision);
  const confidence = calculateDecisionConfidence(signals, decision);

  return deepFreeze({
    recruitmentId: signals.recruitmentId,
    decision: decision,
    rationale: rationale,
    supportingFactors: supportingFactors,
    blockingFactors: blockingFactors,
    confidence: confidence,
    scenarioId: signals.scenarioId,
    generatedMetadata: Object.freeze({
      generatedAt: "deterministic",
      generatedBy: "phase_147",
      schemaVersion: DECISION_MATRIX_SCHEMA_VERSION,
      deterministic: true,
      phase: RECRUITMENT_DECISION_MATRIX_PHASE,
      advisoryOnly: true,
      runtimeImpact: "none",
      decisionMatrixOnly: true,
      decisionPriority:
        DECISION_PRIORITY[decision] != null ? DECISION_PRIORITY[decision] : 5
    }),
    advisoryMetadata: Object.freeze({
      advisoryOnly: true,
      descriptiveOnly: true,
      persistent: false,
      generatedBy: "phase_147",
      phase: RECRUITMENT_DECISION_MATRIX_PHASE,
      decisionMatrixOnly: true,
      executed: false,
      activated: false,
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
function isRecruitmentImplementationDecision(value) {
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
  if (value.advisoryMetadata.activatesAnything !== false) {
    return false;
  }
  if (!Object.isFrozen(value)) {
    return false;
  }
  return true;
}

module.exports = {
  RECRUITMENT_DECISION_MATRIX_PHASE,
  RECRUITMENT_DECISION_MATRIX_ENTITY,
  DECISION_MATRIX_SCHEMA_VERSION,
  IMPLEMENTATION_DECISION,
  DECISION_PRIORITY,
  DECISION_RATIONALE,
  RECRUITMENT_DECISION_MATRIX_METADATA,
  RECRUITMENT_DECISION_MATRIX_DESCRIPTOR,
  EXPECTED_RESULT_KEYS,
  generateRecruitmentImplementationDecision,
  isRecruitmentImplementationDecision
};
