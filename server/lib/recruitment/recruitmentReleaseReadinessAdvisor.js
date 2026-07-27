"use strict";

/**
 * Phase 142 — Recruitment Release Readiness Advisor (Advisory Only).
 *
 * Pure advisory release readiness report evaluating release confidence,
 * missing prerequisites, recommended validation, and advisory approval status.
 * No database access, no persistence, no runtime imports, no side effects.
 * No automation. Never mutates input. Never persists output.
 *
 * No Express. No database. No filesystem. No network access.
 * No worker. No routing. No publishing. No execution changes.
 * No runtime module imports. No storage assumptions.
 */

const RECRUITMENT_RELEASE_READINESS_ADVISOR_PHASE = 142;

const RECRUITMENT_RELEASE_READINESS_ADVISOR_ENTITY = "recruitment_release_readiness_advisor";

const RELEASE_READINESS_SCHEMA_VERSION = "1.0.0";

const ADVISORY_APPROVAL_STATUS = Object.freeze({
  ADVISORY_APPROVED: "ADVISORY_APPROVED",
  ADVISORY_REVIEW_REQUIRED: "ADVISORY_REVIEW_REQUIRED",
  ADVISORY_BLOCKED: "ADVISORY_BLOCKED",
  UNKNOWN: "UNKNOWN"
});

const RELEASE_READINESS_STATUS = Object.freeze({
  RELEASE_READY: "RELEASE_READY",
  RELEASE_PARTIALLY_READY: "RELEASE_PARTIALLY_READY",
  RELEASE_REVIEW_REQUIRED: "RELEASE_REVIEW_REQUIRED",
  RELEASE_BLOCKED: "RELEASE_BLOCKED",
  UNKNOWN: "UNKNOWN"
});

const RECRUITMENT_RELEASE_READINESS_ADVISOR_METADATA = Object.freeze({
  phase: RECRUITMENT_RELEASE_READINESS_ADVISOR_PHASE,
  advisoryOnly: true,
  descriptiveOnly: true,
  readOnly: true,
  releaseReadinessAdvisorOnly: true,
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
  sourcePhases: Object.freeze([
    114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131,
    132, 133, 134, 135, 136, 137, 138, 139, 140, 141
  ])
});

const RECRUITMENT_RELEASE_READINESS_ADVISOR_DESCRIPTOR = Object.freeze({
  entity: RECRUITMENT_RELEASE_READINESS_ADVISOR_ENTITY,
  domain: "recruitment",
  phase: RECRUITMENT_RELEASE_READINESS_ADVISOR_PHASE,
  description:
    "Pure advisory release readiness report with confidence scoring, prerequisite gaps, validation recommendations, and approval status.",
  schemaVersion: RELEASE_READINESS_SCHEMA_VERSION,
  metadata: RECRUITMENT_RELEASE_READINESS_ADVISOR_METADATA
});

const EXPECTED_RESULT_KEYS = Object.freeze([
  "recruitmentId",
  "releaseReadinessStatus",
  "releaseConfidence",
  "advisoryApprovalStatus",
  "missingPrerequisites",
  "recommendedValidation",
  "readinessSummary",
  "confidence",
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
 * @returns {string|null}
 */
function resolveRecruitmentId(recruitmentId) {
  if (recruitmentId == null) {
    return null;
  }
  return String(recruitmentId);
}

/**
 * @param {*} input
 * @returns {boolean}
 */
function isRecognizedReleaseInput(input) {
  if (!isPlainObject(input)) {
    return false;
  }

  const objectFields = [
    "governanceChecklist",
    "riskAssessment",
    "operationalReadinessAssessment",
    "architectureSummary",
    "adoptionBlueprintSummary",
    "runtimeReadinessGate",
    "integrationRolloutPlan",
    "integrationRolloutPlanner",
    "rolloutPlanner",
    "observabilityPlanning",
    "diagnosticsPlanning",
    "productionAdoptionPlaybook"
  ];

  for (let i = 0; i < objectFields.length; i += 1) {
    const field = objectFields[i];
    const value = input[field];
    if (value == null) {
      continue;
    }
    if (!isPlainObject(value)) {
      return false;
    }
  }

  if (input.recruitmentId != null) {
    if (typeof input.recruitmentId !== "string" && typeof input.recruitmentId !== "number") {
      return false;
    }
  }

  return true;
}

/**
 * @param {Readonly<Object>} input
 * @returns {boolean}
 */
function hasMeaningfulReleaseSignals(input) {
  const signalFields = [
    "governanceChecklist",
    "riskAssessment",
    "operationalReadinessAssessment",
    "architectureSummary",
    "adoptionBlueprintSummary",
    "runtimeReadinessGate",
    "integrationRolloutPlan",
    "integrationRolloutPlanner",
    "rolloutPlanner",
    "observabilityPlanning",
    "diagnosticsPlanning",
    "productionAdoptionPlaybook",
    "recruitmentId"
  ];

  for (let i = 0; i < signalFields.length; i += 1) {
    if (input[signalFields[i]] != null) {
      return true;
    }
  }

  return false;
}

/**
 * @param {Readonly<Object>} input
 * @returns {Readonly<Array>}
 */
function collectMissingPrerequisites(input) {
  const prerequisites = [];
  const governance = isPlainObject(input.governanceChecklist) ? input.governanceChecklist : null;
  const risk = isPlainObject(input.riskAssessment) ? input.riskAssessment : null;
  const operational = isPlainObject(input.operationalReadinessAssessment)
    ? input.operationalReadinessAssessment
    : null;

  if (governance != null && Array.isArray(governance.knownGaps)) {
    for (let i = 0; i < governance.knownGaps.length; i += 1) {
      const gap = governance.knownGaps[i];
      if (!prerequisites.includes(gap)) {
        prerequisites.push(gap);
      }
    }
  }

  if (operational != null && Array.isArray(operational.knownGaps)) {
    for (let i = 0; i < operational.knownGaps.length; i += 1) {
      const gap = operational.knownGaps[i];
      if (!prerequisites.includes(gap)) {
        prerequisites.push(gap);
      }
    }
  }

  if (governance == null && input.architectureSummary == null) {
    prerequisites.push("architecture_advisory_metadata_missing");
  }
  if (governance == null && input.adoptionBlueprintSummary == null) {
    prerequisites.push("deployment_advisory_metadata_missing");
  }
  if (governance == null && input.observabilityPlanning == null) {
    prerequisites.push("observability_advisory_metadata_missing");
  }
  if (governance == null && input.diagnosticsPlanning == null) {
    prerequisites.push("diagnostics_advisory_metadata_missing");
  }
  if (
    governance == null &&
    input.integrationRolloutPlan == null &&
    input.integrationRolloutPlanner == null &&
    input.rolloutPlanner == null
  ) {
    prerequisites.push("rollout_advisory_metadata_missing");
  }
  if (governance == null && input.productionAdoptionPlaybook == null) {
    prerequisites.push("documentation_advisory_metadata_missing");
  }
  if (operational == null && governance == null) {
    prerequisites.push("operational_readiness_assessment_missing");
  }
  if (risk == null && governance == null) {
    prerequisites.push("risk_assessment_missing");
  }

  if (risk != null && risk.overallRiskPosture === "CRITICAL") {
    if (!prerequisites.includes("critical_risk_mitigation_required")) {
      prerequisites.push("critical_risk_mitigation_required");
    }
  }

  const gate = isPlainObject(input.runtimeReadinessGate) ? input.runtimeReadinessGate : null;
  if (gate?.gateStatus === "GATE_CLOSED") {
    if (!prerequisites.includes("runtime_readiness_gate_closed")) {
      prerequisites.push("runtime_readiness_gate_closed");
    }
  }

  return Object.freeze(prerequisites);
}

/**
 * @param {Readonly<Array>} missingPrerequisites
 * @param {Readonly<Object>} input
 * @returns {Readonly<Array>}
 */
function buildRecommendedValidation(missingPrerequisites, input) {
  const validations = [];
  const risk = isPlainObject(input.riskAssessment) ? input.riskAssessment : null;

  if (missingPrerequisites.includes("architecture_advisory_metadata_missing")) {
    validations.push("Validate architecture blueprint advisory completeness");
  }
  if (missingPrerequisites.includes("deployment_advisory_metadata_missing")) {
    validations.push("Validate runtime adoption blueprint advisory coverage");
  }
  if (missingPrerequisites.includes("observability_advisory_metadata_missing")) {
    validations.push("Validate observability planning advisory definitions");
  }
  if (missingPrerequisites.includes("diagnostics_advisory_metadata_missing")) {
    validations.push("Validate diagnostics planning and attachment advisory coverage");
  }
  if (missingPrerequisites.includes("rollout_advisory_metadata_missing")) {
    validations.push("Validate integration rollout planner advisory stages");
  }
  if (missingPrerequisites.includes("documentation_advisory_metadata_missing")) {
    validations.push("Validate production adoption playbook advisory documentation");
  }
  if (missingPrerequisites.includes("operational_readiness_assessment_missing")) {
    validations.push("Complete operational readiness assessment advisory review");
  }
  if (missingPrerequisites.includes("risk_assessment_missing")) {
    validations.push("Complete advisory risk assessment review");
  }
  if (missingPrerequisites.includes("runtime_readiness_gate_closed")) {
    validations.push("Re-evaluate runtime readiness gate advisory checkpoints");
  }
  if (missingPrerequisites.includes("critical_risk_mitigation_required")) {
    validations.push("Address critical advisory risk mitigation items");
  }

  if (risk != null && Array.isArray(risk.mitigationRecommendations)) {
    for (let i = 0; i < risk.mitigationRecommendations.length; i += 1) {
      const rec = `Validate: ${risk.mitigationRecommendations[i]}`;
      if (!validations.includes(rec)) {
        validations.push(rec);
      }
    }
  }

  if (validations.length === 0) {
    validations.push("Proceed with advisory release readiness validation review");
  }

  return Object.freeze(validations);
}

/**
 * @param {Readonly<Object>} input
 * @param {Readonly<Array>} missingPrerequisites
 * @returns {number}
 */
function calculateReleaseConfidence(input, missingPrerequisites) {
  const governance = isPlainObject(input.governanceChecklist) ? input.governanceChecklist : null;
  const risk = isPlainObject(input.riskAssessment) ? input.riskAssessment : null;
  const operational = isPlainObject(input.operationalReadinessAssessment)
    ? input.operationalReadinessAssessment
    : null;

  const signals = [governance, risk, operational].filter(Boolean);

  if (signals.length === 0 && missingPrerequisites.length > 0) {
    return 0;
  }

  let totalConfidence = 0;
  let count = 0;

  if (governance != null && typeof governance.confidence === "number") {
    totalConfidence += governance.confidence;
    count += 1;
  }
  if (risk != null && typeof risk.confidence === "number") {
    totalConfidence += risk.confidence;
    count += 1;
  }
  if (operational != null && typeof operational.confidence === "number") {
    totalConfidence += operational.confidence;
    count += 1;
  }

  if (count === 0) {
    const rawSignals = [
      input.architectureSummary,
      input.adoptionBlueprintSummary,
      input.observabilityPlanning,
      input.diagnosticsPlanning,
      input.integrationRolloutPlan,
      input.integrationRolloutPlanner,
      input.rolloutPlanner,
      input.productionAdoptionPlaybook
    ].filter(Boolean);

    if (rawSignals.length === 0) {
      return 0;
    }

    return Math.round((rawSignals.length / 8) * 50);
  }

  const baseConfidence = Math.round(totalConfidence / count);
  const gapPenalty = Math.min(missingPrerequisites.length * 5, 40);

  return Math.max(0, baseConfidence - gapPenalty);
}

/**
 * @param {number} releaseConfidence
 * @param {Readonly<Array>} missingPrerequisites
 * @param {Readonly<Object>} input
 * @returns {string}
 */
function resolveAdvisoryApprovalStatus(releaseConfidence, missingPrerequisites, input) {
  const governance = isPlainObject(input.governanceChecklist) ? input.governanceChecklist : null;
  const risk = isPlainObject(input.riskAssessment) ? input.riskAssessment : null;
  const operational = isPlainObject(input.operationalReadinessAssessment)
    ? input.operationalReadinessAssessment
    : null;

  const hasAnySignal =
    governance != null ||
    risk != null ||
    operational != null ||
    input.architectureSummary != null ||
    input.adoptionBlueprintSummary != null;

  if (!hasAnySignal) {
    return ADVISORY_APPROVAL_STATUS.UNKNOWN;
  }

  if (
    governance?.governancePosture === "GOVERNANCE_BLOCKED" ||
    risk?.overallRiskPosture === "CRITICAL" ||
    operational?.status === "OPERATIONAL_BLOCKED" ||
    missingPrerequisites.includes("critical_risk_mitigation_required") ||
    missingPrerequisites.includes("runtime_readiness_gate_closed")
  ) {
    return ADVISORY_APPROVAL_STATUS.ADVISORY_BLOCKED;
  }

  if (
    releaseConfidence >= 80 &&
    missingPrerequisites.length === 0 &&
    governance?.governancePosture === "GOVERNANCE_READY" &&
    risk?.overallRiskPosture === "ACCEPTABLE" &&
    operational?.status === "OPERATIONAL_READY"
  ) {
    return ADVISORY_APPROVAL_STATUS.ADVISORY_APPROVED;
  }

  return ADVISORY_APPROVAL_STATUS.ADVISORY_REVIEW_REQUIRED;
}

/**
 * @param {string} approvalStatus
 * @param {number} releaseConfidence
 * @returns {string}
 */
function resolveReleaseReadinessStatus(approvalStatus, releaseConfidence) {
  if (approvalStatus === ADVISORY_APPROVAL_STATUS.UNKNOWN) {
    return RELEASE_READINESS_STATUS.UNKNOWN;
  }
  if (approvalStatus === ADVISORY_APPROVAL_STATUS.ADVISORY_BLOCKED) {
    return RELEASE_READINESS_STATUS.RELEASE_BLOCKED;
  }
  if (approvalStatus === ADVISORY_APPROVAL_STATUS.ADVISORY_APPROVED) {
    return RELEASE_READINESS_STATUS.RELEASE_READY;
  }
  if (releaseConfidence >= 50) {
    return RELEASE_READINESS_STATUS.RELEASE_PARTIALLY_READY;
  }
  return RELEASE_READINESS_STATUS.RELEASE_REVIEW_REQUIRED;
}

/**
 * @param {string} status
 * @param {number} confidence
 * @param {number} prerequisiteCount
 * @returns {string}
 */
function buildReadinessSummaryText(status, confidence, prerequisiteCount) {
  if (status === RELEASE_READINESS_STATUS.UNKNOWN) {
    return "Release readiness could not be determined from supplied advisory metadata";
  }

  if (status === RELEASE_READINESS_STATUS.RELEASE_READY) {
    return `Release readiness satisfied with ${confidence}% advisory confidence`;
  }

  if (status === RELEASE_READINESS_STATUS.RELEASE_BLOCKED) {
    return "Release readiness blocked by advisory signals";
  }

  if (status === RELEASE_READINESS_STATUS.RELEASE_PARTIALLY_READY) {
    return `Release readiness partially satisfied with ${confidence}% confidence and ${prerequisiteCount} prerequisite gaps`;
  }

  return `Release readiness requires advisory review with ${confidence}% confidence and ${prerequisiteCount} prerequisite gaps`;
}

/**
 * @param {Readonly<Object>} params
 * @returns {Readonly<Object>}
 */
function buildReleaseReadinessResult(params) {
  return deepFreeze({
    recruitmentId: params.recruitmentId,
    releaseReadinessStatus: params.releaseReadinessStatus,
    releaseConfidence: params.releaseConfidence,
    advisoryApprovalStatus: params.advisoryApprovalStatus,
    missingPrerequisites: params.missingPrerequisites,
    recommendedValidation: params.recommendedValidation,
    readinessSummary: params.readinessSummary,
    confidence: params.confidence,
    advisoryMetadata: deepFreeze({
      advisoryOnly: true,
      descriptiveOnly: true,
      persistent: false,
      generatedBy: "phase_142",
      phase: RECRUITMENT_RELEASE_READINESS_ADVISOR_PHASE,
      releaseReadinessAdvisorOnly: true,
      executed: false,
      persistenceEnabled: false,
      sideEffects: false,
      mutatesInput: false,
      runtimeWiringEnabled: false,
      flagExecutionEnabled: false,
      rolloutActivationEnabled: false
    })
  });
}

/**
 * Build advisory release readiness report from supplied metadata.
 * Never throws. Never mutates input. Never persists output.
 *
 * @param {Object|null|undefined} input
 * @returns {Readonly<Object>}
 */
function buildRecruitmentReleaseReadinessReport(input) {
  try {
    if (!isRecognizedReleaseInput(input) || !hasMeaningfulReleaseSignals(input)) {
      const missingPrerequisites = collectMissingPrerequisites({});

      return buildReleaseReadinessResult({
        recruitmentId: null,
        releaseReadinessStatus: RELEASE_READINESS_STATUS.UNKNOWN,
        releaseConfidence: 0,
        advisoryApprovalStatus: ADVISORY_APPROVAL_STATUS.UNKNOWN,
        missingPrerequisites,
        recommendedValidation: buildRecommendedValidation(missingPrerequisites, {}),
        readinessSummary: buildReadinessSummaryText(RELEASE_READINESS_STATUS.UNKNOWN, 0, missingPrerequisites.length),
        confidence: 0
      });
    }

    const recruitmentId = resolveRecruitmentId(input.recruitmentId);
    const missingPrerequisites = collectMissingPrerequisites(input);
    const releaseConfidence = calculateReleaseConfidence(input, missingPrerequisites);
    const advisoryApprovalStatus = resolveAdvisoryApprovalStatus(
      releaseConfidence,
      missingPrerequisites,
      input
    );
    const releaseReadinessStatus = resolveReleaseReadinessStatus(
      advisoryApprovalStatus,
      releaseConfidence
    );
    const recommendedValidation = buildRecommendedValidation(missingPrerequisites, input);
    const readinessSummary = buildReadinessSummaryText(
      releaseReadinessStatus,
      releaseConfidence,
      missingPrerequisites.length
    );

    return buildReleaseReadinessResult({
      recruitmentId,
      releaseReadinessStatus,
      releaseConfidence,
      advisoryApprovalStatus,
      missingPrerequisites,
      recommendedValidation,
      readinessSummary,
      confidence: releaseConfidence
    });
  } catch {
    const missingPrerequisites = collectMissingPrerequisites({});

    return buildReleaseReadinessResult({
      recruitmentId: null,
      releaseReadinessStatus: RELEASE_READINESS_STATUS.UNKNOWN,
      releaseConfidence: 0,
      advisoryApprovalStatus: ADVISORY_APPROVAL_STATUS.UNKNOWN,
      missingPrerequisites,
      recommendedValidation: buildRecommendedValidation(missingPrerequisites, {}),
      readinessSummary: buildReadinessSummaryText(RELEASE_READINESS_STATUS.UNKNOWN, 0, missingPrerequisites.length),
      confidence: 0
    });
  }
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function isRecruitmentReleaseReadinessReport(value) {
  if (!isPlainObject(value)) {
    return false;
  }

  for (let i = 0; i < EXPECTED_RESULT_KEYS.length; i += 1) {
    if (!(EXPECTED_RESULT_KEYS[i] in value)) {
      return false;
    }
  }

  if (!Object.values(ADVISORY_APPROVAL_STATUS).includes(value.advisoryApprovalStatus)) {
    return false;
  }

  if (
    typeof value.releaseConfidence !== "number" ||
    typeof value.confidence !== "number" ||
    !Array.isArray(value.missingPrerequisites)
  ) {
    return false;
  }

  if (!isPlainObject(value.advisoryMetadata)) {
    return false;
  }

  return (
    value.advisoryMetadata.advisoryOnly === true &&
    value.advisoryMetadata.releaseReadinessAdvisorOnly === true &&
    value.advisoryMetadata.executed === false
  );
}

module.exports = {
  RECRUITMENT_RELEASE_READINESS_ADVISOR_PHASE,
  RECRUITMENT_RELEASE_READINESS_ADVISOR_ENTITY,
  RELEASE_READINESS_SCHEMA_VERSION,
  ADVISORY_APPROVAL_STATUS,
  RELEASE_READINESS_STATUS,
  RECRUITMENT_RELEASE_READINESS_ADVISOR_DESCRIPTOR,
  RECRUITMENT_RELEASE_READINESS_ADVISOR_METADATA,
  EXPECTED_RESULT_KEYS,
  buildRecruitmentReleaseReadinessReport,
  isRecruitmentReleaseReadinessReport
};
