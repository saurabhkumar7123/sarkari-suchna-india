"use strict";

/**
 * Phase 136 — Recruitment Workflow Integration Governance Suite tests.
 * Verifies governance policy, decision matrix, rollback planner,
 * governance compliance validator, governance summary, isolation,
 * determinism, immutability, and architecture boundaries.
 */

const fs = require("fs");
const path = require("path");

const {
  RECRUITMENT_WORKFLOW_INTEGRATION_GOVERNANCE_POLICY_PHASE,
  RECRUITMENT_WORKFLOW_INTEGRATION_GOVERNANCE_POLICY_ENTITY,
  GOVERNANCE_POLICY_STATUS,
  GOVERNANCE_POSTURE,
  POLICY_CATEGORY,
  GOVERNANCE_POLICY_IDS,
  GOVERNANCE_POLICY_DEFINITIONS,
  RECRUITMENT_WORKFLOW_INTEGRATION_GOVERNANCE_POLICY_METADATA,
  createRecruitmentWorkflowIntegrationGovernancePolicy
} = require("../server/lib/recruitment/recruitmentWorkflowIntegrationGovernancePolicy");

const {
  RECRUITMENT_WORKFLOW_INTEGRATION_DECISION_MATRIX_PHASE,
  RECRUITMENT_WORKFLOW_INTEGRATION_DECISION_MATRIX_ENTITY,
  MATRIX_DIMENSION,
  MATRIX_EVALUATION_STATUS,
  MATRIX_POSTURE,
  MATRIX_DIMENSION_DEFINITIONS,
  RECRUITMENT_WORKFLOW_INTEGRATION_DECISION_MATRIX_METADATA,
  createRecruitmentWorkflowIntegrationDecisionMatrix
} = require("../server/lib/recruitment/recruitmentWorkflowIntegrationDecisionMatrix");

const {
  RECRUITMENT_WORKFLOW_ROLLBACK_PLANNER_PHASE,
  RECRUITMENT_WORKFLOW_ROLLBACK_PLANNER_ENTITY,
  ROLLBACK_STAGE_STATUS,
  ROLLBACK_POSTURE,
  ROLLBACK_STAGE_IDS,
  ROLLBACK_STAGE_DEFINITIONS,
  RECRUITMENT_WORKFLOW_ROLLBACK_PLANNER_METADATA,
  createRecruitmentWorkflowRollbackPlan
} = require("../server/lib/recruitment/recruitmentWorkflowRollbackPlanner");

const {
  RECRUITMENT_WORKFLOW_GOVERNANCE_COMPLIANCE_VALIDATOR_PHASE,
  RECRUITMENT_WORKFLOW_GOVERNANCE_COMPLIANCE_VALIDATOR_ENTITY,
  COMPLIANCE_STATUS,
  COMPLIANCE_RULE_STATUS,
  COMPLIANCE_RULE_IDS,
  COMPLIANCE_RULE_DEFINITIONS,
  RECRUITMENT_WORKFLOW_GOVERNANCE_COMPLIANCE_VALIDATOR_METADATA,
  validateRecruitmentWorkflowGovernanceCompliance
} = require("../server/lib/recruitment/recruitmentWorkflowGovernanceComplianceValidator");

const {
  RECRUITMENT_WORKFLOW_INTEGRATION_GOVERNANCE_SUMMARY_PHASE,
  RECRUITMENT_WORKFLOW_INTEGRATION_GOVERNANCE_SUMMARY_ENTITY,
  GOVERNANCE_SUMMARY_POSTURE,
  AGGREGATED_COMPONENT,
  RECRUITMENT_WORKFLOW_INTEGRATION_GOVERNANCE_SUMMARY_METADATA,
  createRecruitmentWorkflowIntegrationGovernanceSummary
} = require("../server/lib/recruitment/recruitmentWorkflowIntegrationGovernanceSummary");

const {
  RECRUITMENT_WORKFLOW_STATES,
  orchestrateRecruitmentWorkflow
} = require("../server/lib/recruitment/recruitmentWorkflowOrchestrator");

const ROOT = path.join(__dirname, "..");

const GOVERNANCE_POLICY_PATH =
  "server/lib/recruitment/recruitmentWorkflowIntegrationGovernancePolicy.js";
const DECISION_MATRIX_PATH =
  "server/lib/recruitment/recruitmentWorkflowIntegrationDecisionMatrix.js";
const ROLLBACK_PLANNER_PATH = "server/lib/recruitment/recruitmentWorkflowRollbackPlanner.js";
const COMPLIANCE_VALIDATOR_PATH =
  "server/lib/recruitment/recruitmentWorkflowGovernanceComplianceValidator.js";
const GOVERNANCE_SUMMARY_PATH =
  "server/lib/recruitment/recruitmentWorkflowIntegrationGovernanceSummary.js";

const PHASE_136_MODULE_PATHS = Object.freeze([
  GOVERNANCE_POLICY_PATH,
  DECISION_MATRIX_PATH,
  ROLLBACK_PLANNER_PATH,
  COMPLIANCE_VALIDATOR_PATH,
  GOVERNANCE_SUMMARY_PATH
]);

const PHASE_136_EXPORT_PATTERNS = Object.freeze([
  /createRecruitmentWorkflowIntegrationGovernancePolicy/,
  /createRecruitmentWorkflowIntegrationDecisionMatrix/,
  /createRecruitmentWorkflowRollbackPlan/,
  /validateRecruitmentWorkflowGovernanceCompliance/,
  /createRecruitmentWorkflowIntegrationGovernanceSummary/
]);

const ROLLOUT_PLANNER_MODULE_PATH =
  "server/lib/recruitment/recruitmentWorkflowIntegrationRolloutPlanner.js";
const ACTIVATION_MATRIX_MODULE_PATH =
  "server/lib/recruitment/recruitmentWorkflowFeatureActivationMatrix.js";
const SAFETY_CHECKLIST_MODULE_PATH =
  "server/lib/recruitment/recruitmentWorkflowIntegrationSafetyChecklist.js";
const ACTIVATION_STRATEGY_MODULE_PATH =
  "server/lib/recruitment/recruitmentWorkflowControlledActivationStrategy.js";
const CONSISTENCY_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowConsistencyValidator.js";
const READINESS_FRAMEWORK_MODULE_PATH =
  "server/lib/recruitment/recruitmentWorkflowIntegrationReadinessFramework.js";
const ORCHESTRATOR_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowOrchestrator.js";
const COORDINATOR_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowIntegrationCoordinator.js";
const GATEWAY_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowAdvisoryGateway.js";
const PIPELINE_MODULE_PATH = "server/lib/recruitment/runRecruitmentPipeline.js";
const WORKER_MODULE_PATH = "server/services/workers/siteWorker.js";

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

function buildAllModuleSignals() {
  const signals = {};
  for (let phase = 114; phase <= 135; phase += 1) {
    signals[phase] = { satisfied: true, ready: true };
  }
  return signals;
}

function buildAllActivatedModules() {
  const modules = {};
  for (let phase = 114; phase <= 135; phase += 1) {
    modules[phase] = { activated: true, satisfied: true };
  }
  return modules;
}

function buildReadyForGovernanceInput(overrides = {}) {
  return {
    integrationReadiness: {
      integrationStatus: "READY_FOR_CONTROLLED_INTEGRATION",
      readinessLevel: "READY_FOR_CONTROLLED_INTEGRATION"
    },
    readinessAssessment: {
      readinessStatus: "READY_FOR_STORAGE"
    },
    recommendation: {
      recommendationStatus: "PROCEED"
    },
    consistencyValidation: {
      consistencyStatus: "CONSISTENT"
    },
    intelligenceSummary: {
      currentState: {
        health: "HEALTHY",
        risk: "LOW"
      }
    },
    health: {
      healthStatus: "HEALTHY"
    },
    risk: {
      riskLevel: "LOW"
    },
    moduleSignals: buildAllModuleSignals(),
    activatedModules: buildAllActivatedModules(),
    governanceReview: {
      complete: true,
      documented: true,
      rollbackPlanDocumented: true
    },
    rollbackPlanDocumented: true,
    ...overrides
  };
}

function buildPartialGovernanceInput(overrides = {}) {
  return {
    integrationReadiness: {
      integrationStatus: "PARTIALLY_READY",
      readinessLevel: "PARTIALLY_READY"
    },
    readinessAssessment: {
      readinessStatus: "PARTIALLY_READY"
    },
    recommendation: {
      recommendationStatus: "REVIEW_REQUIRED"
    },
    consistencyValidation: {
      consistencyStatus: "CONSISTENT"
    },
    intelligenceSummary: {
      currentState: {
        health: "STABLE",
        risk: "MEDIUM"
      }
    },
    health: {
      healthStatus: "STABLE"
    },
    risk: {
      riskLevel: "MEDIUM"
    },
    moduleSignals: {
      114: { satisfied: true },
      115: { satisfied: true },
      116: { satisfied: true },
      117: { satisfied: true }
    },
    activatedModules: {
      114: { activated: true },
      115: { activated: true }
    },
    ...overrides
  };
}

function buildBlockedGovernanceInput(overrides = {}) {
  return {
    integrationReadiness: {
      integrationStatus: "NOT_READY",
      readinessLevel: "NOT_READY"
    },
    readinessAssessment: {
      readinessStatus: "BLOCKED"
    },
    recommendation: {
      recommendationStatus: "BLOCKED_ACTION_REQUIRED"
    },
    consistencyValidation: {
      consistencyStatus: "INCONSISTENT"
    },
    intelligenceSummary: {
      currentState: {
        health: "BLOCKED",
        risk: "CRITICAL"
      }
    },
    health: {
      healthStatus: "BLOCKED"
    },
    risk: {
      riskLevel: "CRITICAL"
    },
    rollbackTrigger: {
      requested: true,
      criticalFailure: true
    },
    ...overrides
  };
}

function buildFullGovernanceSuiteOutputs(baseInput) {
  const governancePolicy = createRecruitmentWorkflowIntegrationGovernancePolicy(baseInput);
  const decisionMatrix = createRecruitmentWorkflowIntegrationDecisionMatrix(baseInput);
  const rollbackPlan = createRecruitmentWorkflowRollbackPlan(baseInput);
  const complianceValidation = validateRecruitmentWorkflowGovernanceCompliance({
    governancePolicy,
    decisionMatrix,
    rollbackPlan,
    integrationReadiness: baseInput.integrationReadiness,
    consistencyValidation: baseInput.consistencyValidation,
    intelligenceSummary: baseInput.intelligenceSummary,
    governanceReview: baseInput.governanceReview
  });
  const governanceSummary = createRecruitmentWorkflowIntegrationGovernanceSummary({
    recruitmentId: 42,
    governancePolicy,
    decisionMatrix,
    rollbackPlan,
    complianceValidation
  });

  return {
    governancePolicy,
    decisionMatrix,
    rollbackPlan,
    complianceValidation,
    governanceSummary
  };
}

describe("Phase 136 — recruitmentWorkflowIntegrationGovernanceSuite", () => {
  describe("exports and metadata", () => {
    test("governance policy phase constants and metadata", () => {
      expect(RECRUITMENT_WORKFLOW_INTEGRATION_GOVERNANCE_POLICY_PHASE).toBe(136);
      expect(RECRUITMENT_WORKFLOW_INTEGRATION_GOVERNANCE_POLICY_ENTITY).toBe(
        "recruitment_workflow_integration_governance_policy"
      );
      expect(RECRUITMENT_WORKFLOW_INTEGRATION_GOVERNANCE_POLICY_METADATA.advisoryOnly).toBe(true);
      expect(RECRUITMENT_WORKFLOW_INTEGRATION_GOVERNANCE_POLICY_METADATA.persistent).toBe(false);
      expect(RECRUITMENT_WORKFLOW_INTEGRATION_GOVERNANCE_POLICY_METADATA.generatedBy).toBe(
        "phase_136"
      );
      expect(RECRUITMENT_WORKFLOW_INTEGRATION_GOVERNANCE_POLICY_METADATA.governancePolicyOnly).toBe(
        true
      );
    });

    test("decision matrix phase constants and metadata", () => {
      expect(RECRUITMENT_WORKFLOW_INTEGRATION_DECISION_MATRIX_PHASE).toBe(136);
      expect(RECRUITMENT_WORKFLOW_INTEGRATION_DECISION_MATRIX_ENTITY).toBe(
        "recruitment_workflow_integration_decision_matrix"
      );
      expect(RECRUITMENT_WORKFLOW_INTEGRATION_DECISION_MATRIX_METADATA.advisoryOnly).toBe(true);
      expect(RECRUITMENT_WORKFLOW_INTEGRATION_DECISION_MATRIX_METADATA.decisionMatrixOnly).toBe(
        true
      );
    });

    test("rollback planner phase constants and metadata", () => {
      expect(RECRUITMENT_WORKFLOW_ROLLBACK_PLANNER_PHASE).toBe(136);
      expect(RECRUITMENT_WORKFLOW_ROLLBACK_PLANNER_ENTITY).toBe(
        "recruitment_workflow_rollback_planner"
      );
      expect(RECRUITMENT_WORKFLOW_ROLLBACK_PLANNER_METADATA.rollbackPlannerOnly).toBe(true);
      expect(RECRUITMENT_WORKFLOW_ROLLBACK_PLANNER_METADATA.executesRollback).toBe(false);
    });

    test("governance compliance validator phase constants and metadata", () => {
      expect(RECRUITMENT_WORKFLOW_GOVERNANCE_COMPLIANCE_VALIDATOR_PHASE).toBe(136);
      expect(RECRUITMENT_WORKFLOW_GOVERNANCE_COMPLIANCE_VALIDATOR_ENTITY).toBe(
        "recruitment_workflow_governance_compliance_validator"
      );
      expect(
        RECRUITMENT_WORKFLOW_GOVERNANCE_COMPLIANCE_VALIDATOR_METADATA.governanceComplianceOnly
      ).toBe(true);
      expect(
        RECRUITMENT_WORKFLOW_GOVERNANCE_COMPLIANCE_VALIDATOR_METADATA.autoCorrectionEnabled
      ).toBe(false);
    });

    test("governance summary phase constants and metadata", () => {
      expect(RECRUITMENT_WORKFLOW_INTEGRATION_GOVERNANCE_SUMMARY_PHASE).toBe(136);
      expect(RECRUITMENT_WORKFLOW_INTEGRATION_GOVERNANCE_SUMMARY_ENTITY).toBe(
        "recruitment_workflow_integration_governance_summary"
      );
      expect(RECRUITMENT_WORKFLOW_INTEGRATION_GOVERNANCE_SUMMARY_METADATA.governanceSummaryOnly).toBe(
        true
      );
      expect(RECRUITMENT_WORKFLOW_INTEGRATION_GOVERNANCE_SUMMARY_METADATA.runtimeIntegration).toBe(
        false
      );
    });
  });

  describe("governance policy — rules and posture", () => {
    test("defines 10 governance policy rules across categories", () => {
      expect(GOVERNANCE_POLICY_DEFINITIONS).toHaveLength(10);
      expect(GOVERNANCE_POLICY_DEFINITIONS[0].id).toBe(
        GOVERNANCE_POLICY_IDS.CONTROLLED_INTEGRATION_ONLY
      );
      expect(GOVERNANCE_POLICY_DEFINITIONS[0].category).toBe(POLICY_CATEGORY.INTEGRATION_BOUNDARY);
    });

    test("returns unknown posture for empty input", () => {
      const result = createRecruitmentWorkflowIntegrationGovernancePolicy(null);

      expect(result.governancePosture).toBe(GOVERNANCE_POSTURE.UNKNOWN);
      expect(result.unknownCount).toBe(10);
      expect(result.enforcedCount).toBe(0);
      expect(result.governancePolicySummary).toContain("awaits advisory prerequisite signals");
    });

    test("reports compliant posture when all prerequisites are satisfied", () => {
      const result = createRecruitmentWorkflowIntegrationGovernancePolicy(
        buildReadyForGovernanceInput()
      );

      expect(result.governancePosture).toBe(GOVERNANCE_POSTURE.COMPLIANT);
      expect(result.enforcedCount).toBe(10);
      expect(result.waivedCount).toBe(0);
      expect(result.governancePolicySummary).toContain("compliant");
    });

    test("reports non-compliant posture for blocked integration signals", () => {
      const result = createRecruitmentWorkflowIntegrationGovernancePolicy(
        buildBlockedGovernanceInput()
      );

      expect(result.governancePosture).toBe(GOVERNANCE_POSTURE.NON_COMPLIANT);
      expect(result.waivedCount).toBeGreaterThan(0);
      expect(result.governancePolicySummary).toContain("non-compliant");
    });

    test("reports review required when governance review is incomplete", () => {
      const result = createRecruitmentWorkflowIntegrationGovernancePolicy(
        buildReadyForGovernanceInput({
          governanceReview: { complete: false },
          rollbackPlanDocumented: false
        })
      );

      expect(result.governancePosture).toBe(GOVERNANCE_POSTURE.REVIEW_REQUIRED);
      expect(result.unknownCount).toBeGreaterThan(0);
    });

    test("enforces consistency before gate policy when consistent", () => {
      const result = createRecruitmentWorkflowIntegrationGovernancePolicy(
        buildReadyForGovernanceInput()
      );

      const consistencyPolicy = result.policyEvaluations.find(
        (item) => item.id === GOVERNANCE_POLICY_IDS.CONSISTENCY_BEFORE_GATE
      );

      expect(consistencyPolicy.status).toBe(GOVERNANCE_POLICY_STATUS.ENFORCED);
    });

    test("waives readiness gate policy when not ready", () => {
      const result = createRecruitmentWorkflowIntegrationGovernancePolicy(
        buildBlockedGovernanceInput()
      );

      const readinessPolicy = result.policyEvaluations.find(
        (item) => item.id === GOVERNANCE_POLICY_IDS.READINESS_GATE_SATISFIED
      );

      expect(readinessPolicy.status).toBe(GOVERNANCE_POLICY_STATUS.WAIVED);
    });

    test("always enforces no production mutation policy", () => {
      const result = createRecruitmentWorkflowIntegrationGovernancePolicy(
        buildPartialGovernanceInput()
      );

      const mutationPolicy = result.policyEvaluations.find(
        (item) => item.id === GOVERNANCE_POLICY_IDS.NO_PRODUCTION_MUTATION
      );

      expect(mutationPolicy.status).toBe(GOVERNANCE_POLICY_STATUS.ENFORCED);
    });

    test("enforces phase dependency order when foundational phases satisfied", () => {
      const result = createRecruitmentWorkflowIntegrationGovernancePolicy(
        buildPartialGovernanceInput()
      );

      const dependencyPolicy = result.policyEvaluations.find(
        (item) => item.id === GOVERNANCE_POLICY_IDS.PHASE_DEPENDENCY_ORDER
      );

      expect(dependencyPolicy.status).toBe(GOVERNANCE_POLICY_STATUS.ENFORCED);
    });

    test("waives health risk thresholds when critical risk present", () => {
      const result = createRecruitmentWorkflowIntegrationGovernancePolicy(
        buildBlockedGovernanceInput()
      );

      const healthPolicy = result.policyEvaluations.find(
        (item) => item.id === GOVERNANCE_POLICY_IDS.HEALTH_RISK_THRESHOLDS
      );

      expect(healthPolicy.status).toBe(GOVERNANCE_POLICY_STATUS.WAIVED);
    });

    test("covers all policy categories in definitions", () => {
      const categories = new Set(GOVERNANCE_POLICY_DEFINITIONS.map((item) => item.category));

      expect(categories.has(POLICY_CATEGORY.READINESS)).toBe(true);
      expect(categories.has(POLICY_CATEGORY.CONSISTENCY)).toBe(true);
      expect(categories.has(POLICY_CATEGORY.SAFETY)).toBe(true);
      expect(categories.has(POLICY_CATEGORY.ROLLBACK)).toBe(true);
      expect(categories.has(POLICY_CATEGORY.INTEGRATION_BOUNDARY)).toBe(true);
    });

    test("enforces rollback plan documented when flag is set", () => {
      const result = createRecruitmentWorkflowIntegrationGovernancePolicy(
        buildReadyForGovernanceInput({ rollbackPlanDocumented: true })
      );

      const rollbackPolicy = result.policyEvaluations.find(
        (item) => item.id === GOVERNANCE_POLICY_IDS.ROLLBACK_PLAN_DOCUMENTED
      );

      expect(rollbackPolicy.status).toBe(GOVERNANCE_POLICY_STATUS.ENFORCED);
    });

    test("advisory metadata confirms governance policy is not executed", () => {
      const result = createRecruitmentWorkflowIntegrationGovernancePolicy(
        buildReadyForGovernanceInput()
      );

      expect(result.advisoryMetadata.executed).toBe(false);
      expect(result.advisoryMetadata.governancePolicyOnly).toBe(true);
    });
  });

  describe("decision matrix — dimension evaluation", () => {
    test("defines 5 evaluation dimensions", () => {
      expect(MATRIX_DIMENSION_DEFINITIONS).toHaveLength(5);
      expect(MATRIX_DIMENSION_DEFINITIONS.map((row) => row.dimension)).toEqual([
        MATRIX_DIMENSION.READINESS,
        MATRIX_DIMENSION.CONSISTENCY,
        MATRIX_DIMENSION.RECOMMENDATION,
        MATRIX_DIMENSION.HEALTH,
        MATRIX_DIMENSION.RISK
      ]);
    });

    test("returns unknown matrix posture without signals", () => {
      const result = createRecruitmentWorkflowIntegrationDecisionMatrix(undefined);

      expect(result.matrixPosture).toBe(MATRIX_POSTURE.UNKNOWN);
      expect(result.unknownCount).toBe(5);
      expect(result.matrixSummary).toContain("awaits advisory prerequisite signals");
    });

    test("evaluates readiness dimension as favorable when ready", () => {
      const result = createRecruitmentWorkflowIntegrationDecisionMatrix(
        buildReadyForGovernanceInput()
      );

      const readinessRow = result.matrixRows.find(
        (row) => row.dimension === MATRIX_DIMENSION.READINESS
      );

      expect(readinessRow.evaluationStatus).toBe(MATRIX_EVALUATION_STATUS.FAVORABLE);
      expect(readinessRow.signalValue).toBe("READY_FOR_CONTROLLED_INTEGRATION");
    });

    test("evaluates consistency dimension as unfavorable when inconsistent", () => {
      const result = createRecruitmentWorkflowIntegrationDecisionMatrix(
        buildBlockedGovernanceInput()
      );

      const consistencyRow = result.matrixRows.find(
        (row) => row.dimension === MATRIX_DIMENSION.CONSISTENCY
      );

      expect(consistencyRow.evaluationStatus).toBe(MATRIX_EVALUATION_STATUS.UNFAVORABLE);
    });

    test("evaluates recommendation dimension as neutral for review required", () => {
      const result = createRecruitmentWorkflowIntegrationDecisionMatrix(
        buildPartialGovernanceInput()
      );

      const recommendationRow = result.matrixRows.find(
        (row) => row.dimension === MATRIX_DIMENSION.RECOMMENDATION
      );

      expect(recommendationRow.evaluationStatus).toBe(MATRIX_EVALUATION_STATUS.NEUTRAL);
    });

    test("evaluates health dimension as favorable when healthy", () => {
      const result = createRecruitmentWorkflowIntegrationDecisionMatrix(
        buildReadyForGovernanceInput()
      );

      const healthRow = result.matrixRows.find((row) => row.dimension === MATRIX_DIMENSION.HEALTH);

      expect(healthRow.evaluationStatus).toBe(MATRIX_EVALUATION_STATUS.FAVORABLE);
    });

    test("evaluates risk dimension as unfavorable when critical", () => {
      const result = createRecruitmentWorkflowIntegrationDecisionMatrix(
        buildBlockedGovernanceInput()
      );

      const riskRow = result.matrixRows.find((row) => row.dimension === MATRIX_DIMENSION.RISK);

      expect(riskRow.evaluationStatus).toBe(MATRIX_EVALUATION_STATUS.UNFAVORABLE);
    });

    test("reports proceed advisory when all dimensions favorable", () => {
      const result = createRecruitmentWorkflowIntegrationDecisionMatrix(
        buildReadyForGovernanceInput()
      );

      expect(result.matrixPosture).toBe(MATRIX_POSTURE.PROCEED_ADVISORY);
      expect(result.favorableCount).toBe(5);
      expect(result.matrixSummary).toContain("favorable across all");
    });

    test("reports blocked advisory when any dimension unfavorable", () => {
      const result = createRecruitmentWorkflowIntegrationDecisionMatrix(
        buildBlockedGovernanceInput()
      );

      expect(result.matrixPosture).toBe(MATRIX_POSTURE.BLOCKED_ADVISORY);
      expect(result.unfavorableCount).toBeGreaterThan(0);
      expect(result.matrixSummary).toContain("blocked");
    });

    test("reports review required for partial integration signals", () => {
      const result = createRecruitmentWorkflowIntegrationDecisionMatrix(
        buildPartialGovernanceInput()
      );

      expect(result.matrixPosture).toBe(MATRIX_POSTURE.REVIEW_REQUIRED);
      expect(result.neutralCount).toBeGreaterThan(0);
    });

    test("evaluates risk dimension as neutral for medium risk", () => {
      const result = createRecruitmentWorkflowIntegrationDecisionMatrix(
        buildPartialGovernanceInput()
      );

      const riskRow = result.matrixRows.find((row) => row.dimension === MATRIX_DIMENSION.RISK);

      expect(riskRow.evaluationStatus).toBe(MATRIX_EVALUATION_STATUS.NEUTRAL);
      expect(riskRow.signalValue).toBe("MEDIUM");
    });

    test("evaluates readiness dimension as neutral for partial readiness", () => {
      const result = createRecruitmentWorkflowIntegrationDecisionMatrix(
        buildPartialGovernanceInput()
      );

      const readinessRow = result.matrixRows.find(
        (row) => row.dimension === MATRIX_DIMENSION.READINESS
      );

      expect(readinessRow.evaluationStatus).toBe(MATRIX_EVALUATION_STATUS.NEUTRAL);
    });

    test("advisory metadata confirms decision matrix is not executed", () => {
      const result = createRecruitmentWorkflowIntegrationDecisionMatrix(
        buildReadyForGovernanceInput()
      );

      expect(result.advisoryMetadata.executed).toBe(false);
      expect(result.advisoryMetadata.decisionMatrixOnly).toBe(true);
    });
  });

  describe("rollback planner — advisory rollback stages", () => {
    test("defines 13 advisory rollback stages in reverse integration order", () => {
      expect(ROLLBACK_STAGE_DEFINITIONS).toHaveLength(13);
      expect(ROLLBACK_STAGE_DEFINITIONS[0].id).toBe(
        ROLLBACK_STAGE_IDS.DEACTIVATE_ACTIVATION_PLANNING
      );
      expect(ROLLBACK_STAGE_DEFINITIONS[12].id).toBe(
        ROLLBACK_STAGE_IDS.DOCUMENT_ROLLBACK_COMPLETION
      );
    });

    test("returns unknown rollback posture without signals", () => {
      const result = createRecruitmentWorkflowRollbackPlan(null);

      expect(result.rollbackPosture).toBe(ROLLBACK_POSTURE.UNKNOWN);
      expect(result.rollbackStages).toHaveLength(13);
      expect(
        result.rollbackStages.every((stage) => stage.status === ROLLBACK_STAGE_STATUS.UNKNOWN)
      ).toBe(true);
    });

    test("reports no rollback needed when integration is ready and not requested", () => {
      const result = createRecruitmentWorkflowRollbackPlan(buildReadyForGovernanceInput());

      expect(result.rollbackPosture).toBe(ROLLBACK_POSTURE.NO_ROLLBACK_NEEDED);
      expect(result.recommendedCount).toBe(0);
      expect(result.rollbackSummary).toContain("no rollback");
    });

    test("recommends rollback stages when rollback is requested", () => {
      const result = createRecruitmentWorkflowRollbackPlan(
        buildReadyForGovernanceInput({
          rollbackTrigger: { requested: true }
        })
      );

      expect(result.recommendedCount).toBeGreaterThan(0);
      expect(result.recommendedStages.length).toBeGreaterThan(0);
      expect(result.rollbackSummary).toContain("rollback");
    });

    test("recommends full rollback advisory for critical failure", () => {
      const result = createRecruitmentWorkflowRollbackPlan(buildBlockedGovernanceInput());

      expect(result.rollbackPosture).toBe(ROLLBACK_POSTURE.FULL_ROLLBACK_ADVISORY);
      expect(result.recommendedCount).toBeGreaterThanOrEqual(10);
    });

    test("includes document rollback completion as final stage", () => {
      const result = createRecruitmentWorkflowRollbackPlan(buildBlockedGovernanceInput());

      const finalStage = result.rollbackStages.find(
        (stage) => stage.id === ROLLBACK_STAGE_IDS.DOCUMENT_ROLLBACK_COMPLETION
      );

      expect(finalStage).toBeDefined();
      expect(finalStage.status).toBe(ROLLBACK_STAGE_STATUS.RECOMMENDED);
    });

    test("rollback stages maintain prerequisite ordering", () => {
      const result = createRecruitmentWorkflowRollbackPlan(buildBlockedGovernanceInput());

      const gateStage = result.rollbackStages.find(
        (stage) => stage.id === ROLLBACK_STAGE_IDS.REVERT_CONTROLLED_INTEGRATION_GATE
      );

      expect(gateStage.prerequisiteStageIds).toContain(
        ROLLBACK_STAGE_IDS.DEACTIVATE_ACTIVATION_PLANNING
      );
    });

    test("reports partial rollback for partially activated modules", () => {
      const result = createRecruitmentWorkflowRollbackPlan(
        buildPartialGovernanceInput({
          rollbackTrigger: { requested: true }
        })
      );

      expect(result.rollbackPosture).toBe(ROLLBACK_POSTURE.PARTIAL_ROLLBACK_ADVISORY);
      expect(result.recommendedCount).toBeGreaterThan(0);
      expect(result.recommendedCount).toBeLessThan(13);
    });

    test("does not execute rollback — advisory metadata confirms", () => {
      const result = createRecruitmentWorkflowRollbackPlan(buildBlockedGovernanceInput());

      expect(result.advisoryMetadata.executed).toBe(false);
      expect(result.advisoryMetadata.executesRollback).toBe(false);
    });

    test("first rollback stage targets activation planning phase 135", () => {
      const result = createRecruitmentWorkflowRollbackPlan(buildBlockedGovernanceInput());

      const firstStage = result.rollbackStages[0];

      expect(firstStage.modulePhases).toContain(135);
      expect(firstStage.order).toBe(1);
    });

    test("blocked integration without rollback trigger reports not recommended stages", () => {
      const result = createRecruitmentWorkflowRollbackPlan(
        buildBlockedGovernanceInput({
          rollbackTrigger: undefined,
          intelligenceSummary: {
            currentState: {
              health: "AT_RISK",
              risk: "HIGH"
            }
          }
        })
      );

      expect(result.rollbackPosture).toBe(ROLLBACK_POSTURE.NO_ROLLBACK_NEEDED);
      expect(result.notRecommendedCount).toBe(13);
    });

    test("partial integration without rollback request yields review posture", () => {
      const result = createRecruitmentWorkflowRollbackPlan(buildPartialGovernanceInput());

      expect(result.recommendedCount).toBe(0);
      expect(result.rollbackPosture).toBe(ROLLBACK_POSTURE.REVIEW_REQUIRED);
      expect(result.unknownCount).toBeGreaterThan(0);
    });
  });

  describe("governance compliance validator — policy compliance", () => {
    test("defines 8 governance compliance rules", () => {
      expect(COMPLIANCE_RULE_DEFINITIONS).toHaveLength(8);
      expect(COMPLIANCE_RULE_DEFINITIONS[0].id).toBe(COMPLIANCE_RULE_IDS.POLICY_POSTURE_COMPLIANT);
    });

    test("returns unknown compliance status without signals", () => {
      const result = validateRecruitmentWorkflowGovernanceCompliance({});

      expect(result.complianceStatus).toBe(COMPLIANCE_STATUS.UNKNOWN);
      expect(result.unknownCount).toBe(8);
      expect(result.complianceSummary).toContain("awaits advisory prerequisite signals");
    });

    test("reports compliant when all governance outputs are favorable", () => {
      const baseInput = buildReadyForGovernanceInput();
      const governancePolicy = createRecruitmentWorkflowIntegrationGovernancePolicy(baseInput);
      const decisionMatrix = createRecruitmentWorkflowIntegrationDecisionMatrix(baseInput);
      const rollbackPlan = createRecruitmentWorkflowRollbackPlan(baseInput);

      const result = validateRecruitmentWorkflowGovernanceCompliance({
        governancePolicy,
        decisionMatrix,
        rollbackPlan,
        integrationReadiness: baseInput.integrationReadiness,
        consistencyValidation: baseInput.consistencyValidation,
        intelligenceSummary: baseInput.intelligenceSummary,
        governanceReview: baseInput.governanceReview
      });

      expect(result.complianceStatus).toBe(COMPLIANCE_STATUS.COMPLIANT);
      expect(result.satisfiedCount).toBe(8);
      expect(result.complianceSummary).toContain("verified");
    });

    test("reports non-compliant when policy posture is non-compliant", () => {
      const baseInput = buildBlockedGovernanceInput();
      const governancePolicy = createRecruitmentWorkflowIntegrationGovernancePolicy(baseInput);
      const decisionMatrix = createRecruitmentWorkflowIntegrationDecisionMatrix(baseInput);
      const rollbackPlan = createRecruitmentWorkflowRollbackPlan(baseInput);

      const result = validateRecruitmentWorkflowGovernanceCompliance({
        governancePolicy,
        decisionMatrix,
        rollbackPlan,
        integrationReadiness: baseInput.integrationReadiness,
        consistencyValidation: baseInput.consistencyValidation,
        intelligenceSummary: baseInput.intelligenceSummary
      });

      expect(result.complianceStatus).toBe(COMPLIANCE_STATUS.NON_COMPLIANT);
      expect(result.violatedCount).toBeGreaterThan(0);
      expect(result.complianceSummary).toContain("violated");
    });

    test("flags critical risk as compliance violation", () => {
      const result = validateRecruitmentWorkflowGovernanceCompliance({
        intelligenceSummary: {
          currentState: { risk: "CRITICAL" }
        },
        governancePolicy: { governancePosture: GOVERNANCE_POSTURE.REVIEW_REQUIRED },
        decisionMatrix: { matrixPosture: MATRIX_POSTURE.REVIEW_REQUIRED },
        rollbackPlan: { rollbackPosture: ROLLBACK_POSTURE.REVIEW_REQUIRED, recommendedCount: 1 }
      });

      const riskRule = result.complianceRules.find(
        (rule) => rule.id === COMPLIANCE_RULE_IDS.NO_CRITICAL_RISK
      );

      expect(riskRule.status).toBe(COMPLIANCE_RULE_STATUS.VIOLATED);
    });

    test("satisfies advisory only boundary rule unconditionally", () => {
      const result = validateRecruitmentWorkflowGovernanceCompliance({
        governancePolicy: { governancePosture: GOVERNANCE_POSTURE.UNKNOWN }
      });

      const boundaryRule = result.complianceRules.find(
        (rule) => rule.id === COMPLIANCE_RULE_IDS.ADVISORY_ONLY_BOUNDARY
      );

      expect(boundaryRule.status).toBe(COMPLIANCE_RULE_STATUS.SATISFIED);
    });

    test("flags blocked decision matrix as compliance violation", () => {
      const result = validateRecruitmentWorkflowGovernanceCompliance({
        decisionMatrix: { matrixPosture: MATRIX_POSTURE.BLOCKED_ADVISORY },
        governancePolicy: { governancePosture: GOVERNANCE_POSTURE.REVIEW_REQUIRED },
        rollbackPlan: { rollbackPosture: ROLLBACK_POSTURE.NO_ROLLBACK_NEEDED, recommendedCount: 0 },
        intelligenceSummary: { currentState: { risk: "LOW" } }
      });

      const matrixRule = result.complianceRules.find(
        (rule) => rule.id === COMPLIANCE_RULE_IDS.DECISION_MATRIX_FAVORABLE
      );

      expect(matrixRule.status).toBe(COMPLIANCE_RULE_STATUS.VIOLATED);
    });

    test("requires governance review documented for full compliance", () => {
      const result = validateRecruitmentWorkflowGovernanceCompliance({
        governancePolicy: { governancePosture: GOVERNANCE_POSTURE.COMPLIANT },
        decisionMatrix: { matrixPosture: MATRIX_POSTURE.PROCEED_ADVISORY },
        rollbackPlan: { rollbackPosture: ROLLBACK_POSTURE.NO_ROLLBACK_NEEDED, recommendedCount: 0 },
        integrationReadiness: { integrationStatus: "READY_FOR_CONTROLLED_INTEGRATION" },
        consistencyValidation: { consistencyStatus: "CONSISTENT" },
        intelligenceSummary: { currentState: { risk: "LOW" } }
      });

      const reviewRule = result.complianceRules.find(
        (rule) => rule.id === COMPLIANCE_RULE_IDS.GOVERNANCE_REVIEW_DOCUMENTED
      );

      expect(reviewRule.status).toBe(COMPLIANCE_RULE_STATUS.UNKNOWN);
      expect(result.complianceStatus).toBe(COMPLIANCE_STATUS.REVIEW_REQUIRED);
    });

    test("satisfies readiness gate rule when integration is ready", () => {
      const result = validateRecruitmentWorkflowGovernanceCompliance({
        governancePolicy: { governancePosture: GOVERNANCE_POSTURE.COMPLIANT },
        decisionMatrix: { matrixPosture: MATRIX_POSTURE.PROCEED_ADVISORY },
        rollbackPlan: { rollbackPosture: ROLLBACK_POSTURE.NO_ROLLBACK_NEEDED, recommendedCount: 0 },
        integrationReadiness: { integrationStatus: "READY_FOR_CONTROLLED_INTEGRATION" },
        consistencyValidation: { consistencyStatus: "CONSISTENT" },
        intelligenceSummary: { currentState: { risk: "LOW" } },
        governanceReview: { documented: true }
      });

      const readinessRule = result.complianceRules.find(
        (rule) => rule.id === COMPLIANCE_RULE_IDS.READINESS_GATE_ENFORCED
      );

      expect(readinessRule.status).toBe(COMPLIANCE_RULE_STATUS.SATISFIED);
    });

    test("violates consistency rule when inconsistent", () => {
      const result = validateRecruitmentWorkflowGovernanceCompliance({
        governancePolicy: { governancePosture: GOVERNANCE_POSTURE.REVIEW_REQUIRED },
        decisionMatrix: { matrixPosture: MATRIX_POSTURE.REVIEW_REQUIRED },
        rollbackPlan: { rollbackPosture: ROLLBACK_POSTURE.NO_ROLLBACK_NEEDED, recommendedCount: 0 },
        consistencyValidation: { consistencyStatus: "INCONSISTENT" },
        intelligenceSummary: { currentState: { risk: "LOW" } }
      });

      const consistencyRule = result.complianceRules.find(
        (rule) => rule.id === COMPLIANCE_RULE_IDS.CONSISTENCY_ENFORCED
      );

      expect(consistencyRule.status).toBe(COMPLIANCE_RULE_STATUS.VIOLATED);
    });

    test("advisory metadata confirms no auto-correction", () => {
      const result = validateRecruitmentWorkflowGovernanceCompliance({
        governancePolicy: { governancePosture: GOVERNANCE_POSTURE.COMPLIANT }
      });

      expect(result.advisoryMetadata.autoCorrectionEnabled).toBe(false);
      expect(result.advisoryMetadata.executed).toBe(false);
    });
  });

  describe("governance summary — aggregation", () => {
    test("returns unknown summary posture without governance outputs", () => {
      const result = createRecruitmentWorkflowIntegrationGovernanceSummary(null);

      expect(result.governanceSummaryPosture).toBe(GOVERNANCE_SUMMARY_POSTURE.UNKNOWN);
      expect(result.aggregatedComponents).toHaveLength(4);
      expect(result.governanceSummary).toContain("could not be determined");
    });

    test("aggregates all four governance components", () => {
      const outputs = buildFullGovernanceSuiteOutputs(buildReadyForGovernanceInput());
      const result = outputs.governanceSummary;

      expect(result.aggregatedComponents).toHaveLength(4);
      expect(result.aggregatedComponents.map((item) => item.component)).toEqual([
        AGGREGATED_COMPONENT.GOVERNANCE_POLICY,
        AGGREGATED_COMPONENT.DECISION_MATRIX,
        AGGREGATED_COMPONENT.ROLLBACK_PLAN,
        AGGREGATED_COMPONENT.COMPLIANCE_VALIDATION
      ]);
    });

    test("reports ready for governance review when all outputs favorable", () => {
      const outputs = buildFullGovernanceSuiteOutputs(buildReadyForGovernanceInput());

      expect(outputs.governanceSummary.governanceSummaryPosture).toBe(
        GOVERNANCE_SUMMARY_POSTURE.READY_FOR_GOVERNANCE_REVIEW
      );
      expect(outputs.governanceSummary.governanceSummary).toContain("ready for controlled governance");
    });

    test("reports blocked governance for non-compliant signals", () => {
      const baseInput = buildBlockedGovernanceInput();
      const governancePolicy = createRecruitmentWorkflowIntegrationGovernancePolicy(baseInput);
      const decisionMatrix = createRecruitmentWorkflowIntegrationDecisionMatrix(baseInput);
      const rollbackPlan = createRecruitmentWorkflowRollbackPlan(baseInput);
      const complianceValidation = validateRecruitmentWorkflowGovernanceCompliance({
        governancePolicy,
        decisionMatrix,
        rollbackPlan,
        integrationReadiness: baseInput.integrationReadiness,
        consistencyValidation: baseInput.consistencyValidation,
        intelligenceSummary: baseInput.intelligenceSummary
      });

      const result = createRecruitmentWorkflowIntegrationGovernanceSummary({
        governancePolicy,
        decisionMatrix,
        rollbackPlan,
        complianceValidation
      });

      expect(result.governanceSummaryPosture).toBe(GOVERNANCE_SUMMARY_POSTURE.BLOCKED_GOVERNANCE);
      expect(result.governanceSummary).toContain("blocked");
    });

    test("includes key governance signals in summary", () => {
      const outputs = buildFullGovernanceSuiteOutputs(buildReadyForGovernanceInput());

      expect(outputs.governanceSummary.keyGovernanceSignals).toContain(
        "Governance policy compliant"
      );
      expect(outputs.governanceSummary.keyGovernanceSignals).toContain("Decision matrix favorable");
      expect(outputs.governanceSummary.keyGovernanceSignals).toContain(
        "Governance compliance verified"
      );
    });

    test("includes recommended governance focus", () => {
      const outputs = buildFullGovernanceSuiteOutputs(buildReadyForGovernanceInput());

      expect(outputs.governanceSummary.recommendedGovernanceFocus).toContain(
        "Proceed with controlled integration governance review"
      );
    });

    test("resolves recruitment id when provided", () => {
      const outputs = buildFullGovernanceSuiteOutputs(buildReadyForGovernanceInput());

      expect(outputs.governanceSummary.recruitmentId).toBe("42");
    });

    test("provides governance overview with all postures", () => {
      const outputs = buildFullGovernanceSuiteOutputs(buildReadyForGovernanceInput());

      expect(outputs.governanceSummary.governanceOverview).toEqual(
        expect.objectContaining({
          policyPosture: GOVERNANCE_POSTURE.COMPLIANT,
          matrixPosture: MATRIX_POSTURE.PROCEED_ADVISORY,
          rollbackPosture: ROLLBACK_POSTURE.NO_ROLLBACK_NEEDED,
          complianceStatus: COMPLIANCE_STATUS.COMPLIANT
        })
      );
    });

    test("reports review required for partial governance outputs", () => {
      const baseInput = buildPartialGovernanceInput();
      const governancePolicy = createRecruitmentWorkflowIntegrationGovernancePolicy(baseInput);
      const decisionMatrix = createRecruitmentWorkflowIntegrationDecisionMatrix(baseInput);
      const rollbackPlan = createRecruitmentWorkflowRollbackPlan(baseInput);
      const complianceValidation = validateRecruitmentWorkflowGovernanceCompliance({
        governancePolicy,
        decisionMatrix,
        rollbackPlan,
        integrationReadiness: baseInput.integrationReadiness,
        consistencyValidation: baseInput.consistencyValidation,
        intelligenceSummary: baseInput.intelligenceSummary
      });

      const result = createRecruitmentWorkflowIntegrationGovernanceSummary({
        governancePolicy,
        decisionMatrix,
        rollbackPlan,
        complianceValidation
      });

      expect(result.governanceSummaryPosture).toBe(GOVERNANCE_SUMMARY_POSTURE.REVIEW_REQUIRED);
    });

    test("aggregated components include metric counts from source outputs", () => {
      const outputs = buildFullGovernanceSuiteOutputs(buildReadyForGovernanceInput());
      const policyComponent = outputs.governanceSummary.aggregatedComponents.find(
        (item) => item.component === AGGREGATED_COMPONENT.GOVERNANCE_POLICY
      );

      expect(policyComponent.metricCount).toBe(10);
      expect(policyComponent.posture).toBe(GOVERNANCE_POSTURE.COMPLIANT);
    });

    test("signals advisory rollback when rollback plan recommends stages", () => {
      const baseInput = buildBlockedGovernanceInput();
      const governancePolicy = createRecruitmentWorkflowIntegrationGovernancePolicy(baseInput);
      const decisionMatrix = createRecruitmentWorkflowIntegrationDecisionMatrix(baseInput);
      const rollbackPlan = createRecruitmentWorkflowRollbackPlan(baseInput);
      const complianceValidation = validateRecruitmentWorkflowGovernanceCompliance({
        governancePolicy,
        decisionMatrix,
        rollbackPlan,
        integrationReadiness: baseInput.integrationReadiness,
        consistencyValidation: baseInput.consistencyValidation,
        intelligenceSummary: baseInput.intelligenceSummary
      });

      const result = createRecruitmentWorkflowIntegrationGovernanceSummary({
        governancePolicy,
        decisionMatrix,
        rollbackPlan,
        complianceValidation
      });

      expect(result.keyGovernanceSignals).toContain("Advisory rollback stages recommended");
    });

    test("advisory metadata confirms governance summary is not executed", () => {
      const outputs = buildFullGovernanceSuiteOutputs(buildReadyForGovernanceInput());

      expect(outputs.governanceSummary.advisoryMetadata.executed).toBe(false);
      expect(outputs.governanceSummary.advisoryMetadata.governanceSummaryOnly).toBe(true);
    });
  });

  describe("governance suite integration — advisory composition", () => {
    test("all five libraries produce coherent advisory output from shared input", () => {
      const input = buildReadyForGovernanceInput();
      const outputs = buildFullGovernanceSuiteOutputs(input);

      expect(outputs.governancePolicy.advisoryMetadata.phase).toBe(136);
      expect(outputs.decisionMatrix.advisoryMetadata.phase).toBe(136);
      expect(outputs.rollbackPlan.advisoryMetadata.phase).toBe(136);
      expect(outputs.complianceValidation.advisoryMetadata.phase).toBe(136);
      expect(outputs.governanceSummary.advisoryMetadata.phase).toBe(136);

      expect(outputs.governancePolicy.governancePosture).toBe(GOVERNANCE_POSTURE.COMPLIANT);
      expect(outputs.decisionMatrix.matrixPosture).toBe(MATRIX_POSTURE.PROCEED_ADVISORY);
      expect(outputs.rollbackPlan.rollbackPosture).toBe(ROLLBACK_POSTURE.NO_ROLLBACK_NEEDED);
      expect(outputs.complianceValidation.complianceStatus).toBe(COMPLIANCE_STATUS.COMPLIANT);
    });

    test("governance summary reflects blocked suite outputs consistently", () => {
      const input = buildBlockedGovernanceInput();
      const governancePolicy = createRecruitmentWorkflowIntegrationGovernancePolicy(input);
      const decisionMatrix = createRecruitmentWorkflowIntegrationDecisionMatrix(input);
      const rollbackPlan = createRecruitmentWorkflowRollbackPlan(input);
      const complianceValidation = validateRecruitmentWorkflowGovernanceCompliance({
        governancePolicy,
        decisionMatrix,
        rollbackPlan,
        integrationReadiness: input.integrationReadiness,
        consistencyValidation: input.consistencyValidation,
        intelligenceSummary: input.intelligenceSummary
      });
      const governanceSummary = createRecruitmentWorkflowIntegrationGovernanceSummary({
        governancePolicy,
        decisionMatrix,
        rollbackPlan,
        complianceValidation
      });

      expect(governancePolicy.governancePosture).toBe(GOVERNANCE_POSTURE.NON_COMPLIANT);
      expect(decisionMatrix.matrixPosture).toBe(MATRIX_POSTURE.BLOCKED_ADVISORY);
      expect(rollbackPlan.rollbackPosture).toBe(ROLLBACK_POSTURE.FULL_ROLLBACK_ADVISORY);
      expect(complianceValidation.complianceStatus).toBe(COMPLIANCE_STATUS.NON_COMPLIANT);
      expect(governanceSummary.governanceSummaryPosture).toBe(
        GOVERNANCE_SUMMARY_POSTURE.BLOCKED_GOVERNANCE
      );
    });
  });

  describe("isolation", () => {
    test("phase 136 modules do not import each other or other recruitment modules", () => {
      for (let i = 0; i < PHASE_136_MODULE_PATHS.length; i += 1) {
        const source = read(PHASE_136_MODULE_PATHS[i]);

        expect(source).toContain("Phase 136");
        expect(source).not.toMatch(/require\(["']\./);
        expect(source).not.toMatch(/require\(["']fs["']\)/);
        expect(source).not.toMatch(/require\(["']express/);
        expect(source).not.toMatch(/require\(["']\.\.\/config\/db/);
        expect(source).not.toMatch(/mysql2/);
      }
    });

    test("phase 136 modules are not referenced by prior phase production modules", () => {
      const productionSources = [
        read(ROLLOUT_PLANNER_MODULE_PATH),
        read(ACTIVATION_MATRIX_MODULE_PATH),
        read(SAFETY_CHECKLIST_MODULE_PATH),
        read(ACTIVATION_STRATEGY_MODULE_PATH),
        read(CONSISTENCY_MODULE_PATH),
        read(READINESS_FRAMEWORK_MODULE_PATH),
        read(ORCHESTRATOR_MODULE_PATH),
        read(COORDINATOR_MODULE_PATH),
        read(GATEWAY_MODULE_PATH),
        read(PIPELINE_MODULE_PATH),
        read(WORKER_MODULE_PATH)
      ];

      for (let i = 0; i < productionSources.length; i += 1) {
        for (let j = 0; j < PHASE_136_EXPORT_PATTERNS.length; j += 1) {
          expect(productionSources[i]).not.toMatch(PHASE_136_EXPORT_PATTERNS[j]);
        }
      }
    });
  });

  describe("deterministic output", () => {
    test("returns identical governance policy for identical input", () => {
      const input = buildReadyForGovernanceInput();
      const first = createRecruitmentWorkflowIntegrationGovernancePolicy(input);
      const second = createRecruitmentWorkflowIntegrationGovernancePolicy(input);

      expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    });

    test("returns identical decision matrix for identical input", () => {
      const input = buildPartialGovernanceInput();
      const first = createRecruitmentWorkflowIntegrationDecisionMatrix(input);
      const second = createRecruitmentWorkflowIntegrationDecisionMatrix(input);

      expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    });

    test("returns identical rollback plan for identical input", () => {
      const input = buildBlockedGovernanceInput();
      const first = createRecruitmentWorkflowRollbackPlan(input);
      const second = createRecruitmentWorkflowRollbackPlan(input);

      expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    });

    test("returns identical compliance validation for identical input", () => {
      const input = {
        governancePolicy: { governancePosture: GOVERNANCE_POSTURE.COMPLIANT },
        decisionMatrix: { matrixPosture: MATRIX_POSTURE.PROCEED_ADVISORY },
        rollbackPlan: { rollbackPosture: ROLLBACK_POSTURE.NO_ROLLBACK_NEEDED, recommendedCount: 0 },
        integrationReadiness: { integrationStatus: "READY_FOR_CONTROLLED_INTEGRATION" },
        consistencyValidation: { consistencyStatus: "CONSISTENT" },
        intelligenceSummary: { currentState: { risk: "LOW" } },
        governanceReview: { documented: true }
      };
      const first = validateRecruitmentWorkflowGovernanceCompliance(input);
      const second = validateRecruitmentWorkflowGovernanceCompliance(input);

      expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    });

    test("returns identical governance summary for identical input", () => {
      const outputs = buildFullGovernanceSuiteOutputs(buildReadyForGovernanceInput());
      const summaryInput = {
        recruitmentId: 42,
        governancePolicy: outputs.governancePolicy,
        decisionMatrix: outputs.decisionMatrix,
        rollbackPlan: outputs.rollbackPlan,
        complianceValidation: outputs.complianceValidation
      };
      const first = createRecruitmentWorkflowIntegrationGovernanceSummary(summaryInput);
      const second = createRecruitmentWorkflowIntegrationGovernanceSummary(summaryInput);

      expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    });
  });

  describe("immutability", () => {
    test("deep freezes governance policy output", () => {
      const result = createRecruitmentWorkflowIntegrationGovernancePolicy(
        buildPartialGovernanceInput()
      );

      assertAllFrozen(result);
      expect(() => {
        result.governancePolicySummary = "CHANGED";
      }).toThrow();
      expect(() => {
        result.policyEvaluations.push({});
      }).toThrow();
    });

    test("deep freezes decision matrix output", () => {
      const result = createRecruitmentWorkflowIntegrationDecisionMatrix(
        buildPartialGovernanceInput()
      );

      assertAllFrozen(result);
      expect(() => {
        result.matrixRows[0].evaluationStatus = "CHANGED";
      }).toThrow();
    });

    test("deep freezes rollback planner output", () => {
      const result = createRecruitmentWorkflowRollbackPlan(buildBlockedGovernanceInput());

      assertAllFrozen(result);
      expect(() => {
        result.rollbackStages[0].status = "CHANGED";
      }).toThrow();
    });

    test("deep freezes compliance validator output", () => {
      const result = validateRecruitmentWorkflowGovernanceCompliance({
        governancePolicy: { governancePosture: GOVERNANCE_POSTURE.COMPLIANT }
      });

      assertAllFrozen(result);
      expect(() => {
        result.complianceRules[0].status = "CHANGED";
      }).toThrow();
    });

    test("deep freezes governance summary output", () => {
      const outputs = buildFullGovernanceSuiteOutputs(buildReadyForGovernanceInput());

      assertAllFrozen(outputs.governanceSummary);
      expect(() => {
        outputs.governanceSummary.governanceSummary = "CHANGED";
      }).toThrow();
      expect(() => {
        outputs.governanceSummary.keyGovernanceSignals.push("CHANGED");
      }).toThrow();
    });

    test("does not mutate shared governance suite input", () => {
      const input = buildReadyForGovernanceInput();
      const before = JSON.stringify(input);

      createRecruitmentWorkflowIntegrationGovernancePolicy(input);
      createRecruitmentWorkflowIntegrationDecisionMatrix(input);
      createRecruitmentWorkflowRollbackPlan(input);
      validateRecruitmentWorkflowGovernanceCompliance({ governancePolicy: { governancePosture: "COMPLIANT" } });
      createRecruitmentWorkflowIntegrationGovernanceSummary({
        governancePolicy: { governancePosture: "COMPLIANT" }
      });

      expect(JSON.stringify(input)).toBe(before);
    });

    test("governance suite does not mutate process environment", () => {
      const envBefore = { ...process.env };
      buildFullGovernanceSuiteOutputs(buildReadyForGovernanceInput());
      expect(process.env).toEqual(envBefore);
    });
  });

  describe("no persistence", () => {
    test("phase 136 module sources declare no persistence or integration storage", () => {
      for (let i = 0; i < PHASE_136_MODULE_PATHS.length; i += 1) {
        const source = read(PHASE_136_MODULE_PATHS[i]);

        expect(source).toContain("no persistence");
        expect(source).toContain("integrationPersistence: false");
        expect(source).toContain("historyTracking: false");
        expect(source).not.toMatch(/INSERT INTO/i);
        expect(source).not.toMatch(/UPDATE\s+/i);
        expect(source).not.toMatch(/saveIntegration/i);
        expect(source).not.toMatch(/persistIntegration/i);
      }
    });
  });

  describe("no runtime wiring", () => {
    test("phase 136 modules declare pure advisory governance constraints", () => {
      for (let i = 0; i < PHASE_136_MODULE_PATHS.length; i += 1) {
        const source = read(PHASE_136_MODULE_PATHS[i]);

        expect(source).toContain("Advisory Only");
        expect(source).toContain("Never mutates input");
        expect(source).toContain("No automation");
        expect(source).toContain("advisoryOnly: true");
        expect(source).toContain("executed: false");
      }
    });

    test("orchestrator behavior remains unchanged and independent from phase 136 governance suite", () => {
      const orchestration = orchestrateRecruitmentWorkflow({
        recruitmentId: 42,
        eventType: "notification"
      });

      expect(orchestration.workflowState).toBe(RECRUITMENT_WORKFLOW_STATES.DRAFT_CREATED);
      expect(orchestration.advisory).toBe(true);
      expect(orchestration.executed).toBe(false);
      expect(orchestration).not.toHaveProperty("governancePosture");
      expect(orchestration).not.toHaveProperty("matrixRows");
      expect(orchestration).not.toHaveProperty("rollbackStages");
      expect(orchestration).not.toHaveProperty("complianceRules");
      expect(orchestration).not.toHaveProperty("governanceSummary");
    });
  });

  describe("no production imports", () => {
    test("phase 136 libraries have no runtime require statements", () => {
      for (let i = 0; i < PHASE_136_MODULE_PATHS.length; i += 1) {
        const source = read(PHASE_136_MODULE_PATHS[i]);
        expect(source).not.toMatch(/require\(/);
      }
    });
  });
});
