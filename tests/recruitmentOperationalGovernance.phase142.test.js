"use strict";

/**
 * Phase 142 — Operational Governance & Adoption Advisory Suite tests.
 * Verifies deterministic output, invalid inputs, empty inputs, partial advisory
 * metadata, complete advisory metadata, stable ordering, confidence calculations,
 * risk aggregation, governance completeness, and summary generation.
 */

const fs = require("fs");
const path = require("path");

const {
  RECRUITMENT_GOVERNANCE_CHECKLIST_PHASE,
  RECRUITMENT_GOVERNANCE_CHECKLIST_ENTITY,
  GOVERNANCE_CHECK_STATUS,
  GOVERNANCE_POSTURE,
  REVIEW_SECTION_IDS,
  REVIEW_SECTION_ORDER,
  RECRUITMENT_GOVERNANCE_CHECKLIST_DESCRIPTOR,
  RECRUITMENT_GOVERNANCE_CHECKLIST_METADATA,
  EXPECTED_RESULT_KEYS: GOVERNANCE_EXPECTED_KEYS,
  buildRecruitmentGovernanceChecklist,
  isRecruitmentGovernanceChecklist
} = require("../server/lib/recruitment/recruitmentGovernanceChecklist");

const {
  RECRUITMENT_RISK_ASSESSMENT_ADVISOR_PHASE,
  RECRUITMENT_RISK_ASSESSMENT_ADVISOR_ENTITY,
  RISK_SEVERITY,
  RISK_CATEGORY,
  OVERALL_RISK_POSTURE,
  RISK_CATEGORY_ORDER,
  RECRUITMENT_RISK_ASSESSMENT_ADVISOR_DESCRIPTOR,
  RECRUITMENT_RISK_ASSESSMENT_ADVISOR_METADATA,
  EXPECTED_RESULT_KEYS: RISK_EXPECTED_KEYS,
  assessRecruitmentRiskProfile,
  isRecruitmentRiskAssessment
} = require("../server/lib/recruitment/recruitmentRiskAssessmentAdvisor");

const {
  RECRUITMENT_RELEASE_READINESS_ADVISOR_PHASE,
  RECRUITMENT_RELEASE_READINESS_ADVISOR_ENTITY,
  ADVISORY_APPROVAL_STATUS,
  RELEASE_READINESS_STATUS,
  RECRUITMENT_RELEASE_READINESS_ADVISOR_DESCRIPTOR,
  RECRUITMENT_RELEASE_READINESS_ADVISOR_METADATA,
  EXPECTED_RESULT_KEYS: RELEASE_EXPECTED_KEYS,
  buildRecruitmentReleaseReadinessReport,
  isRecruitmentReleaseReadinessReport
} = require("../server/lib/recruitment/recruitmentReleaseReadinessAdvisor");

const {
  RECRUITMENT_OPERATIONAL_SUMMARY_BUILDER_PHASE,
  RECRUITMENT_OPERATIONAL_SUMMARY_BUILDER_ENTITY,
  SUMMARY_SECTION_IDS,
  SUMMARY_SECTION_ORDER,
  RECRUITMENT_OPERATIONAL_SUMMARY_BUILDER_DESCRIPTOR,
  RECRUITMENT_OPERATIONAL_SUMMARY_BUILDER_METADATA,
  EXPECTED_RESULT_KEYS: SUMMARY_EXPECTED_KEYS,
  buildRecruitmentOperationalSummary,
  isRecruitmentOperationalSummary
} = require("../server/lib/recruitment/recruitmentOperationalSummaryBuilder");

const {
  buildOperationalReadinessAssessment
} = require("../server/lib/recruitment/recruitmentOperationalReadinessAssessment");

const {
  FEATURE_FLAG_IDS,
  createRecruitmentWorkflowFeatureFlagStrategy
} = require("../server/lib/recruitment/recruitmentWorkflowFeatureFlagStrategy");

const {
  createRecruitmentWorkflowAdoptionBlueprintSummary
} = require("../server/lib/recruitment/recruitmentWorkflowAdoptionBlueprintSummary");

const {
  evaluateRecruitmentWorkflowRuntimeReadinessGate
} = require("../server/lib/recruitment/recruitmentWorkflowRuntimeReadinessGate");

const {
  createRecruitmentWorkflowProductionAdoptionPlaybook
} = require("../server/lib/recruitment/recruitmentWorkflowProductionAdoptionPlaybook");

const {
  createRecruitmentWorkflowRuntimeAdoptionBlueprint
} = require("../server/lib/recruitment/recruitmentWorkflowRuntimeAdoptionBlueprint");

const {
  createRecruitmentWorkflowIntegrationRolloutPlan
} = require("../server/lib/recruitment/recruitmentWorkflowIntegrationRolloutPlanner");

const {
  RECRUITMENT_WORKFLOW_STATES,
  orchestrateRecruitmentWorkflow
} = require("../server/lib/recruitment/recruitmentWorkflowOrchestrator");

const ROOT = path.join(__dirname, "..");
const GOVERNANCE_MODULE = "server/lib/recruitment/recruitmentGovernanceChecklist.js";
const RISK_MODULE = "server/lib/recruitment/recruitmentRiskAssessmentAdvisor.js";
const RELEASE_MODULE = "server/lib/recruitment/recruitmentReleaseReadinessAdvisor.js";
const SUMMARY_MODULE = "server/lib/recruitment/recruitmentOperationalSummaryBuilder.js";
const ORCHESTRATOR_MODULE = "server/lib/recruitment/recruitmentWorkflowOrchestrator.js";
const COORDINATOR_MODULE = "server/lib/recruitment/recruitmentWorkflowIntegrationCoordinator.js";
const GATEWAY_MODULE = "server/lib/recruitment/recruitmentWorkflowAdvisoryGateway.js";
const PIPELINE_MODULE = "server/lib/recruitment/runRecruitmentPipeline.js";
const WORKER_MODULE = "server/services/workers/siteWorker.js";

const PHASE_142_MODULES = [
  "recruitmentGovernanceChecklist",
  "recruitmentRiskAssessmentAdvisor",
  "recruitmentReleaseReadinessAdvisor",
  "recruitmentOperationalSummaryBuilder"
];

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

function collectFrozenNodes(value, nodes = []) {
  if (value == null || typeof value !== "object") {
    return nodes;
  }
  if (Object.isFrozen(value)) {
    nodes.push(value);
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      collectFrozenNodes(value[i], nodes);
    }
    return nodes;
  }
  const keys = Object.keys(value);
  for (let i = 0; i < keys.length; i += 1) {
    collectFrozenNodes(value[keys[i]], nodes);
  }
  return nodes;
}

function assertAllFrozen(value) {
  const nodes = collectFrozenNodes(value);
  for (let i = 0; i < nodes.length; i += 1) {
    expect(Object.isFrozen(nodes[i])).toBe(true);
  }
}

function buildFullyReadyRolloutPlan() {
  return createRecruitmentWorkflowIntegrationRolloutPlan({
    integrationReadiness: {
      integrationStatus: "READY_FOR_CONTROLLED_INTEGRATION"
    }
  });
}

function buildBlockedRolloutPlan() {
  return createRecruitmentWorkflowIntegrationRolloutPlan({
    integrationReadiness: {
      integrationStatus: "NOT_READY"
    }
  });
}

function buildFullGovernanceInput(overrides = {}) {
  const featureFlagStrategy = createRecruitmentWorkflowFeatureFlagStrategy({
    recruitmentId: "GOV_142"
  });

  const productionAdoptionPlaybook = createRecruitmentWorkflowProductionAdoptionPlaybook({
    recruitmentId: "GOV_142"
  });

  const runtimeReadinessGate = evaluateRecruitmentWorkflowRuntimeReadinessGate({
    recruitmentId: "GOV_142",
    architectureSummary: { summaryPosture: "ARCHITECTURE_READY" },
    futureRuntimeMapping: { mappingPosture: "MAPPING_DEFINED" },
    governanceCompliance: { governancePosture: "COMPLIANT" },
    simulationValidation: { validationStatus: "VALID" },
    integrationContract: { contractStatus: "CONTRACT_READY" },
    featureFlagStrategy,
    shadowModeBlueprint: { shadowModePosture: "SHADOW_DEFINED" },
    advisoryPosture: { noProductionMutation: true }
  });

  const runtimeAdoptionBlueprint = createRecruitmentWorkflowRuntimeAdoptionBlueprint({
    recruitmentId: "GOV_142",
    architectureSummary: { summaryPosture: "ARCHITECTURE_READY" },
    futureRuntimeMapping: { mappingPosture: "MAPPING_DEFINED" },
    featureFlagStrategy,
    shadowModeBlueprint: { shadowModePosture: "SHADOW_DEFINED" },
    readinessGate: runtimeReadinessGate,
    governanceCompliance: { governancePosture: "COMPLIANT" },
    productionAdoptionPlaybook
  });

  const adoptionBlueprintSummary = createRecruitmentWorkflowAdoptionBlueprintSummary({
    recruitmentId: "GOV_142",
    runtimeAdoptionBlueprint,
    featureFlagStrategy,
    shadowModeBlueprint: { shadowModePosture: "SHADOW_DEFINED" },
    runtimeReadinessGate,
    productionAdoptionPlaybook
  });

  const operationalReadinessAssessment = buildOperationalReadinessAssessment({
    recruitmentId: "GOV_142",
    adoptionBlueprintSummary,
    runtimeAdoptionBlueprint,
    runtimeReadinessGate,
    productionAdoptionPlaybook,
    featureFlagStrategy,
    integrationRolloutPlan: buildFullyReadyRolloutPlan(),
    observabilityPlanning: {
      observabilityPosture: "OBSERVABILITY_DEFINED",
      contractStatus: "CONTRACT_READY"
    },
    observationRolloutReadiness: { status: "READY", healthStatus: "READY" },
    diagnosticsPlanning: {
      diagnosticsPosture: "DIAGNOSTICS_DEFINED",
      attachmentReady: true,
      coverageRatio: 1
    },
    workflowCoverage: {
      registeredCapabilityCount: 8,
      expectedCapabilityCount: 8,
      coverageRatio: 1
    },
    integrationContractSummary: { summaryPosture: "INTEGRATION_CONTRACT_READY" }
  });

  return {
    recruitmentId: "GOV_142",
    architectureSummary: { summaryPosture: "ARCHITECTURE_READY" },
    compositionValidation: { validationStatus: "VALID" },
    integrationContractSummary: { summaryPosture: "INTEGRATION_CONTRACT_READY" },
    adoptionBlueprintSummary,
    runtimeReadinessGate,
    productionAdoptionPlaybook,
    governanceCompliance: { governancePosture: "COMPLIANT" },
    operationalReadinessAssessment,
    featureFlagStrategy,
    integrationRolloutPlan: buildFullyReadyRolloutPlan(),
    observabilityPlanning: {
      observabilityPosture: "OBSERVABILITY_DEFINED",
      contractStatus: "CONTRACT_READY"
    },
    observationRolloutReadiness: { status: "READY", healthStatus: "READY" },
    observationHealth: { status: "READY" },
    diagnosticsPlanning: {
      diagnosticsPosture: "DIAGNOSTICS_DEFINED",
      attachmentReady: true,
      coverageRatio: 1
    },
    diagnosticsAttachment: { attachmentReady: true, coverageRatio: 1 },
    ...overrides
  };
}

function buildFullAdvisorySuite(overrides = {}) {
  const governanceInput = buildFullGovernanceInput(overrides);
  const governanceChecklist = buildRecruitmentGovernanceChecklist(governanceInput);
  const riskAssessment = assessRecruitmentRiskProfile(governanceInput);
  const releaseReadiness = buildRecruitmentReleaseReadinessReport({
    ...governanceInput,
    governanceChecklist,
    riskAssessment,
    operationalReadinessAssessment: governanceInput.operationalReadinessAssessment
  });

  return {
    governanceInput,
    governanceChecklist,
    riskAssessment,
    releaseReadiness,
    operationalReadinessAssessment: governanceInput.operationalReadinessAssessment
  };
}

describe("Phase 142 — recruitmentGovernanceChecklist", () => {
  describe("module metadata", () => {
    test("exports phase 142 constants", () => {
      expect(RECRUITMENT_GOVERNANCE_CHECKLIST_PHASE).toBe(142);
      expect(RECRUITMENT_GOVERNANCE_CHECKLIST_ENTITY).toBe("recruitment_governance_checklist");
    });

    test("descriptor declares advisory-only governance checklist", () => {
      expect(RECRUITMENT_GOVERNANCE_CHECKLIST_DESCRIPTOR.phase).toBe(142);
      expect(RECRUITMENT_GOVERNANCE_CHECKLIST_DESCRIPTOR.metadata.advisoryOnly).toBe(true);
      expect(RECRUITMENT_GOVERNANCE_CHECKLIST_DESCRIPTOR.metadata.governanceChecklistOnly).toBe(
        true
      );
    });

    test("metadata declares no runtime wiring or side effects", () => {
      expect(RECRUITMENT_GOVERNANCE_CHECKLIST_METADATA.runtimeIntegration).toBe(false);
      expect(RECRUITMENT_GOVERNANCE_CHECKLIST_METADATA.executed).toBe(false);
      expect(RECRUITMENT_GOVERNANCE_CHECKLIST_METADATA.flagExecutionEnabled).toBe(false);
      expect(RECRUITMENT_GOVERNANCE_CHECKLIST_METADATA.rolloutActivationEnabled).toBe(false);
    });

    test("review section order is stable", () => {
      expect(REVIEW_SECTION_ORDER).toEqual([
        REVIEW_SECTION_IDS.ARCHITECTURE,
        REVIEW_SECTION_IDS.ROLLOUT,
        REVIEW_SECTION_IDS.OBSERVABILITY,
        REVIEW_SECTION_IDS.DIAGNOSTICS,
        REVIEW_SECTION_IDS.OPERATIONAL,
        REVIEW_SECTION_IDS.DOCUMENTATION
      ]);
    });
  });

  describe("empty and invalid inputs", () => {
    test("returns unknown posture for null input", () => {
      const result = buildRecruitmentGovernanceChecklist(null);
      expect(result.governancePosture).toBe(GOVERNANCE_POSTURE.UNKNOWN);
      expect(result.confidence).toBe(0);
      expect(result.recruitmentId).toBeNull();
    });

    test("returns unknown posture for empty object", () => {
      const result = buildRecruitmentGovernanceChecklist({});
      expect(result.governancePosture).toBe(GOVERNANCE_POSTURE.UNKNOWN);
      expect(result.overallScore).toBe(0);
    });

    test("returns unknown posture for invalid input type", () => {
      const result = buildRecruitmentGovernanceChecklist("invalid");
      expect(result.governancePosture).toBe(GOVERNANCE_POSTURE.UNKNOWN);
    });

    test("invalid nested field types return unknown checklist", () => {
      const result = buildRecruitmentGovernanceChecklist({
        architectureSummary: "not-an-object"
      });
      expect(result.governancePosture).toBe(GOVERNANCE_POSTURE.UNKNOWN);
    });

    test("empty input marks all review sections unknown", () => {
      const result = buildRecruitmentGovernanceChecklist({});
      expect(result.architectureReview.status).toBe(GOVERNANCE_CHECK_STATUS.UNKNOWN);
      expect(result.rolloutReview.status).toBe(GOVERNANCE_CHECK_STATUS.UNKNOWN);
      expect(result.observabilityReview.status).toBe(GOVERNANCE_CHECK_STATUS.UNKNOWN);
      expect(result.diagnosticsReview.status).toBe(GOVERNANCE_CHECK_STATUS.UNKNOWN);
      expect(result.operationalReview.status).toBe(GOVERNANCE_CHECK_STATUS.UNKNOWN);
      expect(result.documentationReview.status).toBe(GOVERNANCE_CHECK_STATUS.UNKNOWN);
      expect(result.knownGaps.length).toBeGreaterThan(0);
    });
  });

  describe("result structure and validation", () => {
    test("returns all expected result keys", () => {
      const result = buildRecruitmentGovernanceChecklist(buildFullGovernanceInput());
      for (let i = 0; i < GOVERNANCE_EXPECTED_KEYS.length; i += 1) {
        expect(result).toHaveProperty(GOVERNANCE_EXPECTED_KEYS[i]);
      }
    });

    test("isRecruitmentGovernanceChecklist validates result shape", () => {
      const result = buildRecruitmentGovernanceChecklist(buildFullGovernanceInput());
      expect(isRecruitmentGovernanceChecklist(result)).toBe(true);
      expect(isRecruitmentGovernanceChecklist({})).toBe(false);
    });
  });

  describe("determinism and immutability", () => {
    test("produces identical output for identical input", () => {
      const input = buildFullGovernanceInput();
      expect(buildRecruitmentGovernanceChecklist(input)).toEqual(
        buildRecruitmentGovernanceChecklist(input)
      );
    });

    test("does not mutate input object", () => {
      const input = buildFullGovernanceInput();
      const snapshot = JSON.parse(JSON.stringify(input));
      buildRecruitmentGovernanceChecklist(input);
      expect(input).toEqual(snapshot);
    });

    test("returns deeply frozen result", () => {
      assertAllFrozen(buildRecruitmentGovernanceChecklist(buildFullGovernanceInput()));
    });

    test("review sections maintain stable ordering", () => {
      const result = buildRecruitmentGovernanceChecklist(buildFullGovernanceInput());
      const sectionIds = result.reviewSections.map((item) => item.reviewId);
      expect(sectionIds).toEqual(REVIEW_SECTION_ORDER);
      expect(result.reviewSections.map((item) => item.order)).toEqual([1, 2, 3, 4, 5, 6]);
    });
  });

  describe("partial advisory metadata", () => {
    test("single architecture signal yields review required posture", () => {
      const result = buildRecruitmentGovernanceChecklist({
        architectureSummary: { summaryPosture: "ARCHITECTURE_REVIEW_REQUIRED" }
      });
      expect(result.architectureReview.hasSignals).toBe(true);
      expect(result.governancePosture).toBe(GOVERNANCE_POSTURE.GOVERNANCE_REVIEW_REQUIRED);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThan(100);
    });

    test("partial observability yields review required section", () => {
      const result = buildRecruitmentGovernanceChecklist({
        observabilityPlanning: { observabilityPosture: "OBSERVABILITY_PARTIAL" }
      });
      expect(result.observabilityReview.status).toBe(GOVERNANCE_CHECK_STATUS.REVIEW_REQUIRED);
    });

    test("partial diagnostics yields review required section", () => {
      const result = buildRecruitmentGovernanceChecklist({
        diagnosticsPlanning: {
          diagnosticsPosture: "DIAGNOSTICS_PARTIAL",
          coverageRatio: 0.5
        }
      });
      expect(result.diagnosticsReview.status).toBe(GOVERNANCE_CHECK_STATUS.REVIEW_REQUIRED);
    });
  });

  describe("complete advisory metadata", () => {
    test("returns governance ready for complete advisory suite", () => {
      const result = buildRecruitmentGovernanceChecklist(buildFullGovernanceInput());
      expect(result.governancePosture).toBe(GOVERNANCE_POSTURE.GOVERNANCE_READY);
      expect(result.recruitmentId).toBe("GOV_142");
      expect(result.confidence).toBe(100);
    });

    test("all review sections satisfied when fully ready", () => {
      const result = buildRecruitmentGovernanceChecklist(buildFullGovernanceInput());
      for (let i = 0; i < result.reviewSections.length; i += 1) {
        expect(result.reviewSections[i].status).toBe(GOVERNANCE_CHECK_STATUS.SATISFIED);
      }
    });

    test("known gaps empty when fully ready", () => {
      expect(buildRecruitmentGovernanceChecklist(buildFullGovernanceInput()).knownGaps).toEqual([]);
    });
  });

  describe("governance completeness", () => {
    test("blocked architecture yields governance blocked posture", () => {
      const result = buildRecruitmentGovernanceChecklist({
        architectureSummary: { summaryPosture: "ARCHITECTURE_BLOCKED" }
      });
      expect(result.architectureReview.status).toBe(GOVERNANCE_CHECK_STATUS.UNSATISFIED);
      expect(result.governancePosture).toBe(GOVERNANCE_POSTURE.GOVERNANCE_BLOCKED);
    });

    test("closed readiness gate blocks operational review", () => {
      const result = buildRecruitmentGovernanceChecklist({
        runtimeReadinessGate: { gateStatus: "GATE_CLOSED" },
        adoptionBlueprintSummary: { summaryPosture: "ADOPTION_BLOCKED" }
      });
      expect(result.operationalReview.status).toBe(GOVERNANCE_CHECK_STATUS.UNSATISFIED);
    });

    test("blocked rollout stage blocks rollout review", () => {
      const result = buildRecruitmentGovernanceChecklist({
        integrationRolloutPlan: buildBlockedRolloutPlan()
      });
      expect(result.rolloutReview.status).toBe(GOVERNANCE_CHECK_STATUS.UNSATISFIED);
    });
  });

  describe("confidence calculations", () => {
    test("confidence is zero for empty input", () => {
      expect(buildRecruitmentGovernanceChecklist({}).confidence).toBe(0);
    });

    test("confidence reaches 100 when all sections satisfied", () => {
      expect(buildRecruitmentGovernanceChecklist(buildFullGovernanceInput()).confidence).toBe(100);
    });

    test("blocked section reduces confidence", () => {
      const ready = buildRecruitmentGovernanceChecklist(buildFullGovernanceInput());
      const blocked = buildRecruitmentGovernanceChecklist(
        buildFullGovernanceInput({
          architectureSummary: { summaryPosture: "ARCHITECTURE_BLOCKED" }
        })
      );
      expect(blocked.confidence).toBeLessThan(ready.confidence);
    });
  });
});

describe("Phase 142 — recruitmentRiskAssessmentAdvisor", () => {
  describe("module metadata", () => {
    test("exports phase 142 constants", () => {
      expect(RECRUITMENT_RISK_ASSESSMENT_ADVISOR_PHASE).toBe(142);
      expect(RECRUITMENT_RISK_ASSESSMENT_ADVISOR_ENTITY).toBe("recruitment_risk_assessment_advisor");
    });

    test("descriptor declares advisory-only risk assessment", () => {
      expect(RECRUITMENT_RISK_ASSESSMENT_ADVISOR_DESCRIPTOR.metadata.riskAssessmentAdvisorOnly).toBe(
        true
      );
    });

    test("risk category order is stable", () => {
      expect(RISK_CATEGORY_ORDER).toEqual([
        RISK_CATEGORY.TECHNICAL,
        RISK_CATEGORY.OPERATIONAL,
        RISK_CATEGORY.ROLLOUT,
        RISK_CATEGORY.MONITORING
      ]);
    });
  });

  describe("empty and invalid inputs", () => {
    test("returns unknown posture for null input", () => {
      const result = assessRecruitmentRiskProfile(null);
      expect(result.overallRiskPosture).toBe(OVERALL_RISK_POSTURE.UNKNOWN);
      expect(result.confidence).toBe(0);
    });

    test("returns metadata missing risks for empty input", () => {
      const result = assessRecruitmentRiskProfile({});
      expect(result.technicalRisks[0].riskId).toBe("technical_metadata_missing");
      expect(result.operationalRisks[0].riskId).toBe("operational_metadata_missing");
      expect(result.rolloutRisks[0].riskId).toBe("rollout_metadata_missing");
      expect(result.monitoringRisks[0].riskId).toBe("monitoring_metadata_missing");
    });

    test("invalid nested field types return unknown assessment", () => {
      const result = assessRecruitmentRiskProfile({ architectureSummary: "invalid" });
      expect(result.overallRiskPosture).toBe(OVERALL_RISK_POSTURE.UNKNOWN);
    });
  });

  describe("result structure and validation", () => {
    test("returns all expected result keys", () => {
      const result = assessRecruitmentRiskProfile(buildFullGovernanceInput());
      for (let i = 0; i < RISK_EXPECTED_KEYS.length; i += 1) {
        expect(result).toHaveProperty(RISK_EXPECTED_KEYS[i]);
      }
    });

    test("isRecruitmentRiskAssessment validates result shape", () => {
      const result = assessRecruitmentRiskProfile(buildFullGovernanceInput());
      expect(isRecruitmentRiskAssessment(result)).toBe(true);
      expect(isRecruitmentRiskAssessment(null)).toBe(false);
    });
  });

  describe("determinism and immutability", () => {
    test("produces identical output for identical input", () => {
      const input = buildFullGovernanceInput();
      expect(assessRecruitmentRiskProfile(input)).toEqual(assessRecruitmentRiskProfile(input));
    });

    test("does not mutate input object", () => {
      const input = buildFullGovernanceInput();
      const snapshot = JSON.parse(JSON.stringify(input));
      assessRecruitmentRiskProfile(input);
      expect(input).toEqual(snapshot);
    });

    test("returns deeply frozen result", () => {
      assertAllFrozen(assessRecruitmentRiskProfile(buildFullGovernanceInput()));
    });
  });

  describe("risk aggregation", () => {
    test("complete metadata yields acceptable risk posture", () => {
      const result = assessRecruitmentRiskProfile(buildFullGovernanceInput());
      expect(result.overallRiskPosture).toBe(OVERALL_RISK_POSTURE.ACCEPTABLE);
      expect(result.overallRiskLevel).toBe(RISK_SEVERITY.LOW);
    });

    test("blocked architecture yields critical overall risk", () => {
      const result = assessRecruitmentRiskProfile({
        architectureSummary: { summaryPosture: "ARCHITECTURE_BLOCKED" }
      });
      expect(result.overallRiskLevel).toBe(RISK_SEVERITY.CRITICAL);
      expect(result.overallRiskPosture).toBe(OVERALL_RISK_POSTURE.CRITICAL);
      expect(result.technicalRisks.some((r) => r.riskId === "architecture_blueprint_blocked")).toBe(
        true
      );
    });

    test("closed gate yields high operational risk", () => {
      const result = assessRecruitmentRiskProfile({
        runtimeReadinessGate: { gateStatus: "GATE_CLOSED" }
      });
      expect(result.overallRiskLevel).toBe(RISK_SEVERITY.HIGH);
      expect(result.operationalRisks.some((r) => r.riskId === "runtime_gate_closed")).toBe(true);
    });

    test("blocked rollout yields high rollout risk", () => {
      const result = assessRecruitmentRiskProfile({
        integrationRolloutPlan: buildBlockedRolloutPlan()
      });
      expect(result.rolloutRisks.some((r) => r.riskId === "rollout_stage_blocked")).toBe(true);
    });

    test("blocked observability yields high monitoring risk", () => {
      const result = assessRecruitmentRiskProfile({
        observabilityPlanning: { observabilityPosture: "OBSERVABILITY_BLOCKED" }
      });
      expect(result.monitoringRisks.some((r) => r.riskId === "observability_planning_blocked")).toBe(
        true
      );
    });

    test("mitigation recommendations populated for blocked signals", () => {
      const result = assessRecruitmentRiskProfile({
        architectureSummary: { summaryPosture: "ARCHITECTURE_BLOCKED" }
      });
      expect(result.mitigationRecommendations.length).toBeGreaterThan(0);
      expect(result.mitigationRecommendations[0]).toContain("architecture");
    });

    test("risk score increases with severity", () => {
      const acceptable = assessRecruitmentRiskProfile(buildFullGovernanceInput());
      const critical = assessRecruitmentRiskProfile({
        architectureSummary: { summaryPosture: "ARCHITECTURE_BLOCKED" },
        adoptionBlueprintSummary: { summaryPosture: "ADOPTION_BLOCKED" }
      });
      expect(critical.riskScore).toBeGreaterThan(acceptable.riskScore);
    });
  });

  describe("confidence calculations", () => {
    test("confidence is zero for empty input", () => {
      expect(assessRecruitmentRiskProfile({}).confidence).toBe(0);
    });

    test("confidence increases with populated categories", () => {
      const empty = assessRecruitmentRiskProfile({});
      const partial = assessRecruitmentRiskProfile({
        architectureSummary: { summaryPosture: "ARCHITECTURE_READY" }
      });
      const full = assessRecruitmentRiskProfile(buildFullGovernanceInput());
      expect(partial.confidence).toBeGreaterThan(empty.confidence);
      expect(full.confidence).toBeGreaterThan(partial.confidence);
    });
  });
});

describe("Phase 142 — recruitmentReleaseReadinessAdvisor", () => {
  describe("module metadata", () => {
    test("exports phase 142 constants", () => {
      expect(RECRUITMENT_RELEASE_READINESS_ADVISOR_PHASE).toBe(142);
      expect(RECRUITMENT_RELEASE_READINESS_ADVISOR_ENTITY).toBe(
        "recruitment_release_readiness_advisor"
      );
    });

    test("descriptor declares advisory-only release readiness", () => {
      expect(RECRUITMENT_RELEASE_READINESS_ADVISOR_DESCRIPTOR.metadata.releaseReadinessAdvisorOnly).toBe(
        true
      );
    });
  });

  describe("empty and invalid inputs", () => {
    test("returns unknown status for null input", () => {
      const result = buildRecruitmentReleaseReadinessReport(null);
      expect(result.advisoryApprovalStatus).toBe(ADVISORY_APPROVAL_STATUS.UNKNOWN);
      expect(result.releaseConfidence).toBe(0);
    });

    test("returns unknown status for empty object", () => {
      const result = buildRecruitmentReleaseReadinessReport({});
      expect(result.releaseReadinessStatus).toBe(RELEASE_READINESS_STATUS.UNKNOWN);
      expect(result.missingPrerequisites.length).toBeGreaterThan(0);
    });

    test("invalid nested field types return unknown report", () => {
      const result = buildRecruitmentReleaseReadinessReport({
        governanceChecklist: "invalid"
      });
      expect(result.advisoryApprovalStatus).toBe(ADVISORY_APPROVAL_STATUS.UNKNOWN);
    });
  });

  describe("result structure and validation", () => {
    test("returns all expected result keys", () => {
      const suite = buildFullAdvisorySuite();
      const result = buildRecruitmentReleaseReadinessReport({
        ...suite.governanceInput,
        governanceChecklist: suite.governanceChecklist,
        riskAssessment: suite.riskAssessment,
        operationalReadinessAssessment: suite.operationalReadinessAssessment
      });
      for (let i = 0; i < RELEASE_EXPECTED_KEYS.length; i += 1) {
        expect(result).toHaveProperty(RELEASE_EXPECTED_KEYS[i]);
      }
    });

    test("isRecruitmentReleaseReadinessReport validates result shape", () => {
      const suite = buildFullAdvisorySuite();
      const result = buildRecruitmentReleaseReadinessReport({
        governanceChecklist: suite.governanceChecklist,
        riskAssessment: suite.riskAssessment,
        operationalReadinessAssessment: suite.operationalReadinessAssessment
      });
      expect(isRecruitmentReleaseReadinessReport(result)).toBe(true);
    });
  });

  describe("determinism and immutability", () => {
    test("produces identical output for identical input", () => {
      const suite = buildFullAdvisorySuite();
      const input = {
        ...suite.governanceInput,
        governanceChecklist: suite.governanceChecklist,
        riskAssessment: suite.riskAssessment,
        operationalReadinessAssessment: suite.operationalReadinessAssessment
      };
      expect(buildRecruitmentReleaseReadinessReport(input)).toEqual(
        buildRecruitmentReleaseReadinessReport(input)
      );
    });

    test("returns deeply frozen result", () => {
      const suite = buildFullAdvisorySuite();
      assertAllFrozen(
        buildRecruitmentReleaseReadinessReport({
          governanceChecklist: suite.governanceChecklist,
          riskAssessment: suite.riskAssessment,
          operationalReadinessAssessment: suite.operationalReadinessAssessment
        })
      );
    });
  });

  describe("partial advisory metadata", () => {
    test("raw metadata only yields review required approval", () => {
      const result = buildRecruitmentReleaseReadinessReport({
        architectureSummary: { summaryPosture: "ARCHITECTURE_READY" }
      });
      expect(result.advisoryApprovalStatus).toBe(ADVISORY_APPROVAL_STATUS.ADVISORY_REVIEW_REQUIRED);
      expect(result.missingPrerequisites.length).toBeGreaterThan(0);
    });

    test("recommended validation populated for missing prerequisites", () => {
      const result = buildRecruitmentReleaseReadinessReport({});
      expect(result.recommendedValidation.length).toBeGreaterThan(0);
    });
  });

  describe("complete advisory metadata", () => {
    test("returns advisory approved for complete suite", () => {
      const suite = buildFullAdvisorySuite();
      const result = buildRecruitmentReleaseReadinessReport({
        ...suite.governanceInput,
        governanceChecklist: suite.governanceChecklist,
        riskAssessment: suite.riskAssessment,
        operationalReadinessAssessment: suite.operationalReadinessAssessment
      });
      expect(result.advisoryApprovalStatus).toBe(ADVISORY_APPROVAL_STATUS.ADVISORY_APPROVED);
      expect(result.releaseReadinessStatus).toBe(RELEASE_READINESS_STATUS.RELEASE_READY);
      expect(result.releaseConfidence).toBeGreaterThanOrEqual(80);
    });

    test("missing prerequisites empty when fully ready", () => {
      const suite = buildFullAdvisorySuite();
      const result = buildRecruitmentReleaseReadinessReport({
        governanceChecklist: suite.governanceChecklist,
        riskAssessment: suite.riskAssessment,
        operationalReadinessAssessment: suite.operationalReadinessAssessment
      });
      expect(result.missingPrerequisites).toEqual([]);
    });
  });

  describe("blocked release readiness", () => {
    test("critical risk blocks advisory approval", () => {
      const suite = buildFullAdvisorySuite();
      const criticalRisk = assessRecruitmentRiskProfile({
        architectureSummary: { summaryPosture: "ARCHITECTURE_BLOCKED" }
      });
      const result = buildRecruitmentReleaseReadinessReport({
        governanceChecklist: suite.governanceChecklist,
        riskAssessment: criticalRisk,
        operationalReadinessAssessment: suite.operationalReadinessAssessment
      });
      expect(result.advisoryApprovalStatus).toBe(ADVISORY_APPROVAL_STATUS.ADVISORY_BLOCKED);
      expect(result.releaseReadinessStatus).toBe(RELEASE_READINESS_STATUS.RELEASE_BLOCKED);
    });

    test("closed gate blocks advisory approval", () => {
      const result = buildRecruitmentReleaseReadinessReport({
        runtimeReadinessGate: { gateStatus: "GATE_CLOSED" },
        architectureSummary: { summaryPosture: "ARCHITECTURE_READY" }
      });
      expect(result.advisoryApprovalStatus).toBe(ADVISORY_APPROVAL_STATUS.ADVISORY_BLOCKED);
      expect(result.missingPrerequisites).toContain("runtime_readiness_gate_closed");
    });
  });
});

describe("Phase 142 — recruitmentOperationalSummaryBuilder", () => {
  describe("module metadata", () => {
    test("exports phase 142 constants", () => {
      expect(RECRUITMENT_OPERATIONAL_SUMMARY_BUILDER_PHASE).toBe(142);
      expect(RECRUITMENT_OPERATIONAL_SUMMARY_BUILDER_ENTITY).toBe(
        "recruitment_operational_summary_builder"
      );
    });

    test("descriptor declares advisory-only summary builder", () => {
      expect(
        RECRUITMENT_OPERATIONAL_SUMMARY_BUILDER_DESCRIPTOR.metadata.operationalSummaryBuilderOnly
      ).toBe(true);
    });

    test("summary section order is stable", () => {
      expect(SUMMARY_SECTION_ORDER).toEqual([
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
    });
  });

  describe("empty and invalid inputs", () => {
    test("returns unknown sections for null input", () => {
      const result = buildRecruitmentOperationalSummary(null);
      expect(result.readiness.status).toBe("UNKNOWN");
      expect(result.governance.posture).toBe("UNKNOWN");
      expect(result.risks.overallRiskPosture).toBe("UNKNOWN");
      expect(result.confidence.overallConfidence).toBe(0);
    });

    test("returns unknown sections for empty object", () => {
      const result = buildRecruitmentOperationalSummary({});
      expect(result.rollout.status).toBe("UNKNOWN");
      expect(result.observability.status).toBe("UNKNOWN");
      expect(result.diagnostics.status).toBe("UNKNOWN");
      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.nextSteps.length).toBeGreaterThan(0);
    });

    test("invalid nested field types return unknown summary", () => {
      const result = buildRecruitmentOperationalSummary({ governanceChecklist: "invalid" });
      expect(result.governance.posture).toBe("UNKNOWN");
    });
  });

  describe("result structure and validation", () => {
    test("returns all expected result keys", () => {
      const suite = buildFullAdvisorySuite();
      const result = buildRecruitmentOperationalSummary({
        recruitmentId: "GOV_142",
        governanceChecklist: suite.governanceChecklist,
        riskAssessment: suite.riskAssessment,
        releaseReadiness: suite.releaseReadiness,
        operationalReadinessAssessment: suite.operationalReadinessAssessment,
        integrationRolloutPlan: suite.governanceInput.integrationRolloutPlan,
        observabilityPlanning: suite.governanceInput.observabilityPlanning,
        diagnosticsPlanning: suite.governanceInput.diagnosticsPlanning
      });
      for (let i = 0; i < SUMMARY_EXPECTED_KEYS.length; i += 1) {
        expect(result).toHaveProperty(SUMMARY_EXPECTED_KEYS[i]);
      }
    });

    test("isRecruitmentOperationalSummary validates result shape", () => {
      const suite = buildFullAdvisorySuite();
      const result = buildRecruitmentOperationalSummary({
        governanceChecklist: suite.governanceChecklist,
        riskAssessment: suite.riskAssessment
      });
      expect(isRecruitmentOperationalSummary(result)).toBe(true);
    });
  });

  describe("determinism and immutability", () => {
    test("produces identical output for identical input", () => {
      const suite = buildFullAdvisorySuite();
      const input = {
        governanceChecklist: suite.governanceChecklist,
        riskAssessment: suite.riskAssessment,
        releaseReadiness: suite.releaseReadiness,
        operationalReadinessAssessment: suite.operationalReadinessAssessment,
        integrationRolloutPlan: suite.governanceInput.integrationRolloutPlan,
        observabilityPlanning: suite.governanceInput.observabilityPlanning,
        diagnosticsPlanning: suite.governanceInput.diagnosticsPlanning
      };
      expect(buildRecruitmentOperationalSummary(input)).toEqual(
        buildRecruitmentOperationalSummary(input)
      );
    });

    test("does not mutate input object", () => {
      const suite = buildFullAdvisorySuite();
      const input = {
        governanceChecklist: suite.governanceChecklist,
        riskAssessment: suite.riskAssessment
      };
      const snapshot = JSON.parse(JSON.stringify(input));
      buildRecruitmentOperationalSummary(input);
      expect(input).toEqual(snapshot);
    });

    test("returns deeply frozen result", () => {
      const suite = buildFullAdvisorySuite();
      assertAllFrozen(
        buildRecruitmentOperationalSummary({
          governanceChecklist: suite.governanceChecklist,
          riskAssessment: suite.riskAssessment,
          releaseReadiness: suite.releaseReadiness,
          operationalReadinessAssessment: suite.operationalReadinessAssessment
        })
      );
    });

    test("summary sections maintain stable ordering", () => {
      const suite = buildFullAdvisorySuite();
      const result = buildRecruitmentOperationalSummary({
        governanceChecklist: suite.governanceChecklist,
        riskAssessment: suite.riskAssessment
      });
      expect(result.summarySections.map((s) => s.sectionId)).toEqual(SUMMARY_SECTION_ORDER);
      expect(result.summarySections.map((s) => s.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    });
  });

  describe("summary generation", () => {
    test("consolidates all advisory outputs into sections", () => {
      const suite = buildFullAdvisorySuite();
      const result = buildRecruitmentOperationalSummary({
        recruitmentId: "GOV_142",
        governanceChecklist: suite.governanceChecklist,
        riskAssessment: suite.riskAssessment,
        releaseReadiness: suite.releaseReadiness,
        operationalReadinessAssessment: suite.operationalReadinessAssessment,
        integrationRolloutPlan: suite.governanceInput.integrationRolloutPlan,
        observabilityPlanning: suite.governanceInput.observabilityPlanning,
        observationHealth: suite.governanceInput.observationHealth,
        diagnosticsPlanning: suite.governanceInput.diagnosticsPlanning,
        diagnosticsAttachment: suite.governanceInput.diagnosticsAttachment
      });

      expect(result.recruitmentId).toBe("GOV_142");
      expect(result.readiness.status).toBe("READY");
      expect(result.governance.posture).toBe(GOVERNANCE_POSTURE.GOVERNANCE_READY);
      expect(result.risks.overallRiskPosture).toBe(OVERALL_RISK_POSTURE.ACCEPTABLE);
      expect(result.rollout.status).toBe("READY");
      expect(result.observability.status).toBe("READY");
      expect(result.diagnostics.status).toBe("READY");
      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.nextSteps.length).toBeGreaterThan(0);
      expect(result.confidence.overallConfidence).toBeGreaterThan(0);
    });

    test("aggregates recommendations from risk and release outputs", () => {
      const suite = buildFullAdvisorySuite();
      const result = buildRecruitmentOperationalSummary({
        riskAssessment: suite.riskAssessment,
        releaseReadiness: suite.releaseReadiness,
        operationalReadinessAssessment: suite.operationalReadinessAssessment
      });
      expect(result.recommendations.length).toBeGreaterThan(1);
    });

    test("next steps reflect approval status", () => {
      const suite = buildFullAdvisorySuite();
      const result = buildRecruitmentOperationalSummary({
        governanceChecklist: suite.governanceChecklist,
        releaseReadiness: suite.releaseReadiness
      });
      expect(result.nextSteps.some((step) => step.includes("release"))).toBe(true);
    });

    test("partial inputs yield partially populated summary", () => {
      const governanceChecklist = buildRecruitmentGovernanceChecklist({
        architectureSummary: { summaryPosture: "ARCHITECTURE_READY" }
      });
      const result = buildRecruitmentOperationalSummary({ governanceChecklist });
      expect(result.governance.posture).toBe(GOVERNANCE_POSTURE.GOVERNANCE_REVIEW_REQUIRED);
      expect(result.readiness.status).toBe("UNKNOWN");
      expect(result.confidence.populatedSectionCount).toBeLessThan(6);
    });
  });

  describe("confidence calculations", () => {
    test("confidence section averages advisory output confidence", () => {
      const suite = buildFullAdvisorySuite();
      const result = buildRecruitmentOperationalSummary({
        governanceChecklist: suite.governanceChecklist,
        riskAssessment: suite.riskAssessment,
        releaseReadiness: suite.releaseReadiness,
        operationalReadinessAssessment: suite.operationalReadinessAssessment,
        integrationRolloutPlan: suite.governanceInput.integrationRolloutPlan,
        observabilityPlanning: suite.governanceInput.observabilityPlanning,
        diagnosticsPlanning: suite.governanceInput.diagnosticsPlanning
      });
      expect(result.confidence.overallConfidence).toBeGreaterThanOrEqual(80);
      expect(result.confidence.populatedSectionCount).toBe(6);
    });
  });
});

describe("Phase 142 — architecture boundaries", () => {
  const modulePaths = [GOVERNANCE_MODULE, RISK_MODULE, RELEASE_MODULE, SUMMARY_MODULE];

  test.each(modulePaths)("module %s declares no persistence", (modulePath) => {
    const source = read(modulePath);
    expect(source).toContain("no persistence");
    expect(source).toContain("persistenceEnabled: false");
    expect(source).not.toMatch(/INSERT INTO/i);
    expect(source).not.toMatch(/UPDATE\s+/i);
  });

  test.each(modulePaths)("module %s declares advisory-only contract", (modulePath) => {
    const source = read(modulePath);
    expect(source).toContain("Advisory Only");
    expect(source).toContain("Never mutates input");
    expect(source).toContain("advisoryOnly: true");
    expect(source).toContain("executed: false");
    expect(source).toContain("flagExecutionEnabled: false");
    expect(source).toContain("rolloutActivationEnabled: false");
  });

  test.each(modulePaths)("module %s has no runtime require statements", (modulePath) => {
    const source = read(modulePath);
    expect(source).not.toMatch(/require\(/);
  });

  test("orchestrator behavior remains unchanged and independent from phase 142", () => {
    const orchestration = orchestrateRecruitmentWorkflow({
      recruitmentId: 142,
      eventType: "notification"
    });

    expect(orchestration.workflowState).toBe(RECRUITMENT_WORKFLOW_STATES.DRAFT_CREATED);
    expect(orchestration.advisory).toBe(true);
    expect(orchestration.executed).toBe(false);
    expect(orchestration).not.toHaveProperty("governancePosture");
    expect(orchestration).not.toHaveProperty("overallRiskPosture");
    expect(orchestration).not.toHaveProperty("releaseConfidence");
  });

  test.each(PHASE_142_MODULES)("phase 142 module %s is not imported by orchestrator", (moduleName) => {
    expect(read(ORCHESTRATOR_MODULE)).not.toContain(moduleName);
  });

  test.each(PHASE_142_MODULES)("phase 142 module %s is not imported by coordinator", (moduleName) => {
    expect(read(COORDINATOR_MODULE)).not.toContain(moduleName);
  });

  test.each(PHASE_142_MODULES)("phase 142 module %s is not imported by advisory gateway", (moduleName) => {
    expect(read(GATEWAY_MODULE)).not.toContain(moduleName);
  });

  test.each(PHASE_142_MODULES)("phase 142 module %s is not imported by recruitment pipeline", (moduleName) => {
    expect(read(PIPELINE_MODULE)).not.toContain(moduleName);
  });

  test.each(PHASE_142_MODULES)("phase 142 module %s is not imported by site worker", (moduleName) => {
    expect(read(WORKER_MODULE)).not.toContain(moduleName);
  });

  test("all phase 142 outputs declare executed false", () => {
    const suite = buildFullAdvisorySuite();
    expect(suite.governanceChecklist.advisoryMetadata.executed).toBe(false);
    expect(suite.riskAssessment.advisoryMetadata.executed).toBe(false);
    expect(suite.releaseReadiness.advisoryMetadata.executed).toBe(false);

    const summary = buildRecruitmentOperationalSummary({
      governanceChecklist: suite.governanceChecklist,
      riskAssessment: suite.riskAssessment,
      releaseReadiness: suite.releaseReadiness
    });
    expect(summary.advisoryMetadata.executed).toBe(false);
  });

  test("metadata source phases include 141", () => {
    expect(RECRUITMENT_GOVERNANCE_CHECKLIST_METADATA.sourcePhases).toContain(141);
    expect(RECRUITMENT_RISK_ASSESSMENT_ADVISOR_METADATA.sourcePhases).toContain(141);
    expect(RECRUITMENT_RELEASE_READINESS_ADVISOR_METADATA.sourcePhases).toContain(141);
    expect(RECRUITMENT_OPERATIONAL_SUMMARY_BUILDER_METADATA.sourcePhases).toContain(141);
  });
});
