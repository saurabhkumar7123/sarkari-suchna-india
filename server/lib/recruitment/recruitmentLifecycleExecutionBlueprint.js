"use strict";

/**
 * Phase 148 — Recruitment Lifecycle Execution Blueprint (Advisory Only).
 *
 * Pure descriptive blueprint for the future lifecycle execution sequence from
 * notification through final result. Documents transition rules, verification
 * checkpoints, and failure boundaries without performing state transitions.
 * No database access, no persistence, no runtime imports, no side effects.
 *
 * No Express. No database. No filesystem. No network access.
 * No worker. No routing. No publishing. No execution changes.
 * No runtime module imports. No storage assumptions.
 */

const RECRUITMENT_LIFECYCLE_EXECUTION_BLUEPRINT_PHASE = 148;

const RECRUITMENT_LIFECYCLE_EXECUTION_BLUEPRINT_ENTITY =
  "recruitment_lifecycle_execution_blueprint";

const LIFECYCLE_BLUEPRINT_SCHEMA_VERSION = "1.0.0";

const LIFECYCLE_EXECUTION_POSTURE = Object.freeze({
  SEQUENCE_DEFINED: "SEQUENCE_DEFINED",
  SEQUENCE_PARTIAL: "SEQUENCE_PARTIAL",
  SEQUENCE_UNKNOWN: "SEQUENCE_UNKNOWN"
});

/**
 * Advisory lifecycle events aligned with Phase 95 vocabulary (no import).
 */
const LIFECYCLE_EVENT_IDS = Object.freeze({
  NOTIFICATION: "NOTIFICATION",
  APPLICATION: "APPLICATION",
  APPLICATION_CORRECTION: "APPLICATION_CORRECTION",
  EXAM_CITY: "EXAM_CITY",
  ADMIT_CARD: "ADMIT_CARD",
  ANSWER_KEY: "ANSWER_KEY",
  RESULT: "RESULT",
  FINAL_RESULT: "FINAL_RESULT"
});

const CORE_LIFECYCLE_SEQUENCE = Object.freeze([
  LIFECYCLE_EVENT_IDS.NOTIFICATION,
  LIFECYCLE_EVENT_IDS.APPLICATION,
  LIFECYCLE_EVENT_IDS.APPLICATION_CORRECTION,
  LIFECYCLE_EVENT_IDS.EXAM_CITY,
  LIFECYCLE_EVENT_IDS.ADMIT_CARD,
  LIFECYCLE_EVENT_IDS.ANSWER_KEY,
  LIFECYCLE_EVENT_IDS.RESULT,
  LIFECYCLE_EVENT_IDS.FINAL_RESULT
]);

const LIFECYCLE_STAGE_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: LIFECYCLE_EVENT_IDS.NOTIFICATION,
    order: 1,
    label: "Notification",
    optional: false,
    activatesRuntime: false,
    description: "Initial recruitment notification published by conducting authority."
  }),
  Object.freeze({
    id: LIFECYCLE_EVENT_IDS.APPLICATION,
    order: 2,
    label: "Apply",
    optional: false,
    activatesRuntime: false,
    description: "Application window opens for candidate submissions."
  }),
  Object.freeze({
    id: LIFECYCLE_EVENT_IDS.APPLICATION_CORRECTION,
    order: 3,
    label: "Correction",
    optional: true,
    activatesRuntime: false,
    description: "Application correction window for candidate amendments."
  }),
  Object.freeze({
    id: LIFECYCLE_EVENT_IDS.EXAM_CITY,
    order: 4,
    label: "Exam City",
    optional: true,
    activatesRuntime: false,
    description: "Exam city preference or allotment notice."
  }),
  Object.freeze({
    id: LIFECYCLE_EVENT_IDS.ADMIT_CARD,
    order: 5,
    label: "Admit Card",
    optional: false,
    activatesRuntime: false,
    description: "Admit card release for eligible candidates."
  }),
  Object.freeze({
    id: LIFECYCLE_EVENT_IDS.ANSWER_KEY,
    order: 6,
    label: "Answer Key",
    optional: true,
    activatesRuntime: false,
    description: "Provisional or final answer key publication."
  }),
  Object.freeze({
    id: LIFECYCLE_EVENT_IDS.RESULT,
    order: 7,
    label: "Result",
    optional: false,
    activatesRuntime: false,
    description: "Examination result announcement."
  }),
  Object.freeze({
    id: LIFECYCLE_EVENT_IDS.FINAL_RESULT,
    order: 8,
    label: "Final Result",
    optional: false,
    activatesRuntime: false,
    description: "Final result after scrutiny, normalization, or court orders."
  })
]);

const FORWARD_TRANSITION_RULES = Object.freeze({
  [LIFECYCLE_EVENT_IDS.NOTIFICATION]: Object.freeze([LIFECYCLE_EVENT_IDS.APPLICATION]),
  [LIFECYCLE_EVENT_IDS.APPLICATION]: Object.freeze([
    LIFECYCLE_EVENT_IDS.APPLICATION_CORRECTION,
    LIFECYCLE_EVENT_IDS.EXAM_CITY,
    LIFECYCLE_EVENT_IDS.ADMIT_CARD
  ]),
  [LIFECYCLE_EVENT_IDS.APPLICATION_CORRECTION]: Object.freeze([
    LIFECYCLE_EVENT_IDS.EXAM_CITY,
    LIFECYCLE_EVENT_IDS.ADMIT_CARD
  ]),
  [LIFECYCLE_EVENT_IDS.EXAM_CITY]: Object.freeze([LIFECYCLE_EVENT_IDS.ADMIT_CARD]),
  [LIFECYCLE_EVENT_IDS.ADMIT_CARD]: Object.freeze([
    LIFECYCLE_EVENT_IDS.ANSWER_KEY,
    LIFECYCLE_EVENT_IDS.RESULT
  ]),
  [LIFECYCLE_EVENT_IDS.ANSWER_KEY]: Object.freeze([LIFECYCLE_EVENT_IDS.RESULT]),
  [LIFECYCLE_EVENT_IDS.RESULT]: Object.freeze([LIFECYCLE_EVENT_IDS.FINAL_RESULT]),
  [LIFECYCLE_EVENT_IDS.FINAL_RESULT]: Object.freeze([])
});

const VERIFICATION_CHECKPOINT_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: "CHK_LIFECYCLE_EVENT_VALID",
    order: 1,
    lifecycleEventId: null,
    label: "Lifecycle event vocabulary valid",
    description: "Resolved event must belong to advisory lifecycle vocabulary.",
    blocking: true
  }),
  Object.freeze({
    id: "CHK_TRANSITION_ALLOWED",
    order: 2,
    lifecycleEventId: null,
    label: "Forward transition allowed",
    description: "Proposed next event must appear in forward transition table.",
    blocking: true
  }),
  Object.freeze({
    id: "CHK_IDENTITY_RESOLVED",
    order: 3,
    lifecycleEventId: LIFECYCLE_EVENT_IDS.NOTIFICATION,
    label: "Recruitment identity resolved",
    description: "Recruitment identity must be resolved before lifecycle progression.",
    blocking: true
  }),
  Object.freeze({
    id: "CHK_DRAFT_VALIDATED",
    order: 4,
    lifecycleEventId: null,
    label: "Draft validation passed",
    description: "Advisory draft must pass workflow validation before publish readiness.",
    blocking: true
  }),
  Object.freeze({
    id: "CHK_MANUAL_REVIEW_CLEARED",
    order: 5,
    lifecycleEventId: null,
    label: "Manual review cleared",
    description: "Manual review gate must be cleared for ambiguous classifications.",
    blocking: true
  }),
  Object.freeze({
    id: "CHK_PUBLISH_READINESS",
    order: 6,
    lifecycleEventId: LIFECYCLE_EVENT_IDS.FINAL_RESULT,
    label: "Publish readiness confirmed",
    description: "Publish readiness advisory must confirm before write coupling.",
    blocking: true
  }),
  Object.freeze({
    id: "CHK_GOVERNANCE_SIGN_OFF",
    order: 7,
    lifecycleEventId: null,
    label: "Governance sign-off",
    description: "Governance review gate must pass before controlled runtime coupling.",
    blocking: false
  })
]);

const FAILURE_BOUNDARY_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: "FAIL_INVALID_TRANSITION",
    order: 1,
    failureType: "invalid_transition",
    severity: "CRITICAL",
    boundaryAction: "halt_progression",
    description: "Disallowed lifecycle transition halts advisory progression.",
    automatedRecovery: false
  }),
  Object.freeze({
    id: "FAIL_LOW_CONFIDENCE_CLASSIFICATION",
    order: 2,
    failureType: "low_confidence",
    severity: "HIGH",
    boundaryAction: "route_manual_review",
    description: "Low-confidence lifecycle classification routes to manual review.",
    automatedRecovery: false
  }),
  Object.freeze({
    id: "FAIL_IDENTITY_AMBIGUITY",
    order: 3,
    failureType: "identity_ambiguity",
    severity: "HIGH",
    boundaryAction: "route_manual_review",
    description: "Ambiguous recruitment identity match halts automated progression.",
    automatedRecovery: false
  }),
  Object.freeze({
    id: "FAIL_VALIDATION_BLOCKING",
    order: 4,
    failureType: "validation_failure",
    severity: "CRITICAL",
    boundaryAction: "halt_progression",
    description: "Blocking validation findings prevent lifecycle stage advancement.",
    automatedRecovery: false
  }),
  Object.freeze({
    id: "FAIL_PUBLISH_NOT_READY",
    order: 5,
    failureType: "publish_not_ready",
    severity: "HIGH",
    boundaryAction: "halt_publish_coupling",
    description: "Publish readiness failure blocks write-path coupling.",
    automatedRecovery: false
  }),
  Object.freeze({
    id: "FAIL_GOVERNANCE_HOLD",
    order: 6,
    failureType: "governance_hold",
    severity: "MEDIUM",
    boundaryAction: "pause_integration",
    description: "Governance hold pauses integration without altering production flow.",
    automatedRecovery: false
  }),
  Object.freeze({
    id: "FAIL_ROLLBACK_REQUIRED",
    order: 7,
    failureType: "rollback_required",
    severity: "CRITICAL",
    boundaryAction: "initiate_rollback_plan",
    description: "Rollback recommended per decision matrix — descriptive only.",
    automatedRecovery: false
  })
]);

const RECRUITMENT_LIFECYCLE_EXECUTION_BLUEPRINT_METADATA = Object.freeze({
  phase: RECRUITMENT_LIFECYCLE_EXECUTION_BLUEPRINT_PHASE,
  advisoryOnly: true,
  descriptiveOnly: true,
  readOnly: true,
  lifecycleExecutionBlueprintOnly: true,
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
  sourcePhases: Object.freeze([95, 96, 114, 116, 147])
});

const RECRUITMENT_LIFECYCLE_EXECUTION_BLUEPRINT_DESCRIPTOR = Object.freeze({
  entity: RECRUITMENT_LIFECYCLE_EXECUTION_BLUEPRINT_ENTITY,
  domain: "recruitment",
  phase: RECRUITMENT_LIFECYCLE_EXECUTION_BLUEPRINT_PHASE,
  description:
    "Pure descriptive lifecycle execution blueprint with transition rules, verification checkpoints, and failure boundaries.",
  schemaVersion: LIFECYCLE_BLUEPRINT_SCHEMA_VERSION,
  metadata: RECRUITMENT_LIFECYCLE_EXECUTION_BLUEPRINT_METADATA
});

const EXPECTED_RESULT_KEYS = Object.freeze([
  "recruitmentId",
  "lifecycleSequence",
  "transitionRules",
  "verificationCheckpoints",
  "failureBoundaries",
  "currentLifecycleEvent",
  "nextAllowedEvents",
  "executionPosture",
  "confidence",
  "executionSummary",
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
 * @param {*} eventId
 * @returns {boolean}
 */
function isKnownLifecycleEvent(eventId) {
  return typeof eventId === "string" && CORE_LIFECYCLE_SEQUENCE.indexOf(eventId) !== -1;
}

/**
 * @param {*} eventId
 * @returns {string}
 */
function normalizeLifecycleEvent(eventId) {
  if (isKnownLifecycleEvent(eventId)) {
    return eventId;
  }
  return LIFECYCLE_EVENT_IDS.NOTIFICATION;
}

/**
 * @param {*} input
 * @returns {boolean}
 */
function isRecognizedLifecycleBlueprintInput(input) {
  if (!isPlainObject(input)) {
    return false;
  }
  if (input.recruitmentId != null && typeof input.recruitmentId !== "string" && typeof input.recruitmentId !== "number") {
    return false;
  }
  if (input.currentLifecycleEvent != null && typeof input.currentLifecycleEvent !== "string") {
    return false;
  }
  if (input.includedLifecycleEventIds != null && !Array.isArray(input.includedLifecycleEventIds)) {
    return false;
  }
  return true;
}

/**
 * @param {Readonly<Object>} input
 * @returns {Readonly<Array>}
 */
function resolveIncludedLifecycleStages(input) {
  if (!Array.isArray(input.includedLifecycleEventIds) || input.includedLifecycleEventIds.length === 0) {
    return LIFECYCLE_STAGE_DEFINITIONS;
  }
  const requested = new Set(input.includedLifecycleEventIds);
  return LIFECYCLE_STAGE_DEFINITIONS.filter((stage) => requested.has(stage.id));
}

/**
 * @param {string} currentEvent
 * @returns {Readonly<Array>}
 */
function resolveNextAllowedEvents(currentEvent) {
  const transitions = FORWARD_TRANSITION_RULES[currentEvent];
  if (transitions == null) {
    return Object.freeze([]);
  }
  return transitions;
}

/**
 * @param {Readonly<Array>} stages
 * @returns {Readonly<Object>}
 */
function buildTransitionRules(stages) {
  const rules = [];
  for (let i = 0; i < stages.length; i += 1) {
    const stage = stages[i];
    const allowedNext = FORWARD_TRANSITION_RULES[stage.id] || Object.freeze([]);
    const filteredNext = allowedNext.filter((nextId) => {
      for (let j = 0; j < stages.length; j += 1) {
        if (stages[j].id === nextId) {
          return true;
        }
      }
      return false;
    });
    rules.push(
      Object.freeze({
        fromEvent: stage.id,
        order: stage.order,
        allowedNextEvents: Object.freeze(filteredNext.slice()),
        optionalStage: stage.optional === true
      })
    );
  }
  return Object.freeze(rules);
}

/**
 * @param {*} input
 * @returns {number}
 */
function calculateLifecycleConfidence(input) {
  if (!isPlainObject(input)) {
    return 0;
  }

  let score = 45;

  if (isKnownLifecycleEvent(input.currentLifecycleEvent)) {
    score += 15;
  }
  if (isPlainObject(input.lifecycleResolution)) {
    score += 15;
    if (input.lifecycleResolution.lifecycleConfidence === "high") {
      score += 10;
    }
  }
  if (isPlainObject(input.validationResult) && input.validationResult.status === "valid") {
    score += 10;
  }
  if (isPlainObject(input.transitionResolution)) {
    score += 5;
  }

  if (score > 100) {
    return 100;
  }
  return score;
}

/**
 * @param {Readonly<Array>} stages
 * @param {*} input
 * @returns {string}
 */
function resolveExecutionPosture(stages, input) {
  if (!isPlainObject(input)) {
    return LIFECYCLE_EXECUTION_POSTURE.SEQUENCE_UNKNOWN;
  }
  if (stages.length === 0) {
    return LIFECYCLE_EXECUTION_POSTURE.SEQUENCE_UNKNOWN;
  }
  if (stages.length === LIFECYCLE_STAGE_DEFINITIONS.length) {
    return LIFECYCLE_EXECUTION_POSTURE.SEQUENCE_DEFINED;
  }
  return LIFECYCLE_EXECUTION_POSTURE.SEQUENCE_PARTIAL;
}

/**
 * @param {string} posture
 * @param {string} currentEvent
 * @returns {string}
 */
function buildExecutionSummary(posture, currentEvent) {
  if (posture === LIFECYCLE_EXECUTION_POSTURE.SEQUENCE_DEFINED) {
    return "Lifecycle execution sequence defined from notification through final result at event " + currentEvent + ".";
  }
  if (posture === LIFECYCLE_EXECUTION_POSTURE.SEQUENCE_PARTIAL) {
    return "Lifecycle execution sequence partially defined — subset of stages included.";
  }
  return "Lifecycle execution sequence posture unknown.";
}

/**
 * @param {*} input
 * @returns {Readonly<Object>}
 */
function buildRecruitmentLifecycleExecutionBlueprint(input) {
  const hasInput = isRecognizedLifecycleBlueprintInput(input);
  const safeInput = hasInput ? input : {};
  const postureInput = hasInput ? input : null;
  const recruitmentId = resolveRecruitmentId(safeInput.recruitmentId);
  const currentLifecycleEvent = normalizeLifecycleEvent(safeInput.currentLifecycleEvent);
  const includedStages = resolveIncludedLifecycleStages(safeInput);
  const lifecycleSequence = deepFreeze(
    includedStages
      .slice()
      .sort((left, right) => left.order - right.order)
      .map((stage) =>
        Object.freeze({
          eventId: stage.id,
          order: stage.order,
          label: stage.label,
          optional: stage.optional,
          description: stage.description
        })
      )
  );
  const transitionRules = buildTransitionRules(includedStages);
  const nextAllowedEvents = resolveNextAllowedEvents(currentLifecycleEvent).filter((nextId) => {
    for (let i = 0; i < includedStages.length; i += 1) {
      if (includedStages[i].id === nextId) {
        return true;
      }
    }
    return false;
  });
  const confidence = calculateLifecycleConfidence(postureInput);
  const executionPosture = resolveExecutionPosture(includedStages, postureInput);

  return deepFreeze({
    recruitmentId,
    lifecycleSequence,
    transitionRules,
    verificationCheckpoints: VERIFICATION_CHECKPOINT_DEFINITIONS,
    failureBoundaries: FAILURE_BOUNDARY_DEFINITIONS,
    currentLifecycleEvent,
    nextAllowedEvents: Object.freeze(nextAllowedEvents.slice()),
    executionPosture,
    confidence,
    executionSummary: buildExecutionSummary(executionPosture, currentLifecycleEvent),
    advisoryMetadata: Object.freeze({
      advisoryOnly: true,
      descriptiveOnly: true,
      persistent: false,
      generatedBy: "phase_148",
      phase: RECRUITMENT_LIFECYCLE_EXECUTION_BLUEPRINT_PHASE,
      lifecycleExecutionBlueprintOnly: true,
      executed: false,
      runtimeIntegration: false,
      persistenceEnabled: false,
      sideEffects: false,
      mutatesInput: false,
      mutatesProduction: false,
      performsStateTransitions: false,
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
function isRecruitmentLifecycleExecutionBlueprint(value) {
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
  if (value.advisoryMetadata.performsStateTransitions !== false) {
    return false;
  }
  return true;
}

module.exports = {
  RECRUITMENT_LIFECYCLE_EXECUTION_BLUEPRINT_PHASE,
  RECRUITMENT_LIFECYCLE_EXECUTION_BLUEPRINT_ENTITY,
  LIFECYCLE_BLUEPRINT_SCHEMA_VERSION,
  LIFECYCLE_EXECUTION_POSTURE,
  LIFECYCLE_EVENT_IDS,
  CORE_LIFECYCLE_SEQUENCE,
  LIFECYCLE_STAGE_DEFINITIONS,
  FORWARD_TRANSITION_RULES,
  VERIFICATION_CHECKPOINT_DEFINITIONS,
  FAILURE_BOUNDARY_DEFINITIONS,
  RECRUITMENT_LIFECYCLE_EXECUTION_BLUEPRINT_DESCRIPTOR,
  RECRUITMENT_LIFECYCLE_EXECUTION_BLUEPRINT_METADATA,
  EXPECTED_RESULT_KEYS,
  isKnownLifecycleEvent,
  buildRecruitmentLifecycleExecutionBlueprint,
  isRecruitmentLifecycleExecutionBlueprint
};
