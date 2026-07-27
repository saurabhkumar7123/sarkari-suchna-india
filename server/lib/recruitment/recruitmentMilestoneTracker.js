"use strict";

/**
 * Phase 150 — Recruitment Milestone Tracker (Advisory Only).
 *
 * Pure deterministic grouping of execution work packages into implementation
 * milestones with dependencies and completion requirements.
 * No database access, no persistence, no runtime imports, no side effects.
 * No automation. Never mutates input. Never persists output.
 *
 * No Express. No database. No filesystem. No network access.
 * No worker. No routing. No publishing. No execution changes.
 * No runtime module imports. No storage assumptions.
 */

const RECRUITMENT_MILESTONE_TRACKER_PHASE = 150;

const RECRUITMENT_MILESTONE_TRACKER_ENTITY = "recruitment_milestone_tracker";

const MILESTONE_TRACKER_SCHEMA_VERSION = "1.0.0";

const MILESTONE_STATUS = Object.freeze({
  PENDING: "PENDING",
  IN_PROGRESS: "IN_PROGRESS",
  BLOCKED: "BLOCKED",
  COMPLETE: "COMPLETE"
});

const MILESTONE_DEFINITIONS = Object.freeze([
  Object.freeze({
    milestoneNumber: 1,
    id: "MILESTONE_FOUNDATION_MONITORING",
    label: "Foundation monitoring baselines",
    workPackageIds: Object.freeze([
      "WP_MONITORING_PIPELINE_HEALTH",
      "WP_MONITORING_ALERTING_THRESHOLDS"
    ]),
    dependencies: Object.freeze([]),
    completionRequirements: Object.freeze([
      "All included work packages reach COMPLETE status",
      "Shadow health checkpoints validate without write side effects",
      "Alert thresholds remain non-paging in production"
    ])
  }),
  Object.freeze({
    milestoneNumber: 2,
    id: "MILESTONE_INGESTION_IDENTIFICATION",
    label: "Update ingestion and identification",
    workPackageIds: Object.freeze([
      "WP_UPDATE_INGESTION_BOT_DETECTION",
      "WP_UPDATE_INGESTION_NORMALIZATION",
      "WP_IDENTIFICATION_CONFIDENCE_ROUTING",
      "WP_IDENTIFICATION_DEDUPLICATION"
    ]),
    dependencies: Object.freeze(["MILESTONE_FOUNDATION_MONITORING"]),
    completionRequirements: Object.freeze([
      "All included work packages reach COMPLETE status",
      "Shadow detection does not alter production ingestion counts",
      "Deduplication proposals remain non-destructive"
    ])
  }),
  Object.freeze({
    milestoneNumber: 3,
    id: "MILESTONE_LIFECYCLE_VALIDATION",
    label: "Lifecycle classification and validation",
    workPackageIds: Object.freeze([
      "WP_LIFECYCLE_EVENT_CLASSIFIER",
      "WP_LIFECYCLE_TRANSITION_VALIDATION",
      "WP_VALIDATION_CONTRACT_COMPLIANCE",
      "WP_VALIDATION_GOVERNANCE_GATES"
    ]),
    dependencies: Object.freeze(["MILESTONE_INGESTION_IDENTIFICATION"]),
    completionRequirements: Object.freeze([
      "All included work packages reach COMPLETE status",
      "Classifier outputs match scenario fixtures within tolerance",
      "Governance gates remain non-enforcing in production"
    ])
  }),
  Object.freeze({
    milestoneNumber: 4,
    id: "MILESTONE_DRAFT_GROUPING",
    label: "Draft linkage and recruitment grouping",
    workPackageIds: Object.freeze([
      "WP_DRAFT_RECRUITMENT_BINDING",
      "WP_DRAFT_APPROVAL_GATE",
      "WP_GROUPING_CANDIDATE_RESOLUTION",
      "WP_GROUPING_IDENTITY_MERGE"
    ]),
    dependencies: Object.freeze(["MILESTONE_INGESTION_IDENTIFICATION"]),
    completionRequirements: Object.freeze([
      "All included work packages reach COMPLETE status",
      "No draft or recruitment row mutations during shadow validation",
      "Identity merge simulations are fully reversible"
    ])
  }),
  Object.freeze({
    milestoneNumber: 5,
    id: "MILESTONE_TIMELINE_PUBLISHING",
    label: "Timeline generation and controlled publishing",
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
    completionRequirements: Object.freeze([
      "All included work packages reach COMPLETE status",
      "No public content mutations during shadow sync planning",
      "Feature flags remain inactive; rollout plan documented only"
    ])
  }),
  Object.freeze({
    milestoneNumber: 6,
    id: "MILESTONE_OBSERVABILITY",
    label: "Observability completion",
    workPackageIds: Object.freeze([
      "WP_OBSERVABILITY_TRACE_CORRELATION",
      "WP_OBSERVABILITY_DIAGNOSTICS_ATTACHMENT"
    ]),
    dependencies: Object.freeze(["MILESTONE_FOUNDATION_MONITORING"]),
    completionRequirements: Object.freeze([
      "All included work packages reach COMPLETE status",
      "Trace correlation covers advisory pipeline stages",
      "Diagnostics attachment remains advisory-only"
    ])
  })
]);

const RECRUITMENT_MILESTONE_TRACKER_METADATA = Object.freeze({
  phase: RECRUITMENT_MILESTONE_TRACKER_PHASE,
  advisoryOnly: true,
  descriptiveOnly: true,
  readOnly: true,
  milestoneTrackerOnly: true,
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

const RECRUITMENT_MILESTONE_TRACKER_DESCRIPTOR = Object.freeze({
  entity: RECRUITMENT_MILESTONE_TRACKER_ENTITY,
  domain: "recruitment",
  phase: RECRUITMENT_MILESTONE_TRACKER_PHASE,
  description:
    "Pure deterministic milestone tracker grouping work packages into sequenced implementation milestones.",
  schemaVersion: MILESTONE_TRACKER_SCHEMA_VERSION,
  metadata: RECRUITMENT_MILESTONE_TRACKER_METADATA
});

const EXPECTED_RESULT_KEYS = Object.freeze([
  "recruitmentId",
  "milestones",
  "totalMilestoneCount",
  "dependencyValidation",
  "milestoneProgress",
  "milestoneSummary",
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
function isRecognizedMilestoneInput(input) {
  if (!isPlainObject(input)) {
    return false;
  }
  if (input.recruitmentId != null && typeof input.recruitmentId !== "string" && typeof input.recruitmentId !== "number") {
    return false;
  }
  if (input.workPackages != null && !isPlainObject(input.workPackages) && !Array.isArray(input.workPackages)) {
    return false;
  }
  if (input.completedPackageIds != null && !Array.isArray(input.completedPackageIds)) {
    return false;
  }
  return true;
}

/**
 * @param {*} input
 * @returns {Readonly<Set>}
 */
function deriveCompletedPackageSet(input) {
  const completed = new Set();
  if (!isPlainObject(input)) {
    return completed;
  }

  if (Array.isArray(input.completedPackageIds)) {
    for (let i = 0; i < input.completedPackageIds.length; i += 1) {
      if (typeof input.completedPackageIds[i] === "string") {
        completed.add(input.completedPackageIds[i]);
      }
    }
  }

  if (isPlainObject(input.workPackages) && Array.isArray(input.workPackages.workPackages)) {
    for (let i = 0; i < input.workPackages.workPackages.length; i += 1) {
      const pkg = input.workPackages.workPackages[i];
      if (isPlainObject(pkg) && pkg.status === "COMPLETE" && typeof pkg.identifier === "string") {
        completed.add(pkg.identifier);
      }
    }
  }

  if (Array.isArray(input.workPackages)) {
    for (let i = 0; i < input.workPackages.length; i += 1) {
      const pkg = input.workPackages[i];
      if (isPlainObject(pkg) && pkg.status === "COMPLETE" && typeof pkg.identifier === "string") {
        completed.add(pkg.identifier);
      } else if (typeof pkg === "string") {
        completed.add(pkg);
      }
    }
  }

  return completed;
}

/**
 * @param {Readonly<Set>} completedPackages
 * @param {Readonly<Array>} workPackageIds
 * @returns {{ completeCount: number, remainingCount: number, complete: boolean }}
 */
function assessPackageCompletion(completedPackages, workPackageIds) {
  let completeCount = 0;
  for (let i = 0; i < workPackageIds.length; i += 1) {
    if (completedPackages.has(workPackageIds[i])) {
      completeCount += 1;
    }
  }
  return {
    completeCount,
    remainingCount: workPackageIds.length - completeCount,
    complete: completeCount === workPackageIds.length && workPackageIds.length > 0
  };
}

/**
 * @param {Readonly<Set>} completedMilestoneIds
 * @param {Readonly<Array>} dependencies
 * @returns {boolean}
 */
function dependenciesSatisfied(completedMilestoneIds, dependencies) {
  for (let i = 0; i < dependencies.length; i += 1) {
    if (!completedMilestoneIds.has(dependencies[i])) {
      return false;
    }
  }
  return true;
}

/**
 * @param {Readonly<Set>} completedPackages
 * @returns {Readonly<Array>}
 */
function buildMilestones(completedPackages) {
  const completedMilestoneIds = new Set();
  const milestones = [];

  for (let i = 0; i < MILESTONE_DEFINITIONS.length; i += 1) {
    const def = MILESTONE_DEFINITIONS[i];
    const packageAssessment = assessPackageCompletion(completedPackages, def.workPackageIds);
    const depsMet = dependenciesSatisfied(completedMilestoneIds, def.dependencies);

    let status = MILESTONE_STATUS.PENDING;
    if (packageAssessment.complete) {
      status = MILESTONE_STATUS.COMPLETE;
      completedMilestoneIds.add(def.id);
    } else if (!depsMet) {
      status = MILESTONE_STATUS.BLOCKED;
    } else if (packageAssessment.completeCount > 0) {
      status = MILESTONE_STATUS.IN_PROGRESS;
    } else {
      status = MILESTONE_STATUS.PENDING;
    }

    milestones.push(
      Object.freeze({
        milestoneNumber: def.milestoneNumber,
        id: def.id,
        label: def.label,
        workPackageIds: def.workPackageIds,
        includedWorkPackages: def.workPackageIds,
        dependencies: def.dependencies,
        completionRequirements: def.completionRequirements,
        status,
        completeCount: packageAssessment.completeCount,
        remainingCount: packageAssessment.remainingCount,
        complete: packageAssessment.complete
      })
    );
  }

  return Object.freeze(milestones);
}

/**
 * @returns {Readonly<Object>}
 */
function validateMilestoneDependencies() {
  const knownIds = new Set();
  const issues = [];

  for (let i = 0; i < MILESTONE_DEFINITIONS.length; i += 1) {
    knownIds.add(MILESTONE_DEFINITIONS[i].id);
  }

  for (let i = 0; i < MILESTONE_DEFINITIONS.length; i += 1) {
    const def = MILESTONE_DEFINITIONS[i];
    for (let d = 0; d < def.dependencies.length; d += 1) {
      if (!knownIds.has(def.dependencies[d])) {
        issues.push(
          Object.freeze({
            milestoneId: def.id,
            dependency: def.dependencies[d],
            issue: "UNKNOWN_DEPENDENCY"
          })
        );
      }
    }
  }

  const numbers = MILESTONE_DEFINITIONS.map(function mapNumber(m) {
    return m.milestoneNumber;
  });
  for (let i = 1; i < numbers.length; i += 1) {
    if (numbers[i] <= numbers[i - 1]) {
      issues.push(
        Object.freeze({
          milestoneId: MILESTONE_DEFINITIONS[i].id,
          issue: "NON_INCREASING_MILESTONE_NUMBER"
        })
      );
    }
  }

  return Object.freeze({
    valid: issues.length === 0,
    knownMilestoneCount: knownIds.size,
    issues: Object.freeze(issues)
  });
}

/**
 * @param {Readonly<Array>} milestones
 * @returns {Readonly<Object>}
 */
function buildMilestoneProgress(milestones) {
  let complete = 0;
  let inProgress = 0;
  let blocked = 0;
  let pending = 0;

  for (let i = 0; i < milestones.length; i += 1) {
    const status = milestones[i].status;
    if (status === MILESTONE_STATUS.COMPLETE) {
      complete += 1;
    } else if (status === MILESTONE_STATUS.IN_PROGRESS) {
      inProgress += 1;
    } else if (status === MILESTONE_STATUS.BLOCKED) {
      blocked += 1;
    } else {
      pending += 1;
    }
  }

  const total = milestones.length;
  const percentage = total === 0 ? 0 : Math.round((complete / total) * 100);

  return Object.freeze({
    complete,
    inProgress,
    blocked,
    pending,
    total,
    percentage
  });
}

/**
 * @param {Readonly<Array>} milestones
 * @param {Readonly<Object>} progress
 * @returns {string}
 */
function buildMilestoneSummary(milestones, progress) {
  return (
    progress.complete +
    " of " +
    milestones.length +
    " implementation milestones complete (" +
    progress.percentage +
    "%); " +
    progress.blocked +
    " blocked by unmet dependencies."
  );
}

/**
 * @param {*} input
 * @returns {Readonly<Object>}
 */
function buildRecruitmentMilestoneTracker(input) {
  const hasInput = isRecognizedMilestoneInput(input);
  const safeInput = hasInput ? input : {};
  const recruitmentId = resolveRecruitmentId(safeInput.recruitmentId);
  const completedPackages = deriveCompletedPackageSet(hasInput ? input : null);
  const milestones = buildMilestones(completedPackages);
  const dependencyValidation = validateMilestoneDependencies();
  const milestoneProgress = buildMilestoneProgress(milestones);

  return deepFreeze({
    recruitmentId,
    milestones,
    totalMilestoneCount: milestones.length,
    dependencyValidation,
    milestoneProgress,
    milestoneSummary: buildMilestoneSummary(milestones, milestoneProgress),
    advisoryMetadata: Object.freeze({
      advisoryOnly: true,
      descriptiveOnly: true,
      persistent: false,
      generatedBy: "phase_150",
      phase: RECRUITMENT_MILESTONE_TRACKER_PHASE,
      milestoneTrackerOnly: true,
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
function isRecruitmentMilestoneTracker(value) {
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
  RECRUITMENT_MILESTONE_TRACKER_PHASE,
  RECRUITMENT_MILESTONE_TRACKER_ENTITY,
  MILESTONE_TRACKER_SCHEMA_VERSION,
  MILESTONE_STATUS,
  MILESTONE_DEFINITIONS,
  RECRUITMENT_MILESTONE_TRACKER_DESCRIPTOR,
  RECRUITMENT_MILESTONE_TRACKER_METADATA,
  EXPECTED_RESULT_KEYS,
  buildRecruitmentMilestoneTracker,
  isRecruitmentMilestoneTracker
};
