"use strict";

/**
 * Phase 142 — Recruitment Operational Summary Builder (Advisory Only).
 *
 * Pure advisory builder that consolidates governance checklist, risk assessment,
 * release readiness, and operational readiness outputs into one operational summary.
 * No database access, no persistence, no runtime imports, no side effects.
 * No automation. Never mutates input. Never persists output.
 *
 * No Express. No database. No filesystem. No network access.
 * No worker. No routing. No publishing. No execution changes.
 * No runtime module imports. No storage assumptions.
 */

const RECRUITMENT_OPERATIONAL_SUMMARY_BUILDER_PHASE = 142;

const RECRUITMENT_OPERATIONAL_SUMMARY_BUILDER_ENTITY = "recruitment_operational_summary_builder";

const SUMMARY_SCHEMA_VERSION = "1.0.0";

const SUMMARY_SECTION_IDS = Object.freeze({
  READINESS: "readiness",
  GOVERNANCE: "governance",
  RISKS: "risks",
  ROLLOUT: "rollout",
  OBSERVABILITY: "observability",
  DIAGNOSTICS: "diagnostics",
  RECOMMENDATIONS: "recommendations",
  NEXT_STEPS: "nextSteps",
  CONFIDENCE: "confidence"
});

const SUMMARY_SECTION_ORDER = Object.freeze([
  SUMMARY_SECTION_IDS.READINESS,
  SUMMARY_SECTION_IDS.GOVERNANCE,
  SUMMARY_SECTION_IDS.RISKS,
  SUMMARY_SECTION_IDS.ROLLOUT,
  SUMMARY_SECTION_IDS.OBSERVABILITY,
  SUMMARY_SECTION_IDS.DIAGNOSTICS,
  SUMMARY_SECTION_IDS.RECOMMENDATIONS,
  SUMMARY_SECTION_IDS.NEXT_STEPS,
  SUMMARY_SECTION_IDS.CONFIDENCE
]);

const RECRUITMENT_OPERATIONAL_SUMMARY_BUILDER_METADATA = Object.freeze({
  phase: RECRUITMENT_OPERATIONAL_SUMMARY_BUILDER_PHASE,
  advisoryOnly: true,
  descriptiveOnly: true,
  readOnly: true,
  operationalSummaryBuilderOnly: true,
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

const RECRUITMENT_OPERATIONAL_SUMMARY_BUILDER_DESCRIPTOR = Object.freeze({
  entity: RECRUITMENT_OPERATIONAL_SUMMARY_BUILDER_ENTITY,
  domain: "recruitment",
  phase: RECRUITMENT_OPERATIONAL_SUMMARY_BUILDER_PHASE,
  description:
    "Pure advisory operational summary consolidating readiness, governance, risks, rollout, observability, diagnostics, recommendations, next steps, and confidence.",
  schemaVersion: SUMMARY_SCHEMA_VERSION,
  metadata: RECRUITMENT_OPERATIONAL_SUMMARY_BUILDER_METADATA
});

const EXPECTED_RESULT_KEYS = Object.freeze([
  "recruitmentId",
  "summarySections",
  "readiness",
  "governance",
  "risks",
  "rollout",
  "observability",
  "diagnostics",
  "recommendations",
  "nextSteps",
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
function isRecognizedSummaryInput(input) {
  if (!isPlainObject(input)) {
    return false;
  }

  const objectFields = [
    "governanceChecklist",
    "riskAssessment",
    "releaseReadiness",
    "operationalReadinessAssessment",
    "integrationRolloutPlan",
    "integrationRolloutPlanner",
    "rolloutPlanner",
    "observabilityPlanning",
    "observationRolloutReadiness",
    "observationHealth",
    "diagnosticsPlanning",
    "diagnosticsAttachment"
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
function hasMeaningfulSummarySignals(input) {
  const signalFields = [
    "governanceChecklist",
    "riskAssessment",
    "releaseReadiness",
    "operationalReadinessAssessment",
    "integrationRolloutPlan",
    "integrationRolloutPlanner",
    "rolloutPlanner",
    "observabilityPlanning",
    "observationRolloutReadiness",
    "observationHealth",
    "diagnosticsPlanning",
    "diagnosticsAttachment",
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
 * @returns {Readonly<Object>|null}
 */
function resolveRolloutPlannerInput(input) {
  if (isPlainObject(input.integrationRolloutPlan)) {
    return input.integrationRolloutPlan;
  }
  if (isPlainObject(input.integrationRolloutPlanner)) {
    return input.integrationRolloutPlanner;
  }
  if (isPlainObject(input.rolloutPlanner)) {
    return input.rolloutPlanner;
  }
  return null;
}

/**
 * @param {Readonly<Object>} input
 * @returns {Readonly<Object>}
 */
function buildReadinessSection(input) {
  const operational = isPlainObject(input.operationalReadinessAssessment)
    ? input.operationalReadinessAssessment
    : null;
  const release = isPlainObject(input.releaseReadiness) ? input.releaseReadiness : null;

  if (operational == null && release == null) {
    return deepFreeze({
      sectionId: SUMMARY_SECTION_IDS.READINESS,
      status: "UNKNOWN",
      confidence: 0,
      summary: "Readiness could not be determined from supplied advisory outputs",
      operationalStatus: null,
      releaseReadinessStatus: null,
      approvalStatus: null
    });
  }

  const operationalStatus = operational?.status ?? "UNKNOWN";
  const releaseStatus = release?.releaseReadinessStatus ?? "UNKNOWN";
  const approvalStatus = release?.advisoryApprovalStatus ?? "UNKNOWN";
  const confidence =
    typeof release?.releaseConfidence === "number"
      ? release.releaseConfidence
      : typeof operational?.confidence === "number"
        ? operational.confidence
        : 0;

  let status = "REVIEW_REQUIRED";
  if (operationalStatus === "OPERATIONAL_READY" && releaseStatus === "RELEASE_READY") {
    status = "READY";
  } else if (operationalStatus === "OPERATIONAL_BLOCKED" || releaseStatus === "RELEASE_BLOCKED") {
    status = "BLOCKED";
  } else if (operationalStatus === "OPERATIONAL_PARTIALLY_READY" || releaseStatus === "RELEASE_PARTIALLY_READY") {
    status = "PARTIALLY_READY";
  }

  return deepFreeze({
    sectionId: SUMMARY_SECTION_IDS.READINESS,
    status,
    confidence,
    summary:
      status === "READY"
        ? "Operational and release readiness satisfied for advisory review"
        : status === "BLOCKED"
          ? "Readiness blocked by advisory signals"
          : "Readiness requires advisory review",
    operationalStatus,
    releaseReadinessStatus: releaseStatus,
    approvalStatus
  });
}

/**
 * @param {Readonly<Object>} input
 * @returns {Readonly<Object>}
 */
function buildGovernanceSection(input) {
  const governance = isPlainObject(input.governanceChecklist) ? input.governanceChecklist : null;

  if (governance == null) {
    return deepFreeze({
      sectionId: SUMMARY_SECTION_IDS.GOVERNANCE,
      posture: "UNKNOWN",
      overallScore: 0,
      reviewSectionCount: 0,
      satisfiedSectionCount: 0,
      knownGapCount: 0,
      summary: "Governance could not be determined from supplied advisory outputs"
    });
  }

  const reviewSections = Array.isArray(governance.reviewSections) ? governance.reviewSections : [];
  const satisfiedCount = reviewSections.filter((section) => section?.status === "SATISFIED").length;
  const knownGapCount = Array.isArray(governance.knownGaps) ? governance.knownGaps.length : 0;

  return deepFreeze({
    sectionId: SUMMARY_SECTION_IDS.GOVERNANCE,
    posture: governance.governancePosture ?? "UNKNOWN",
    overallScore: governance.overallScore ?? 0,
    reviewSectionCount: reviewSections.length,
    satisfiedSectionCount: satisfiedCount,
    knownGapCount,
    summary:
      governance.governancePosture === "GOVERNANCE_READY"
        ? "Governance checklist satisfied across advisory review sections"
        : governance.governancePosture === "GOVERNANCE_BLOCKED"
          ? "Governance blocked by advisory review signals"
          : "Governance requires advisory review"
  });
}

/**
 * @param {Readonly<Object>} input
 * @returns {Readonly<Object>}
 */
function buildRisksSection(input) {
  const risk = isPlainObject(input.riskAssessment) ? input.riskAssessment : null;

  if (risk == null) {
    return deepFreeze({
      sectionId: SUMMARY_SECTION_IDS.RISKS,
      overallRiskPosture: "UNKNOWN",
      overallRiskLevel: "UNKNOWN",
      riskScore: 0,
      technicalRiskCount: 0,
      operationalRiskCount: 0,
      rolloutRiskCount: 0,
      monitoringRiskCount: 0,
      summary: "Risk profile could not be determined from supplied advisory outputs"
    });
  }

  return deepFreeze({
    sectionId: SUMMARY_SECTION_IDS.RISKS,
    overallRiskPosture: risk.overallRiskPosture ?? "UNKNOWN",
    overallRiskLevel: risk.overallRiskLevel ?? "UNKNOWN",
    riskScore: risk.riskScore ?? 0,
    technicalRiskCount: Array.isArray(risk.technicalRisks) ? risk.technicalRisks.length : 0,
    operationalRiskCount: Array.isArray(risk.operationalRisks) ? risk.operationalRisks.length : 0,
    rolloutRiskCount: Array.isArray(risk.rolloutRisks) ? risk.rolloutRisks.length : 0,
    monitoringRiskCount: Array.isArray(risk.monitoringRisks) ? risk.monitoringRisks.length : 0,
    summary: risk.riskSummary ?? "Advisory risk assessment summary unavailable"
  });
}

/**
 * @param {Readonly<Object>} input
 * @returns {Readonly<Object>}
 */
function buildRolloutSection(input) {
  const rolloutPlan = resolveRolloutPlannerInput(input);
  const governance = isPlainObject(input.governanceChecklist) ? input.governanceChecklist : null;
  const rolloutReview = governance?.rolloutReview ?? null;

  if (rolloutPlan == null && rolloutReview == null) {
    return deepFreeze({
      sectionId: SUMMARY_SECTION_IDS.ROLLOUT,
      status: "UNKNOWN",
      totalStageCount: 0,
      readyStageCount: 0,
      blockedStageCount: 0,
      summary: "Rollout could not be determined from supplied advisory outputs"
    });
  }

  const stages = Array.isArray(rolloutPlan?.rolloutStages) ? rolloutPlan.rolloutStages : [];
  const readyCount = stages.filter((stage) => stage?.status === "READY").length;
  const blockedCount = stages.filter((stage) => stage?.status === "BLOCKED").length;

  let status = "REVIEW_REQUIRED";
  if (rolloutReview?.status === "SATISFIED" || (stages.length > 0 && readyCount === stages.length)) {
    status = "READY";
  } else if (rolloutReview?.status === "UNSATISFIED" || blockedCount > 0) {
    status = "BLOCKED";
  } else if (rolloutReview?.status === "REVIEW_REQUIRED" || readyCount > 0) {
    status = "PARTIALLY_READY";
  }

  return deepFreeze({
    sectionId: SUMMARY_SECTION_IDS.ROLLOUT,
    status,
    totalStageCount: stages.length,
    readyStageCount: readyCount,
    blockedStageCount: blockedCount,
    summary:
      status === "READY"
        ? "Rollout advisory stages satisfied for governance review"
        : status === "BLOCKED"
          ? "Rollout blocked by advisory stage signals"
          : "Rollout requires advisory review"
  });
}

/**
 * @param {Readonly<Object>} input
 * @returns {Readonly<Object>}
 */
function buildObservabilitySection(input) {
  const planning = isPlainObject(input.observabilityPlanning) ? input.observabilityPlanning : null;
  const rolloutReadiness = isPlainObject(input.observationRolloutReadiness)
    ? input.observationRolloutReadiness
    : null;
  const health = isPlainObject(input.observationHealth) ? input.observationHealth : null;
  const governance = isPlainObject(input.governanceChecklist) ? input.governanceChecklist : null;
  const observabilityReview = governance?.observabilityReview ?? null;

  if (planning == null && rolloutReadiness == null && health == null && observabilityReview == null) {
    return deepFreeze({
      sectionId: SUMMARY_SECTION_IDS.OBSERVABILITY,
      status: "UNKNOWN",
      observabilityPosture: null,
      contractStatus: null,
      healthStatus: null,
      summary: "Observability could not be determined from supplied advisory outputs"
    });
  }

  const observabilityPosture =
    typeof planning?.observabilityPosture === "string" ? planning.observabilityPosture : null;
  const contractStatus =
    typeof planning?.contractStatus === "string" ? planning.contractStatus : null;
  const healthStatus =
    typeof health?.status === "string"
      ? health.status
      : typeof rolloutReadiness?.healthStatus === "string"
        ? rolloutReadiness.healthStatus
        : null;

  let status = "REVIEW_REQUIRED";
  if (
    observabilityReview?.status === "SATISFIED" ||
    observabilityPosture === "OBSERVABILITY_DEFINED"
  ) {
    status = "READY";
  } else if (
    observabilityReview?.status === "UNSATISFIED" ||
    observabilityPosture === "OBSERVABILITY_BLOCKED"
  ) {
    status = "BLOCKED";
  } else if (
    observabilityReview?.status === "REVIEW_REQUIRED" ||
    observabilityPosture === "OBSERVABILITY_PARTIAL"
  ) {
    status = "PARTIALLY_READY";
  }

  return deepFreeze({
    sectionId: SUMMARY_SECTION_IDS.OBSERVABILITY,
    status,
    observabilityPosture,
    contractStatus,
    healthStatus,
    summary:
      status === "READY"
        ? "Observability advisory planning satisfied for governance review"
        : status === "BLOCKED"
          ? "Observability blocked by advisory signals"
          : "Observability requires advisory review"
  });
}

/**
 * @param {Readonly<Object>} input
 * @returns {Readonly<Object>}
 */
function buildDiagnosticsSection(input) {
  const planning = isPlainObject(input.diagnosticsPlanning) ? input.diagnosticsPlanning : null;
  const attachment = isPlainObject(input.diagnosticsAttachment) ? input.diagnosticsAttachment : null;
  const governance = isPlainObject(input.governanceChecklist) ? input.governanceChecklist : null;
  const diagnosticsReview = governance?.diagnosticsReview ?? null;

  if (planning == null && attachment == null && diagnosticsReview == null) {
    return deepFreeze({
      sectionId: SUMMARY_SECTION_IDS.DIAGNOSTICS,
      status: "UNKNOWN",
      diagnosticsPosture: null,
      attachmentReady: false,
      coverageRatio: null,
      summary: "Diagnostics could not be determined from supplied advisory outputs"
    });
  }

  const diagnosticsPosture =
    typeof planning?.diagnosticsPosture === "string" ? planning.diagnosticsPosture : null;
  const attachmentReady =
    attachment?.attachmentReady === true || planning?.attachmentReady === true;
  const coverageRatio =
    typeof planning?.coverageRatio === "number"
      ? planning.coverageRatio
      : typeof attachment?.coverageRatio === "number"
        ? attachment.coverageRatio
        : null;

  let status = "REVIEW_REQUIRED";
  if (diagnosticsReview?.status === "SATISFIED" || diagnosticsPosture === "DIAGNOSTICS_DEFINED") {
    status = attachmentReady ? "READY" : "PARTIALLY_READY";
  } else if (
    diagnosticsReview?.status === "UNSATISFIED" ||
    diagnosticsPosture === "DIAGNOSTICS_BLOCKED"
  ) {
    status = "BLOCKED";
  } else if (
    diagnosticsReview?.status === "REVIEW_REQUIRED" ||
    diagnosticsPosture === "DIAGNOSTICS_PARTIAL"
  ) {
    status = "PARTIALLY_READY";
  }

  return deepFreeze({
    sectionId: SUMMARY_SECTION_IDS.DIAGNOSTICS,
    status,
    diagnosticsPosture,
    attachmentReady,
    coverageRatio,
    summary:
      status === "READY"
        ? "Diagnostics advisory planning satisfied for governance review"
        : status === "BLOCKED"
          ? "Diagnostics blocked by advisory signals"
          : "Diagnostics requires advisory review"
  });
}

/**
 * @param {Readonly<Object>} input
 * @returns {Readonly<Array>}
 */
function buildRecommendationsSection(input) {
  const recommendations = [];
  const risk = isPlainObject(input.riskAssessment) ? input.riskAssessment : null;
  const release = isPlainObject(input.releaseReadiness) ? input.releaseReadiness : null;
  const operational = isPlainObject(input.operationalReadinessAssessment)
    ? input.operationalReadinessAssessment
    : null;

  if (risk != null && Array.isArray(risk.mitigationRecommendations)) {
    for (let i = 0; i < risk.mitigationRecommendations.length; i += 1) {
      const rec = risk.mitigationRecommendations[i];
      if (!recommendations.includes(rec)) {
        recommendations.push(rec);
      }
    }
  }

  if (release != null && Array.isArray(release.recommendedValidation)) {
    for (let i = 0; i < release.recommendedValidation.length; i += 1) {
      const rec = release.recommendedValidation[i];
      if (!recommendations.includes(rec)) {
        recommendations.push(rec);
      }
    }
  }

  if (operational != null && Array.isArray(operational.recommendedNextActivities)) {
    for (let i = 0; i < operational.recommendedNextActivities.length; i += 1) {
      const rec = operational.recommendedNextActivities[i];
      if (!recommendations.includes(rec)) {
        recommendations.push(rec);
      }
    }
  }

  if (recommendations.length === 0) {
    recommendations.push("Supply advisory outputs for consolidated operational summary");
  }

  return Object.freeze(recommendations);
}

/**
 * @param {Readonly<Object>} input
 * @param {Readonly<Array>} recommendations
 * @returns {Readonly<Array>}
 */
function buildNextStepsSection(input, recommendations) {
  const nextSteps = [];
  const release = isPlainObject(input.releaseReadiness) ? input.releaseReadiness : null;
  const governance = isPlainObject(input.governanceChecklist) ? input.governanceChecklist : null;

  if (release?.advisoryApprovalStatus === "ADVISORY_APPROVED") {
    nextSteps.push("Proceed with advisory release readiness sign-off review");
  } else if (release?.advisoryApprovalStatus === "ADVISORY_BLOCKED") {
    nextSteps.push("Resolve blocked advisory prerequisites before release review");
  } else if (release?.advisoryApprovalStatus === "ADVISORY_REVIEW_REQUIRED") {
    nextSteps.push("Complete advisory release readiness review");
  }

  if (governance?.governancePosture === "GOVERNANCE_READY") {
    nextSteps.push("Finalize governance checklist advisory review");
  } else if (governance?.governancePosture === "GOVERNANCE_BLOCKED") {
    nextSteps.push("Address governance checklist advisory blockers");
  } else if (governance?.governancePosture === "GOVERNANCE_REVIEW_REQUIRED") {
    nextSteps.push("Complete governance checklist advisory review sections");
  }

  if (nextSteps.length === 0 && recommendations.length > 0) {
    nextSteps.push(recommendations[0]);
  }

  if (nextSteps.length === 0) {
    nextSteps.push("Supply advisory metadata for operational summary next steps");
  }

  return Object.freeze(nextSteps);
}

/**
 * @param {Readonly<Object>} sections
 * @param {Readonly<Object>} input
 * @returns {Readonly<Object>}
 */
function buildConfidenceSection(sections, input) {
  const governance = isPlainObject(input.governanceChecklist) ? input.governanceChecklist : null;
  const risk = isPlainObject(input.riskAssessment) ? input.riskAssessment : null;
  const release = isPlainObject(input.releaseReadiness) ? input.releaseReadiness : null;
  const operational = isPlainObject(input.operationalReadinessAssessment)
    ? input.operationalReadinessAssessment
    : null;

  const confidenceValues = [
    governance?.confidence,
    risk?.confidence,
    release?.confidence,
    operational?.confidence
  ].filter((value) => typeof value === "number");

  const overallConfidence =
    confidenceValues.length > 0
      ? Math.round(confidenceValues.reduce((sum, val) => sum + val, 0) / confidenceValues.length)
      : 0;

  const populatedSections = [
    sections.readiness,
    sections.governance,
    sections.risks,
    sections.rollout,
    sections.observability,
    sections.diagnostics
  ].filter((section) => section?.status !== "UNKNOWN").length;

  const coverageRatio = populatedSections / 6;

  return deepFreeze({
    sectionId: SUMMARY_SECTION_IDS.CONFIDENCE,
    overallConfidence,
    populatedSectionCount: populatedSections,
    totalSectionCount: 6,
    coverageRatio,
    summary:
      overallConfidence >= 80
        ? `High advisory confidence at ${overallConfidence}% across ${populatedSections} populated sections`
        : overallConfidence > 0
          ? `Moderate advisory confidence at ${overallConfidence}% across ${populatedSections} populated sections`
          : "Advisory confidence could not be determined from supplied outputs"
  });
}

/**
 * @param {Readonly<Object>} sections
 * @returns {Readonly<Array>}
 */
function buildSummarySectionsArray(sections) {
  const result = [];

  for (let i = 0; i < SUMMARY_SECTION_ORDER.length; i += 1) {
    const sectionId = SUMMARY_SECTION_ORDER[i];
    if (sectionId === SUMMARY_SECTION_IDS.RECOMMENDATIONS) {
      result.push(
        deepFreeze({
          sectionId,
          order: i + 1,
          itemCount: sections.recommendations.length
        })
      );
    } else if (sectionId === SUMMARY_SECTION_IDS.NEXT_STEPS) {
      result.push(
        deepFreeze({
          sectionId,
          order: i + 1,
          itemCount: sections.nextSteps.length
        })
      );
    } else if (sectionId === SUMMARY_SECTION_IDS.CONFIDENCE) {
      result.push(
        deepFreeze({
          sectionId,
          order: i + 1,
          overallConfidence: sections.confidence.overallConfidence
        })
      );
    } else {
      result.push(
        deepFreeze({
          sectionId,
          order: i + 1,
          status: sections[sectionId]?.status ?? sections[sectionId]?.posture ?? "UNKNOWN"
        })
      );
    }
  }

  return Object.freeze(result);
}

/**
 * @param {Readonly<Object>} params
 * @returns {Readonly<Object>}
 */
function buildSummaryResult(params) {
  return deepFreeze({
    recruitmentId: params.recruitmentId,
    summarySections: params.summarySections,
    readiness: params.sections.readiness,
    governance: params.sections.governance,
    risks: params.sections.risks,
    rollout: params.sections.rollout,
    observability: params.sections.observability,
    diagnostics: params.sections.diagnostics,
    recommendations: params.recommendations,
    nextSteps: params.nextSteps,
    confidence: params.sections.confidence,
    advisoryMetadata: deepFreeze({
      advisoryOnly: true,
      descriptiveOnly: true,
      persistent: false,
      generatedBy: "phase_142",
      phase: RECRUITMENT_OPERATIONAL_SUMMARY_BUILDER_PHASE,
      operationalSummaryBuilderOnly: true,
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
 * Build consolidated operational summary from supplied advisory outputs.
 * Never throws. Never mutates input. Never persists output.
 *
 * @param {Object|null|undefined} input
 * @returns {Readonly<Object>}
 */
function buildRecruitmentOperationalSummary(input) {
  try {
    if (!isRecognizedSummaryInput(input) || !hasMeaningfulSummarySignals(input)) {
      const readiness = buildReadinessSection({});
      const governance = buildGovernanceSection({});
      const risks = buildRisksSection({});
      const rollout = buildRolloutSection({});
      const observability = buildObservabilitySection({});
      const diagnostics = buildDiagnosticsSection({});
      const recommendations = buildRecommendationsSection({});
      const nextSteps = buildNextStepsSection({}, recommendations);
      const sections = {
        readiness,
        governance,
        risks,
        rollout,
        observability,
        diagnostics,
        confidence: buildConfidenceSection(
          { readiness, governance, risks, rollout, observability, diagnostics },
          {}
        )
      };

      return buildSummaryResult({
        recruitmentId: null,
        sections,
        recommendations,
        nextSteps,
        summarySections: buildSummarySectionsArray({ ...sections, recommendations, nextSteps })
      });
    }

    const recruitmentId = resolveRecruitmentId(input.recruitmentId);
    const readiness = buildReadinessSection(input);
    const governance = buildGovernanceSection(input);
    const risks = buildRisksSection(input);
    const rollout = buildRolloutSection(input);
    const observability = buildObservabilitySection(input);
    const diagnostics = buildDiagnosticsSection(input);
    const recommendations = buildRecommendationsSection(input);
    const nextSteps = buildNextStepsSection(input, recommendations);
    const sections = {
      readiness,
      governance,
      risks,
      rollout,
      observability,
      diagnostics,
      confidence: buildConfidenceSection(
        { readiness, governance, risks, rollout, observability, diagnostics },
        input
      )
    };

    return buildSummaryResult({
      recruitmentId,
      sections,
      recommendations,
      nextSteps,
      summarySections: buildSummarySectionsArray({ ...sections, recommendations, nextSteps })
    });
  } catch {
    const readiness = buildReadinessSection({});
    const governance = buildGovernanceSection({});
    const risks = buildRisksSection({});
    const rollout = buildRolloutSection({});
    const observability = buildObservabilitySection({});
    const diagnostics = buildDiagnosticsSection({});
    const recommendations = buildRecommendationsSection({});
    const nextSteps = buildNextStepsSection({}, recommendations);
    const sections = {
      readiness,
      governance,
      risks,
      rollout,
      observability,
      diagnostics,
      confidence: buildConfidenceSection(
        { readiness, governance, risks, rollout, observability, diagnostics },
        {}
      )
    };

    return buildSummaryResult({
      recruitmentId: null,
      sections,
      recommendations,
      nextSteps,
      summarySections: buildSummarySectionsArray({ ...sections, recommendations, nextSteps })
    });
  }
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function isRecruitmentOperationalSummary(value) {
  if (!isPlainObject(value)) {
    return false;
  }

  for (let i = 0; i < EXPECTED_RESULT_KEYS.length; i += 1) {
    if (!(EXPECTED_RESULT_KEYS[i] in value)) {
      return false;
    }
  }

  if (!Array.isArray(value.summarySections) || !Array.isArray(value.recommendations)) {
    return false;
  }

  if (!isPlainObject(value.confidence) || !isPlainObject(value.advisoryMetadata)) {
    return false;
  }

  return (
    value.advisoryMetadata.advisoryOnly === true &&
    value.advisoryMetadata.operationalSummaryBuilderOnly === true &&
    value.advisoryMetadata.executed === false
  );
}

module.exports = {
  RECRUITMENT_OPERATIONAL_SUMMARY_BUILDER_PHASE,
  RECRUITMENT_OPERATIONAL_SUMMARY_BUILDER_ENTITY,
  SUMMARY_SCHEMA_VERSION,
  SUMMARY_SECTION_IDS,
  SUMMARY_SECTION_ORDER,
  RECRUITMENT_OPERATIONAL_SUMMARY_BUILDER_DESCRIPTOR,
  RECRUITMENT_OPERATIONAL_SUMMARY_BUILDER_METADATA,
  EXPECTED_RESULT_KEYS,
  buildRecruitmentOperationalSummary,
  isRecruitmentOperationalSummary
};
