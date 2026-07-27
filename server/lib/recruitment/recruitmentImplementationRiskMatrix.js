"use strict";

/**
 * Phase 149 — Recruitment Implementation Risk Matrix (Advisory Only).
 *
 * Pure deterministic risk assessment for implementation gaps covering
 * technical, operational, deployment, and rollback risks with mitigation
 * strategies. No database access, no persistence, no runtime imports,
 * no side effects. No automation. Never mutates input. Never persists output.
 *
 * No Express. No database. No filesystem. No network access.
 * No worker. No routing. No publishing. No execution changes.
 * No runtime module imports. No storage assumptions.
 */

const RECRUITMENT_IMPLEMENTATION_RISK_MATRIX_PHASE = 149;

const RECRUITMENT_IMPLEMENTATION_RISK_MATRIX_ENTITY = "recruitment_implementation_risk_matrix";

const RISK_MATRIX_SCHEMA_VERSION = "1.0.0";

const RISK_SEVERITY = Object.freeze({
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  CRITICAL: "CRITICAL"
});

const RISK_CATEGORY = Object.freeze({
  TECHNICAL: "technical",
  OPERATIONAL: "operational",
  DEPLOYMENT: "deployment",
  ROLLBACK: "rollback"
});

const SEVERITY_WEIGHT = Object.freeze({
  [RISK_SEVERITY.LOW]: 1,
  [RISK_SEVERITY.MEDIUM]: 2,
  [RISK_SEVERITY.HIGH]: 3,
  [RISK_SEVERITY.CRITICAL]: 4
});

const OVERALL_RISK_POSTURE = Object.freeze({
  ACCEPTABLE: "ACCEPTABLE",
  ELEVATED: "ELEVATED",
  HIGH: "HIGH",
  CRITICAL: "CRITICAL",
  UNKNOWN: "UNKNOWN"
});

const TECHNICAL_RISK_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: "TECH_RISK_PIPELINE_REGRESSION",
    order: 1,
    severity: RISK_SEVERITY.CRITICAL,
    label: "Production pipeline regression during gap closure",
    relatedGapIds: Object.freeze([
      "GAP_UPDATE_INGESTION_BOT_DETECTION",
      "GAP_LIFECYCLE_EVENT_CLASSIFIER"
    ]),
    description: "Coupling advisory logic to production paths may introduce regressions in existing job processing."
  }),
  Object.freeze({
    id: "TECH_RISK_IDENTITY_COLLISION",
    order: 2,
    severity: RISK_SEVERITY.HIGH,
    label: "Recruitment identity collision during deduplication",
    relatedGapIds: Object.freeze([
      "GAP_IDENTIFICATION_DEDUPLICATION",
      "GAP_GROUPING_IDENTITY_MERGE"
    ]),
    description: "Automated deduplication may incorrectly merge distinct recruitment entities."
  }),
  Object.freeze({
    id: "TECH_RISK_CLASSIFICATION_ACCURACY",
    order: 3,
    severity: RISK_SEVERITY.HIGH,
    label: "Lifecycle classification accuracy at scale",
    relatedGapIds: Object.freeze([
      "GAP_LIFECYCLE_EVENT_CLASSIFIER",
      "GAP_LIFECYCLE_TRANSITION_VALIDATION"
    ]),
    description: "Misclassified lifecycle events propagate incorrect timelines and publish states."
  }),
  Object.freeze({
    id: "TECH_RISK_CONTRACT_DRIFT",
    order: 4,
    severity: RISK_SEVERITY.MEDIUM,
    label: "Implementation contract drift from advisory definitions",
    relatedGapIds: Object.freeze(["GAP_VALIDATION_CONTRACT_COMPLIANCE"]),
    description: "Runtime implementation may diverge from documented contract boundaries."
  }),
  Object.freeze({
    id: "TECH_RISK_TRACE_FRAGMENTATION",
    order: 5,
    severity: RISK_SEVERITY.MEDIUM,
    label: "Distributed trace fragmentation",
    relatedGapIds: Object.freeze(["GAP_OBSERVABILITY_TRACE_CORRELATION"]),
    description: "Incomplete trace correlation obscures failure root cause across pipeline stages."
  })
]);

const OPERATIONAL_RISK_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: "OPS_RISK_MANUAL_REVIEW_OVERLOAD",
    order: 1,
    severity: RISK_SEVERITY.HIGH,
    label: "Manual review queue overload",
    relatedGapIds: Object.freeze(["GAP_IDENTIFICATION_CONFIDENCE_ROUTING"]),
    description: "Low-confidence routing without capacity planning may overwhelm review teams."
  }),
  Object.freeze({
    id: "OPS_RISK_GOVERNANCE_BYPASS",
    order: 2,
    severity: RISK_SEVERITY.CRITICAL,
    label: "Governance gate bypass under time pressure",
    relatedGapIds: Object.freeze([
      "GAP_VALIDATION_GOVERNANCE_GATES",
      "GAP_DRAFT_APPROVAL_GATE"
    ]),
    description: "Operational pressure may lead to skipping documented governance checkpoints."
  }),
  Object.freeze({
    id: "OPS_RISK_MONITORING_BLIND_SPOTS",
    order: 3,
    severity: RISK_SEVERITY.MEDIUM,
    label: "Monitoring blind spots during transition",
    relatedGapIds: Object.freeze([
      "GAP_MONITORING_PIPELINE_HEALTH",
      "GAP_MONITORING_ALERTING_THRESHOLDS"
    ]),
    description: "Partial monitoring coverage leaves failures undetected during incremental rollout."
  }),
  Object.freeze({
    id: "OPS_RISK_PUBLISH_BEFORE_REVIEW",
    order: 4,
    severity: RISK_SEVERITY.CRITICAL,
    label: "Publishing before manual review completion",
    relatedGapIds: Object.freeze([
      "GAP_PUBLISH_READINESS_GATE",
      "GAP_PUBLISH_CONTROLLED_ROLLOUT"
    ]),
    description: "Ungated publishing path may release unreviewed recruitment content."
  }),
  Object.freeze({
    id: "OPS_RISK_TIMELINE_INCONSISTENCY",
    order: 5,
    severity: RISK_SEVERITY.MEDIUM,
    label: "Timeline inconsistency across publication channels",
    relatedGapIds: Object.freeze([
      "GAP_TIMELINE_EVENT_AGGREGATION",
      "GAP_TIMELINE_PUBLICATION_SYNC"
    ]),
    description: "Desynchronized timelines create conflicting candidate-facing information."
  })
]);

const DEPLOYMENT_RISK_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: "DEPLOY_RISK_FLAG_MISCONFIGURATION",
    order: 1,
    severity: RISK_SEVERITY.HIGH,
    label: "Feature flag misconfiguration during rollout",
    relatedGapIds: Object.freeze(["GAP_PUBLISH_CONTROLLED_ROLLOUT"]),
    description: "Incorrect flag states may partially activate automation in production."
  }),
  Object.freeze({
    id: "DEPLOY_RISK_SHADOW_DIVERGENCE",
    order: 2,
    severity: RISK_SEVERITY.MEDIUM,
    label: "Shadow observation divergence from production behavior",
    relatedGapIds: Object.freeze(["GAP_UPDATE_INGESTION_BOT_DETECTION"]),
    description: "Shadow-mode results may not reflect actual production ingestion outcomes."
  }),
  Object.freeze({
    id: "DEPLOY_RISK_INCREMENTAL_COUPLING",
    order: 3,
    severity: RISK_SEVERITY.HIGH,
    label: "Incremental coupling ordering errors",
    relatedGapIds: Object.freeze([
      "GAP_UPDATE_INGESTION_NORMALIZATION",
      "GAP_IDENTIFICATION_CONFIDENCE_ROUTING"
    ]),
    description: "Deploying gaps out of dependency order creates inconsistent pipeline states."
  }),
  Object.freeze({
    id: "DEPLOY_RISK_DIAGNOSTICS_OVERHEAD",
    order: 4,
    severity: RISK_SEVERITY.LOW,
    label: "Diagnostics attachment performance overhead",
    relatedGapIds: Object.freeze(["GAP_OBSERVABILITY_DIAGNOSTICS_ATTACHMENT"]),
    description: "Verbose diagnostics may increase pipeline latency under load."
  })
]);

const ROLLBACK_RISK_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: "ROLLBACK_RISK_IDENTITY_STATE",
    order: 1,
    severity: RISK_SEVERITY.CRITICAL,
    label: "Irreversible identity merge state",
    relatedGapIds: Object.freeze(["GAP_GROUPING_IDENTITY_MERGE"]),
    description: "Merged recruitment identities cannot be cleanly separated on rollback."
  }),
  Object.freeze({
    id: "ROLLBACK_RISK_PUBLISHED_CONTENT",
    order: 2,
    severity: RISK_SEVERITY.CRITICAL,
    label: "Published content cannot be retracted cleanly",
    relatedGapIds: Object.freeze([
      "GAP_PUBLISH_CONTROLLED_ROLLOUT",
      "GAP_TIMELINE_PUBLICATION_SYNC"
    ]),
    description: "Rollback of publishing automation does not retract already-published content."
  }),
  Object.freeze({
    id: "ROLLBACK_RISK_PARTIAL_LIFECYCLE",
    order: 3,
    severity: RISK_SEVERITY.HIGH,
    label: "Partial lifecycle state after rollback",
    relatedGapIds: Object.freeze([
      "GAP_LIFECYCLE_TRANSITION_VALIDATION",
      "GAP_TIMELINE_EVENT_AGGREGATION"
    ]),
    description: "Mid-pipeline rollback leaves recruitment entities in ambiguous lifecycle states."
  }),
  Object.freeze({
    id: "ROLLBACK_RISK_DRAFT_ORPHAN",
    order: 4,
    severity: RISK_SEVERITY.MEDIUM,
    label: "Orphaned draft bindings after rollback",
    relatedGapIds: Object.freeze(["GAP_DRAFT_RECRUITMENT_BINDING"]),
    description: "Draft-to-recruitment bindings may become inconsistent after partial rollback."
  })
]);

const MITIGATION_STRATEGY_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: "MITIGATE_SHADOW_FIRST",
    order: 1,
    label: "Shadow-first observation before coupling",
    addressesRiskIds: Object.freeze([
      "TECH_RISK_PIPELINE_REGRESSION",
      "DEPLOY_RISK_SHADOW_DIVERGENCE"
    ]),
    strategy: "Run all new automation in read-only shadow mode before enabling production writes."
  }),
  Object.freeze({
    id: "MITIGATE_FLAG_GATING",
    order: 2,
    label: "Feature flag gating for all runtime coupling",
    addressesRiskIds: Object.freeze([
      "DEPLOY_RISK_FLAG_MISCONFIGURATION",
      "DEPLOY_RISK_INCREMENTAL_COUPLING"
    ]),
    strategy: "Gate each gap closure behind independently togglable feature flags."
  }),
  Object.freeze({
    id: "MITIGATE_MANUAL_REVIEW_QUEUE",
    order: 3,
    label: "Manual review queue for low-confidence matches",
    addressesRiskIds: Object.freeze([
      "TECH_RISK_IDENTITY_COLLISION",
      "OPS_RISK_MANUAL_REVIEW_OVERLOAD"
    ]),
    strategy: "Route sub-threshold confidence results to manual review with capacity alerts."
  }),
  Object.freeze({
    id: "MITIGATE_GOVERNANCE_ENFORCEMENT",
    order: 4,
    label: "Hard governance gate enforcement",
    addressesRiskIds: Object.freeze([
      "OPS_RISK_GOVERNANCE_BYPASS",
      "OPS_RISK_PUBLISH_BEFORE_REVIEW"
    ]),
    strategy: "Block pipeline progression at governance checkpoints until explicit approval."
  }),
  Object.freeze({
    id: "MITIGATE_ROLLBACK_BOUNDARIES",
    order: 5,
    label: "Document rollback boundaries per rollout stage",
    addressesRiskIds: Object.freeze([
      "ROLLBACK_RISK_IDENTITY_STATE",
      "ROLLBACK_RISK_PUBLISHED_CONTENT",
      "ROLLBACK_RISK_PARTIAL_LIFECYCLE"
    ]),
    strategy: "Define reversible vs irreversible operations before each deployment stage."
  }),
  Object.freeze({
    id: "MITIGATE_MONITORING_BASELINE",
    order: 6,
    label: "Monitoring baseline before automation",
    addressesRiskIds: Object.freeze(["OPS_RISK_MONITORING_BLIND_SPOTS"]),
    strategy: "Establish health checkpoints and alerting before enabling automated processing."
  }),
  Object.freeze({
    id: "MITIGATE_CONTRACT_VALIDATION",
    order: 7,
    label: "Runtime contract compliance validation",
    addressesRiskIds: Object.freeze(["TECH_RISK_CONTRACT_DRIFT"]),
    strategy: "Validate implementation outputs against advisory contract schemas at each stage."
  }),
  Object.freeze({
    id: "MITIGATE_TRACE_CORRELATION",
    order: 8,
    label: "End-to-end trace correlation",
    addressesRiskIds: Object.freeze(["TECH_RISK_TRACE_FRAGMENTATION"]),
    strategy: "Propagate correlation identifiers across all pipeline stages for failure diagnosis."
  })
]);

const RECRUITMENT_IMPLEMENTATION_RISK_MATRIX_METADATA = Object.freeze({
  phase: RECRUITMENT_IMPLEMENTATION_RISK_MATRIX_PHASE,
  advisoryOnly: true,
  descriptiveOnly: true,
  readOnly: true,
  implementationRiskMatrixOnly: true,
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

const RECRUITMENT_IMPLEMENTATION_RISK_MATRIX_DESCRIPTOR = Object.freeze({
  entity: RECRUITMENT_IMPLEMENTATION_RISK_MATRIX_ENTITY,
  domain: "recruitment",
  phase: RECRUITMENT_IMPLEMENTATION_RISK_MATRIX_PHASE,
  description:
    "Pure deterministic implementation risk matrix with technical, operational, deployment, and rollback risks.",
  schemaVersion: RISK_MATRIX_SCHEMA_VERSION,
  metadata: RECRUITMENT_IMPLEMENTATION_RISK_MATRIX_METADATA
});

const EXPECTED_RESULT_KEYS = Object.freeze([
  "recruitmentId",
  "technicalRisk",
  "operationalRisk",
  "deploymentRisk",
  "rollbackRisk",
  "mitigationStrategies",
  "overallRiskPosture",
  "overallRiskScore",
  "riskSummary",
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
function isRecognizedRiskMatrixInput(input) {
  if (!isPlainObject(input)) {
    return false;
  }
  if (input.recruitmentId != null && typeof input.recruitmentId !== "string" && typeof input.recruitmentId !== "number") {
    return false;
  }
  if (input.gapCatalog != null && !isPlainObject(input.gapCatalog)) {
    return false;
  }
  return true;
}

/**
 * @param {Readonly<Array>} risks
 * @returns {number}
 */
function calculateCategoryScore(risks) {
  let score = 0;
  for (let i = 0; i < risks.length; i += 1) {
    const weight = SEVERITY_WEIGHT[risks[i].severity];
    if (weight != null) {
      score += weight;
    }
  }
  return score;
}

/**
 * @param {number} score
 * @returns {string}
 */
function resolveOverallRiskPosture(score) {
  if (score <= 0) {
    return OVERALL_RISK_POSTURE.UNKNOWN;
  }
  if (score >= 40) {
    return OVERALL_RISK_POSTURE.CRITICAL;
  }
  if (score >= 28) {
    return OVERALL_RISK_POSTURE.HIGH;
  }
  if (score >= 16) {
    return OVERALL_RISK_POSTURE.ELEVATED;
  }
  return OVERALL_RISK_POSTURE.ACCEPTABLE;
}

/**
 * @param {string} posture
 * @param {number} score
 * @returns {string}
 */
function buildRiskSummary(posture, score) {
  if (posture === OVERALL_RISK_POSTURE.CRITICAL) {
    return "Critical implementation risk posture (score " + score + ") — defer runtime coupling until mitigations are in place.";
  }
  if (posture === OVERALL_RISK_POSTURE.HIGH) {
    return "High implementation risk posture (score " + score + ") — shadow observation and governance gates required before rollout.";
  }
  if (posture === OVERALL_RISK_POSTURE.ELEVATED) {
    return "Elevated implementation risk posture (score " + score + ") — proceed with phased rollout and documented rollback boundaries.";
  }
  if (posture === OVERALL_RISK_POSTURE.ACCEPTABLE) {
    return "Acceptable implementation risk posture (score " + score + ") — standard mitigation strategies sufficient.";
  }
  return "Risk posture unknown.";
}

/**
 * @param {*} input
 * @returns {Readonly<Object>}
 */
function buildRecruitmentImplementationRiskMatrix(input) {
  const hasInput = isRecognizedRiskMatrixInput(input);
  const safeInput = hasInput ? input : {};
  const recruitmentId = resolveRecruitmentId(safeInput.recruitmentId);

  const technicalScore = calculateCategoryScore(TECHNICAL_RISK_DEFINITIONS);
  const operationalScore = calculateCategoryScore(OPERATIONAL_RISK_DEFINITIONS);
  const deploymentScore = calculateCategoryScore(DEPLOYMENT_RISK_DEFINITIONS);
  const rollbackScore = calculateCategoryScore(ROLLBACK_RISK_DEFINITIONS);
  const overallRiskScore = technicalScore + operationalScore + deploymentScore + rollbackScore;
  const overallRiskPosture = resolveOverallRiskPosture(overallRiskScore);

  return deepFreeze({
    recruitmentId,
    technicalRisk: TECHNICAL_RISK_DEFINITIONS,
    operationalRisk: OPERATIONAL_RISK_DEFINITIONS,
    deploymentRisk: DEPLOYMENT_RISK_DEFINITIONS,
    rollbackRisk: ROLLBACK_RISK_DEFINITIONS,
    mitigationStrategies: MITIGATION_STRATEGY_DEFINITIONS,
    overallRiskPosture,
    overallRiskScore,
    riskSummary: buildRiskSummary(overallRiskPosture, overallRiskScore),
    advisoryMetadata: Object.freeze({
      advisoryOnly: true,
      descriptiveOnly: true,
      persistent: false,
      generatedBy: "phase_149",
      phase: RECRUITMENT_IMPLEMENTATION_RISK_MATRIX_PHASE,
      implementationRiskMatrixOnly: true,
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
function isRecruitmentImplementationRiskMatrix(value) {
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
  RECRUITMENT_IMPLEMENTATION_RISK_MATRIX_PHASE,
  RECRUITMENT_IMPLEMENTATION_RISK_MATRIX_ENTITY,
  RISK_MATRIX_SCHEMA_VERSION,
  RISK_SEVERITY,
  RISK_CATEGORY,
  OVERALL_RISK_POSTURE,
  TECHNICAL_RISK_DEFINITIONS,
  OPERATIONAL_RISK_DEFINITIONS,
  DEPLOYMENT_RISK_DEFINITIONS,
  ROLLBACK_RISK_DEFINITIONS,
  MITIGATION_STRATEGY_DEFINITIONS,
  RECRUITMENT_IMPLEMENTATION_RISK_MATRIX_DESCRIPTOR,
  RECRUITMENT_IMPLEMENTATION_RISK_MATRIX_METADATA,
  EXPECTED_RESULT_KEYS,
  buildRecruitmentImplementationRiskMatrix,
  isRecruitmentImplementationRiskMatrix
};
