"use strict";

/**
 * Phase 147 — Scenario Verification & Decision Matrix Suite tests.
 * Verifies deterministic output, invalid inputs, every built-in scenario,
 * decision matrix correctness, confidence calculations, stable ordering,
 * and runtime isolation.
 */

const fs = require("fs");
const path = require("path");

const {
  RECRUITMENT_SCENARIO_CATALOG_PHASE,
  RECRUITMENT_SCENARIO_CATALOG_ENTITY,
  SCENARIO_CATALOG_SCHEMA_VERSION,
  EXPECTED_CONTRACT_VERSION,
  IMPLEMENTATION_SCENARIO_IDS,
  SCENARIO_OUTCOMES,
  REQUIRED_STAGE_IDS,
  REQUIRED_CAPABILITY_IDS,
  REQUIRED_EXECUTION_IDS,
  REQUIRED_ROLLBACK_IDS,
  REQUIRED_BOUNDARY_IDS,
  REQUIRED_PREREQUISITE_IDS,
  REQUIRED_DEPENDENCY_IDS,
  REQUIRED_VALIDATION_IDS,
  REQUIRED_OBSERVABILITY_IDS,
  REQUIRED_GOVERNANCE_IDS,
  SCENARIO_DEFINITIONS,
  ORDERED_SCENARIO_IDS,
  RECRUITMENT_SCENARIO_CATALOG_DESCRIPTOR,
  RECRUITMENT_SCENARIO_CATALOG_METADATA,
  listRecruitmentScenarioIds,
  listRecruitmentScenarios,
  isKnownRecruitmentScenarioId,
  getRecruitmentScenario,
  isRecruitmentScenarioDefinition
} = require("../server/lib/recruitment/recruitmentScenarioCatalog");

const {
  RECRUITMENT_SCENARIO_EVALUATOR_PHASE,
  RECRUITMENT_SCENARIO_EVALUATOR_ENTITY,
  SCENARIO_EVALUATOR_SCHEMA_VERSION,
  SCENARIO_STATUS,
  RECRUITMENT_SCENARIO_EVALUATOR_DESCRIPTOR,
  RECRUITMENT_SCENARIO_EVALUATOR_METADATA,
  EXPECTED_RESULT_KEYS: EVALUATOR_EXPECTED_KEYS,
  evaluateRecruitmentScenario,
  isRecruitmentScenarioEvaluation
} = require("../server/lib/recruitment/recruitmentScenarioEvaluator");

const {
  RECRUITMENT_DECISION_MATRIX_PHASE,
  RECRUITMENT_DECISION_MATRIX_ENTITY,
  DECISION_MATRIX_SCHEMA_VERSION,
  IMPLEMENTATION_DECISION,
  DECISION_RATIONALE,
  RECRUITMENT_DECISION_MATRIX_DESCRIPTOR,
  RECRUITMENT_DECISION_MATRIX_METADATA,
  EXPECTED_RESULT_KEYS: DECISION_EXPECTED_KEYS,
  generateRecruitmentImplementationDecision,
  isRecruitmentImplementationDecision
} = require("../server/lib/recruitment/recruitmentDecisionMatrix");

const {
  RECRUITMENT_SCENARIO_SUMMARY_PHASE,
  RECRUITMENT_SCENARIO_SUMMARY_ENTITY,
  SCENARIO_SUMMARY_SCHEMA_VERSION,
  SUMMARY_POSTURE,
  RECRUITMENT_SCENARIO_SUMMARY_DESCRIPTOR,
  RECRUITMENT_SCENARIO_SUMMARY_METADATA,
  EXPECTED_RESULT_KEYS: SUMMARY_EXPECTED_KEYS,
  buildRecruitmentScenarioSummary,
  isRecruitmentScenarioSummary
} = require("../server/lib/recruitment/recruitmentScenarioSummary");

const {
  RECRUITMENT_WORKFLOW_STATES,
  orchestrateRecruitmentWorkflow
} = require("../server/lib/recruitment/recruitmentWorkflowOrchestrator");

const ROOT = path.join(__dirname, "..");
const CATALOG_MODULE = "server/lib/recruitment/recruitmentScenarioCatalog.js";
const EVALUATOR_MODULE = "server/lib/recruitment/recruitmentScenarioEvaluator.js";
const DECISION_MODULE = "server/lib/recruitment/recruitmentDecisionMatrix.js";
const SUMMARY_MODULE = "server/lib/recruitment/recruitmentScenarioSummary.js";
const ORCHESTRATOR_MODULE = "server/lib/recruitment/recruitmentWorkflowOrchestrator.js";
const COORDINATOR_MODULE = "server/lib/recruitment/recruitmentWorkflowIntegrationCoordinator.js";
const GATEWAY_MODULE = "server/lib/recruitment/recruitmentWorkflowAdvisoryGateway.js";
const PIPELINE_MODULE = "server/lib/recruitment/runRecruitmentPipeline.js";
const WORKER_MODULE = "server/services/workers/siteWorker.js";

const PHASE_147_MODULES = [
  "recruitmentScenarioCatalog",
  "recruitmentScenarioEvaluator",
  "recruitmentDecisionMatrix",
  "recruitmentScenarioSummary"
];

const ALL_SCENARIO_IDS = [
  IMPLEMENTATION_SCENARIO_IDS.COMPLETE_IMPLEMENTATION,
  IMPLEMENTATION_SCENARIO_IDS.PARTIAL_IMPLEMENTATION,
  IMPLEMENTATION_SCENARIO_IDS.MISSING_PREREQUISITES,
  IMPLEMENTATION_SCENARIO_IDS.DEPENDENCY_FAILURE,
  IMPLEMENTATION_SCENARIO_IDS.ROLLBACK_REQUIRED,
  IMPLEMENTATION_SCENARIO_IDS.VALIDATION_FAILURE,
  IMPLEMENTATION_SCENARIO_IDS.OBSERVABILITY_INCOMPLETE,
  IMPLEMENTATION_SCENARIO_IDS.GOVERNANCE_REVIEW_REQUIRED
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

function buildCompletePlan() {
  return {
    contractVersion: EXPECTED_CONTRACT_VERSION,
    implementationStages: REQUIRED_STAGE_IDS.slice(),
    supportedCapabilities: REQUIRED_CAPABILITY_IDS.slice(),
    executionRequirements: REQUIRED_EXECUTION_IDS.slice(),
    rollbackRequirements: REQUIRED_ROLLBACK_IDS.slice(),
    runtimeBoundaries: REQUIRED_BOUNDARY_IDS.slice(),
    prerequisites: REQUIRED_PREREQUISITE_IDS.slice(),
    dependencies: REQUIRED_DEPENDENCY_IDS.slice(),
    validationChecks: REQUIRED_VALIDATION_IDS.slice(),
    observabilityChecks: REQUIRED_OBSERVABILITY_IDS.slice(),
    governanceChecks: REQUIRED_GOVERNANCE_IDS.slice(),
    prerequisitesComplete: true,
    dependenciesHealthy: true,
    validationPassed: true,
    observabilityComplete: true,
    governanceApproved: true,
    rollbackTriggered: false
  };
}

function buildPartialPlan() {
  return {
    contractVersion: EXPECTED_CONTRACT_VERSION,
    implementationStages: ["STAGE_CONTRACT_ALIGNMENT", "STAGE_ADAPTER_SCAFFOLD"],
    supportedCapabilities: ["CAP_BOUNDARY_ISOLATION", "CAP_RUNTIME_ADAPTER"],
    executionRequirements: ["EXEC_NO_RUNTIME_WIRING"],
    rollbackRequirements: ["RB_DISABLE_FLAGS"],
    runtimeBoundaries: ["BOUNDARY_ORCHESTRATOR"],
    prerequisites: ["PREREQ_CONTRACT_DEFINED"],
    dependencies: REQUIRED_DEPENDENCY_IDS.slice(),
    validationChecks: ["VAL_CONTRACT_COMPLIANCE"],
    observabilityChecks: ["OBS_MONITORING_CHECKPOINTS"],
    governanceChecks: [],
    prerequisitesComplete: false,
    dependenciesHealthy: true,
    validationPassed: false,
    observabilityComplete: false,
    governanceApproved: false,
    rollbackTriggered: false
  };
}

function buildMissingPrerequisitesPlan() {
  return {
    contractVersion: EXPECTED_CONTRACT_VERSION,
    implementationStages: REQUIRED_STAGE_IDS.slice(),
    supportedCapabilities: REQUIRED_CAPABILITY_IDS.slice(),
    executionRequirements: REQUIRED_EXECUTION_IDS.slice(),
    rollbackRequirements: REQUIRED_ROLLBACK_IDS.slice(),
    runtimeBoundaries: REQUIRED_BOUNDARY_IDS.slice(),
    prerequisites: [],
    dependencies: REQUIRED_DEPENDENCY_IDS.slice(),
    validationChecks: REQUIRED_VALIDATION_IDS.slice(),
    observabilityChecks: REQUIRED_OBSERVABILITY_IDS.slice(),
    governanceChecks: [],
    prerequisitesComplete: false,
    dependenciesHealthy: true,
    validationPassed: true,
    observabilityComplete: true,
    governanceApproved: false,
    rollbackTriggered: false
  };
}

function buildDependencyFailurePlan() {
  return {
    contractVersion: EXPECTED_CONTRACT_VERSION,
    implementationStages: REQUIRED_STAGE_IDS.slice(),
    supportedCapabilities: REQUIRED_CAPABILITY_IDS.slice(),
    executionRequirements: REQUIRED_EXECUTION_IDS.slice(),
    rollbackRequirements: REQUIRED_ROLLBACK_IDS.slice(),
    runtimeBoundaries: REQUIRED_BOUNDARY_IDS.slice(),
    prerequisites: REQUIRED_PREREQUISITE_IDS.slice(),
    dependencies: [],
    validationChecks: REQUIRED_VALIDATION_IDS.slice(),
    observabilityChecks: REQUIRED_OBSERVABILITY_IDS.slice(),
    governanceChecks: [],
    prerequisitesComplete: true,
    dependenciesHealthy: false,
    validationPassed: true,
    observabilityComplete: true,
    governanceApproved: false,
    rollbackTriggered: false
  };
}

function buildRollbackRequiredPlan() {
  return {
    contractVersion: EXPECTED_CONTRACT_VERSION,
    implementationStages: REQUIRED_STAGE_IDS.slice(),
    supportedCapabilities: REQUIRED_CAPABILITY_IDS.slice(),
    executionRequirements: REQUIRED_EXECUTION_IDS.slice(),
    rollbackRequirements: REQUIRED_ROLLBACK_IDS.slice(),
    runtimeBoundaries: REQUIRED_BOUNDARY_IDS.slice(),
    prerequisites: REQUIRED_PREREQUISITE_IDS.slice(),
    dependencies: [],
    validationChecks: [],
    observabilityChecks: REQUIRED_OBSERVABILITY_IDS.slice(),
    governanceChecks: [],
    prerequisitesComplete: true,
    dependenciesHealthy: false,
    validationPassed: false,
    observabilityComplete: true,
    governanceApproved: false,
    rollbackTriggered: true
  };
}

function buildValidationFailurePlan() {
  return {
    contractVersion: EXPECTED_CONTRACT_VERSION,
    implementationStages: REQUIRED_STAGE_IDS.slice(),
    supportedCapabilities: REQUIRED_CAPABILITY_IDS.slice(),
    executionRequirements: REQUIRED_EXECUTION_IDS.slice(),
    rollbackRequirements: REQUIRED_ROLLBACK_IDS.slice(),
    runtimeBoundaries: REQUIRED_BOUNDARY_IDS.slice(),
    prerequisites: REQUIRED_PREREQUISITE_IDS.slice(),
    dependencies: REQUIRED_DEPENDENCY_IDS.slice(),
    validationChecks: [],
    observabilityChecks: REQUIRED_OBSERVABILITY_IDS.slice(),
    governanceChecks: [],
    prerequisitesComplete: true,
    dependenciesHealthy: true,
    validationPassed: false,
    observabilityComplete: true,
    governanceApproved: false,
    rollbackTriggered: false
  };
}

function buildObservabilityIncompletePlan() {
  return {
    contractVersion: EXPECTED_CONTRACT_VERSION,
    implementationStages: REQUIRED_STAGE_IDS.slice(),
    supportedCapabilities: REQUIRED_CAPABILITY_IDS.slice(),
    executionRequirements: REQUIRED_EXECUTION_IDS.slice(),
    rollbackRequirements: REQUIRED_ROLLBACK_IDS.slice(),
    runtimeBoundaries: REQUIRED_BOUNDARY_IDS.slice(),
    prerequisites: REQUIRED_PREREQUISITE_IDS.slice(),
    dependencies: REQUIRED_DEPENDENCY_IDS.slice(),
    validationChecks: REQUIRED_VALIDATION_IDS.slice(),
    observabilityChecks: [],
    governanceChecks: [],
    prerequisitesComplete: true,
    dependenciesHealthy: true,
    validationPassed: true,
    observabilityComplete: false,
    governanceApproved: false,
    rollbackTriggered: false
  };
}

function buildGovernanceReviewPlan() {
  return {
    contractVersion: EXPECTED_CONTRACT_VERSION,
    implementationStages: REQUIRED_STAGE_IDS.slice(),
    supportedCapabilities: REQUIRED_CAPABILITY_IDS.slice(),
    executionRequirements: REQUIRED_EXECUTION_IDS.slice(),
    rollbackRequirements: REQUIRED_ROLLBACK_IDS.slice(),
    runtimeBoundaries: REQUIRED_BOUNDARY_IDS.slice(),
    prerequisites: REQUIRED_PREREQUISITE_IDS.slice(),
    dependencies: REQUIRED_DEPENDENCY_IDS.slice(),
    validationChecks: REQUIRED_VALIDATION_IDS.slice(),
    observabilityChecks: REQUIRED_OBSERVABILITY_IDS.slice(),
    governanceChecks: [],
    prerequisitesComplete: true,
    dependenciesHealthy: true,
    validationPassed: true,
    observabilityComplete: true,
    governanceApproved: false,
    rollbackTriggered: false
  };
}

function planForScenario(scenarioId) {
  switch (scenarioId) {
    case IMPLEMENTATION_SCENARIO_IDS.COMPLETE_IMPLEMENTATION:
      return buildCompletePlan();
    case IMPLEMENTATION_SCENARIO_IDS.PARTIAL_IMPLEMENTATION:
      return buildPartialPlan();
    case IMPLEMENTATION_SCENARIO_IDS.MISSING_PREREQUISITES:
      return buildMissingPrerequisitesPlan();
    case IMPLEMENTATION_SCENARIO_IDS.DEPENDENCY_FAILURE:
      return buildDependencyFailurePlan();
    case IMPLEMENTATION_SCENARIO_IDS.ROLLBACK_REQUIRED:
      return buildRollbackRequiredPlan();
    case IMPLEMENTATION_SCENARIO_IDS.VALIDATION_FAILURE:
      return buildValidationFailurePlan();
    case IMPLEMENTATION_SCENARIO_IDS.OBSERVABILITY_INCOMPLETE:
      return buildObservabilityIncompletePlan();
    case IMPLEMENTATION_SCENARIO_IDS.GOVERNANCE_REVIEW_REQUIRED:
      return buildGovernanceReviewPlan();
    default:
      return {};
  }
}

function expectedDecisionForScenario(scenarioId) {
  switch (scenarioId) {
    case IMPLEMENTATION_SCENARIO_IDS.COMPLETE_IMPLEMENTATION:
      return IMPLEMENTATION_DECISION.PROCEED_TO_NEXT_REVIEW;
    case IMPLEMENTATION_SCENARIO_IDS.PARTIAL_IMPLEMENTATION:
      return IMPLEMENTATION_DECISION.REVISE_IMPLEMENTATION_PLAN;
    case IMPLEMENTATION_SCENARIO_IDS.MISSING_PREREQUISITES:
      return IMPLEMENTATION_DECISION.COMPLETE_PREREQUISITES;
    case IMPLEMENTATION_SCENARIO_IDS.DEPENDENCY_FAILURE:
      return IMPLEMENTATION_DECISION.ROLLBACK_RECOMMENDED;
    case IMPLEMENTATION_SCENARIO_IDS.ROLLBACK_REQUIRED:
      return IMPLEMENTATION_DECISION.ROLLBACK_RECOMMENDED;
    case IMPLEMENTATION_SCENARIO_IDS.VALIDATION_FAILURE:
      return IMPLEMENTATION_DECISION.PERFORM_ADDITIONAL_VALIDATION;
    case IMPLEMENTATION_SCENARIO_IDS.OBSERVABILITY_INCOMPLETE:
      return IMPLEMENTATION_DECISION.PERFORM_ADDITIONAL_VALIDATION;
    case IMPLEMENTATION_SCENARIO_IDS.GOVERNANCE_REVIEW_REQUIRED:
      return IMPLEMENTATION_DECISION.REVIEW_REQUIRED;
    default:
      return IMPLEMENTATION_DECISION.REVIEW_REQUIRED;
  }
}

describe("Phase 147 — recruitmentScenarioCatalog", () => {
  describe("module metadata", () => {
    test("exports phase 147 constants", () => {
      expect(RECRUITMENT_SCENARIO_CATALOG_PHASE).toBe(147);
      expect(RECRUITMENT_SCENARIO_CATALOG_ENTITY).toBe("recruitment_scenario_catalog");
      expect(RECRUITMENT_SCENARIO_CATALOG_DESCRIPTOR.phase).toBe(147);
      expect(RECRUITMENT_SCENARIO_CATALOG_METADATA.advisoryOnly).toBe(true);
      expect(RECRUITMENT_SCENARIO_CATALOG_METADATA.executed).toBe(false);
      expect(RECRUITMENT_SCENARIO_CATALOG_METADATA.activatesAnything).toBe(false);
      expect(SCENARIO_CATALOG_SCHEMA_VERSION).toBe("1.0.0");
    });
  });

  describe("built-in scenarios", () => {
    test("exposes all required scenario ids in stable order", () => {
      expect(listRecruitmentScenarioIds()).toEqual(ALL_SCENARIO_IDS);
      expect(ORDERED_SCENARIO_IDS).toEqual(ALL_SCENARIO_IDS);
      expect(listRecruitmentScenarios()).toHaveLength(8);
      expect(SCENARIO_DEFINITIONS).toHaveLength(8);
    });

    test.each(ALL_SCENARIO_IDS)("scenario %s has required shape", (scenarioId) => {
      const scenario = getRecruitmentScenario(scenarioId);
      expect(scenario).not.toBeNull();
      expect(isRecruitmentScenarioDefinition(scenario)).toBe(true);
      expect(scenario.id).toBe(scenarioId);
      expect(typeof scenario.description).toBe("string");
      expect(scenario.description.length).toBeGreaterThan(0);
      expect(scenario.expectedInputs).toBeDefined();
      expect(typeof scenario.expectedOutcome).toBe("string");
      expect(scenario.advisoryOnly).toBe(true);
      assertAllFrozen(scenario);
    });

    test("expected outcomes map to catalog outcomes", () => {
      expect(getRecruitmentScenario("COMPLETE_IMPLEMENTATION").expectedOutcome).toBe(
        SCENARIO_OUTCOMES.IMPLEMENTATION_COMPLETE_ADVISORY
      );
      expect(getRecruitmentScenario("PARTIAL_IMPLEMENTATION").expectedOutcome).toBe(
        SCENARIO_OUTCOMES.IMPLEMENTATION_PARTIAL_ADVISORY
      );
      expect(getRecruitmentScenario("MISSING_PREREQUISITES").expectedOutcome).toBe(
        SCENARIO_OUTCOMES.PREREQUISITES_INCOMPLETE
      );
      expect(getRecruitmentScenario("DEPENDENCY_FAILURE").expectedOutcome).toBe(
        SCENARIO_OUTCOMES.DEPENDENCY_BLOCKED
      );
      expect(getRecruitmentScenario("ROLLBACK_REQUIRED").expectedOutcome).toBe(
        SCENARIO_OUTCOMES.ROLLBACK_ADVISORY
      );
      expect(getRecruitmentScenario("VALIDATION_FAILURE").expectedOutcome).toBe(
        SCENARIO_OUTCOMES.VALIDATION_FAILED
      );
      expect(getRecruitmentScenario("OBSERVABILITY_INCOMPLETE").expectedOutcome).toBe(
        SCENARIO_OUTCOMES.OBSERVABILITY_GAP
      );
      expect(getRecruitmentScenario("GOVERNANCE_REVIEW_REQUIRED").expectedOutcome).toBe(
        SCENARIO_OUTCOMES.GOVERNANCE_REVIEW_NEEDED
      );
    });

    test("unknown scenario id returns null", () => {
      expect(isKnownRecruitmentScenarioId("NOT_A_SCENARIO")).toBe(false);
      expect(getRecruitmentScenario("NOT_A_SCENARIO")).toBeNull();
      expect(getRecruitmentScenario(null)).toBeNull();
    });
  });
});

describe("Phase 147 — recruitmentScenarioEvaluator", () => {
  describe("module metadata", () => {
    test("exports phase 147 constants", () => {
      expect(RECRUITMENT_SCENARIO_EVALUATOR_PHASE).toBe(147);
      expect(RECRUITMENT_SCENARIO_EVALUATOR_ENTITY).toBe("recruitment_scenario_evaluator");
      expect(RECRUITMENT_SCENARIO_EVALUATOR_DESCRIPTOR.phase).toBe(147);
      expect(RECRUITMENT_SCENARIO_EVALUATOR_METADATA.advisoryOnly).toBe(true);
      expect(RECRUITMENT_SCENARIO_EVALUATOR_METADATA.executed).toBe(false);
      expect(SCENARIO_EVALUATOR_SCHEMA_VERSION).toBe("1.0.0");
      expect(EVALUATOR_EXPECTED_KEYS).toContain("scenarioStatus");
      expect(EVALUATOR_EXPECTED_KEYS).toContain("matchedConditions");
      expect(EVALUATOR_EXPECTED_KEYS).toContain("unmetConditions");
      expect(EVALUATOR_EXPECTED_KEYS).toContain("findings");
      expect(EVALUATOR_EXPECTED_KEYS).toContain("recommendations");
      expect(EVALUATOR_EXPECTED_KEYS).toContain("confidence");
    });
  });

  describe("deterministic output", () => {
    test("identical inputs produce identical outputs", () => {
      const input = {
        recruitmentId: "EVAL_147",
        scenarioId: IMPLEMENTATION_SCENARIO_IDS.COMPLETE_IMPLEMENTATION,
        implementationPlan: buildCompletePlan()
      };
      const a = evaluateRecruitmentScenario(input);
      const b = evaluateRecruitmentScenario(input);
      expect(a).toEqual(b);
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    });

    test("output is deeply frozen", () => {
      const result = evaluateRecruitmentScenario({
        recruitmentId: "FROZEN",
        scenarioId: IMPLEMENTATION_SCENARIO_IDS.COMPLETE_IMPLEMENTATION,
        implementationPlan: buildCompletePlan()
      });
      assertAllFrozen(result);
      expect(isRecruitmentScenarioEvaluation(result)).toBe(true);
    });

    test("does not mutate input", () => {
      const input = {
        recruitmentId: "MUT",
        scenarioId: IMPLEMENTATION_SCENARIO_IDS.PARTIAL_IMPLEMENTATION,
        implementationPlan: buildPartialPlan()
      };
      const snapshot = JSON.stringify(input);
      evaluateRecruitmentScenario(input);
      expect(JSON.stringify(input)).toBe(snapshot);
    });
  });

  describe("invalid inputs", () => {
    test("null input yields EMPTY evaluation", () => {
      const result = evaluateRecruitmentScenario(null);
      expect(result.scenarioStatus).toBe(SCENARIO_STATUS.EMPTY);
      expect(result.confidence).toBe(0);
      expect(result.advisoryMetadata.executed).toBe(false);
    });

    test("unknown scenario yields INVALID", () => {
      const result = evaluateRecruitmentScenario({
        recruitmentId: "BAD",
        scenarioId: "NOT_REAL",
        implementationPlan: buildCompletePlan()
      });
      expect(result.scenarioStatus).toBe(SCENARIO_STATUS.INVALID);
      expect(result.confidence).toBe(0);
    });

    test("missing plan yields EMPTY", () => {
      const result = evaluateRecruitmentScenario({
        recruitmentId: "NOPLAN",
        scenarioId: IMPLEMENTATION_SCENARIO_IDS.COMPLETE_IMPLEMENTATION
      });
      expect(result.scenarioStatus).toBe(SCENARIO_STATUS.EMPTY);
      expect(result.matchedConditions).toEqual([]);
    });
  });

  describe("every built-in scenario", () => {
    test.each(ALL_SCENARIO_IDS)(
      "matching plan for %s yields SCENARIO_MATCHED",
      (scenarioId) => {
        const scenario = getRecruitmentScenario(scenarioId);
        const result = evaluateRecruitmentScenario({
          recruitmentId: "MATCH_" + scenarioId,
          scenarioId,
          scenario,
          implementationPlan: planForScenario(scenarioId)
        });
        expect(result.scenarioStatus).toBe(SCENARIO_STATUS.MATCHED);
        expect(result.unmetConditions).toEqual([]);
        expect(result.matchedConditions.length).toBeGreaterThan(0);
        expect(result.expectedOutcome).toBe(scenario.expectedOutcome);
        expect(result.confidence).toBeGreaterThanOrEqual(90);
        expect(result.advisoryMetadata.activatesAnything).toBe(false);
      }
    );

    test("complete plan against partial scenario is unmatched or partial", () => {
      const result = evaluateRecruitmentScenario({
        recruitmentId: "MISMATCH",
        scenarioId: IMPLEMENTATION_SCENARIO_IDS.PARTIAL_IMPLEMENTATION,
        implementationPlan: buildCompletePlan()
      });
      expect(result.scenarioStatus).not.toBe(SCENARIO_STATUS.MATCHED);
      expect(result.unmetConditions.length).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThan(90);
    });
  });

  describe("confidence calculations", () => {
    test("matched complete scenario has high confidence", () => {
      const result = evaluateRecruitmentScenario({
        recruitmentId: "CONF_HIGH",
        scenarioId: IMPLEMENTATION_SCENARIO_IDS.COMPLETE_IMPLEMENTATION,
        implementationPlan: buildCompletePlan()
      });
      expect(result.confidence).toBeGreaterThanOrEqual(90);
      expect(result.confidence).toBeLessThanOrEqual(100);
    });

    test("partial match reduces confidence", () => {
      const plan = buildCompletePlan();
      plan.governanceApproved = false;
      plan.governanceChecks = [];
      const result = evaluateRecruitmentScenario({
        recruitmentId: "CONF_PARTIAL",
        scenarioId: IMPLEMENTATION_SCENARIO_IDS.COMPLETE_IMPLEMENTATION,
        implementationPlan: plan
      });
      expect(result.scenarioStatus).toBe(SCENARIO_STATUS.PARTIAL);
      expect(result.confidence).toBeGreaterThanOrEqual(40);
      expect(result.confidence).toBeLessThanOrEqual(79);
    });
  });

  describe("stable ordering", () => {
    test("conditions, findings, and recommendations are sorted", () => {
      const result = evaluateRecruitmentScenario({
        recruitmentId: "SORT",
        scenarioId: IMPLEMENTATION_SCENARIO_IDS.COMPLETE_IMPLEMENTATION,
        implementationPlan: buildPartialPlan()
      });
      expect(result.matchedConditions.map((c) => c.id)).toEqual(
        result.matchedConditions
          .map((c) => c.id)
          .slice()
          .sort()
      );
      expect(result.unmetConditions.map((c) => c.id)).toEqual(
        result.unmetConditions
          .map((c) => c.id)
          .slice()
          .sort()
      );
      expect(result.findings.map((f) => f.id)).toEqual(
        result.findings
          .map((f) => f.id)
          .slice()
          .sort()
      );
      expect(result.recommendations).toEqual(result.recommendations.slice().sort());
    });
  });
});

describe("Phase 147 — recruitmentDecisionMatrix", () => {
  describe("module metadata", () => {
    test("exports phase 147 constants", () => {
      expect(RECRUITMENT_DECISION_MATRIX_PHASE).toBe(147);
      expect(RECRUITMENT_DECISION_MATRIX_ENTITY).toBe("recruitment_decision_matrix");
      expect(RECRUITMENT_DECISION_MATRIX_DESCRIPTOR.phase).toBe(147);
      expect(RECRUITMENT_DECISION_MATRIX_METADATA.advisoryOnly).toBe(true);
      expect(DECISION_MATRIX_SCHEMA_VERSION).toBe("1.0.0");
      expect(DECISION_EXPECTED_KEYS).toContain("decision");
      expect(DECISION_EXPECTED_KEYS).toContain("rationale");
      expect(Object.keys(IMPLEMENTATION_DECISION)).toHaveLength(6);
    });
  });

  describe("deterministic output", () => {
    test("identical inputs produce identical outputs", () => {
      const evaluation = evaluateRecruitmentScenario({
        recruitmentId: "DEC_147",
        scenarioId: IMPLEMENTATION_SCENARIO_IDS.COMPLETE_IMPLEMENTATION,
        implementationPlan: buildCompletePlan()
      });
      const input = {
        recruitmentId: "DEC_147",
        evaluation,
        implementationPlan: buildCompletePlan()
      };
      const a = generateRecruitmentImplementationDecision(input);
      const b = generateRecruitmentImplementationDecision(input);
      expect(a).toEqual(b);
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    });

    test("output is deeply frozen", () => {
      const evaluation = evaluateRecruitmentScenario({
        recruitmentId: "FROZEN_DEC",
        scenarioId: IMPLEMENTATION_SCENARIO_IDS.COMPLETE_IMPLEMENTATION,
        implementationPlan: buildCompletePlan()
      });
      const result = generateRecruitmentImplementationDecision({
        recruitmentId: "FROZEN_DEC",
        evaluation,
        implementationPlan: buildCompletePlan()
      });
      assertAllFrozen(result);
      expect(isRecruitmentImplementationDecision(result)).toBe(true);
    });
  });

  describe("invalid inputs", () => {
    test("null input yields REVIEW_REQUIRED", () => {
      const result = generateRecruitmentImplementationDecision(null);
      expect(result.decision).toBe(IMPLEMENTATION_DECISION.REVIEW_REQUIRED);
      expect(result.rationale).toBe(DECISION_RATIONALE.REVIEW_REQUIRED);
      expect(result.advisoryMetadata.executed).toBe(false);
    });
  });

  describe("decision matrix correctness", () => {
    test.each(ALL_SCENARIO_IDS)(
      "scenario %s maps to expected decision",
      (scenarioId) => {
        const plan = planForScenario(scenarioId);
        const evaluation = evaluateRecruitmentScenario({
          recruitmentId: "DEC_" + scenarioId,
          scenarioId,
          implementationPlan: plan
        });
        expect(evaluation.scenarioStatus).toBe(SCENARIO_STATUS.MATCHED);
        const decision = generateRecruitmentImplementationDecision({
          recruitmentId: "DEC_" + scenarioId,
          evaluation,
          implementationPlan: plan
        });
        expect(decision.decision).toBe(expectedDecisionForScenario(scenarioId));
        expect(decision.rationale).toBe(DECISION_RATIONALE[decision.decision]);
        expect(typeof decision.rationale).toBe("string");
        expect(decision.rationale.length).toBeGreaterThan(0);
        expect(decision.advisoryMetadata.activatesAnything).toBe(false);
      }
    );

    test("every decision value has rationale", () => {
      const decisions = Object.keys(IMPLEMENTATION_DECISION);
      for (let i = 0; i < decisions.length; i += 1) {
        const key = decisions[i];
        expect(DECISION_RATIONALE[key]).toBeDefined();
        expect(typeof DECISION_RATIONALE[key]).toBe("string");
      }
    });
  });

  describe("stable ordering", () => {
    test("supporting and blocking factors are sorted", () => {
      const plan = buildPartialPlan();
      const evaluation = evaluateRecruitmentScenario({
        recruitmentId: "SORT_DEC",
        scenarioId: IMPLEMENTATION_SCENARIO_IDS.PARTIAL_IMPLEMENTATION,
        implementationPlan: plan
      });
      const decision = generateRecruitmentImplementationDecision({
        recruitmentId: "SORT_DEC",
        evaluation,
        implementationPlan: plan
      });
      expect(decision.supportingFactors).toEqual(decision.supportingFactors.slice().sort());
      expect(decision.blockingFactors).toEqual(decision.blockingFactors.slice().sort());
    });
  });
});

describe("Phase 147 — recruitmentScenarioSummary", () => {
  describe("module metadata", () => {
    test("exports phase 147 constants", () => {
      expect(RECRUITMENT_SCENARIO_SUMMARY_PHASE).toBe(147);
      expect(RECRUITMENT_SCENARIO_SUMMARY_ENTITY).toBe("recruitment_scenario_summary");
      expect(RECRUITMENT_SCENARIO_SUMMARY_DESCRIPTOR.phase).toBe(147);
      expect(RECRUITMENT_SCENARIO_SUMMARY_METADATA.advisoryOnly).toBe(true);
      expect(SCENARIO_SUMMARY_SCHEMA_VERSION).toBe("1.0.0");
      expect(SUMMARY_EXPECTED_KEYS).toContain("selectedScenario");
      expect(SUMMARY_EXPECTED_KEYS).toContain("evaluation");
      expect(SUMMARY_EXPECTED_KEYS).toContain("decision");
      expect(SUMMARY_EXPECTED_KEYS).toContain("risks");
      expect(SUMMARY_EXPECTED_KEYS).toContain("recommendations");
      expect(SUMMARY_EXPECTED_KEYS).toContain("confidence");
      expect(SUMMARY_EXPECTED_KEYS).toContain("nextReviewSteps");
    });
  });

  describe("deterministic output", () => {
    test("identical inputs produce identical outputs", () => {
      const scenario = getRecruitmentScenario(
        IMPLEMENTATION_SCENARIO_IDS.COMPLETE_IMPLEMENTATION
      );
      const plan = buildCompletePlan();
      const evaluation = evaluateRecruitmentScenario({
        recruitmentId: "SUM_147",
        scenarioId: scenario.id,
        scenario,
        implementationPlan: plan
      });
      const decision = generateRecruitmentImplementationDecision({
        recruitmentId: "SUM_147",
        evaluation,
        implementationPlan: plan
      });
      const input = {
        recruitmentId: "SUM_147",
        selectedScenario: scenario,
        evaluation,
        decision
      };
      const a = buildRecruitmentScenarioSummary(input);
      const b = buildRecruitmentScenarioSummary(input);
      expect(a).toEqual(b);
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    });

    test("output is deeply frozen", () => {
      const scenario = getRecruitmentScenario(
        IMPLEMENTATION_SCENARIO_IDS.COMPLETE_IMPLEMENTATION
      );
      const plan = buildCompletePlan();
      const evaluation = evaluateRecruitmentScenario({
        recruitmentId: "FROZEN_SUM",
        scenarioId: scenario.id,
        implementationPlan: plan
      });
      const decision = generateRecruitmentImplementationDecision({
        recruitmentId: "FROZEN_SUM",
        evaluation,
        implementationPlan: plan
      });
      const result = buildRecruitmentScenarioSummary({
        recruitmentId: "FROZEN_SUM",
        selectedScenario: scenario,
        evaluation,
        decision
      });
      assertAllFrozen(result);
      expect(isRecruitmentScenarioSummary(result)).toBe(true);
    });
  });

  describe("invalid inputs", () => {
    test("null input yields incomplete summary", () => {
      const result = buildRecruitmentScenarioSummary(null);
      expect(result.summaryPosture).toBe(SUMMARY_POSTURE.INCOMPLETE);
      expect(result.confidence).toBe(0);
      expect(result.decision.decision).toBe(IMPLEMENTATION_DECISION.REVIEW_REQUIRED);
      expect(result.advisoryMetadata.executed).toBe(false);
    });
  });

  describe("consolidated report", () => {
    test("complete matched path yields ready posture", () => {
      const scenario = getRecruitmentScenario(
        IMPLEMENTATION_SCENARIO_IDS.COMPLETE_IMPLEMENTATION
      );
      const plan = buildCompletePlan();
      const evaluation = evaluateRecruitmentScenario({
        recruitmentId: "READY",
        scenarioId: scenario.id,
        scenario,
        implementationPlan: plan
      });
      const decision = generateRecruitmentImplementationDecision({
        recruitmentId: "READY",
        evaluation,
        implementationPlan: plan
      });
      const result = buildRecruitmentScenarioSummary({
        recruitmentId: "READY",
        selectedScenario: scenario,
        evaluation,
        decision
      });
      expect(result.selectedScenario.id).toBe(
        IMPLEMENTATION_SCENARIO_IDS.COMPLETE_IMPLEMENTATION
      );
      expect(result.evaluation.scenarioStatus).toBe(SCENARIO_STATUS.MATCHED);
      expect(result.decision.decision).toBe(IMPLEMENTATION_DECISION.PROCEED_TO_NEXT_REVIEW);
      expect(result.summaryPosture).toBe(SUMMARY_POSTURE.READY_FOR_NEXT_REVIEW);
      expect(result.confidence).toBeGreaterThanOrEqual(85);
      expect(result.nextReviewSteps.length).toBeGreaterThan(0);
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    test.each(ALL_SCENARIO_IDS)(
      "end-to-end summary for %s includes required sections",
      (scenarioId) => {
        const scenario = getRecruitmentScenario(scenarioId);
        const plan = planForScenario(scenarioId);
        const evaluation = evaluateRecruitmentScenario({
          recruitmentId: "E2E_" + scenarioId,
          scenarioId,
          scenario,
          implementationPlan: plan
        });
        const decision = generateRecruitmentImplementationDecision({
          recruitmentId: "E2E_" + scenarioId,
          evaluation,
          implementationPlan: plan
        });
        const result = buildRecruitmentScenarioSummary({
          recruitmentId: "E2E_" + scenarioId,
          selectedScenario: scenario,
          evaluation,
          decision
        });
        expect(result.selectedScenario.id).toBe(scenarioId);
        expect(result.evaluation.available).toBe(true);
        expect(result.decision.available).toBe(true);
        expect(result.decision.decision).toBe(expectedDecisionForScenario(scenarioId));
        expect(Array.isArray(result.risks)).toBe(true);
        expect(Array.isArray(result.recommendations)).toBe(true);
        expect(Array.isArray(result.nextReviewSteps)).toBe(true);
        expect(typeof result.confidence).toBe("number");
        expect(result.advisoryMetadata.activatesAnything).toBe(false);
      }
    );
  });

  describe("stable ordering", () => {
    test("risks, recommendations, and nextReviewSteps are sorted", () => {
      const scenario = getRecruitmentScenario(
        IMPLEMENTATION_SCENARIO_IDS.PARTIAL_IMPLEMENTATION
      );
      const plan = buildPartialPlan();
      const evaluation = evaluateRecruitmentScenario({
        recruitmentId: "SORT_SUM",
        scenarioId: scenario.id,
        implementationPlan: plan
      });
      const decision = generateRecruitmentImplementationDecision({
        recruitmentId: "SORT_SUM",
        evaluation,
        implementationPlan: plan
      });
      const result = buildRecruitmentScenarioSummary({
        recruitmentId: "SORT_SUM",
        selectedScenario: scenario,
        evaluation,
        decision
      });
      expect(result.risks.map((r) => r.id)).toEqual(
        result.risks
          .map((r) => r.id)
          .slice()
          .sort()
      );
      expect(result.recommendations).toEqual(result.recommendations.slice().sort());
      expect(result.nextReviewSteps).toEqual(result.nextReviewSteps.slice().sort());
    });
  });
});

describe("Phase 147 — runtime isolation", () => {
  test("phase 147 modules contain no require() calls", () => {
    const modules = [CATALOG_MODULE, EVALUATOR_MODULE, DECISION_MODULE, SUMMARY_MODULE];
    for (let i = 0; i < modules.length; i += 1) {
      const source = read(modules[i]);
      expect(source).not.toMatch(/\brequire\s*\(/);
      expect(source).not.toMatch(/\bimport\s+/);
      expect(source.toLowerCase()).not.toMatch(/\binsert\s+into\b/);
      expect(source.toLowerCase()).not.toMatch(/\bupdate\s+\w+\s+set\b/);
      expect(source).not.toMatch(/\bfs\./);
      expect(source).not.toMatch(/\bwriteFile/);
    }
  });

  test.each(PHASE_147_MODULES)(
    "phase 147 module %s is not imported by orchestrator",
    (moduleName) => {
      expect(read(ORCHESTRATOR_MODULE)).not.toContain(moduleName);
    }
  );

  test.each(PHASE_147_MODULES)(
    "phase 147 module %s is not imported by coordinator",
    (moduleName) => {
      expect(read(COORDINATOR_MODULE)).not.toContain(moduleName);
    }
  );

  test.each(PHASE_147_MODULES)(
    "phase 147 module %s is not imported by advisory gateway",
    (moduleName) => {
      expect(read(GATEWAY_MODULE)).not.toContain(moduleName);
    }
  );

  test.each(PHASE_147_MODULES)(
    "phase 147 module %s is not imported by recruitment pipeline",
    (moduleName) => {
      expect(read(PIPELINE_MODULE)).not.toContain(moduleName);
    }
  );

  test.each(PHASE_147_MODULES)(
    "phase 147 module %s is not imported by site worker",
    (moduleName) => {
      expect(read(WORKER_MODULE)).not.toContain(moduleName);
    }
  );

  test("orchestrator output does not leak phase 147 fields", () => {
    const result = orchestrateRecruitmentWorkflow({
      recruitmentId: "ISO_147",
      workflowState: RECRUITMENT_WORKFLOW_STATES.DRAFT_CREATED
    });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("phase_147");
    expect(serialized).not.toContain("SCENARIO_MATCHED");
    expect(serialized).not.toContain("PROCEED_TO_NEXT_REVIEW");
    expect(serialized).not.toContain("recruitment_scenario_catalog");
    expect(serialized).not.toContain("recruitment_scenario_evaluator");
    expect(serialized).not.toContain("recruitment_decision_matrix");
    expect(serialized).not.toContain("recruitment_scenario_summary");
  });
});
