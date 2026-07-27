"use strict";

/**
 * Phase 146 — Implementation Dry-Run & Simulation Framework tests.
 * Verifies deterministic output, invalid inputs, empty plans, complete plans,
 * dependency failures, rollout stop conditions, compliance calculations,
 * confidence calculations, stable ordering, and runtime isolation.
 */

const fs = require("fs");
const path = require("path");

const {
  RECRUITMENT_IMPLEMENTATION_DRY_RUN_SIMULATOR_PHASE,
  RECRUITMENT_IMPLEMENTATION_DRY_RUN_SIMULATOR_ENTITY,
  DRY_RUN_SIMULATOR_SCHEMA_VERSION,
  EXPECTED_CONTRACT_VERSION,
  SIMULATION_STATUS,
  READINESS_STATUS,
  REQUIRED_STAGE_IDS,
  REQUIRED_CAPABILITY_IDS,
  REQUIRED_EXECUTION_IDS,
  REQUIRED_ROLLBACK_IDS,
  REQUIRED_BOUNDARY_IDS,
  RECRUITMENT_IMPLEMENTATION_DRY_RUN_SIMULATOR_DESCRIPTOR,
  RECRUITMENT_IMPLEMENTATION_DRY_RUN_SIMULATOR_METADATA,
  EXPECTED_RESULT_KEYS: DRY_RUN_EXPECTED_KEYS,
  simulateRecruitmentImplementationDryRun,
  isRecruitmentImplementationDryRunSimulation
} = require("../server/lib/recruitment/recruitmentImplementationDryRunSimulator");

const {
  RECRUITMENT_ROLLOUT_SIMULATION_PHASE,
  RECRUITMENT_ROLLOUT_SIMULATION_ENTITY,
  ROLLOUT_SIMULATION_STATUS,
  CHECKPOINT_PROGRESSION_STATUS,
  STOP_CONDITION_IDS,
  ROLLOUT_STEP_DEFINITIONS,
  RECRUITMENT_ROLLOUT_SIMULATION_DESCRIPTOR,
  RECRUITMENT_ROLLOUT_SIMULATION_METADATA,
  EXPECTED_RESULT_KEYS: ROLLOUT_EXPECTED_KEYS,
  simulateRecruitmentRollout,
  isRecruitmentRolloutSimulation
} = require("../server/lib/recruitment/recruitmentRolloutSimulation");

const {
  RECRUITMENT_CONTRACT_COMPLIANCE_CHECKER_PHASE,
  RECRUITMENT_CONTRACT_COMPLIANCE_CHECKER_ENTITY,
  COMPLIANCE_STATUS,
  EXPECTED_CONTRACT_VERSION: COMPLIANCE_CONTRACT_VERSION,
  RECRUITMENT_CONTRACT_COMPLIANCE_CHECKER_DESCRIPTOR,
  RECRUITMENT_CONTRACT_COMPLIANCE_CHECKER_METADATA,
  EXPECTED_RESULT_KEYS: COMPLIANCE_EXPECTED_KEYS,
  checkRecruitmentContractCompliance,
  isRecruitmentContractComplianceResult
} = require("../server/lib/recruitment/recruitmentContractComplianceChecker");

const {
  RECRUITMENT_SIMULATION_SUMMARY_PHASE,
  RECRUITMENT_SIMULATION_SUMMARY_ENTITY,
  SUMMARY_POSTURE,
  DEPENDENCY_HEALTH,
  RECRUITMENT_SIMULATION_SUMMARY_DESCRIPTOR,
  RECRUITMENT_SIMULATION_SUMMARY_METADATA,
  EXPECTED_RESULT_KEYS: SUMMARY_EXPECTED_KEYS,
  buildRecruitmentSimulationSummary,
  isRecruitmentSimulationSummary
} = require("../server/lib/recruitment/recruitmentSimulationSummary");

const {
  RECRUITMENT_WORKFLOW_STATES,
  orchestrateRecruitmentWorkflow
} = require("../server/lib/recruitment/recruitmentWorkflowOrchestrator");

const ROOT = path.join(__dirname, "..");
const DRY_RUN_MODULE = "server/lib/recruitment/recruitmentImplementationDryRunSimulator.js";
const ROLLOUT_MODULE = "server/lib/recruitment/recruitmentRolloutSimulation.js";
const COMPLIANCE_MODULE = "server/lib/recruitment/recruitmentContractComplianceChecker.js";
const SUMMARY_MODULE = "server/lib/recruitment/recruitmentSimulationSummary.js";
const ORCHESTRATOR_MODULE = "server/lib/recruitment/recruitmentWorkflowOrchestrator.js";
const COORDINATOR_MODULE = "server/lib/recruitment/recruitmentWorkflowIntegrationCoordinator.js";
const GATEWAY_MODULE = "server/lib/recruitment/recruitmentWorkflowAdvisoryGateway.js";
const PIPELINE_MODULE = "server/lib/recruitment/runRecruitmentPipeline.js";
const WORKER_MODULE = "server/services/workers/siteWorker.js";

const PHASE_146_MODULES = [
  "recruitmentImplementationDryRunSimulator",
  "recruitmentRolloutSimulation",
  "recruitmentContractComplianceChecker",
  "recruitmentSimulationSummary"
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

function buildCompleteImplementationPlan() {
  return {
    contractVersion: EXPECTED_CONTRACT_VERSION,
    implementationStages: REQUIRED_STAGE_IDS.slice(),
    supportedCapabilities: REQUIRED_CAPABILITY_IDS.slice(),
    executionRequirements: REQUIRED_EXECUTION_IDS.slice(),
    rollbackRequirements: REQUIRED_ROLLBACK_IDS.slice(),
    runtimeBoundaries: REQUIRED_BOUNDARY_IDS.slice()
  };
}

function buildPartialImplementationPlan() {
  return {
    contractVersion: EXPECTED_CONTRACT_VERSION,
    implementationStages: [
      "STAGE_CONTRACT_ALIGNMENT",
      "STAGE_ADAPTER_SCAFFOLD"
    ],
    supportedCapabilities: ["CAP_BOUNDARY_ISOLATION", "CAP_RUNTIME_ADAPTER"],
    executionRequirements: ["EXEC_NO_RUNTIME_WIRING"],
    rollbackRequirements: ["RB_DISABLE_FLAGS"],
    runtimeBoundaries: ["BOUNDARY_ORCHESTRATOR"]
  };
}

describe("Phase 146 — recruitmentImplementationDryRunSimulator", () => {
  describe("module metadata", () => {
    test("exports phase 146 constants", () => {
      expect(RECRUITMENT_IMPLEMENTATION_DRY_RUN_SIMULATOR_PHASE).toBe(146);
      expect(RECRUITMENT_IMPLEMENTATION_DRY_RUN_SIMULATOR_ENTITY).toBe(
        "recruitment_implementation_dry_run_simulator"
      );
      expect(RECRUITMENT_IMPLEMENTATION_DRY_RUN_SIMULATOR_DESCRIPTOR.phase).toBe(146);
      expect(RECRUITMENT_IMPLEMENTATION_DRY_RUN_SIMULATOR_METADATA.advisoryOnly).toBe(true);
      expect(RECRUITMENT_IMPLEMENTATION_DRY_RUN_SIMULATOR_METADATA.executed).toBe(false);
      expect(RECRUITMENT_IMPLEMENTATION_DRY_RUN_SIMULATOR_METADATA.activatesAnything).toBe(
        false
      );
      expect(DRY_RUN_SIMULATOR_SCHEMA_VERSION).toBe("1.0.0");
    });
  });

  describe("deterministic output", () => {
    test("identical inputs produce identical outputs", () => {
      const input = {
        recruitmentId: "DRY_146",
        implementationPlan: buildCompleteImplementationPlan()
      };
      const a = simulateRecruitmentImplementationDryRun(input);
      const b = simulateRecruitmentImplementationDryRun(input);
      expect(a).toEqual(b);
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    });

    test("output is deeply frozen", () => {
      const result = simulateRecruitmentImplementationDryRun({
        recruitmentId: "FROZEN",
        implementationPlan: buildCompleteImplementationPlan()
      });
      assertAllFrozen(result);
      expect(isRecruitmentImplementationDryRunSimulation(result)).toBe(true);
    });

    test("does not mutate input", () => {
      const input = {
        recruitmentId: "MUT",
        implementationPlan: buildCompleteImplementationPlan()
      };
      const snapshot = JSON.stringify(input);
      simulateRecruitmentImplementationDryRun(input);
      expect(JSON.stringify(input)).toBe(snapshot);
    });
  });

  describe("invalid inputs and empty plans", () => {
    test("null input yields EMPTY simulation", () => {
      const result = simulateRecruitmentImplementationDryRun(null);
      expect(result.recruitmentId).toBe("UNKNOWN");
      expect(result.simulationStatus).toBe(SIMULATION_STATUS.EMPTY);
      expect(result.confidence).toBe(0);
      expect(result.simulatedReadiness.status).toBe(READINESS_STATUS.UNKNOWN);
      expect(result.advisoryMetadata.executed).toBe(false);
    });

    test("empty object yields EMPTY simulation", () => {
      const result = simulateRecruitmentImplementationDryRun({});
      expect(result.simulationStatus).toBe(SIMULATION_STATUS.EMPTY);
      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(
        DRY_RUN_EXPECTED_KEYS.every((key) =>
          Object.prototype.hasOwnProperty.call(result, key)
        )
      ).toBe(true);
    });

    test("non-object input is handled safely", () => {
      const result = simulateRecruitmentImplementationDryRun("invalid");
      expect(result.simulationStatus).toBe(SIMULATION_STATUS.EMPTY);
      expect(result.advisoryMetadata.activatesAnything).toBe(false);
    });
  });

  describe("complete plans", () => {
    test("complete plan yields COMPLETE simulation with READY readiness", () => {
      const result = simulateRecruitmentImplementationDryRun({
        recruitmentId: "COMPLETE",
        implementationPlan: buildCompleteImplementationPlan()
      });
      expect(result.simulationStatus).toBe(SIMULATION_STATUS.COMPLETE);
      expect(result.simulatedReadiness.status).toBe(READINESS_STATUS.READY);
      expect(result.simulatedReadiness.readinessScore).toBeGreaterThanOrEqual(90);
      expect(result.detectedConflicts).toHaveLength(0);
      expect(result.evaluatedStages.every((s) => s.simulated === true)).toBe(true);
      expect(result.simulatedCapabilities.every((c) => c.simulated === true)).toBe(true);
      expect(result.confidence).toBeGreaterThan(0);
    });
  });

  describe("dependency failures", () => {
    test("partial plan reports missing dependencies and blocked stages", () => {
      const result = simulateRecruitmentImplementationDryRun({
        recruitmentId: "DEPS",
        implementationPlan: buildPartialImplementationPlan()
      });
      expect(result.simulationStatus).not.toBe(SIMULATION_STATUS.COMPLETE);
      expect(result.dependencyChecks.some((c) => c.satisfied !== true)).toBe(true);
      expect(result.prerequisiteChecks.some((c) => c.satisfied !== true)).toBe(true);
      expect([READINESS_STATUS.PARTIALLY_READY, READINESS_STATUS.NOT_READY]).toContain(
        result.simulatedReadiness.status
      );
      expect(result.simulatedReadiness.readinessScore).toBeLessThan(90);
    });

    test("controlled coupling without rollback creates conflict", () => {
      const plan = buildPartialImplementationPlan();
      plan.implementationStages.push("STAGE_CONTROLLED_COUPLING");
      const result = simulateRecruitmentImplementationDryRun({
        recruitmentId: "CONFLICT",
        implementationPlan: plan
      });
      expect(
        result.detectedConflicts.some((c) => c.id === "CONFLICT_COUPLING_WITHOUT_ROLLBACK")
      ).toBe(true);
    });
  });

  describe("stable ordering", () => {
    test("evaluated stages are ordered by order field", () => {
      const result = simulateRecruitmentImplementationDryRun({
        recruitmentId: "ORDER",
        implementationPlan: buildCompleteImplementationPlan()
      });
      for (let i = 1; i < result.evaluatedStages.length; i += 1) {
        expect(result.evaluatedStages[i].order).toBeGreaterThan(
          result.evaluatedStages[i - 1].order
        );
      }
    });

    test("simulated capabilities are sorted by capabilityId", () => {
      const result = simulateRecruitmentImplementationDryRun({
        recruitmentId: "CAP_ORDER",
        implementationPlan: buildCompleteImplementationPlan()
      });
      const ids = result.simulatedCapabilities.map((c) => c.capabilityId);
      const sorted = ids.slice().sort();
      expect(ids).toEqual(sorted);
    });

    test("recommendations are sorted", () => {
      const result = simulateRecruitmentImplementationDryRun({
        recruitmentId: "REC",
        implementationPlan: buildPartialImplementationPlan()
      });
      const sorted = result.recommendations.slice().sort();
      expect(result.recommendations).toEqual(sorted);
    });
  });

  describe("activation conflicts", () => {
    test("runtime wiring flags produce conflicts and never activate", () => {
      const plan = buildCompleteImplementationPlan();
      plan.runtimeWiringEnabled = true;
      plan.activateFlags = true;
      plan.activateRollout = true;
      const result = simulateRecruitmentImplementationDryRun({
        recruitmentId: "ACT",
        implementationPlan: plan
      });
      expect(result.detectedConflicts.length).toBeGreaterThanOrEqual(3);
      expect(result.advisoryMetadata.activatesAnything).toBe(false);
      expect(result.evaluatedStages.every((s) => s.activated === false)).toBe(true);
    });
  });
});

describe("Phase 146 — recruitmentRolloutSimulation", () => {
  describe("module metadata", () => {
    test("exports phase 146 constants", () => {
      expect(RECRUITMENT_ROLLOUT_SIMULATION_PHASE).toBe(146);
      expect(RECRUITMENT_ROLLOUT_SIMULATION_ENTITY).toBe("recruitment_rollout_simulation");
      expect(RECRUITMENT_ROLLOUT_SIMULATION_DESCRIPTOR.phase).toBe(146);
      expect(RECRUITMENT_ROLLOUT_SIMULATION_METADATA.rolloutActivationEnabled).toBe(false);
      expect(ROLLOUT_STEP_DEFINITIONS).toHaveLength(8);
    });
  });

  describe("deterministic output", () => {
    test("identical inputs produce identical outputs", () => {
      const input = {
        recruitmentId: "ROLL_146",
        readyCapabilities: REQUIRED_CAPABILITY_IDS.slice()
      };
      const a = simulateRecruitmentRollout(input);
      const b = simulateRecruitmentRollout(input);
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    });

    test("output is deeply frozen and typed", () => {
      const result = simulateRecruitmentRollout({
        recruitmentId: "FROZEN",
        readyCapabilities: REQUIRED_CAPABILITY_IDS.slice()
      });
      assertAllFrozen(result);
      expect(isRecruitmentRolloutSimulation(result)).toBe(true);
    });

    test("does not mutate input", () => {
      const input = {
        recruitmentId: "MUT",
        readyCapabilities: ["CAP_BOUNDARY_ISOLATION"]
      };
      const snapshot = JSON.stringify(input);
      simulateRecruitmentRollout(input);
      expect(JSON.stringify(input)).toBe(snapshot);
    });
  });

  describe("invalid inputs and empty plans", () => {
    test("null input yields EMPTY sequence", () => {
      const result = simulateRecruitmentRollout(null);
      expect(result.recruitmentId).toBe("UNKNOWN");
      expect(result.rolloutSimulationStatus).toBe(ROLLOUT_SIMULATION_STATUS.SEQUENCE_EMPTY);
      expect(result.confidence).toBe(0);
      expect(
        result.simulatedStopConditions.some((s) => s.id === STOP_CONDITION_IDS.EMPTY_PLAN)
      ).toBe(true);
    });

    test("empty object yields EMPTY sequence", () => {
      const result = simulateRecruitmentRollout({});
      expect(result.rolloutSimulationStatus).toBe(ROLLOUT_SIMULATION_STATUS.SEQUENCE_EMPTY);
      expect(
        ROLLOUT_EXPECTED_KEYS.every((key) => Object.prototype.hasOwnProperty.call(result, key))
      ).toBe(true);
    });
  });

  describe("complete rollout sequence", () => {
    test("all capabilities ready yields SEQUENCE_COMPLETE", () => {
      const result = simulateRecruitmentRollout({
        recruitmentId: "COMPLETE_ROLL",
        readyCapabilities: REQUIRED_CAPABILITY_IDS.slice()
      });
      expect(result.rolloutSimulationStatus).toBe(ROLLOUT_SIMULATION_STATUS.SEQUENCE_COMPLETE);
      expect(
        result.checkpointProgression.every(
          (c) => c.status === CHECKPOINT_PROGRESSION_STATUS.PASSED
        )
      ).toBe(true);
      expect(result.rolloutOrder.every((s) => s.activated === false)).toBe(true);
      expect(result.advisoryMetadata.rolloutActivationEnabled).toBe(false);
    });
  });

  describe("rollout stop conditions", () => {
    test("missing capability triggers stop and rollback point", () => {
      const result = simulateRecruitmentRollout({
        recruitmentId: "STOP",
        readyCapabilities: ["CAP_BOUNDARY_ISOLATION"]
      });
      expect(result.rolloutSimulationStatus).toBe(ROLLOUT_SIMULATION_STATUS.SEQUENCE_STOPPED);
      expect(
        result.simulatedStopConditions.some(
          (s) =>
            s.id === STOP_CONDITION_IDS.MISSING_PREREQUISITE ||
            s.id === STOP_CONDITION_IDS.DEPENDENCY_FAILURE
        )
      ).toBe(true);
      expect(result.simulatedRollbackPoints.some((p) => p.triggered === true)).toBe(true);
    });

    test("runtime activation attempt stops simulation", () => {
      const result = simulateRecruitmentRollout({
        recruitmentId: "ACT_STOP",
        readyCapabilities: REQUIRED_CAPABILITY_IDS.slice(),
        activateRuntime: true
      });
      expect(result.rolloutSimulationStatus).toBe(ROLLOUT_SIMULATION_STATUS.SEQUENCE_STOPPED);
      expect(
        result.simulatedStopConditions.some(
          (s) => s.id === STOP_CONDITION_IDS.RUNTIME_ACTIVATION_ATTEMPT
        )
      ).toBe(true);
      expect(result.advisoryMetadata.activatesAnything).toBe(false);
    });

    test("forceStop simulates stop conditions", () => {
      const result = simulateRecruitmentRollout({
        recruitmentId: "FORCE",
        readyCapabilities: REQUIRED_CAPABILITY_IDS.slice(),
        forceStop: true
      });
      expect(result.rolloutSimulationStatus).toBe(ROLLOUT_SIMULATION_STATUS.SEQUENCE_STOPPED);
      expect(
        result.simulatedStopConditions.some((s) => s.id === STOP_CONDITION_IDS.CONFLICT_DETECTED)
      ).toBe(true);
    });
  });

  describe("stable ordering", () => {
    test("rollout order follows definition order", () => {
      const result = simulateRecruitmentRollout({
        recruitmentId: "ORDER",
        readyCapabilities: REQUIRED_CAPABILITY_IDS.slice()
      });
      for (let i = 1; i < result.rolloutOrder.length; i += 1) {
        expect(result.rolloutOrder[i].order).toBeGreaterThan(result.rolloutOrder[i - 1].order);
      }
      expect(result.rolloutOrder.map((s) => s.stepId)).toEqual(
        ROLLOUT_STEP_DEFINITIONS.map((d) => d.stepId)
      );
    });
  });
});

describe("Phase 146 — recruitmentContractComplianceChecker", () => {
  describe("module metadata", () => {
    test("exports phase 146 constants", () => {
      expect(RECRUITMENT_CONTRACT_COMPLIANCE_CHECKER_PHASE).toBe(146);
      expect(RECRUITMENT_CONTRACT_COMPLIANCE_CHECKER_ENTITY).toBe(
        "recruitment_contract_compliance_checker"
      );
      expect(RECRUITMENT_CONTRACT_COMPLIANCE_CHECKER_DESCRIPTOR.phase).toBe(146);
      expect(COMPLIANCE_CONTRACT_VERSION).toBe("1.0.0");
      expect(RECRUITMENT_CONTRACT_COMPLIANCE_CHECKER_METADATA.executed).toBe(false);
    });
  });

  describe("deterministic output", () => {
    test("identical inputs produce identical outputs", () => {
      const input = {
        recruitmentId: "COMP_146",
        implementationPlan: buildCompleteImplementationPlan()
      };
      const a = checkRecruitmentContractCompliance(input);
      const b = checkRecruitmentContractCompliance(input);
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    });

    test("output is deeply frozen", () => {
      const result = checkRecruitmentContractCompliance({
        recruitmentId: "FROZEN",
        implementationPlan: buildCompleteImplementationPlan()
      });
      assertAllFrozen(result);
      expect(isRecruitmentContractComplianceResult(result)).toBe(true);
    });
  });

  describe("invalid inputs and empty plans", () => {
    test("null input yields UNKNOWN compliance", () => {
      const result = checkRecruitmentContractCompliance(null);
      expect(result.recruitmentId).toBe("UNKNOWN");
      expect(result.complianceStatus).toBe(COMPLIANCE_STATUS.UNKNOWN);
      expect(result.overallComplianceScore).toBe(0);
      expect(result.confidence).toBe(0);
      expect(result.missingRequirements).toContain("IMPLEMENTATION_PLAN");
    });

    test("empty object yields UNKNOWN compliance", () => {
      const result = checkRecruitmentContractCompliance({});
      expect(result.complianceStatus).toBe(COMPLIANCE_STATUS.UNKNOWN);
      expect(
        COMPLIANCE_EXPECTED_KEYS.every((key) =>
          Object.prototype.hasOwnProperty.call(result, key)
        )
      ).toBe(true);
    });
  });

  describe("compliance calculations", () => {
    test("complete plan is COMPLIANT with score 100", () => {
      const result = checkRecruitmentContractCompliance({
        recruitmentId: "FULL",
        implementationPlan: buildCompleteImplementationPlan()
      });
      expect(result.complianceStatus).toBe(COMPLIANCE_STATUS.COMPLIANT);
      expect(result.overallComplianceScore).toBe(100);
      expect(result.missingRequirements).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
      expect(result.satisfiedRequirements.length).toBeGreaterThan(0);
    });

    test("partial plan is PARTIALLY_COMPLIANT or NON_COMPLIANT", () => {
      const result = checkRecruitmentContractCompliance({
        recruitmentId: "PARTIAL",
        implementationPlan: buildPartialImplementationPlan()
      });
      expect(result.missingRequirements.length).toBeGreaterThan(0);
      expect([
        COMPLIANCE_STATUS.PARTIALLY_COMPLIANT,
        COMPLIANCE_STATUS.NON_COMPLIANT
      ]).toContain(result.complianceStatus);
      expect(result.overallComplianceScore).toBeLessThan(100);
    });

    test("activation flags produce warnings and reduce score", () => {
      const plan = buildCompleteImplementationPlan();
      plan.runtimeWiringEnabled = true;
      plan.dbWrites = true;
      const result = checkRecruitmentContractCompliance({
        recruitmentId: "WARN",
        implementationPlan: plan
      });
      expect(result.warnings.length).toBeGreaterThanOrEqual(2);
      expect(result.overallComplianceScore).toBeLessThan(100);
      expect(result.complianceStatus).toBe(COMPLIANCE_STATUS.PARTIALLY_COMPLIANT);
    });

    test("satisfied and missing requirements are stably sorted", () => {
      const result = checkRecruitmentContractCompliance({
        recruitmentId: "SORT",
        implementationPlan: buildPartialImplementationPlan()
      });
      expect(result.satisfiedRequirements).toEqual(
        result.satisfiedRequirements.slice().sort()
      );
      expect(result.missingRequirements).toEqual(result.missingRequirements.slice().sort());
      expect(result.warnings).toEqual(result.warnings.slice().sort());
    });
  });
});

describe("Phase 146 — recruitmentSimulationSummary", () => {
  describe("module metadata", () => {
    test("exports phase 146 constants", () => {
      expect(RECRUITMENT_SIMULATION_SUMMARY_PHASE).toBe(146);
      expect(RECRUITMENT_SIMULATION_SUMMARY_ENTITY).toBe("recruitment_simulation_summary");
      expect(RECRUITMENT_SIMULATION_SUMMARY_DESCRIPTOR.phase).toBe(146);
      expect(RECRUITMENT_SIMULATION_SUMMARY_METADATA.summaryOnly).toBe(true);
    });
  });

  describe("deterministic output", () => {
    test("identical inputs produce identical outputs", () => {
      const dryRun = simulateRecruitmentImplementationDryRun({
        recruitmentId: "SUM",
        implementationPlan: buildCompleteImplementationPlan()
      });
      const compliance = checkRecruitmentContractCompliance({
        recruitmentId: "SUM",
        implementationPlan: buildCompleteImplementationPlan()
      });
      const rollout = simulateRecruitmentRollout({
        recruitmentId: "SUM",
        readyCapabilities: REQUIRED_CAPABILITY_IDS.slice()
      });
      const input = { recruitmentId: "SUM", dryRun, compliance, rollout };
      const a = buildRecruitmentSimulationSummary(input);
      const b = buildRecruitmentSimulationSummary(input);
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    });

    test("output is deeply frozen", () => {
      const result = buildRecruitmentSimulationSummary({
        recruitmentId: "FROZEN",
        dryRun: simulateRecruitmentImplementationDryRun({
          recruitmentId: "FROZEN",
          implementationPlan: buildCompleteImplementationPlan()
        })
      });
      assertAllFrozen(result);
      expect(isRecruitmentSimulationSummary(result)).toBe(true);
    });
  });

  describe("invalid inputs and empty plans", () => {
    test("null input yields EMPTY summary", () => {
      const result = buildRecruitmentSimulationSummary(null);
      expect(result.recruitmentId).toBe("UNKNOWN");
      expect(result.summaryPosture).toBe(SUMMARY_POSTURE.EMPTY);
      expect(result.confidence).toBe(0);
      expect(result.dependencyHealth.status).toBe(DEPENDENCY_HEALTH.UNKNOWN);
    });

    test("empty object yields EMPTY summary with recommendations", () => {
      const result = buildRecruitmentSimulationSummary({});
      expect(result.summaryPosture).toBe(SUMMARY_POSTURE.EMPTY);
      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(
        SUMMARY_EXPECTED_KEYS.every((key) => Object.prototype.hasOwnProperty.call(result, key))
      ).toBe(true);
    });
  });

  describe("confidence calculations", () => {
    test("complete suite yields high confidence and READY posture", () => {
      const plan = buildCompleteImplementationPlan();
      const dryRun = simulateRecruitmentImplementationDryRun({
        recruitmentId: "READY",
        implementationPlan: plan
      });
      const compliance = checkRecruitmentContractCompliance({
        recruitmentId: "READY",
        implementationPlan: plan
      });
      const rollout = simulateRecruitmentRollout({
        recruitmentId: "READY",
        readyCapabilities: REQUIRED_CAPABILITY_IDS.slice()
      });
      const result = buildRecruitmentSimulationSummary({
        recruitmentId: "READY",
        dryRun,
        compliance,
        rollout
      });
      expect(result.summaryPosture).toBe(SUMMARY_POSTURE.READY);
      expect(result.confidence).toBeGreaterThanOrEqual(80);
      expect(result.implementationReadiness.available).toBe(true);
      expect(result.compliance.available).toBe(true);
      expect(result.rolloutSimulation.available).toBe(true);
      expect(result.dependencyHealth.status).toBe(DEPENDENCY_HEALTH.HEALTHY);
      expect(result.advisoryMetadata.executed).toBe(false);
    });

    test("partial suite yields reduced confidence", () => {
      const dryRun = simulateRecruitmentImplementationDryRun({
        recruitmentId: "PARTIAL",
        implementationPlan: buildPartialImplementationPlan()
      });
      const compliance = checkRecruitmentContractCompliance({
        recruitmentId: "PARTIAL",
        implementationPlan: buildPartialImplementationPlan()
      });
      const result = buildRecruitmentSimulationSummary({
        recruitmentId: "PARTIAL",
        dryRun,
        compliance
      });
      expect(result.confidence).toBeLessThan(80);
      expect(result.summaryPosture).not.toBe(SUMMARY_POSTURE.READY);
      expect(result.risks.length).toBeGreaterThan(0);
    });
  });

  describe("stable ordering", () => {
    test("risks and recommendations are sorted", () => {
      const dryRun = simulateRecruitmentImplementationDryRun({
        recruitmentId: "SORT",
        implementationPlan: buildPartialImplementationPlan()
      });
      const result = buildRecruitmentSimulationSummary({ recruitmentId: "SORT", dryRun });
      expect(result.risks.map((r) => r.id)).toEqual(
        result.risks
          .map((r) => r.id)
          .slice()
          .sort()
      );
      expect(result.recommendations).toEqual(result.recommendations.slice().sort());
    });
  });
});

describe("Phase 146 — runtime isolation", () => {
  test("phase 146 modules contain no require() calls", () => {
    const modules = [DRY_RUN_MODULE, ROLLOUT_MODULE, COMPLIANCE_MODULE, SUMMARY_MODULE];
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

  test.each(PHASE_146_MODULES)(
    "phase 146 module %s is not imported by orchestrator",
    (moduleName) => {
      expect(read(ORCHESTRATOR_MODULE)).not.toContain(moduleName);
    }
  );

  test.each(PHASE_146_MODULES)(
    "phase 146 module %s is not imported by coordinator",
    (moduleName) => {
      expect(read(COORDINATOR_MODULE)).not.toContain(moduleName);
    }
  );

  test.each(PHASE_146_MODULES)(
    "phase 146 module %s is not imported by advisory gateway",
    (moduleName) => {
      expect(read(GATEWAY_MODULE)).not.toContain(moduleName);
    }
  );

  test.each(PHASE_146_MODULES)(
    "phase 146 module %s is not imported by recruitment pipeline",
    (moduleName) => {
      expect(read(PIPELINE_MODULE)).not.toContain(moduleName);
    }
  );

  test.each(PHASE_146_MODULES)(
    "phase 146 module %s is not imported by site worker",
    (moduleName) => {
      expect(read(WORKER_MODULE)).not.toContain(moduleName);
    }
  );

  test("orchestrator output does not leak phase 146 fields", () => {
    const result = orchestrateRecruitmentWorkflow({
      recruitmentId: "ISO_146",
      workflowState: RECRUITMENT_WORKFLOW_STATES.DRAFT_CREATED
    });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("phase_146");
    expect(serialized).not.toContain("SIMULATION_COMPLETE");
    expect(serialized).not.toContain("ROLLOUT_SEQUENCE_COMPLETE");
    expect(serialized).not.toContain("recruitment_implementation_dry_run_simulator");
    expect(serialized).not.toContain("recruitment_rollout_simulation");
    expect(serialized).not.toContain("recruitment_contract_compliance_checker");
    expect(serialized).not.toContain("recruitment_simulation_summary");
  });
});
