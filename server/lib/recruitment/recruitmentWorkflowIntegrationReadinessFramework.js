"use strict";

/**
 * Phase 134 — Recruitment Workflow Advisory Integration Readiness Framework (Advisory Only).
 *
 * Pure advisory framework that evaluates integration readiness for the complete
 * advisory workflow architecture spanning Phases 114–133. No database access, no persistence,
 * no runtime imports, no side effects. No automation.
 * Never mutates input. Never persists output.
 */

const RECRUITMENT_WORKFLOW_INTEGRATION_READINESS_FRAMEWORK_PHASE = 134;

const RECRUITMENT_WORKFLOW_INTEGRATION_READINESS_FRAMEWORK_ENTITY =
  "recruitment_workflow_integration_readiness_framework";

const INTEGRATION_STATUS = Object.freeze({
  NOT_READY: "NOT_READY",
  PARTIALLY_READY: "PARTIALLY_READY",
  READY_FOR_CONTROLLED_INTEGRATION: "READY_FOR_CONTROLLED_INTEGRATION",
  UNKNOWN: "UNKNOWN"
});

const READINESS_LEVEL = Object.freeze({
  NOT_READY: "NOT_READY",
  PARTIALLY_READY: "PARTIALLY_READY",
  READY_FOR_CONTROLLED_INTEGRATION: "READY_FOR_CONTROLLED_INTEGRATION",
  UNKNOWN: "UNKNOWN"
});

const CHECKPOINT_STATUS = Object.freeze({
  SATISFIED: "SATISFIED",
  MISSING: "MISSING",
  UNKNOWN: "UNKNOWN"
});

const CONSISTENCY_STATUS = Object.freeze({
  CONSISTENT: "CONSISTENT",
  INCONSISTENT: "INCONSISTENT",
  UNKNOWN: "UNKNOWN"
});

const RECOMMENDATION_STATUS = Object.freeze({
  PROCEED: "PROCEED",
  REVIEW_REQUIRED: "REVIEW_REQUIRED",
  BLOCKED_ACTION_REQUIRED: "BLOCKED_ACTION_REQUIRED",
  MONITOR_ADVISORY: "MONITOR_ADVISORY",
  UNKNOWN: "UNKNOWN"
});

const READINESS_ASSESSMENT_STATUS = Object.freeze({
  NOT_STARTED: "NOT_STARTED",
  PARTIALLY_READY: "PARTIALLY_READY",
  REVIEW_READY: "REVIEW_READY",
  APPROVAL_PENDING: "APPROVAL_PENDING",
  READY_FOR_STORAGE: "READY_FOR_STORAGE",
  BLOCKED: "BLOCKED"
});

const HEALTH_STATUS = Object.freeze({
  HEALTHY: "HEALTHY",
  STABLE: "STABLE",
  AT_RISK: "AT_RISK",
  BLOCKED: "BLOCKED",
  UNKNOWN: "UNKNOWN"
});

const RISK_LEVEL = Object.freeze({
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  CRITICAL: "CRITICAL",
  UNKNOWN: "UNKNOWN"
});

const CAPABILITY_IDS = Object.freeze({
  DRAFT_PROPOSAL: "draft_proposal",
  PERSISTENCE_BOUNDARY: "persistence_boundary",
  APPROVAL_GATE: "approval_gate",
  REVIEW_PACKAGE: "review_package",
  STORAGE_ADAPTER: "storage_adapter",
  REPOSITORY_CONTRACT: "repository_contract",
  WORKFLOW_ORCHESTRATOR: "workflow_orchestrator",
  DECISION_TRACE_MODEL: "decision_trace_model"
});

const CAPABILITY_TO_PHASE = Object.freeze({
  [CAPABILITY_IDS.DRAFT_PROPOSAL]: 114,
  [CAPABILITY_IDS.PERSISTENCE_BOUNDARY]: 115,
  [CAPABILITY_IDS.APPROVAL_GATE]: 116,
  [CAPABILITY_IDS.REVIEW_PACKAGE]: 117,
  [CAPABILITY_IDS.STORAGE_ADAPTER]: 118,
  [CAPABILITY_IDS.REPOSITORY_CONTRACT]: 119,
  [CAPABILITY_IDS.WORKFLOW_ORCHESTRATOR]: 120,
  [CAPABILITY_IDS.DECISION_TRACE_MODEL]: 121
});

const CHECKPOINT_IDS = Object.freeze({
  FOUNDATIONAL_DRAFT_PIPELINE: "FOUNDATIONAL_DRAFT_PIPELINE",
  STORAGE_BOUNDARY: "STORAGE_BOUNDARY",
  ORCHESTRATION_BOUNDARY: "ORCHESTRATION_BOUNDARY",
  TRACE_AND_REGISTRY: "TRACE_AND_REGISTRY",
  READINESS_AND_REPORTING: "READINESS_AND_REPORTING",
  SNAPSHOT_ANALYSIS: "SNAPSHOT_ANALYSIS",
  HEALTH_AND_RISK: "HEALTH_AND_RISK",
  INTELLIGENCE_AGGREGATION: "INTELLIGENCE_AGGREGATION",
  RECOMMENDATION_AND_TIMELINE: "RECOMMENDATION_AND_TIMELINE",
  CONSISTENCY_VALIDATION: "CONSISTENCY_VALIDATION",
  CONTROLLED_INTEGRATION_GATE: "CONTROLLED_INTEGRATION_GATE"
});

const SUPPORTED_CONSISTENCY_STATUSES = Object.freeze(new Set(Object.values(CONSISTENCY_STATUS)));

const SUPPORTED_RECOMMENDATION_STATUSES = Object.freeze(
  new Set(Object.values(RECOMMENDATION_STATUS))
);

const SUPPORTED_READINESS_STATUSES = Object.freeze(
  new Set(Object.values(READINESS_ASSESSMENT_STATUS))
);

const SUPPORTED_HEALTH_STATUSES = Object.freeze(new Set(Object.values(HEALTH_STATUS)));

const SUPPORTED_RISK_LEVELS = Object.freeze(new Set(Object.values(RISK_LEVEL)));

const WORKFLOW_STAGES = Object.freeze({
  NOTIFICATION: "NOTIFICATION",
  APPLICATION: "APPLICATION",
  CORRECTION: "CORRECTION",
  ADMIT_CARD: "ADMIT_CARD",
  EXAM: "EXAM",
  ANSWER_KEY: "ANSWER_KEY",
  RESULT: "RESULT",
  FINAL_RESULT: "FINAL_RESULT"
});

const TIMELINE_STATUS = Object.freeze({
  COMPLETED: "COMPLETED",
  IN_PROGRESS: "IN_PROGRESS",
  BLOCKED: "BLOCKED",
  EMPTY: "EMPTY",
  UNKNOWN: "UNKNOWN"
});

const SUPPORTED_WORKFLOW_STAGES = Object.freeze(new Set(Object.values(WORKFLOW_STAGES)));

const SUPPORTED_TIMELINE_STATUSES = Object.freeze(new Set(Object.values(TIMELINE_STATUS)));

/**
 * Static dependency graph covering Phases 114–133.
 *
 * @type {readonly Object[]}
 */
const PHASE_DEPENDENCY_GRAPH = Object.freeze([
  Object.freeze({
    phase: 114,
    id: "draft_proposal",
    name: "Draft Proposal Engine",
    dependencies: Object.freeze([])
  }),
  Object.freeze({
    phase: 115,
    id: "persistence_boundary",
    name: "Persistence Boundary",
    dependencies: Object.freeze([114])
  }),
  Object.freeze({
    phase: 116,
    id: "approval_gate",
    name: "Approval Gate",
    dependencies: Object.freeze([115])
  }),
  Object.freeze({
    phase: 117,
    id: "review_package",
    name: "Review Package Builder",
    dependencies: Object.freeze([114, 115, 116])
  }),
  Object.freeze({
    phase: 118,
    id: "storage_adapter",
    name: "Storage Adapter",
    dependencies: Object.freeze([117])
  }),
  Object.freeze({
    phase: 119,
    id: "repository_contract",
    name: "Repository Contract",
    dependencies: Object.freeze([118])
  }),
  Object.freeze({
    phase: 120,
    id: "workflow_orchestrator",
    name: "Workflow Orchestrator",
    dependencies: Object.freeze([114, 115, 116, 117, 118, 119])
  }),
  Object.freeze({
    phase: 121,
    id: "decision_trace_model",
    name: "Decision Trace Model",
    dependencies: Object.freeze([120])
  }),
  Object.freeze({
    phase: 122,
    id: "capability_registry",
    name: "Capability Registry",
    dependencies: Object.freeze([114, 115, 116, 117, 118, 119, 120, 121])
  }),
  Object.freeze({
    phase: 123,
    id: "readiness_assessment",
    name: "Readiness Assessment",
    dependencies: Object.freeze([122])
  }),
  Object.freeze({
    phase: 124,
    id: "advisory_report_generator",
    name: "Advisory Report Generator",
    dependencies: Object.freeze([123])
  }),
  Object.freeze({
    phase: 125,
    id: "advisory_snapshot",
    name: "Advisory Snapshot",
    dependencies: Object.freeze([124])
  }),
  Object.freeze({
    phase: 126,
    id: "snapshot_comparison",
    name: "Snapshot Comparison",
    dependencies: Object.freeze([125])
  }),
  Object.freeze({
    phase: 127,
    id: "evolution_analyzer",
    name: "Evolution Analyzer",
    dependencies: Object.freeze([126])
  }),
  Object.freeze({
    phase: 128,
    id: "health_indicator",
    name: "Health Indicator",
    dependencies: Object.freeze([127])
  }),
  Object.freeze({
    phase: 129,
    id: "risk_assessment",
    name: "Risk Assessment",
    dependencies: Object.freeze([128])
  }),
  Object.freeze({
    phase: 130,
    id: "intelligence_summary",
    name: "Intelligence Summary",
    dependencies: Object.freeze([124, 125, 126, 127, 128, 129])
  }),
  Object.freeze({
    phase: 131,
    id: "recommendation_model",
    name: "Recommendation Model",
    dependencies: Object.freeze([123, 127, 128, 129, 130])
  }),
  Object.freeze({
    phase: 132,
    id: "timeline_model",
    name: "Timeline Model",
    dependencies: Object.freeze([131])
  }),
  Object.freeze({
    phase: 133,
    id: "consistency_validator",
    name: "Consistency Validator",
    dependencies: Object.freeze([128, 129, 130, 131, 132])
  })
]);

const RECRUITMENT_WORKFLOW_INTEGRATION_READINESS_FRAMEWORK_METADATA = Object.freeze({
  phase: RECRUITMENT_WORKFLOW_INTEGRATION_READINESS_FRAMEWORK_PHASE,
  advisoryOnly: true,
  persistent: false,
  generatedBy: "phase_134",
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
  sourcePhases: Object.freeze([
    114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131,
    132, 133
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
 * @param {string|null} value
 * @param {Readonly<Set<string>>} supportedValues
 * @returns {string|null}
 */
function resolveKnownValue(value, supportedValues) {
  if (typeof value !== "string" || !supportedValues.has(value)) {
    return null;
  }
  return value;
}

/**
 * @param {*} capabilitySignal
 * @returns {boolean}
 */
function isCapabilitySatisfied(capabilitySignal) {
  if (!isPlainObject(capabilitySignal)) {
    return false;
  }

  if (
    capabilitySignal.available === true ||
    capabilitySignal.present === true ||
    capabilitySignal.ready === true
  ) {
    return true;
  }

  if (typeof capabilitySignal.status === "string") {
    const status = capabilitySignal.status.toLowerCase();
    return status === "available" || status === "present" || status === "ready";
  }

  return false;
}

/**
 * @param {*} input
 * @returns {boolean}
 */
function isRecognizedIntegrationInput(input) {
  if (!isPlainObject(input)) {
    return false;
  }

  const fields = [
    "capabilities",
    "readinessAssessment",
    "recommendation",
    "consistencyValidation",
    "timeline",
    "intelligenceSummary"
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
 * @param {Readonly<Object>} input
 * @returns {boolean}
 */
function hasMeaningfulSignals(input) {
  return (
    input.capabilities != null ||
    input.readinessAssessment != null ||
    input.recommendation != null ||
    input.consistencyValidation != null ||
    input.timeline != null ||
    input.intelligenceSummary != null
  );
}

/**
 * @param {Readonly<Object>} capabilities
 * @returns {Readonly<Set<number>>}
 */
function deriveSatisfiedCapabilityPhases(capabilities) {
  const satisfied = new Set();
  const keys = Object.keys(capabilities);

  for (let i = 0; i < keys.length; i += 1) {
    const capabilityId = keys[i];
    const phase = CAPABILITY_TO_PHASE[capabilityId];
    if (phase != null && isCapabilitySatisfied(capabilities[capabilityId])) {
      satisfied.add(phase);
    }
  }

  return satisfied;
}

/**
 * @param {*} readinessInput
 * @returns {string|null}
 */
function extractReadinessStatus(readinessInput) {
  if (typeof readinessInput === "string") {
    return readinessInput;
  }
  if (!isPlainObject(readinessInput)) {
    return null;
  }
  if (typeof readinessInput.readinessStatus === "string") {
    return readinessInput.readinessStatus;
  }
  return null;
}

/**
 * @param {*} recommendationInput
 * @returns {string|null}
 */
function extractRecommendationStatus(recommendationInput) {
  if (typeof recommendationInput === "string") {
    return recommendationInput;
  }
  if (!isPlainObject(recommendationInput)) {
    return null;
  }
  if (typeof recommendationInput.recommendationStatus === "string") {
    return recommendationInput.recommendationStatus;
  }
  return null;
}

/**
 * @param {*} consistencyInput
 * @returns {string|null}
 */
function extractConsistencyStatus(consistencyInput) {
  if (typeof consistencyInput === "string") {
    return consistencyInput;
  }
  if (!isPlainObject(consistencyInput)) {
    return null;
  }
  if (typeof consistencyInput.consistencyStatus === "string") {
    return consistencyInput.consistencyStatus;
  }
  return null;
}

/**
 * @param {*} timelineInput
 * @returns {{ stage: string|null, status: string|null }}
 */
function extractTimelineSignals(timelineInput) {
  if (typeof timelineInput === "string") {
    return { stage: timelineInput, status: null };
  }
  if (!isPlainObject(timelineInput)) {
    return { stage: null, status: null };
  }

  const stage =
    typeof timelineInput.currentStage === "string"
      ? timelineInput.currentStage
      : typeof timelineInput.timelineStage === "string"
        ? timelineInput.timelineStage
        : null;

  const status =
    typeof timelineInput.timelineStatus === "string" ? timelineInput.timelineStatus : null;

  return { stage, status };
}

/**
 * @param {*} intelligenceInput
 * @returns {{ health: string|null, risk: string|null, hasSignals: boolean }}
 */
function extractIntelligenceSignals(intelligenceInput) {
  if (!isPlainObject(intelligenceInput)) {
    return { health: null, risk: null, hasSignals: false };
  }

  const currentState = isPlainObject(intelligenceInput.currentState)
    ? intelligenceInput.currentState
    : null;

  const health =
    currentState != null && typeof currentState.health === "string"
      ? currentState.health
      : typeof intelligenceInput.healthStatus === "string"
        ? intelligenceInput.healthStatus
        : null;

  const risk =
    currentState != null && typeof currentState.risk === "string"
      ? currentState.risk
      : typeof intelligenceInput.riskLevel === "string"
        ? intelligenceInput.riskLevel
        : null;

  const hasSignals =
    health != null ||
    risk != null ||
    typeof intelligenceInput.intelligenceSummary === "string" ||
    typeof intelligenceInput.workflowStatus === "string" ||
    Array.isArray(intelligenceInput.keySignals);

  return { health, risk, hasSignals };
}

/**
 * @param {Readonly<Object>} input
 * @returns {Readonly<Object>}
 */
function extractIntegrationSignals(input) {
  const capabilities = isPlainObject(input.capabilities) ? input.capabilities : {};
  const satisfiedCapabilityPhases = deriveSatisfiedCapabilityPhases(capabilities);
  const readinessStatus = resolveKnownValue(
    extractReadinessStatus(input.readinessAssessment),
    SUPPORTED_READINESS_STATUSES
  );
  const recommendationStatus = resolveKnownValue(
    extractRecommendationStatus(input.recommendation),
    SUPPORTED_RECOMMENDATION_STATUSES
  );
  const consistencyStatus = resolveKnownValue(
    extractConsistencyStatus(input.consistencyValidation),
    SUPPORTED_CONSISTENCY_STATUSES
  );
  const timelineSignals = extractTimelineSignals(input.timeline);
  const intelligenceSignals = extractIntelligenceSignals(input.intelligenceSummary);

  const satisfiedPhases = new Set(satisfiedCapabilityPhases);

  if (Object.keys(capabilities).length > 0) {
    satisfiedPhases.add(122);
  }

  if (readinessStatus != null) {
    satisfiedPhases.add(123);
    if (
      readinessStatus === READINESS_ASSESSMENT_STATUS.REVIEW_READY ||
      readinessStatus === READINESS_ASSESSMENT_STATUS.APPROVAL_PENDING ||
      readinessStatus === READINESS_ASSESSMENT_STATUS.READY_FOR_STORAGE
    ) {
      satisfiedPhases.add(124);
    }
  }

  if (intelligenceSignals.hasSignals) {
    satisfiedPhases.add(125);
    satisfiedPhases.add(126);
    satisfiedPhases.add(127);
    satisfiedPhases.add(130);
  }

  const intelligenceHealth = resolveKnownValue(
    intelligenceSignals.health,
    SUPPORTED_HEALTH_STATUSES
  );
  const intelligenceRisk = resolveKnownValue(intelligenceSignals.risk, SUPPORTED_RISK_LEVELS);

  if (intelligenceHealth != null) {
    satisfiedPhases.add(128);
  }

  if (intelligenceRisk != null) {
    satisfiedPhases.add(129);
  }

  const timelineStage = resolveKnownValue(timelineSignals.stage, SUPPORTED_WORKFLOW_STAGES);
  const timelineStatus = resolveKnownValue(timelineSignals.status, SUPPORTED_TIMELINE_STATUSES);

  if (recommendationStatus != null) {
    satisfiedPhases.add(131);
  }

  if (timelineStage != null || timelineStatus != null) {
    satisfiedPhases.add(132);
  }

  if (consistencyStatus != null) {
    satisfiedPhases.add(133);
  }

  return {
    capabilities,
    satisfiedPhases,
    readinessStatus,
    recommendationStatus,
    consistencyStatus,
    timelineStage,
    timelineStatus,
    intelligenceHealth,
    intelligenceRisk,
    hasCapabilities: Object.keys(capabilities).length > 0,
    hasReadinessAssessment: input.readinessAssessment != null,
    hasRecommendation: input.recommendation != null,
    hasConsistencyValidation: input.consistencyValidation != null,
    hasTimeline: input.timeline != null,
    hasIntelligenceSummary: input.intelligenceSummary != null
  };
}

/**
 * @param {Readonly<Object>} signals
 * @returns {boolean}
 */
function hasResolvableSignals(signals) {
  return (
    signals.satisfiedPhases.size > 0 ||
    signals.readinessStatus != null ||
    signals.recommendationStatus != null ||
    signals.consistencyStatus != null ||
    signals.timelineStage != null ||
    signals.timelineStatus != null ||
    signals.intelligenceHealth != null ||
    signals.intelligenceRisk != null
  );
}

/**
 * @param {number} phase
 * @param {Readonly<Set<number>>} satisfiedPhases
 * @returns {boolean}
 */
function isPhaseSatisfied(phase, satisfiedPhases) {
  return satisfiedPhases.has(phase);
}

/**
 * @param {Readonly<Object>} signals
 * @returns {ReadonlyArray<Object>}
 */
function buildIntegrationCheckpoints(signals) {
  const satisfiedPhases = signals.satisfiedPhases;

  const foundationalPhases = [114, 115, 116, 117];
  const storagePhases = [118, 119];
  const orchestrationPhases = [120];
  const traceRegistryPhases = [121, 122];
  const readinessPhases = [123, 124];
  const snapshotPhases = [125, 126, 127];
  const healthRiskPhases = [128, 129];
  const intelligencePhases = [130];
  const recommendationTimelinePhases = [131, 132];
  const consistencyPhases = [133];

  function evaluatePhaseGroup(phases) {
    const missing = phases.filter((phase) => !isPhaseSatisfied(phase, satisfiedPhases));
    if (missing.length === 0) {
      return CHECKPOINT_STATUS.SATISFIED;
    }
    if (phases.some((phase) => isPhaseSatisfied(phase, satisfiedPhases))) {
      return CHECKPOINT_STATUS.MISSING;
    }
    return CHECKPOINT_STATUS.UNKNOWN;
  }

  const checkpointDefinitions = [
    {
      id: CHECKPOINT_IDS.FOUNDATIONAL_DRAFT_PIPELINE,
      label: "Foundational Draft Pipeline",
      phases: foundationalPhases,
      status: evaluatePhaseGroup(foundationalPhases)
    },
    {
      id: CHECKPOINT_IDS.STORAGE_BOUNDARY,
      label: "Storage Boundary",
      phases: storagePhases,
      status: evaluatePhaseGroup(storagePhases)
    },
    {
      id: CHECKPOINT_IDS.ORCHESTRATION_BOUNDARY,
      label: "Orchestration Boundary",
      phases: orchestrationPhases,
      status: evaluatePhaseGroup(orchestrationPhases)
    },
    {
      id: CHECKPOINT_IDS.TRACE_AND_REGISTRY,
      label: "Trace and Registry",
      phases: traceRegistryPhases,
      status: evaluatePhaseGroup(traceRegistryPhases)
    },
    {
      id: CHECKPOINT_IDS.READINESS_AND_REPORTING,
      label: "Readiness and Reporting",
      phases: readinessPhases,
      status: evaluatePhaseGroup(readinessPhases)
    },
    {
      id: CHECKPOINT_IDS.SNAPSHOT_ANALYSIS,
      label: "Snapshot Analysis",
      phases: snapshotPhases,
      status: evaluatePhaseGroup(snapshotPhases)
    },
    {
      id: CHECKPOINT_IDS.HEALTH_AND_RISK,
      label: "Health and Risk",
      phases: healthRiskPhases,
      status: evaluatePhaseGroup(healthRiskPhases)
    },
    {
      id: CHECKPOINT_IDS.INTELLIGENCE_AGGREGATION,
      label: "Intelligence Aggregation",
      phases: intelligencePhases,
      status: evaluatePhaseGroup(intelligencePhases)
    },
    {
      id: CHECKPOINT_IDS.RECOMMENDATION_AND_TIMELINE,
      label: "Recommendation and Timeline",
      phases: recommendationTimelinePhases,
      status: evaluatePhaseGroup(recommendationTimelinePhases)
    },
    {
      id: CHECKPOINT_IDS.CONSISTENCY_VALIDATION,
      label: "Consistency Validation",
      phases: consistencyPhases,
      status:
        signals.consistencyStatus === CONSISTENCY_STATUS.CONSISTENT
          ? CHECKPOINT_STATUS.SATISFIED
          : signals.consistencyStatus === CONSISTENCY_STATUS.INCONSISTENT
            ? CHECKPOINT_STATUS.MISSING
            : evaluatePhaseGroup(consistencyPhases)
    }
  ];

  const allPriorSatisfied = checkpointDefinitions.every(
    (checkpoint) => checkpoint.status === CHECKPOINT_STATUS.SATISFIED
  );

  const controlledGateStatus =
    allPriorSatisfied &&
    signals.readinessStatus === READINESS_ASSESSMENT_STATUS.READY_FOR_STORAGE &&
    signals.consistencyStatus === CONSISTENCY_STATUS.CONSISTENT &&
    (signals.recommendationStatus === RECOMMENDATION_STATUS.PROCEED ||
      signals.recommendationStatus === RECOMMENDATION_STATUS.MONITOR_ADVISORY) &&
    signals.intelligenceHealth !== HEALTH_STATUS.BLOCKED &&
    signals.intelligenceRisk !== RISK_LEVEL.CRITICAL
      ? CHECKPOINT_STATUS.SATISFIED
      : checkpointDefinitions.some(
            (checkpoint) => checkpoint.status === CHECKPOINT_STATUS.SATISFIED
          )
        ? CHECKPOINT_STATUS.MISSING
        : CHECKPOINT_STATUS.UNKNOWN;

  checkpointDefinitions.push({
    id: CHECKPOINT_IDS.CONTROLLED_INTEGRATION_GATE,
    label: "Controlled Integration Gate",
    phases: Object.freeze([134]),
    status: controlledGateStatus
  });

  return checkpointDefinitions.map((checkpoint) =>
    deepFreeze({
      id: checkpoint.id,
      label: checkpoint.label,
      phases: Object.freeze(checkpoint.phases.slice()),
      status: checkpoint.status
    })
  );
}

/**
 * @param {Readonly<Object>} signals
 * @param {ReadonlyArray<Object>} checkpoints
 * @returns {ReadonlyArray<Object>}
 */
function deriveMissingPrerequisites(signals, checkpoints) {
  const missing = [];
  const satisfiedPhases = signals.satisfiedPhases;
  const seenPhases = new Set();

  for (let i = 0; i < checkpoints.length; i += 1) {
    const checkpoint = checkpoints[i];
    if (checkpoint.status !== CHECKPOINT_STATUS.MISSING) {
      continue;
    }

    for (let j = 0; j < checkpoint.phases.length; j += 1) {
      const phase = checkpoint.phases[j];
      if (phase === 134 || isPhaseSatisfied(phase, satisfiedPhases) || seenPhases.has(phase)) {
        continue;
      }

      const node = PHASE_DEPENDENCY_GRAPH.find((entry) => entry.phase === phase);
      if (node == null) {
        continue;
      }

      seenPhases.add(phase);
      missing.push(
        deepFreeze({
          phase: node.phase,
          id: node.id,
          name: node.name,
          reason: `Phase ${node.phase} (${node.name}) advisory signals are not satisfied`
        })
      );
    }
  }

  if (
    signals.consistencyStatus === CONSISTENCY_STATUS.INCONSISTENT &&
    !missing.some((entry) => entry.phase === 133)
  ) {
    missing.push(
      deepFreeze({
        phase: 133,
        id: "consistency_validator",
        name: "Consistency Validator",
        reason: "Advisory consistency validation reports inconsistent outputs"
      })
    );
  }

  if (
    signals.readinessStatus === READINESS_ASSESSMENT_STATUS.BLOCKED &&
    !missing.some((entry) => entry.phase === 123)
  ) {
    missing.push(
      deepFreeze({
        phase: 123,
        id: "readiness_assessment",
        name: "Readiness Assessment",
        reason: "Workflow readiness assessment is blocked"
      })
    );
  }

  missing.sort((left, right) => left.phase - right.phase);

  return missing;
}

/**
 * @param {Readonly<Object>} signals
 * @param {ReadonlyArray<Object>} checkpoints
 * @param {ReadonlyArray<Object>} missingPrerequisites
 * @returns {string}
 */
function resolveReadinessLevel(signals, checkpoints, missingPrerequisites) {
  if (
    signals.consistencyStatus === CONSISTENCY_STATUS.INCONSISTENT ||
    signals.readinessStatus === READINESS_ASSESSMENT_STATUS.BLOCKED ||
    signals.recommendationStatus === RECOMMENDATION_STATUS.BLOCKED_ACTION_REQUIRED ||
    signals.intelligenceHealth === HEALTH_STATUS.BLOCKED ||
    signals.intelligenceRisk === RISK_LEVEL.CRITICAL
  ) {
    return READINESS_LEVEL.NOT_READY;
  }

  const controlledGate = checkpoints.find(
    (checkpoint) => checkpoint.id === CHECKPOINT_IDS.CONTROLLED_INTEGRATION_GATE
  );

  if (
    controlledGate != null &&
    controlledGate.status === CHECKPOINT_STATUS.SATISFIED &&
    signals.consistencyStatus === CONSISTENCY_STATUS.CONSISTENT &&
    signals.readinessStatus === READINESS_ASSESSMENT_STATUS.READY_FOR_STORAGE
  ) {
    return READINESS_LEVEL.READY_FOR_CONTROLLED_INTEGRATION;
  }

  const satisfiedCheckpointCount = checkpoints.filter(
    (checkpoint) => checkpoint.status === CHECKPOINT_STATUS.SATISFIED
  ).length;

  if (
    satisfiedCheckpointCount > 0 ||
    signals.readinessStatus === READINESS_ASSESSMENT_STATUS.PARTIALLY_READY ||
    signals.readinessStatus === READINESS_ASSESSMENT_STATUS.REVIEW_READY ||
    signals.readinessStatus === READINESS_ASSESSMENT_STATUS.APPROVAL_PENDING ||
    missingPrerequisites.length > 0
  ) {
    return READINESS_LEVEL.PARTIALLY_READY;
  }

  if (
    signals.readinessStatus === READINESS_ASSESSMENT_STATUS.NOT_STARTED ||
    signals.satisfiedPhases.size === 0
  ) {
    return READINESS_LEVEL.NOT_READY;
  }

  return READINESS_LEVEL.PARTIALLY_READY;
}

/**
 * @param {string} readinessLevel
 * @returns {string}
 */
function resolveIntegrationStatus(readinessLevel) {
  if (readinessLevel === READINESS_LEVEL.UNKNOWN) {
    return INTEGRATION_STATUS.UNKNOWN;
  }
  return readinessLevel;
}

/**
 * @param {string} readinessLevel
 * @param {ReadonlyArray<Object>} checkpoints
 * @param {ReadonlyArray<Object>} missingPrerequisites
 * @returns {string}
 */
function buildIntegrationSummary(readinessLevel, checkpoints, missingPrerequisites) {
  if (readinessLevel === READINESS_LEVEL.UNKNOWN) {
    return "Recruitment workflow advisory integration readiness could not be determined from supplied signals";
  }

  const satisfiedCount = checkpoints.filter(
    (checkpoint) => checkpoint.status === CHECKPOINT_STATUS.SATISFIED
  ).length;

  if (readinessLevel === READINESS_LEVEL.READY_FOR_CONTROLLED_INTEGRATION) {
    return `Recruitment workflow advisory architecture is ready for controlled integration with ${satisfiedCount} of ${checkpoints.length} checkpoints satisfied`;
  }

  if (readinessLevel === READINESS_LEVEL.NOT_READY) {
    if (missingPrerequisites.length === 1) {
      return `Recruitment workflow advisory integration is not ready: ${missingPrerequisites[0].reason}`;
    }
    return `Recruitment workflow advisory integration is not ready with ${missingPrerequisites.length} missing prerequisites`;
  }

  if (missingPrerequisites.length === 0) {
    return `Recruitment workflow advisory integration is partially ready with ${satisfiedCount} of ${checkpoints.length} checkpoints satisfied`;
  }

  return `Recruitment workflow advisory integration is partially ready with ${missingPrerequisites.length} missing prerequisites and ${satisfiedCount} of ${checkpoints.length} checkpoints satisfied`;
}

/**
 * @returns {Readonly<Object>}
 */
function buildStaticDependencyGraph() {
  return deepFreeze(
    PHASE_DEPENDENCY_GRAPH.map((node) =>
      deepFreeze({
        phase: node.phase,
        id: node.id,
        name: node.name,
        dependencies: Object.freeze(node.dependencies.slice())
      })
    )
  );
}

/**
 * @param {Readonly<Object>} params
 * @returns {Readonly<Object>}
 */
function buildIntegrationReadinessResult(params) {
  return deepFreeze({
    integrationStatus: params.integrationStatus,
    readinessLevel: params.readinessLevel,
    dependencyGraph: params.dependencyGraph,
    integrationCheckpoints: Object.freeze(params.integrationCheckpoints.slice()),
    missingPrerequisites: Object.freeze(params.missingPrerequisites.slice()),
    integrationSummary: params.integrationSummary,
    advisoryMetadata: deepFreeze({
      advisoryOnly: true,
      persistent: false,
      generatedBy: "phase_134",
      phase: RECRUITMENT_WORKFLOW_INTEGRATION_READINESS_FRAMEWORK_PHASE,
      architectureOnly: true,
      executed: false,
      persistenceEnabled: false,
      integrationPersistence: false,
      automationEnabled: false,
      alertingEnabled: false,
      historyTracking: false,
      sideEffects: false,
      mutatesInput: false,
      integrationReadinessOnly: true
    })
  });
}

/**
 * Evaluate recruitment workflow advisory integration readiness.
 * Pure: no I/O, no mutation of inputs, no persistence, no runtime coupling.
 *
 * @param {Object|null|undefined} input
 * @returns {Readonly<Object>}
 */
function createRecruitmentWorkflowIntegrationReadinessFramework(input) {
  const dependencyGraph = buildStaticDependencyGraph();

  if (!isRecognizedIntegrationInput(input) || !hasMeaningfulSignals(input)) {
    return buildIntegrationReadinessResult({
      integrationStatus: INTEGRATION_STATUS.UNKNOWN,
      readinessLevel: READINESS_LEVEL.UNKNOWN,
      dependencyGraph,
      integrationCheckpoints: [],
      missingPrerequisites: [],
      integrationSummary: buildIntegrationSummary(READINESS_LEVEL.UNKNOWN, [], [])
    });
  }

  const signals = extractIntegrationSignals(input);

  if (!hasResolvableSignals(signals)) {
    return buildIntegrationReadinessResult({
      integrationStatus: INTEGRATION_STATUS.UNKNOWN,
      readinessLevel: READINESS_LEVEL.UNKNOWN,
      dependencyGraph,
      integrationCheckpoints: [],
      missingPrerequisites: [],
      integrationSummary: buildIntegrationSummary(READINESS_LEVEL.UNKNOWN, [], [])
    });
  }

  const integrationCheckpoints = buildIntegrationCheckpoints(signals);
  const missingPrerequisites = deriveMissingPrerequisites(signals, integrationCheckpoints);
  const readinessLevel = resolveReadinessLevel(
    signals,
    integrationCheckpoints,
    missingPrerequisites
  );
  const integrationStatus = resolveIntegrationStatus(readinessLevel);
  const integrationSummary = buildIntegrationSummary(
    readinessLevel,
    integrationCheckpoints,
    missingPrerequisites
  );

  return buildIntegrationReadinessResult({
    integrationStatus,
    readinessLevel,
    dependencyGraph,
    integrationCheckpoints,
    missingPrerequisites,
    integrationSummary
  });
}

module.exports = {
  RECRUITMENT_WORKFLOW_INTEGRATION_READINESS_FRAMEWORK_PHASE,
  RECRUITMENT_WORKFLOW_INTEGRATION_READINESS_FRAMEWORK_ENTITY,
  INTEGRATION_STATUS,
  READINESS_LEVEL,
  CHECKPOINT_STATUS,
  CONSISTENCY_STATUS,
  RECOMMENDATION_STATUS,
  READINESS_ASSESSMENT_STATUS,
  HEALTH_STATUS,
  RISK_LEVEL,
  CAPABILITY_IDS,
  CAPABILITY_TO_PHASE,
  CHECKPOINT_IDS,
  PHASE_DEPENDENCY_GRAPH,
  RECRUITMENT_WORKFLOW_INTEGRATION_READINESS_FRAMEWORK_METADATA,
  createRecruitmentWorkflowIntegrationReadinessFramework
};
