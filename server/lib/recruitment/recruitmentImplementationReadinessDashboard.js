"use strict";

/**
 * Phase 149 — Recruitment Implementation Readiness Dashboard (Advisory Only).
 *
 * Pure deterministic consolidated implementation dashboard combining gap catalog,
 * roadmap, and risk matrix perspectives into one readiness view. No database
 * access, no persistence, no runtime imports, no side effects. No automation.
 * Never mutates input. Never persists output.
 *
 * No Express. No database. No filesystem. No network access.
 * No worker. No routing. No publishing. No execution changes.
 * No runtime module imports. No storage assumptions.
 */

const RECRUITMENT_IMPLEMENTATION_READINESS_DASHBOARD_PHASE = 149;

const RECRUITMENT_IMPLEMENTATION_READINESS_DASHBOARD_ENTITY =
  "recruitment_implementation_readiness_dashboard";

const DASHBOARD_SCHEMA_VERSION = "1.0.0";

const CONFIDENCE_LEVEL = Object.freeze({
  HIGH: "HIGH",
  MEDIUM: "MEDIUM",
  LOW: "LOW",
  NONE: "NONE"
});

const READINESS_POSTURE = Object.freeze({
  IMPLEMENTATION_READY: "IMPLEMENTATION_READY",
  NEARLY_READY: "NEARLY_READY",
  GAPS_REMAINING: "GAPS_REMAINING",
  NOT_ASSESSED: "NOT_ASSESSED"
});

const COMPLETED_FOUNDATION_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: "FOUNDATION_DOMAIN_MODEL",
    order: 1,
    label: "Domain model foundation",
    phase: 63,
    status: "COMPLETE"
  }),
  Object.freeze({
    id: "FOUNDATION_LIFECYCLE_CONTRACTS",
    order: 2,
    label: "Lifecycle contracts",
    phase: 64,
    status: "COMPLETE"
  }),
  Object.freeze({
    id: "FOUNDATION_IDENTITY_MODEL",
    order: 3,
    label: "Identity model",
    phase: 65,
    status: "COMPLETE"
  }),
  Object.freeze({
    id: "FOUNDATION_MATCHING_CONTRACTS",
    order: 4,
    label: "Matching contracts",
    phase: 66,
    status: "COMPLETE"
  }),
  Object.freeze({
    id: "FOUNDATION_INTEGRATION_MAP",
    order: 5,
    label: "Integration mapping",
    phase: 67,
    status: "COMPLETE"
  }),
  Object.freeze({
    id: "FOUNDATION_DRAFT_LIFECYCLE",
    order: 6,
    label: "Draft lifecycle foundation",
    phaseRange: Object.freeze([114, 117]),
    status: "COMPLETE"
  }),
  Object.freeze({
    id: "FOUNDATION_WORKFLOW_ORCHESTRATION",
    order: 7,
    label: "Workflow orchestration advisory",
    phase: 120,
    status: "COMPLETE"
  }),
  Object.freeze({
    id: "FOUNDATION_READINESS_FRAMEWORK",
    order: 8,
    label: "Integration readiness framework",
    phase: 134,
    status: "COMPLETE"
  }),
  Object.freeze({
    id: "FOUNDATION_RUNTIME_CONTRACT",
    order: 9,
    label: "Runtime integration contract",
    phase: 138,
    status: "COMPLETE"
  }),
  Object.freeze({
    id: "FOUNDATION_ARCHITECTURE_BLUEPRINT",
    order: 10,
    label: "Architecture blueprint composition",
    phase: 139,
    status: "COMPLETE"
  }),
  Object.freeze({
    id: "FOUNDATION_IMPLEMENTATION_CONTRACT",
    order: 11,
    label: "Implementation readiness contract",
    phase: 145,
    status: "COMPLETE"
  }),
  Object.freeze({
    id: "FOUNDATION_DRY_RUN_SIMULATION",
    order: 12,
    label: "Dry-run simulation framework",
    phase: 146,
    status: "COMPLETE"
  }),
  Object.freeze({
    id: "FOUNDATION_SCENARIO_VERIFICATION",
    order: 13,
    label: "Scenario verification and decision matrix",
    phase: 147,
    status: "COMPLETE"
  }),
  Object.freeze({
    id: "FOUNDATION_RUNTIME_INTEGRATION_BLUEPRINT",
    order: 14,
    label: "Runtime integration blueprint",
    phase: 148,
    status: "COMPLETE"
  }),
  Object.freeze({
    id: "FOUNDATION_IMPLEMENTATION_GAP_ANALYSIS",
    order: 15,
    label: "Implementation gap analysis framework",
    phase: 149,
    status: "COMPLETE"
  })
]);

const TOTAL_GAP_COUNT = 20;

const PRIORITY_IMPACT_WEIGHT = Object.freeze({
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1
});

const PRIORITY_COMPLEXITY_WEIGHT = Object.freeze({
  VERY_HIGH: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1
});

const RECRUITMENT_IMPLEMENTATION_READINESS_DASHBOARD_METADATA = Object.freeze({
  phase: RECRUITMENT_IMPLEMENTATION_READINESS_DASHBOARD_PHASE,
  advisoryOnly: true,
  descriptiveOnly: true,
  readOnly: true,
  implementationReadinessDashboardOnly: true,
  architectureOnly: true,
  runtimeIntegration: false,
  persistenceEnabled: false,
  persistent: false,
  queriesDatabase: false,
  sideEffects: false,
  mutatesInput: false,
  mutatesProduction: false,
  flagExecutionEnabled: false,
  rolloutActivationEnabled: false,
  runtimeWiringEnabled: false,
  executed: false,
  activatesAnything: false,
  sourcePhases: Object.freeze([
    63, 64, 65, 66, 67, 114, 120, 134, 138, 139, 145, 146, 147, 148, 149
  ])
});

const RECRUITMENT_IMPLEMENTATION_READINESS_DASHBOARD_DESCRIPTOR = Object.freeze({
  entity: RECRUITMENT_IMPLEMENTATION_READINESS_DASHBOARD_ENTITY,
  domain: "recruitment",
  phase: RECRUITMENT_IMPLEMENTATION_READINESS_DASHBOARD_PHASE,
  description:
    "Pure deterministic consolidated implementation readiness dashboard for recruitment lifecycle automation.",
  schemaVersion: DASHBOARD_SCHEMA_VERSION,
  metadata: RECRUITMENT_IMPLEMENTATION_READINESS_DASHBOARD_METADATA
});

const EXPECTED_RESULT_KEYS = Object.freeze([
  "recruitmentId",
  "completedFoundations",
  "remainingGaps",
  "readinessPercentage",
  "highestPriorityItems",
  "nextRecommendedMilestones",
  "confidence",
  "confidenceLevel",
  "readinessPosture",
  "dashboardSummary",
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
function isRecognizedDashboardInput(input) {
  if (!isPlainObject(input)) {
    return false;
  }
  if (input.recruitmentId != null && typeof input.recruitmentId !== "string" && typeof input.recruitmentId !== "number") {
    return false;
  }
  if (input.gapCatalog != null && !isPlainObject(input.gapCatalog)) {
    return false;
  }
  if (input.roadmap != null && !isPlainObject(input.roadmap)) {
    return false;
  }
  if (input.riskMatrix != null && !isPlainObject(input.riskMatrix)) {
    return false;
  }
  if (input.completedGapIds != null && !Array.isArray(input.completedGapIds)) {
    return false;
  }
  return true;
}

/**
 * @param {*} input
 * @returns {Readonly<Array>}
 */
function resolveRemainingGaps(input) {
  if (isPlainObject(input) && isPlainObject(input.gapCatalog) && Array.isArray(input.gapCatalog.gaps)) {
    return input.gapCatalog.gaps.filter(function filterRemaining(g) {
      return isPlainObject(g) && g.complete !== true;
    });
  }

  const completed = new Set();
  if (isPlainObject(input) && Array.isArray(input.completedGapIds)) {
    for (let i = 0; i < input.completedGapIds.length; i += 1) {
      if (typeof input.completedGapIds[i] === "string") {
        completed.add(input.completedGapIds[i]);
      }
    }
  }

  const defaultGapIds = [
    "GAP_MONITORING_PIPELINE_HEALTH",
    "GAP_MONITORING_ALERTING_THRESHOLDS",
    "GAP_UPDATE_INGESTION_BOT_DETECTION",
    "GAP_UPDATE_INGESTION_NORMALIZATION",
    "GAP_IDENTIFICATION_CONFIDENCE_ROUTING",
    "GAP_IDENTIFICATION_DEDUPLICATION",
    "GAP_LIFECYCLE_EVENT_CLASSIFIER",
    "GAP_LIFECYCLE_TRANSITION_VALIDATION",
    "GAP_DRAFT_RECRUITMENT_BINDING",
    "GAP_DRAFT_APPROVAL_GATE",
    "GAP_GROUPING_CANDIDATE_RESOLUTION",
    "GAP_GROUPING_IDENTITY_MERGE",
    "GAP_TIMELINE_EVENT_AGGREGATION",
    "GAP_TIMELINE_PUBLICATION_SYNC",
    "GAP_VALIDATION_CONTRACT_COMPLIANCE",
    "GAP_VALIDATION_GOVERNANCE_GATES",
    "GAP_PUBLISH_READINESS_GATE",
    "GAP_PUBLISH_CONTROLLED_ROLLOUT",
    "GAP_OBSERVABILITY_TRACE_CORRELATION",
    "GAP_OBSERVABILITY_DIAGNOSTICS_ATTACHMENT"
  ];

  const gaps = [];
  for (let g = 0; g < defaultGapIds.length; g += 1) {
    const id = defaultGapIds[g];
    if (!completed.has(id)) {
      gaps.push(
        Object.freeze({
          identifier: id,
          complete: false
        })
      );
    }
  }
  return gaps;
}

/**
 * @param {Readonly<Array>} remainingGaps
 * @param {*} input
 * @returns {number}
 */
function calculateReadinessPercentage(remainingGaps, input) {
  let totalGaps = TOTAL_GAP_COUNT;
  if (isPlainObject(input) && isPlainObject(input.gapCatalog) && typeof input.gapCatalog.totalGapCount === "number") {
    totalGaps = input.gapCatalog.totalGapCount;
  }
  if (totalGaps <= 0) {
    return 0;
  }
  const completedCount = totalGaps - remainingGaps.length;
  const foundationBonus = COMPLETED_FOUNDATION_DEFINITIONS.length * 2;
  const gapProgress = Math.round((completedCount / totalGaps) * 70);
  const foundationProgress = Math.min(30, foundationBonus);
  const percentage = gapProgress + foundationProgress;
  if (percentage > 100) {
    return 100;
  }
  return percentage;
}

/**
 * @param {Readonly<Array>} remainingGaps
 * @returns {Readonly<Array>}
 */
function buildHighestPriorityItems(remainingGaps) {
  const scored = remainingGaps
    .filter(function filterGap(g) {
      return isPlainObject(g) && typeof g.identifier === "string";
    })
    .map(function scoreGap(gap) {
      const impactWeight = PRIORITY_IMPACT_WEIGHT[gap.productionImpact] || 2;
      const complexityWeight = PRIORITY_COMPLEXITY_WEIGHT[gap.implementationComplexity] || 2;
      const priorityScore = impactWeight * 10 - complexityWeight;
      return Object.freeze({
        identifier: gap.identifier,
        area: gap.area || "unknown",
        description: gap.description || "",
        implementationComplexity: gap.implementationComplexity || "MEDIUM",
        productionImpact: gap.productionImpact || "MEDIUM",
        prerequisiteDependencies: gap.prerequisiteDependencies || Object.freeze([]),
        priorityScore
      });
    })
    .sort(function sortPriority(a, b) {
      if (b.priorityScore !== a.priorityScore) {
        return b.priorityScore - a.priorityScore;
      }
      return a.identifier < b.identifier ? -1 : a.identifier > b.identifier ? 1 : 0;
    });

  return Object.freeze(scored.slice(0, 5));
}

/**
 * @param {*} input
 * @returns {Readonly<Array>}
 */
function buildNextRecommendedMilestones(input) {
  if (isPlainObject(input) && isPlainObject(input.roadmap) && Array.isArray(input.roadmap.recommendedPhases)) {
    const incomplete = input.roadmap.recommendedPhases
      .filter(function filterIncomplete(p) {
        return isPlainObject(p) && p.complete !== true;
      })
      .sort(function sortOrder(a, b) {
        return a.order - b.order;
      })
      .slice(0, 3)
      .map(function mapMilestone(phase) {
        return Object.freeze({
          id: phase.id,
          order: phase.order,
          label: phase.label,
          remainingGapCount: phase.remainingGapCount || 0
        });
      });
    if (incomplete.length > 0) {
      return Object.freeze(incomplete);
    }
  }

  if (isPlainObject(input) && isPlainObject(input.roadmap) && Array.isArray(input.roadmap.rolloutOrder)) {
    return Object.freeze(
      input.roadmap.rolloutOrder.slice(0, 3).map(function mapRollout(step) {
        return Object.freeze({
          id: step.id,
          order: step.order,
          label: step.label,
          activatesRuntime: step.activatesRuntime === true
        });
      })
    );
  }

  return Object.freeze([
    Object.freeze({
      id: "ROLLOUT_MONITORING_BASELINE",
      order: 1,
      label: "Establish monitoring baselines",
      remainingGapCount: 2
    }),
    Object.freeze({
      id: "ROLLOUT_SHADOW_INGESTION",
      order: 2,
      label: "Shadow-mode update ingestion observation",
      remainingGapCount: 2
    }),
    Object.freeze({
      id: "ROLLOUT_IDENTIFICATION_CLASSIFICATION",
      order: 3,
      label: "Advisory identification and lifecycle classification",
      remainingGapCount: 3
    })
  ]);
}

/**
 * @param {number} readinessPercentage
 * @param {*} input
 * @returns {number}
 */
function calculateConfidence(readinessPercentage, input) {
  if (!isPlainObject(input)) {
    return 0;
  }

  let confidence = Math.round(readinessPercentage * 0.5);

  if (isPlainObject(input.gapCatalog)) {
    confidence += 10;
  }
  if (isPlainObject(input.roadmap)) {
    confidence += 10;
    if (isPlainObject(input.roadmap.dependencyValidation) && input.roadmap.dependencyValidation.valid === true) {
      confidence += 5;
    }
  }
  if (isPlainObject(input.riskMatrix)) {
    confidence += 10;
    if (input.riskMatrix.overallRiskPosture === "ELEVATED" || input.riskMatrix.overallRiskPosture === "ACCEPTABLE") {
      confidence += 5;
    }
  }
  if (isPlainObject(input.scenarioSummary)) {
    confidence += 5;
  }
  if (isPlainObject(input.simulationSummary)) {
    confidence += 5;
  }
  if (isPlainObject(input.integrationReadinessReport)) {
    confidence += 5;
  }

  if (confidence > 100) {
    return 100;
  }
  return confidence;
}

/**
 * @param {number} confidence
 * @returns {string}
 */
function resolveConfidenceLevel(confidence) {
  if (confidence >= 80) {
    return CONFIDENCE_LEVEL.HIGH;
  }
  if (confidence >= 50) {
    return CONFIDENCE_LEVEL.MEDIUM;
  }
  if (confidence > 0) {
    return CONFIDENCE_LEVEL.LOW;
  }
  return CONFIDENCE_LEVEL.NONE;
}

/**
 * @param {number} readinessPercentage
 * @param {Readonly<Array>} remainingGaps
 * @param {*} input
 * @returns {string}
 */
function resolveReadinessPosture(readinessPercentage, remainingGaps, input) {
  if (!isPlainObject(input)) {
    return READINESS_POSTURE.NOT_ASSESSED;
  }
  if (remainingGaps.length === 0 && readinessPercentage >= 90) {
    return READINESS_POSTURE.IMPLEMENTATION_READY;
  }
  if (readinessPercentage >= 60) {
    return READINESS_POSTURE.NEARLY_READY;
  }
  return READINESS_POSTURE.GAPS_REMAINING;
}

/**
 * @param {string} posture
 * @param {number} readinessPercentage
 * @param {Readonly<Array>} remainingGaps
 * @returns {string}
 */
function buildDashboardSummary(posture, readinessPercentage, remainingGaps) {
  if (posture === READINESS_POSTURE.IMPLEMENTATION_READY) {
    return "All implementation gaps addressed — platform readiness at " + readinessPercentage + "%.";
  }
  if (posture === READINESS_POSTURE.NEARLY_READY) {
    return (
      "Architecture foundations complete with " +
      remainingGaps.length +
      " gaps remaining — readiness at " +
      readinessPercentage +
      "%."
    );
  }
  if (posture === READINESS_POSTURE.GAPS_REMAINING) {
    return (
      remainingGaps.length +
      " implementation gaps remain across the recruitment lifecycle — readiness at " +
      readinessPercentage +
      "%."
    );
  }
  return "Implementation readiness not assessed.";
}

/**
 * @param {*} input
 * @returns {Readonly<Object>}
 */
function buildRecruitmentImplementationReadinessDashboard(input) {
  const hasInput = isRecognizedDashboardInput(input);
  const safeInput = hasInput ? input : {};
  const recruitmentId = resolveRecruitmentId(safeInput.recruitmentId);
  const remainingGaps = resolveRemainingGaps(hasInput ? input : null);
  const readinessPercentage = calculateReadinessPercentage(remainingGaps, hasInput ? input : null);
  const highestPriorityItems = buildHighestPriorityItems(remainingGaps);
  const nextRecommendedMilestones = buildNextRecommendedMilestones(hasInput ? input : null);
  const confidence = calculateConfidence(readinessPercentage, hasInput ? input : null);
  const confidenceLevel = resolveConfidenceLevel(confidence);
  const readinessPosture = resolveReadinessPosture(readinessPercentage, remainingGaps, hasInput ? input : null);

  return deepFreeze({
    recruitmentId,
    completedFoundations: COMPLETED_FOUNDATION_DEFINITIONS,
    remainingGaps,
    readinessPercentage,
    highestPriorityItems,
    nextRecommendedMilestones,
    confidence,
    confidenceLevel,
    readinessPosture,
    dashboardSummary: buildDashboardSummary(readinessPosture, readinessPercentage, remainingGaps),
    advisoryMetadata: Object.freeze({
      advisoryOnly: true,
      descriptiveOnly: true,
      persistent: false,
      generatedBy: "phase_149",
      phase: RECRUITMENT_IMPLEMENTATION_READINESS_DASHBOARD_PHASE,
      implementationReadinessDashboardOnly: true,
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
function isRecruitmentImplementationReadinessDashboard(value) {
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
  return true;
}

module.exports = {
  RECRUITMENT_IMPLEMENTATION_READINESS_DASHBOARD_PHASE,
  RECRUITMENT_IMPLEMENTATION_READINESS_DASHBOARD_ENTITY,
  DASHBOARD_SCHEMA_VERSION,
  CONFIDENCE_LEVEL,
  READINESS_POSTURE,
  COMPLETED_FOUNDATION_DEFINITIONS,
  RECRUITMENT_IMPLEMENTATION_READINESS_DASHBOARD_DESCRIPTOR,
  RECRUITMENT_IMPLEMENTATION_READINESS_DASHBOARD_METADATA,
  EXPECTED_RESULT_KEYS,
  buildRecruitmentImplementationReadinessDashboard,
  isRecruitmentImplementationReadinessDashboard
};
