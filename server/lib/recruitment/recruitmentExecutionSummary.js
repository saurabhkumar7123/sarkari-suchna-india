"use strict";

/**
 * Phase 150 — Recruitment Execution Summary (Advisory Only).
 *
 * Pure deterministic consolidated execution roadmap combining work packages,
 * shadow plans, and milestones into one readiness-oriented summary.
 * No database access, no persistence, no runtime imports, no side effects.
 * No automation. Never mutates input. Never persists output.
 *
 * No Express. No database. No filesystem. No network access.
 * No worker. No routing. No publishing. No execution changes.
 * No runtime module imports. No storage assumptions.
 */

const RECRUITMENT_EXECUTION_SUMMARY_PHASE = 150;

const RECRUITMENT_EXECUTION_SUMMARY_ENTITY = "recruitment_execution_summary";

const EXECUTION_SUMMARY_SCHEMA_VERSION = "1.0.0";

const CONFIDENCE_LEVEL = Object.freeze({
  HIGH: "HIGH",
  MEDIUM: "MEDIUM",
  LOW: "LOW",
  NONE: "NONE"
});

const READINESS_POSTURE = Object.freeze({
  EXECUTION_READY: "EXECUTION_READY",
  SHADOW_READY: "SHADOW_READY",
  PLANNING_COMPLETE: "PLANNING_COMPLETE",
  GAPS_REMAINING: "GAPS_REMAINING",
  NOT_ASSESSED: "NOT_ASSESSED"
});

const COMPLEXITY_PRIORITY_WEIGHT = Object.freeze({
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3
});

const DEFAULT_RISK_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: "RISK_RUNTIME_COUPLING",
    order: 1,
    severity: "CRITICAL",
    label: "Premature runtime coupling during gap closure",
    mitigation: "Keep all packages in shadow mode until governance gates pass."
  }),
  Object.freeze({
    id: "RISK_IRREVERSIBLE_IDENTITY_MERGE",
    order: 2,
    severity: "HIGH",
    label: "Irreversible identity merge during deduplication",
    mitigation: "Validate merge proposals in shadow only; require explicit human approval."
  }),
  Object.freeze({
    id: "RISK_PUBLISH_PATH_REGRESSION",
    order: 3,
    severity: "HIGH",
    label: "Publish path regression from readiness gate enforcement",
    mitigation: "Shadow-evaluate readiness without enabling production gating."
  }),
  Object.freeze({
    id: "RISK_FEATURE_FLAG_DRIFT",
    order: 4,
    severity: "MEDIUM",
    label: "Feature flag accidental activation during controlled rollout planning",
    mitigation: "Document rollout plans only; keep all flags inactive."
  }),
  Object.freeze({
    id: "RISK_OBSERVABILITY_GAPS",
    order: 5,
    severity: "MEDIUM",
    label: "Incomplete trace correlation obscuring shadow failures",
    mitigation: "Complete observability milestone before late-stage publish packages."
  })
]);

const DEFAULT_RECOMMENDATIONS = Object.freeze([
  Object.freeze({
    id: "REC_START_MONITORING",
    order: 1,
    label: "Begin with foundation monitoring work packages",
    rationale: "Monitoring baselines unblock ingestion and observability milestones."
  }),
  Object.freeze({
    id: "REC_SHADOW_FIRST",
    order: 2,
    label: "Validate every package in shadow mode before any write coupling",
    rationale: "Shadow plans define observation points and failure conditions without execution."
  }),
  Object.freeze({
    id: "REC_PARALLEL_LIFECYCLE_DRAFT",
    order: 3,
    label: "Run lifecycle validation and draft grouping milestones in parallel after ingestion",
    rationale: "Both milestones depend only on ingestion identification completion."
  }),
  Object.freeze({
    id: "REC_DEFER_PUBLISH",
    order: 4,
    label: "Defer controlled publishing until readiness and governance packages complete",
    rationale: "Publish packages have the highest blast radius and require all prerequisites."
  }),
  Object.freeze({
    id: "REC_KEEP_FLAGS_OFF",
    order: 5,
    label: "Keep feature flags inactive throughout advisory execution planning",
    rationale: "Phase 150 is planning-only; rollout activation remains disabled."
  })
]);

const TOTAL_DEFAULT_PACKAGES = 20;
const TOTAL_DEFAULT_MILESTONES = 6;

const RECRUITMENT_EXECUTION_SUMMARY_METADATA = Object.freeze({
  phase: RECRUITMENT_EXECUTION_SUMMARY_PHASE,
  advisoryOnly: true,
  descriptiveOnly: true,
  readOnly: true,
  executionSummaryOnly: true,
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
    63, 64, 65, 66, 67, 114, 120, 134, 138, 139, 145, 146, 147, 148, 149, 150
  ])
});

const RECRUITMENT_EXECUTION_SUMMARY_DESCRIPTOR = Object.freeze({
  entity: RECRUITMENT_EXECUTION_SUMMARY_ENTITY,
  domain: "recruitment",
  phase: RECRUITMENT_EXECUTION_SUMMARY_PHASE,
  description:
    "Pure deterministic consolidated execution roadmap for shadow-first recruitment implementation.",
  schemaVersion: EXECUTION_SUMMARY_SCHEMA_VERSION,
  metadata: RECRUITMENT_EXECUTION_SUMMARY_METADATA
});

const EXPECTED_RESULT_KEYS = Object.freeze([
  "recruitmentId",
  "implementationMilestones",
  "workPackageProgress",
  "readiness",
  "highestPriorityPackage",
  "risks",
  "recommendations",
  "confidence",
  "confidenceLevel",
  "readinessPosture",
  "executionRoadmapSummary",
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
function isRecognizedSummaryInput(input) {
  if (!isPlainObject(input)) {
    return false;
  }
  if (input.recruitmentId != null && typeof input.recruitmentId !== "string" && typeof input.recruitmentId !== "number") {
    return false;
  }
  if (input.workPackages != null && !isPlainObject(input.workPackages)) {
    return false;
  }
  if (input.shadowPlanner != null && !isPlainObject(input.shadowPlanner)) {
    return false;
  }
  if (input.milestoneTracker != null && !isPlainObject(input.milestoneTracker)) {
    return false;
  }
  if (input.completedPackageIds != null && !Array.isArray(input.completedPackageIds)) {
    return false;
  }
  return true;
}

/**
 * @param {*} input
 * @returns {Readonly<Array>}
 */
function resolveImplementationMilestones(input) {
  if (
    isPlainObject(input) &&
    isPlainObject(input.milestoneTracker) &&
    Array.isArray(input.milestoneTracker.milestones)
  ) {
    return Object.freeze(
      input.milestoneTracker.milestones.map(function mapMilestone(m) {
        return Object.freeze({
          milestoneNumber: m.milestoneNumber,
          id: m.id,
          label: m.label,
          status: m.status,
          workPackageIds: m.workPackageIds || m.includedWorkPackages || Object.freeze([]),
          dependencies: m.dependencies || Object.freeze([]),
          remainingCount: typeof m.remainingCount === "number" ? m.remainingCount : 0,
          complete: m.complete === true
        });
      })
    );
  }

  return Object.freeze([
    Object.freeze({
      milestoneNumber: 1,
      id: "MILESTONE_FOUNDATION_MONITORING",
      label: "Foundation monitoring baselines",
      status: "PENDING",
      workPackageIds: Object.freeze([
        "WP_MONITORING_PIPELINE_HEALTH",
        "WP_MONITORING_ALERTING_THRESHOLDS"
      ]),
      dependencies: Object.freeze([]),
      remainingCount: 2,
      complete: false
    }),
    Object.freeze({
      milestoneNumber: 2,
      id: "MILESTONE_INGESTION_IDENTIFICATION",
      label: "Update ingestion and identification",
      status: "BLOCKED",
      workPackageIds: Object.freeze([
        "WP_UPDATE_INGESTION_BOT_DETECTION",
        "WP_UPDATE_INGESTION_NORMALIZATION",
        "WP_IDENTIFICATION_CONFIDENCE_ROUTING",
        "WP_IDENTIFICATION_DEDUPLICATION"
      ]),
      dependencies: Object.freeze(["MILESTONE_FOUNDATION_MONITORING"]),
      remainingCount: 4,
      complete: false
    }),
    Object.freeze({
      milestoneNumber: 3,
      id: "MILESTONE_LIFECYCLE_VALIDATION",
      label: "Lifecycle classification and validation",
      status: "BLOCKED",
      workPackageIds: Object.freeze([
        "WP_LIFECYCLE_EVENT_CLASSIFIER",
        "WP_LIFECYCLE_TRANSITION_VALIDATION",
        "WP_VALIDATION_CONTRACT_COMPLIANCE",
        "WP_VALIDATION_GOVERNANCE_GATES"
      ]),
      dependencies: Object.freeze(["MILESTONE_INGESTION_IDENTIFICATION"]),
      remainingCount: 4,
      complete: false
    }),
    Object.freeze({
      milestoneNumber: 4,
      id: "MILESTONE_DRAFT_GROUPING",
      label: "Draft linkage and recruitment grouping",
      status: "BLOCKED",
      workPackageIds: Object.freeze([
        "WP_DRAFT_RECRUITMENT_BINDING",
        "WP_DRAFT_APPROVAL_GATE",
        "WP_GROUPING_CANDIDATE_RESOLUTION",
        "WP_GROUPING_IDENTITY_MERGE"
      ]),
      dependencies: Object.freeze(["MILESTONE_INGESTION_IDENTIFICATION"]),
      remainingCount: 4,
      complete: false
    }),
    Object.freeze({
      milestoneNumber: 5,
      id: "MILESTONE_TIMELINE_PUBLISHING",
      label: "Timeline generation and controlled publishing",
      status: "BLOCKED",
      workPackageIds: Object.freeze([
        "WP_TIMELINE_EVENT_AGGREGATION",
        "WP_TIMELINE_PUBLICATION_SYNC",
        "WP_PUBLISH_READINESS_GATE",
        "WP_PUBLISH_CONTROLLED_ROLLOUT"
      ]),
      dependencies: Object.freeze([
        "MILESTONE_LIFECYCLE_VALIDATION",
        "MILESTONE_DRAFT_GROUPING"
      ]),
      remainingCount: 4,
      complete: false
    }),
    Object.freeze({
      milestoneNumber: 6,
      id: "MILESTONE_OBSERVABILITY",
      label: "Observability completion",
      status: "BLOCKED",
      workPackageIds: Object.freeze([
        "WP_OBSERVABILITY_TRACE_CORRELATION",
        "WP_OBSERVABILITY_DIAGNOSTICS_ATTACHMENT"
      ]),
      dependencies: Object.freeze(["MILESTONE_FOUNDATION_MONITORING"]),
      remainingCount: 2,
      complete: false
    })
  ]);
}

/**
 * @param {*} input
 * @returns {Readonly<Object>}
 */
function resolveWorkPackageProgress(input) {
  if (isPlainObject(input) && isPlainObject(input.workPackages)) {
    const packages = Array.isArray(input.workPackages.workPackages)
      ? input.workPackages.workPackages
      : [];
    const byStatus = isPlainObject(input.workPackages.packagesByStatus)
      ? input.workPackages.packagesByStatus
      : {};

    let complete = Array.isArray(byStatus.COMPLETE) ? byStatus.COMPLETE.length : 0;
    let ready = Array.isArray(byStatus.READY) ? byStatus.READY.length : 0;
    let blocked = Array.isArray(byStatus.BLOCKED) ? byStatus.BLOCKED.length : 0;
    let pending = Array.isArray(byStatus.PENDING) ? byStatus.PENDING.length : 0;

    if (complete + ready + blocked + pending === 0 && packages.length > 0) {
      for (let i = 0; i < packages.length; i += 1) {
        const status = packages[i] && packages[i].status;
        if (status === "COMPLETE") {
          complete += 1;
        } else if (status === "READY") {
          ready += 1;
        } else if (status === "BLOCKED") {
          blocked += 1;
        } else {
          pending += 1;
        }
      }
    }

    const total =
      typeof input.workPackages.totalPackageCount === "number"
        ? input.workPackages.totalPackageCount
        : packages.length || TOTAL_DEFAULT_PACKAGES;
    const percentage = total === 0 ? 0 : Math.round((complete / total) * 100);

    return Object.freeze({
      total,
      complete,
      ready,
      blocked,
      pending,
      percentage,
      dependencyValid:
        isPlainObject(input.workPackages.dependencyValidation) &&
        input.workPackages.dependencyValidation.valid === true
    });
  }

  if (isPlainObject(input) && Array.isArray(input.completedPackageIds)) {
    const complete = input.completedPackageIds.filter(function filterString(id) {
      return typeof id === "string";
    }).length;
    const total = TOTAL_DEFAULT_PACKAGES;
    const ready = complete < total ? 1 : 0;
    return Object.freeze({
      total,
      complete,
      ready,
      blocked: Math.max(0, total - complete - ready),
      pending: 0,
      percentage: Math.round((complete / total) * 100),
      dependencyValid: true
    });
  }

  return Object.freeze({
    total: TOTAL_DEFAULT_PACKAGES,
    complete: 0,
    ready: 1,
    blocked: TOTAL_DEFAULT_PACKAGES - 1,
    pending: 0,
    percentage: 0,
    dependencyValid: true
  });
}

/**
 * @param {Readonly<Object>} workPackageProgress
 * @param {Readonly<Array>} milestones
 * @param {*} input
 * @returns {Readonly<Object>}
 */
function calculateReadiness(workPackageProgress, milestones, input) {
  const milestoneComplete = milestones.filter(function filterComplete(m) {
    return m.complete === true;
  }).length;
  const milestoneTotal = milestones.length || TOTAL_DEFAULT_MILESTONES;
  const packagePct = workPackageProgress.percentage;
  const milestonePct = Math.round((milestoneComplete / milestoneTotal) * 100);

  let shadowPlanBonus = 0;
  if (isPlainObject(input) && isPlainObject(input.shadowPlanner)) {
    shadowPlanBonus = 10;
    if (input.shadowPlanner.writeExecutionPermitted === false) {
      shadowPlanBonus += 5;
    }
  }

  let score = Math.round(packagePct * 0.5 + milestonePct * 0.35) + shadowPlanBonus;
  if (workPackageProgress.dependencyValid === true) {
    score += 5;
  }
  if (score > 100) {
    score = 100;
  }

  return Object.freeze({
    score,
    packagePercentage: packagePct,
    milestonePercentage: milestonePct,
    shadowPlansPresent: shadowPlanBonus > 0,
    dependencyValid: workPackageProgress.dependencyValid === true
  });
}

/**
 * @param {*} input
 * @returns {Readonly<Object>|null}
 */
function resolveHighestPriorityPackage(input) {
  let packages = [];
  if (
    isPlainObject(input) &&
    isPlainObject(input.workPackages) &&
    Array.isArray(input.workPackages.workPackages)
  ) {
    packages = input.workPackages.workPackages.filter(function filterIncomplete(p) {
      return isPlainObject(p) && p.status !== "COMPLETE";
    });
  }

  if (packages.length === 0) {
    return Object.freeze({
      identifier: "WP_MONITORING_PIPELINE_HEALTH",
      order: 1,
      objective:
        "Wire read-only recruitment pipeline health checkpoints without mutating production monitoring paths.",
      estimatedComplexity: "MEDIUM",
      status: "READY",
      priorityScore: 10,
      rationale: "Foundation package with no prerequisites; unblocks all downstream milestones."
    });
  }

  const readyFirst = packages
    .slice()
    .sort(function sortPriority(a, b) {
      const aReady = a.status === "READY" ? 0 : 1;
      const bReady = b.status === "READY" ? 0 : 1;
      if (aReady !== bReady) {
        return aReady - bReady;
      }
      const aOrder = typeof a.order === "number" ? a.order : 999;
      const bOrder = typeof b.order === "number" ? b.order : 999;
      if (aOrder !== bOrder) {
        return aOrder - bOrder;
      }
      const aComplexity = COMPLEXITY_PRIORITY_WEIGHT[a.estimatedComplexity] || 2;
      const bComplexity = COMPLEXITY_PRIORITY_WEIGHT[b.estimatedComplexity] || 2;
      return aComplexity - bComplexity;
    });

  const top = readyFirst[0];
  const priorityScore =
    (top.status === "READY" ? 10 : 5) -
    (COMPLEXITY_PRIORITY_WEIGHT[top.estimatedComplexity] || 2) +
    (typeof top.order === "number" ? Math.max(0, 10 - top.order) : 0);

  return Object.freeze({
    identifier: top.identifier,
    order: top.order,
    objective: top.objective || "",
    estimatedComplexity: top.estimatedComplexity || "MEDIUM",
    status: top.status || "PENDING",
    priorityScore,
    rationale:
      top.status === "READY"
        ? "Ready package with earliest order and satisfied prerequisites."
        : "Next unresolved package by milestone order."
  });
}

/**
 * @param {*} input
 * @returns {Readonly<Array>}
 */
function resolveRisks(input) {
  if (isPlainObject(input) && Array.isArray(input.risks) && input.risks.length > 0) {
    return Object.freeze(
      input.risks
        .filter(function filterRisk(r) {
          return isPlainObject(r);
        })
        .map(function mapRisk(r, index) {
          return Object.freeze({
            id: typeof r.id === "string" ? r.id : "RISK_" + (index + 1),
            order: typeof r.order === "number" ? r.order : index + 1,
            severity: typeof r.severity === "string" ? r.severity : "MEDIUM",
            label: typeof r.label === "string" ? r.label : "Unspecified risk",
            mitigation: typeof r.mitigation === "string" ? r.mitigation : ""
          });
        })
        .sort(function sortOrder(a, b) {
          return a.order - b.order;
        })
    );
  }

  if (
    isPlainObject(input) &&
    isPlainObject(input.riskMatrix) &&
    Array.isArray(input.riskMatrix.technicalRisk)
  ) {
    return Object.freeze(
      input.riskMatrix.technicalRisk.slice(0, 5).map(function mapTechRisk(r, index) {
        return Object.freeze({
          id: r.id || "TECH_RISK_" + (index + 1),
          order: r.order || index + 1,
          severity: r.severity || "MEDIUM",
          label: r.label || "Technical risk",
          mitigation: "Address via shadow validation before runtime coupling."
        });
      })
    );
  }

  return DEFAULT_RISK_DEFINITIONS;
}

/**
 * @param {*} input
 * @param {Readonly<Object>|null} highestPriorityPackage
 * @returns {Readonly<Array>}
 */
function resolveRecommendations(input, highestPriorityPackage) {
  const recommendations = DEFAULT_RECOMMENDATIONS.map(function mapRec(r) {
    return r;
  });

  if (highestPriorityPackage != null && typeof highestPriorityPackage.identifier === "string") {
    recommendations.unshift(
      Object.freeze({
        id: "REC_PRIORITY_PACKAGE",
        order: 0,
        label: "Prioritize " + highestPriorityPackage.identifier,
        rationale: highestPriorityPackage.rationale || "Highest-priority ready work package."
      })
    );
  }

  if (
    isPlainObject(input) &&
    isPlainObject(input.shadowPlanner) &&
    input.shadowPlanner.writeExecutionPermitted === false
  ) {
    recommendations.push(
      Object.freeze({
        id: "REC_CONFIRM_NO_WRITE",
        order: 6,
        label: "Confirm shadow planner writeExecutionPermitted remains false",
        rationale: "Shadow plans must never permit write execution during Phase 150."
      })
    );
  }

  return Object.freeze(
    recommendations.sort(function sortOrder(a, b) {
      return a.order - b.order;
    })
  );
}

/**
 * @param {Readonly<Object>} readiness
 * @param {*} input
 * @returns {number}
 */
function calculateConfidence(readiness, input) {
  if (!isPlainObject(input)) {
    return 0;
  }

  let confidence = Math.round(readiness.score * 0.6);

  if (isPlainObject(input.workPackages)) {
    confidence += 10;
    if (
      isPlainObject(input.workPackages.dependencyValidation) &&
      input.workPackages.dependencyValidation.valid === true
    ) {
      confidence += 5;
    }
  }
  if (isPlainObject(input.shadowPlanner)) {
    confidence += 10;
  }
  if (isPlainObject(input.milestoneTracker)) {
    confidence += 10;
    if (
      isPlainObject(input.milestoneTracker.dependencyValidation) &&
      input.milestoneTracker.dependencyValidation.valid === true
    ) {
      confidence += 5;
    }
  }
  if (isPlainObject(input.gapCatalog)) {
    confidence += 5;
  }
  if (isPlainObject(input.riskMatrix)) {
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
 * @param {Readonly<Object>} readiness
 * @param {Readonly<Object>} workPackageProgress
 * @param {*} input
 * @returns {string}
 */
function resolveReadinessPosture(readiness, workPackageProgress, input) {
  if (!isPlainObject(input)) {
    return READINESS_POSTURE.NOT_ASSESSED;
  }
  if (workPackageProgress.complete === workPackageProgress.total && workPackageProgress.total > 0) {
    return READINESS_POSTURE.EXECUTION_READY;
  }
  if (
    isPlainObject(input.shadowPlanner) &&
    isPlainObject(input.workPackages) &&
    isPlainObject(input.milestoneTracker) &&
    input.shadowPlanner.writeExecutionPermitted === false
  ) {
    return READINESS_POSTURE.SHADOW_READY;
  }
  if (isPlainObject(input.workPackages) || isPlainObject(input.milestoneTracker)) {
    return READINESS_POSTURE.PLANNING_COMPLETE;
  }
  return READINESS_POSTURE.GAPS_REMAINING;
}

/**
 * @param {string} posture
 * @param {Readonly<Object>} readiness
 * @param {Readonly<Object>} workPackageProgress
 * @param {Readonly<Object>|null} highestPriorityPackage
 * @returns {string}
 */
function buildExecutionRoadmapSummary(posture, readiness, workPackageProgress, highestPriorityPackage) {
  const priorityId =
    highestPriorityPackage != null && typeof highestPriorityPackage.identifier === "string"
      ? highestPriorityPackage.identifier
      : "WP_MONITORING_PIPELINE_HEALTH";

  if (posture === READINESS_POSTURE.EXECUTION_READY) {
    return (
      "All " +
      workPackageProgress.total +
      " work packages complete — execution roadmap readiness at " +
      readiness.score +
      "%."
    );
  }
  if (posture === READINESS_POSTURE.SHADOW_READY) {
    return (
      "Shadow-first execution plan ready (" +
      workPackageProgress.complete +
      "/" +
      workPackageProgress.total +
      " packages complete); next priority: " +
      priorityId +
      "."
    );
  }
  if (posture === READINESS_POSTURE.PLANNING_COMPLETE) {
    return (
      "Execution planning artifacts available — readiness score " +
      readiness.score +
      "%; prioritize " +
      priorityId +
      "."
    );
  }
  if (posture === READINESS_POSTURE.GAPS_REMAINING) {
    return (
      "Implementation gaps remain across " +
      workPackageProgress.total +
      " work packages — begin with " +
      priorityId +
      "."
    );
  }
  return "Execution roadmap not assessed.";
}

/**
 * @param {*} input
 * @returns {Readonly<Object>}
 */
function buildRecruitmentExecutionSummary(input) {
  const hasInput = isRecognizedSummaryInput(input);
  const safeInput = hasInput ? input : {};
  const recruitmentId = resolveRecruitmentId(safeInput.recruitmentId);
  const implementationMilestones = resolveImplementationMilestones(hasInput ? input : null);
  const workPackageProgress = resolveWorkPackageProgress(hasInput ? input : null);
  const readiness = calculateReadiness(workPackageProgress, implementationMilestones, hasInput ? input : null);
  const highestPriorityPackage = resolveHighestPriorityPackage(hasInput ? input : null);
  const risks = resolveRisks(hasInput ? input : null);
  const recommendations = resolveRecommendations(hasInput ? input : null, highestPriorityPackage);
  const confidence = calculateConfidence(readiness, hasInput ? input : null);
  const confidenceLevel = resolveConfidenceLevel(confidence);
  const readinessPosture = resolveReadinessPosture(readiness, workPackageProgress, hasInput ? input : null);

  return deepFreeze({
    recruitmentId,
    implementationMilestones,
    workPackageProgress,
    readiness,
    highestPriorityPackage,
    risks,
    recommendations,
    confidence,
    confidenceLevel,
    readinessPosture,
    executionRoadmapSummary: buildExecutionRoadmapSummary(
      readinessPosture,
      readiness,
      workPackageProgress,
      highestPriorityPackage
    ),
    advisoryMetadata: Object.freeze({
      advisoryOnly: true,
      descriptiveOnly: true,
      persistent: false,
      generatedBy: "phase_150",
      phase: RECRUITMENT_EXECUTION_SUMMARY_PHASE,
      executionSummaryOnly: true,
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
function isRecruitmentExecutionSummary(value) {
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
  RECRUITMENT_EXECUTION_SUMMARY_PHASE,
  RECRUITMENT_EXECUTION_SUMMARY_ENTITY,
  EXECUTION_SUMMARY_SCHEMA_VERSION,
  CONFIDENCE_LEVEL,
  READINESS_POSTURE,
  DEFAULT_RISK_DEFINITIONS,
  DEFAULT_RECOMMENDATIONS,
  RECRUITMENT_EXECUTION_SUMMARY_DESCRIPTOR,
  RECRUITMENT_EXECUTION_SUMMARY_METADATA,
  EXPECTED_RESULT_KEYS,
  buildRecruitmentExecutionSummary,
  isRecruitmentExecutionSummary
};
