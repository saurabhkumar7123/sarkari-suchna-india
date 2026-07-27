"use strict";

/**
 * Phase 144 — Recruitment Transition Manifest (Advisory Only).
 *
 * Pure advisory transition manifest providing metadata between Architecture Phase
 * and Future Implementation Phase. No database access, no persistence, no runtime
 * imports, no side effects. No automation. Never mutates input. Never persists output.
 *
 * No Express. No database. No filesystem. No network access.
 * No worker. No routing. No publishing. No execution changes.
 * No runtime module imports. No storage assumptions.
 */

const RECRUITMENT_TRANSITION_MANIFEST_PHASE = 144;

const RECRUITMENT_TRANSITION_MANIFEST_ENTITY = "recruitment_transition_manifest";

const TRANSITION_SCHEMA_VERSION = "1.0.0";

const ARCHITECTURE_VERSION = "144.0.0";

const CURRENT_STATE = Object.freeze({
  ADVISORY_ARCHITECTURE_COMPLETE: "ADVISORY_ARCHITECTURE_COMPLETE",
  PARTIALLY_DOCUMENTED: "PARTIALLY_DOCUMENTED",
  UNKNOWN: "UNKNOWN"
});

const NEXT_STAGE = Object.freeze({
  FUTURE_IMPLEMENTATION_PHASE: "FUTURE_IMPLEMENTATION_PHASE",
  PENDING_REVIEW: "PENDING_REVIEW",
  BLOCKED: "BLOCKED",
  UNKNOWN: "UNKNOWN"
});

const TRANSITION_READINESS = Object.freeze({
  READY_FOR_TRANSITION_PLANNING: "READY_FOR_TRANSITION_PLANNING",
  REQUIRES_REVIEW: "REQUIRES_REVIEW",
  NOT_READY: "NOT_READY",
  UNKNOWN: "UNKNOWN"
});

const RECOMMENDED_OBJECTIVE_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: "OBJ_RUNTIME_ADAPTER",
    order: 1,
    title: "Implement Runtime Adapter Interface",
    description: "Build runtime adapter per Phase 138 integration contract advisory specifications.",
    phase: 138,
    advisoryReference: "recruitmentWorkflowRuntimeAdapterInterface"
  }),
  Object.freeze({
    id: "OBJ_CONTROLLED_COUPLING",
    order: 2,
    title: "Plan Controlled Runtime Coupling",
    description: "Execute controlled coupling per Phase 135 activation strategy documentation.",
    phase: 135,
    advisoryReference: "recruitmentWorkflowControlledActivationStrategy"
  }),
  Object.freeze({
    id: "OBJ_FEATURE_FLAGS",
    order: 3,
    title: "Implement Feature Flag Infrastructure",
    description: "Build feature flag infrastructure per Phase 140 strategy without advisory activation.",
    phase: 140,
    advisoryReference: "recruitmentWorkflowFeatureFlagStrategy"
  }),
  Object.freeze({
    id: "OBJ_SHADOW_MODE",
    order: 4,
    title: "Establish Shadow Mode Observation",
    description: "Implement read-only shadow observation per Phase 140 shadow mode blueprint.",
    phase: 140,
    advisoryReference: "recruitmentWorkflowShadowModeBlueprint"
  }),
  Object.freeze({
    id: "OBJ_GOVERNANCE_GATES",
    order: 5,
    title: "Operationalize Governance Gates",
    description: "Translate Phase 142 governance checklist into operational review gates.",
    phase: 142,
    advisoryReference: "recruitmentGovernanceChecklist"
  }),
  Object.freeze({
    id: "OBJ_MONITORING",
    order: 6,
    title: "Deploy Monitoring Infrastructure",
    description: "Implement monitoring per observability and diagnostics planning signals.",
    phase: 141,
    advisoryReference: "observabilityPlanning"
  })
]);

const RUNTIME_BOUNDARY_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: "RUNTIME_ORCHESTRATOR",
    order: 1,
    label: "Workflow orchestrator",
    advisoryImportsAllowed: false,
    runtimeWiringRequired: true,
    isolationMaintained: true
  }),
  Object.freeze({
    id: "RUNTIME_COORDINATOR",
    order: 2,
    label: "Integration coordinator",
    advisoryImportsAllowed: false,
    runtimeWiringRequired: true,
    isolationMaintained: true
  }),
  Object.freeze({
    id: "ADVISORY_GATEWAY",
    order: 3,
    label: "Advisory gateway",
    advisoryImportsAllowed: false,
    runtimeWiringRequired: false,
    isolationMaintained: true
  }),
  Object.freeze({
    id: "EXECUTION_PIPELINE",
    order: 4,
    label: "Recruitment pipeline",
    advisoryImportsAllowed: false,
    runtimeWiringRequired: true,
    isolationMaintained: true
  }),
  Object.freeze({
    id: "SITE_WORKER",
    order: 5,
    label: "Site worker",
    advisoryImportsAllowed: false,
    runtimeWiringRequired: true,
    isolationMaintained: true
  }),
  Object.freeze({
    id: "DATABASE_LAYER",
    order: 6,
    label: "Database layer",
    advisoryImportsAllowed: false,
    runtimeWiringRequired: true,
    isolationMaintained: true
  }),
  Object.freeze({
    id: "FILESYSTEM_LAYER",
    order: 7,
    label: "Filesystem layer",
    advisoryImportsAllowed: false,
    runtimeWiringRequired: false,
    isolationMaintained: true
  })
]);

const ADVISORY_CONSTRAINT_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: "CONSTRAINT_ADVISORY_ONLY",
    order: 1,
    constraint: "All Phase 114–144 modules remain advisory-only during transition planning.",
    enforced: true
  }),
  Object.freeze({
    id: "CONSTRAINT_NO_AUTO_ACTIVATION",
    order: 2,
    constraint: "Transition manifest must not auto-activate rollout, flags, or runtime wiring.",
    enforced: true
  }),
  Object.freeze({
    id: "CONSTRAINT_NO_PERSISTENCE",
    order: 3,
    constraint: "Advisory outputs must not write database records or filesystem state.",
    enforced: true
  }),
  Object.freeze({
    id: "CONSTRAINT_RUNTIME_ISOLATION",
    order: 4,
    constraint: "Runtime paths must not import advisory modules until explicit implementation phase.",
    enforced: true
  }),
  Object.freeze({
    id: "CONSTRAINT_GOVERNANCE_REVIEW",
    order: 5,
    constraint: "Future implementation requires governance sign-off per Phase 142 checklist.",
    enforced: true
  })
]);

const RECRUITMENT_TRANSITION_MANIFEST_METADATA = Object.freeze({
  phase: RECRUITMENT_TRANSITION_MANIFEST_PHASE,
  advisoryOnly: true,
  descriptiveOnly: true,
  readOnly: true,
  transitionManifestOnly: true,
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
  sourcePhases: Object.freeze([
    114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131,
    132, 133, 134, 135, 136, 137, 138, 139, 140, 141, 142, 143
  ])
});

const RECRUITMENT_TRANSITION_MANIFEST_DESCRIPTOR = Object.freeze({
  entity: RECRUITMENT_TRANSITION_MANIFEST_ENTITY,
  domain: "recruitment",
  phase: RECRUITMENT_TRANSITION_MANIFEST_PHASE,
  description:
    "Pure advisory transition manifest between Architecture Phase and Future Implementation Phase.",
  schemaVersion: TRANSITION_SCHEMA_VERSION,
  metadata: RECRUITMENT_TRANSITION_MANIFEST_METADATA
});

const EXPECTED_RESULT_KEYS = Object.freeze([
  "recruitmentId",
  "currentState",
  "nextStage",
  "recommendedObjectives",
  "runtimeBoundaries",
  "advisoryConstraints",
  "transitionReadiness",
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
 * @param {*} input
 * @returns {boolean}
 */
function isRecognizedTransitionInput(input) {
  if (!isPlainObject(input)) {
    return false;
  }
  return (
    isPlainObject(input.completionReport) ||
    isPlainObject(input.auditReport) ||
    isPlainObject(input.architectureManifest)
  );
}

/**
 * @param {*} input
 * @returns {string}
 */
function resolveCurrentState(input) {
  if (!isPlainObject(input)) {
    return CURRENT_STATE.UNKNOWN;
  }

  const completion = isPlainObject(input.completionReport) ? input.completionReport : null;
  if (completion != null && completion.overallCompletion != null) {
    if (completion.overallCompletion.status === "COMPLETE") {
      return CURRENT_STATE.ADVISORY_ARCHITECTURE_COMPLETE;
    }
    return CURRENT_STATE.PARTIALLY_DOCUMENTED;
  }

  const audit = isPlainObject(input.auditReport) ? input.auditReport : null;
  if (audit != null && audit.auditStatus === "COMPLETE") {
    return CURRENT_STATE.ADVISORY_ARCHITECTURE_COMPLETE;
  }

  if (isRecognizedTransitionInput(input)) {
    return CURRENT_STATE.ADVISORY_ARCHITECTURE_COMPLETE;
  }

  return CURRENT_STATE.UNKNOWN;
}

/**
 * @param {string} currentState
 * @param {number} confidence
 * @returns {string}
 */
function resolveNextStage(currentState, confidence) {
  if (currentState === CURRENT_STATE.ADVISORY_ARCHITECTURE_COMPLETE && confidence >= 80) {
    return NEXT_STAGE.FUTURE_IMPLEMENTATION_PHASE;
  }
  if (currentState === CURRENT_STATE.PARTIALLY_DOCUMENTED) {
    return NEXT_STAGE.PENDING_REVIEW;
  }
  if (currentState === CURRENT_STATE.UNKNOWN) {
    return NEXT_STAGE.UNKNOWN;
  }
  if (confidence < 50) {
    return NEXT_STAGE.BLOCKED;
  }
  return NEXT_STAGE.PENDING_REVIEW;
}

/**
 * @returns {Readonly<Array>}
 */
function buildRecommendedObjectives() {
  return RECOMMENDED_OBJECTIVE_DEFINITIONS;
}

/**
 * @returns {Readonly<Array>}
 */
function buildRuntimeBoundaries() {
  return RUNTIME_BOUNDARY_DEFINITIONS;
}

/**
 * @returns {Readonly<Array>}
 */
function buildAdvisoryConstraints() {
  return ADVISORY_CONSTRAINT_DEFINITIONS;
}

/**
 * @param {string} currentState
 * @param {string} nextStage
 * @param {number} confidence
 * @returns {string}
 */
function resolveTransitionReadiness(currentState, nextStage, confidence) {
  if (currentState === CURRENT_STATE.UNKNOWN) {
    return TRANSITION_READINESS.UNKNOWN;
  }
  if (
    currentState === CURRENT_STATE.ADVISORY_ARCHITECTURE_COMPLETE &&
    nextStage === NEXT_STAGE.FUTURE_IMPLEMENTATION_PHASE &&
    confidence >= 80
  ) {
    return TRANSITION_READINESS.READY_FOR_TRANSITION_PLANNING;
  }
  if (confidence >= 50) {
    return TRANSITION_READINESS.REQUIRES_REVIEW;
  }
  return TRANSITION_READINESS.NOT_READY;
}

/**
 * @param {*} input
 * @param {string} currentState
 * @returns {number}
 */
function calculateTransitionConfidence(input, currentState) {
  if (!isPlainObject(input)) {
    return 0;
  }

  let score = 40;

  if (currentState === CURRENT_STATE.ADVISORY_ARCHITECTURE_COMPLETE) {
    score += 30;
  } else if (currentState === CURRENT_STATE.PARTIALLY_DOCUMENTED) {
    score += 15;
  }

  if (isPlainObject(input.completionReport)) {
    score += 15;
    const pct = input.completionReport.overallCompletion;
    if (pct != null && typeof pct.percentage === "number") {
      score += Math.round(pct.percentage / 20);
    }
  }
  if (isPlainObject(input.auditReport)) {
    score += 10;
    if (input.auditReport.confidence >= 90) {
      score += 5;
    }
  }
  if (isPlainObject(input.architectureManifest)) {
    score += 5;
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
function buildRecruitmentTransitionManifest(input) {
  const hasInput = isPlainObject(input);
  const safeInput = hasInput ? input : {};
  const recruitmentId = resolveRecruitmentId(safeInput.recruitmentId);

  const currentState = resolveCurrentState(input);
  const confidence = calculateTransitionConfidence(input, currentState);
  const nextStage = resolveNextStage(currentState, confidence);
  const recommendedObjectives = buildRecommendedObjectives();
  const runtimeBoundaries = buildRuntimeBoundaries();
  const advisoryConstraints = buildAdvisoryConstraints();
  const transitionReadiness = resolveTransitionReadiness(currentState, nextStage, confidence);

  return deepFreeze({
    recruitmentId,
    currentState,
    nextStage,
    recommendedObjectives,
    runtimeBoundaries,
    advisoryConstraints,
    transitionReadiness,
    confidence,
    generatedMetadata: Object.freeze({
      generatedAt: "deterministic",
      generatedBy: "phase_144",
      schemaVersion: TRANSITION_SCHEMA_VERSION,
      deterministic: true,
      phase: RECRUITMENT_TRANSITION_MANIFEST_PHASE,
      architectureVersion: ARCHITECTURE_VERSION,
      advisoryOnly: true,
      runtimeImpact: "none",
      fromPhase: "ARCHITECTURE_PHASE",
      toPhase: "FUTURE_IMPLEMENTATION_PHASE"
    }),
    advisoryMetadata: Object.freeze({
      advisoryOnly: true,
      descriptiveOnly: true,
      persistent: false,
      generatedBy: "phase_144",
      phase: RECRUITMENT_TRANSITION_MANIFEST_PHASE,
      transitionManifestOnly: true,
      executed: false,
      runtimeIntegration: false,
      persistenceEnabled: false,
      sideEffects: false,
      mutatesInput: false,
      mutatesProduction: false,
      flagExecutionEnabled: false,
      rolloutActivationEnabled: false,
      runtimeWiringEnabled: false
    })
  });
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function isRecruitmentTransitionManifest(value) {
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
  RECRUITMENT_TRANSITION_MANIFEST_PHASE,
  RECRUITMENT_TRANSITION_MANIFEST_ENTITY,
  TRANSITION_SCHEMA_VERSION,
  ARCHITECTURE_VERSION,
  CURRENT_STATE,
  NEXT_STAGE,
  TRANSITION_READINESS,
  RECOMMENDED_OBJECTIVE_DEFINITIONS,
  RUNTIME_BOUNDARY_DEFINITIONS,
  ADVISORY_CONSTRAINT_DEFINITIONS,
  RECRUITMENT_TRANSITION_MANIFEST_METADATA,
  RECRUITMENT_TRANSITION_MANIFEST_DESCRIPTOR,
  EXPECTED_RESULT_KEYS,
  buildRecruitmentTransitionManifest,
  isRecruitmentTransitionManifest
};
