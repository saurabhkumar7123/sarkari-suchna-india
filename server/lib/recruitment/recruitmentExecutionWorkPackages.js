"use strict";

/**
 * Phase 150 — Recruitment Execution Work Packages (Advisory Only).
 *
 * Pure deterministic conversion of implementation gaps into discrete,
 * reversible work packages for future shadow-first execution planning.
 * No database access, no persistence, no runtime imports, no side effects.
 * No automation. Never mutates input. Never persists output.
 *
 * No Express. No database. No filesystem. No network access.
 * No worker. No routing. No publishing. No execution changes.
 * No runtime module imports. No storage assumptions.
 */

const RECRUITMENT_EXECUTION_WORK_PACKAGES_PHASE = 150;

const RECRUITMENT_EXECUTION_WORK_PACKAGES_ENTITY = "recruitment_execution_work_packages";

const WORK_PACKAGES_SCHEMA_VERSION = "1.0.0";

const ESTIMATED_COMPLEXITY = Object.freeze({
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH"
});

const WORK_PACKAGE_STATUS = Object.freeze({
  PENDING: "PENDING",
  READY: "READY",
  BLOCKED: "BLOCKED",
  COMPLETE: "COMPLETE"
});

const WORK_PACKAGE_DEFINITIONS = Object.freeze([
  Object.freeze({
    identifier: "WP_MONITORING_PIPELINE_HEALTH",
    order: 1,
    gapId: "GAP_MONITORING_PIPELINE_HEALTH",
    objective:
      "Wire read-only recruitment pipeline health checkpoints without mutating production monitoring paths.",
    prerequisites: Object.freeze([]),
    estimatedComplexity: ESTIMATED_COMPLEXITY.MEDIUM,
    rollbackStrategy:
      "Disable health checkpoint emission feature flag and restore prior monitoring baseline configuration.",
    successCriteria: Object.freeze([
      "Health checkpoint schema validates against advisory contract",
      "No write side effects observed in shadow comparison",
      "Existing monitoring dashboards remain unchanged"
    ])
  }),
  Object.freeze({
    identifier: "WP_MONITORING_ALERTING_THRESHOLDS",
    order: 2,
    gapId: "GAP_MONITORING_ALERTING_THRESHOLDS",
    objective:
      "Define advisory alerting thresholds for recruitment processing failures and SLA breaches.",
    prerequisites: Object.freeze(["WP_MONITORING_PIPELINE_HEALTH"]),
    estimatedComplexity: ESTIMATED_COMPLEXITY.LOW,
    rollbackStrategy:
      "Revert threshold configuration to prior unset state; remove advisory threshold artifacts.",
    successCriteria: Object.freeze([
      "Threshold definitions documented and frozen",
      "Shadow alerts do not page production on-call",
      "Threshold vocabulary matches governance checklist"
    ])
  }),
  Object.freeze({
    identifier: "WP_UPDATE_INGESTION_BOT_DETECTION",
    order: 3,
    gapId: "GAP_UPDATE_INGESTION_BOT_DETECTION",
    objective:
      "Observe bot-driven update detection signals in shadow mode without consuming them in production ingestion.",
    prerequisites: Object.freeze(["WP_MONITORING_PIPELINE_HEALTH"]),
    estimatedComplexity: ESTIMATED_COMPLEXITY.HIGH,
    rollbackStrategy:
      "Disconnect shadow observation tap; leave production ingestion path unmodified.",
    successCriteria: Object.freeze([
      "Detection signals captured in read-only observation store",
      "Production ingestion payload counts unchanged",
      "Shadow divergence report generated without write coupling"
    ])
  }),
  Object.freeze({
    identifier: "WP_UPDATE_INGESTION_NORMALIZATION",
    order: 4,
    gapId: "GAP_UPDATE_INGESTION_NORMALIZATION",
    objective:
      "Shadow-validate update payload normalization to recruitment domain vocabulary.",
    prerequisites: Object.freeze(["WP_UPDATE_INGESTION_BOT_DETECTION"]),
    estimatedComplexity: ESTIMATED_COMPLEXITY.MEDIUM,
    rollbackStrategy:
      "Discard shadow-normalized payloads; retain production raw update path.",
    successCriteria: Object.freeze([
      "Normalized shadow payloads pass contract compliance checks",
      "No production schema mutations",
      "Normalization failure rate below advisory acceptance threshold"
    ])
  }),
  Object.freeze({
    identifier: "WP_IDENTIFICATION_CONFIDENCE_ROUTING",
    order: 5,
    gapId: "GAP_IDENTIFICATION_CONFIDENCE_ROUTING",
    objective:
      "Shadow-evaluate confidence-based recruitment identification routing and manual review queues.",
    prerequisites: Object.freeze(["WP_UPDATE_INGESTION_NORMALIZATION"]),
    estimatedComplexity: ESTIMATED_COMPLEXITY.HIGH,
    rollbackStrategy:
      "Disable shadow routing advisor; clear advisory review queue artifacts.",
    successCriteria: Object.freeze([
      "Confidence bands produce stable routing decisions in shadow",
      "Manual review queue remains advisory-only",
      "No production identity writes occur"
    ])
  }),
  Object.freeze({
    identifier: "WP_IDENTIFICATION_DEDUPLICATION",
    order: 6,
    gapId: "GAP_IDENTIFICATION_DEDUPLICATION",
    objective:
      "Shadow-compare cross-source recruitment deduplication candidates without merging production entities.",
    prerequisites: Object.freeze(["WP_IDENTIFICATION_CONFIDENCE_ROUTING"]),
    estimatedComplexity: ESTIMATED_COMPLEXITY.HIGH,
    rollbackStrategy:
      "Discard shadow merge proposals; retain production identity graph untouched.",
    successCriteria: Object.freeze([
      "Deduplication proposals are reversible and non-destructive",
      "Collision reports include confidence and rationale",
      "Zero production identity merges during shadow validation"
    ])
  }),
  Object.freeze({
    identifier: "WP_LIFECYCLE_EVENT_CLASSIFIER",
    order: 7,
    gapId: "GAP_LIFECYCLE_EVENT_CLASSIFIER",
    objective:
      "Shadow-classify lifecycle events from ingested updates without coupling to the production pipeline.",
    prerequisites: Object.freeze(["WP_IDENTIFICATION_CONFIDENCE_ROUTING"]),
    estimatedComplexity: ESTIMATED_COMPLEXITY.HIGH,
    rollbackStrategy:
      "Stop shadow classifier emission; retain advisory classification artifacts only.",
    successCriteria: Object.freeze([
      "Classifier outputs match scenario verification fixtures",
      "Production lifecycle state remains unchanged",
      "Misclassification rate within advisory tolerance"
    ])
  }),
  Object.freeze({
    identifier: "WP_LIFECYCLE_TRANSITION_VALIDATION",
    order: 8,
    gapId: "GAP_LIFECYCLE_TRANSITION_VALIDATION",
    objective:
      "Shadow-validate forward lifecycle transition rules against advisory contract definitions.",
    prerequisites: Object.freeze(["WP_LIFECYCLE_EVENT_CLASSIFIER"]),
    estimatedComplexity: ESTIMATED_COMPLEXITY.MEDIUM,
    rollbackStrategy:
      "Disable shadow transition validator; discard advisory violation reports.",
    successCriteria: Object.freeze([
      "Illegal transition attempts are flagged in shadow only",
      "No production state machines altered",
      "Transition rule set matches documented contracts"
    ])
  }),
  Object.freeze({
    identifier: "WP_DRAFT_RECRUITMENT_BINDING",
    order: 9,
    gapId: "GAP_DRAFT_RECRUITMENT_BINDING",
    objective:
      "Shadow-propose draft-to-recruitment entity bindings without persisting production linkages.",
    prerequisites: Object.freeze(["WP_IDENTIFICATION_CONFIDENCE_ROUTING"]),
    estimatedComplexity: ESTIMATED_COMPLEXITY.MEDIUM,
    rollbackStrategy:
      "Drop shadow binding proposals; leave draft and recruitment stores unchanged.",
    successCriteria: Object.freeze([
      "Binding proposals validate against draft linkage contracts",
      "No draft or recruitment row mutations",
      "Orphan draft rate measurable in shadow reports"
    ])
  }),
  Object.freeze({
    identifier: "WP_DRAFT_APPROVAL_GATE",
    order: 10,
    gapId: "GAP_DRAFT_APPROVAL_GATE",
    objective:
      "Shadow-evaluate draft approval gate decisions without enabling write-through approval.",
    prerequisites: Object.freeze(["WP_DRAFT_RECRUITMENT_BINDING"]),
    estimatedComplexity: ESTIMATED_COMPLEXITY.MEDIUM,
    rollbackStrategy:
      "Disable shadow approval evaluator; retain existing manual approval path.",
    successCriteria: Object.freeze([
      "Approval decisions match governance checklist expectations",
      "Gate remains non-enforcing in production",
      "Shadow rejection reasons are auditable"
    ])
  }),
  Object.freeze({
    identifier: "WP_GROUPING_CANDIDATE_RESOLUTION",
    order: 11,
    gapId: "GAP_GROUPING_CANDIDATE_RESOLUTION",
    objective:
      "Shadow-resolve recruitment grouping candidates without applying production group memberships.",
    prerequisites: Object.freeze(["WP_IDENTIFICATION_CONFIDENCE_ROUTING"]),
    estimatedComplexity: ESTIMATED_COMPLEXITY.MEDIUM,
    rollbackStrategy:
      "Discard shadow grouping candidates; leave production grouping unchanged.",
    successCriteria: Object.freeze([
      "Grouping candidates are stable across repeated shadow runs",
      "No production group membership writes",
      "Candidate resolution respects identity prerequisites"
    ])
  }),
  Object.freeze({
    identifier: "WP_GROUPING_IDENTITY_MERGE",
    order: 12,
    gapId: "GAP_GROUPING_IDENTITY_MERGE",
    objective:
      "Shadow-simulate identity merge within recruitment groups without mutating production identities.",
    prerequisites: Object.freeze(["WP_GROUPING_CANDIDATE_RESOLUTION"]),
    estimatedComplexity: ESTIMATED_COMPLEXITY.HIGH,
    rollbackStrategy:
      "Abandon shadow merge simulation artifacts; no production identity rollback required.",
    successCriteria: Object.freeze([
      "Merge simulations are fully reversible by discarding artifacts",
      "Collision and conflict reports are complete",
      "Zero production identity mutations"
    ])
  }),
  Object.freeze({
    identifier: "WP_TIMELINE_EVENT_AGGREGATION",
    order: 13,
    gapId: "GAP_TIMELINE_EVENT_AGGREGATION",
    objective:
      "Shadow-aggregate timeline events from classified lifecycle outputs without publishing timelines.",
    prerequisites: Object.freeze([
      "WP_LIFECYCLE_TRANSITION_VALIDATION",
      "WP_GROUPING_CANDIDATE_RESOLUTION"
    ]),
    estimatedComplexity: ESTIMATED_COMPLEXITY.MEDIUM,
    rollbackStrategy:
      "Delete shadow timeline aggregates; retain production timeline store untouched.",
    successCriteria: Object.freeze([
      "Aggregated events form coherent timeline sequences",
      "No public timeline publication occurs",
      "Aggregation is deterministic for identical inputs"
    ])
  }),
  Object.freeze({
    identifier: "WP_TIMELINE_PUBLICATION_SYNC",
    order: 14,
    gapId: "GAP_TIMELINE_PUBLICATION_SYNC",
    objective:
      "Shadow-compare timeline publication sync plans without writing to public surfaces.",
    prerequisites: Object.freeze(["WP_TIMELINE_EVENT_AGGREGATION"]),
    estimatedComplexity: ESTIMATED_COMPLEXITY.MEDIUM,
    rollbackStrategy:
      "Discard shadow sync plans; leave published content unchanged.",
    successCriteria: Object.freeze([
      "Sync plans identify intended public diffs only",
      "No public content mutations",
      "Sync plan generation is repeatable"
    ])
  }),
  Object.freeze({
    identifier: "WP_VALIDATION_CONTRACT_COMPLIANCE",
    order: 15,
    gapId: "GAP_VALIDATION_CONTRACT_COMPLIANCE",
    objective:
      "Shadow-run contract compliance checks against implementation boundaries.",
    prerequisites: Object.freeze(["WP_LIFECYCLE_TRANSITION_VALIDATION"]),
    estimatedComplexity: ESTIMATED_COMPLEXITY.MEDIUM,
    rollbackStrategy:
      "Disable shadow compliance runner; discard advisory compliance reports.",
    successCriteria: Object.freeze([
      "Compliance report covers all active contracts",
      "Violations are advisory-only",
      "No enforcement side effects in production"
    ])
  }),
  Object.freeze({
    identifier: "WP_VALIDATION_GOVERNANCE_GATES",
    order: 16,
    gapId: "GAP_VALIDATION_GOVERNANCE_GATES",
    objective:
      "Shadow-evaluate governance gates prior to any publish readiness enforcement.",
    prerequisites: Object.freeze(["WP_VALIDATION_CONTRACT_COMPLIANCE"]),
    estimatedComplexity: ESTIMATED_COMPLEXITY.MEDIUM,
    rollbackStrategy:
      "Turn off shadow governance evaluator; retain existing non-enforcing posture.",
    successCriteria: Object.freeze([
      "Governance gate outcomes match checklist definitions",
      "Gates do not block production traffic",
      "Audit trail of shadow decisions is complete"
    ])
  }),
  Object.freeze({
    identifier: "WP_PUBLISH_READINESS_GATE",
    order: 17,
    gapId: "GAP_PUBLISH_READINESS_GATE",
    objective:
      "Shadow-evaluate publish readiness without enabling production publish gating.",
    prerequisites: Object.freeze([
      "WP_VALIDATION_GOVERNANCE_GATES",
      "WP_TIMELINE_PUBLICATION_SYNC",
      "WP_DRAFT_APPROVAL_GATE"
    ]),
    estimatedComplexity: ESTIMATED_COMPLEXITY.HIGH,
    rollbackStrategy:
      "Disable shadow readiness gate; leave publish path unrestricted as before.",
    successCriteria: Object.freeze([
      "Readiness decisions align with governance and timeline prerequisites",
      "No publish path blocking in production",
      "Shadow false-positive rate within advisory tolerance"
    ])
  }),
  Object.freeze({
    identifier: "WP_PUBLISH_CONTROLLED_ROLLOUT",
    order: 18,
    gapId: "GAP_PUBLISH_CONTROLLED_ROLLOUT",
    objective:
      "Plan controlled publishing behind feature flags without activating runtime rollout.",
    prerequisites: Object.freeze(["WP_PUBLISH_READINESS_GATE"]),
    estimatedComplexity: ESTIMATED_COMPLEXITY.HIGH,
    rollbackStrategy:
      "Keep feature flags off; discard rollout plan artifacts if needed.",
    successCriteria: Object.freeze([
      "Rollout plan documents flag stages without enabling flags",
      "Rollback steps are explicit and reversible",
      "No production publish behavior changes"
    ])
  }),
  Object.freeze({
    identifier: "WP_OBSERVABILITY_TRACE_CORRELATION",
    order: 19,
    gapId: "GAP_OBSERVABILITY_TRACE_CORRELATION",
    objective:
      "Shadow-correlate end-to-end traces across ingestion, classification, and publishing stages.",
    prerequisites: Object.freeze(["WP_MONITORING_ALERTING_THRESHOLDS"]),
    estimatedComplexity: ESTIMATED_COMPLEXITY.MEDIUM,
    rollbackStrategy:
      "Remove shadow correlation adapter; retain prior tracing configuration.",
    successCriteria: Object.freeze([
      "Trace correlation spans cover advisory pipeline stages",
      "No production trace sampling changes required",
      "Correlation artifacts are read-only"
    ])
  }),
  Object.freeze({
    identifier: "WP_OBSERVABILITY_DIAGNOSTICS_ATTACHMENT",
    order: 20,
    gapId: "GAP_OBSERVABILITY_DIAGNOSTICS_ATTACHMENT",
    objective:
      "Shadow-attach diagnostics to workflow stages without emitting production diagnostic side effects.",
    prerequisites: Object.freeze(["WP_OBSERVABILITY_TRACE_CORRELATION"]),
    estimatedComplexity: ESTIMATED_COMPLEXITY.LOW,
    rollbackStrategy:
      "Detach shadow diagnostics adapter; discard advisory attachment payloads.",
    successCriteria: Object.freeze([
      "Diagnostics payloads validate against observation contract",
      "Production run output remains unchanged",
      "Attachment is advisory-only and reversible"
    ])
  })
]);

const RECRUITMENT_EXECUTION_WORK_PACKAGES_METADATA = Object.freeze({
  phase: RECRUITMENT_EXECUTION_WORK_PACKAGES_PHASE,
  advisoryOnly: true,
  descriptiveOnly: true,
  readOnly: true,
  executionWorkPackagesOnly: true,
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

const RECRUITMENT_EXECUTION_WORK_PACKAGES_DESCRIPTOR = Object.freeze({
  entity: RECRUITMENT_EXECUTION_WORK_PACKAGES_ENTITY,
  domain: "recruitment",
  phase: RECRUITMENT_EXECUTION_WORK_PACKAGES_PHASE,
  description:
    "Pure deterministic work packages converting implementation gaps into reversible execution units.",
  schemaVersion: WORK_PACKAGES_SCHEMA_VERSION,
  metadata: RECRUITMENT_EXECUTION_WORK_PACKAGES_METADATA
});

const EXPECTED_RESULT_KEYS = Object.freeze([
  "recruitmentId",
  "workPackages",
  "totalPackageCount",
  "packagesByStatus",
  "dependencyValidation",
  "packageSummary",
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
function isRecognizedWorkPackagesInput(input) {
  if (!isPlainObject(input)) {
    return false;
  }
  if (input.recruitmentId != null && typeof input.recruitmentId !== "string" && typeof input.recruitmentId !== "number") {
    return false;
  }
  if (input.completedPackageIds != null && !Array.isArray(input.completedPackageIds)) {
    return false;
  }
  if (input.completedGapIds != null && !Array.isArray(input.completedGapIds)) {
    return false;
  }
  if (input.gapCatalog != null && !isPlainObject(input.gapCatalog)) {
    return false;
  }
  if (input.excludedPackageIds != null && !Array.isArray(input.excludedPackageIds)) {
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

  const completedGaps = new Set();
  if (Array.isArray(input.completedGapIds)) {
    for (let g = 0; g < input.completedGapIds.length; g += 1) {
      if (typeof input.completedGapIds[g] === "string") {
        completedGaps.add(input.completedGapIds[g]);
      }
    }
  }
  if (isPlainObject(input.gapCatalog) && Array.isArray(input.gapCatalog.gaps)) {
    for (let i = 0; i < input.gapCatalog.gaps.length; i += 1) {
      const gap = input.gapCatalog.gaps[i];
      if (isPlainObject(gap) && gap.complete === true && typeof gap.identifier === "string") {
        completedGaps.add(gap.identifier);
      }
    }
  }

  for (let p = 0; p < WORK_PACKAGE_DEFINITIONS.length; p += 1) {
    const pkg = WORK_PACKAGE_DEFINITIONS[p];
    if (completedGaps.has(pkg.gapId)) {
      completed.add(pkg.identifier);
    }
  }

  return completed;
}

/**
 * @param {*} input
 * @returns {Readonly<Set>|null}
 */
function deriveExcludedPackageSet(input) {
  if (!isPlainObject(input) || !Array.isArray(input.excludedPackageIds)) {
    return null;
  }
  const excluded = new Set();
  for (let i = 0; i < input.excludedPackageIds.length; i += 1) {
    if (typeof input.excludedPackageIds[i] === "string") {
      excluded.add(input.excludedPackageIds[i]);
    }
  }
  return excluded;
}

/**
 * @param {Readonly<Set>} completedPackages
 * @param {string} packageId
 * @returns {boolean}
 */
function prerequisitesSatisfied(completedPackages, packageId) {
  for (let i = 0; i < WORK_PACKAGE_DEFINITIONS.length; i += 1) {
    if (WORK_PACKAGE_DEFINITIONS[i].identifier === packageId) {
      const prereqs = WORK_PACKAGE_DEFINITIONS[i].prerequisites;
      for (let p = 0; p < prereqs.length; p += 1) {
        if (!completedPackages.has(prereqs[p])) {
          return false;
        }
      }
      return true;
    }
  }
  return false;
}

/**
 * @param {Readonly<Set>} completedPackages
 * @param {Readonly<Object>} definition
 * @returns {string}
 */
function resolvePackageStatus(completedPackages, definition) {
  if (completedPackages.has(definition.identifier)) {
    return WORK_PACKAGE_STATUS.COMPLETE;
  }
  if (definition.prerequisites.length === 0 || prerequisitesSatisfied(completedPackages, definition.identifier)) {
    return WORK_PACKAGE_STATUS.READY;
  }
  return WORK_PACKAGE_STATUS.BLOCKED;
}

/**
 * @param {Readonly<Set>} completedPackages
 * @param {Readonly<Set>|null} excludedPackages
 * @returns {Readonly<Array>}
 */
function buildWorkPackageEntries(completedPackages, excludedPackages) {
  return WORK_PACKAGE_DEFINITIONS.filter(function filterPackage(pkg) {
    if (excludedPackages != null && excludedPackages.has(pkg.identifier)) {
      return false;
    }
    return true;
  }).map(function mapPackage(pkg) {
    return Object.freeze({
      identifier: pkg.identifier,
      order: pkg.order,
      gapId: pkg.gapId,
      objective: pkg.objective,
      prerequisites: pkg.prerequisites,
      estimatedComplexity: pkg.estimatedComplexity,
      rollbackStrategy: pkg.rollbackStrategy,
      successCriteria: pkg.successCriteria,
      status: resolvePackageStatus(completedPackages, pkg)
    });
  });
}

/**
 * @param {Readonly<Array>} workPackages
 * @returns {Readonly<Object>}
 */
function buildPackagesByStatus(workPackages) {
  const byStatus = {
    PENDING: Object.freeze([]),
    READY: Object.freeze([]),
    BLOCKED: Object.freeze([]),
    COMPLETE: Object.freeze([])
  };

  const buckets = {
    PENDING: [],
    READY: [],
    BLOCKED: [],
    COMPLETE: []
  };

  for (let i = 0; i < workPackages.length; i += 1) {
    const pkg = workPackages[i];
    if (buckets[pkg.status]) {
      buckets[pkg.status].push(pkg.identifier);
    } else {
      buckets.PENDING.push(pkg.identifier);
    }
  }

  byStatus.PENDING = Object.freeze(buckets.PENDING);
  byStatus.READY = Object.freeze(buckets.READY);
  byStatus.BLOCKED = Object.freeze(buckets.BLOCKED);
  byStatus.COMPLETE = Object.freeze(buckets.COMPLETE);

  return deepFreeze(byStatus);
}

/**
 * @returns {Readonly<Object>}
 */
function validatePackageDependencies() {
  const knownIds = new Set();
  const issues = [];

  for (let i = 0; i < WORK_PACKAGE_DEFINITIONS.length; i += 1) {
    knownIds.add(WORK_PACKAGE_DEFINITIONS[i].identifier);
  }

  for (let i = 0; i < WORK_PACKAGE_DEFINITIONS.length; i += 1) {
    const pkg = WORK_PACKAGE_DEFINITIONS[i];
    for (let p = 0; p < pkg.prerequisites.length; p += 1) {
      const prereq = pkg.prerequisites[p];
      if (!knownIds.has(prereq)) {
        issues.push(
          Object.freeze({
            packageId: pkg.identifier,
            prerequisite: prereq,
            issue: "UNKNOWN_PREREQUISITE"
          })
        );
      }
    }
  }

  return Object.freeze({
    valid: issues.length === 0,
    knownPackageCount: knownIds.size,
    issues: Object.freeze(issues)
  });
}

/**
 * @param {Readonly<Array>} workPackages
 * @returns {string}
 */
function buildPackageSummary(workPackages) {
  const ready = workPackages.filter(function filterReady(p) {
    return p.status === WORK_PACKAGE_STATUS.READY;
  }).length;
  const blocked = workPackages.filter(function filterBlocked(p) {
    return p.status === WORK_PACKAGE_STATUS.BLOCKED;
  }).length;
  const complete = workPackages.filter(function filterComplete(p) {
    return p.status === WORK_PACKAGE_STATUS.COMPLETE;
  }).length;
  return (
    workPackages.length +
    " work packages defined (" +
    ready +
    " ready, " +
    blocked +
    " blocked, " +
    complete +
    " complete) for shadow-first reversible execution."
  );
}

/**
 * @param {*} input
 * @returns {Readonly<Object>}
 */
function buildRecruitmentExecutionWorkPackages(input) {
  const hasInput = isRecognizedWorkPackagesInput(input);
  const safeInput = hasInput ? input : {};
  const recruitmentId = resolveRecruitmentId(safeInput.recruitmentId);
  const completedPackages = deriveCompletedPackageSet(hasInput ? input : null);
  const excludedPackages = deriveExcludedPackageSet(hasInput ? input : null);
  const workPackages = buildWorkPackageEntries(completedPackages, excludedPackages);
  const packagesByStatus = buildPackagesByStatus(workPackages);
  const dependencyValidation = validatePackageDependencies();

  return deepFreeze({
    recruitmentId,
    workPackages,
    totalPackageCount: workPackages.length,
    packagesByStatus,
    dependencyValidation,
    packageSummary: buildPackageSummary(workPackages),
    advisoryMetadata: Object.freeze({
      advisoryOnly: true,
      descriptiveOnly: true,
      persistent: false,
      generatedBy: "phase_150",
      phase: RECRUITMENT_EXECUTION_WORK_PACKAGES_PHASE,
      executionWorkPackagesOnly: true,
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
function isRecruitmentExecutionWorkPackages(value) {
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

/**
 * @param {string} identifier
 * @returns {boolean}
 */
function isKnownWorkPackageIdentifier(identifier) {
  if (typeof identifier !== "string") {
    return false;
  }
  for (let i = 0; i < WORK_PACKAGE_DEFINITIONS.length; i += 1) {
    if (WORK_PACKAGE_DEFINITIONS[i].identifier === identifier) {
      return true;
    }
  }
  return false;
}

module.exports = {
  RECRUITMENT_EXECUTION_WORK_PACKAGES_PHASE,
  RECRUITMENT_EXECUTION_WORK_PACKAGES_ENTITY,
  WORK_PACKAGES_SCHEMA_VERSION,
  ESTIMATED_COMPLEXITY,
  WORK_PACKAGE_STATUS,
  WORK_PACKAGE_DEFINITIONS,
  RECRUITMENT_EXECUTION_WORK_PACKAGES_DESCRIPTOR,
  RECRUITMENT_EXECUTION_WORK_PACKAGES_METADATA,
  EXPECTED_RESULT_KEYS,
  buildRecruitmentExecutionWorkPackages,
  isRecruitmentExecutionWorkPackages,
  isKnownWorkPackageIdentifier
};
