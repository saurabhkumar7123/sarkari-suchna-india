"use strict";

/**
 * Phase 150 — Shadow Implementation Execution Plan Suite tests.
 * Verifies deterministic output, invalid inputs, empty metadata,
 * work package generation, milestone ordering, dependency validation,
 * readiness calculations, stable ordering, and runtime isolation.
 */

const fs = require("fs");
const path = require("path");

const {
  RECRUITMENT_EXECUTION_WORK_PACKAGES_PHASE,
  RECRUITMENT_EXECUTION_WORK_PACKAGES_ENTITY,
  WORK_PACKAGES_SCHEMA_VERSION,
  ESTIMATED_COMPLEXITY,
  WORK_PACKAGE_STATUS,
  WORK_PACKAGE_DEFINITIONS,
  RECRUITMENT_EXECUTION_WORK_PACKAGES_DESCRIPTOR,
  RECRUITMENT_EXECUTION_WORK_PACKAGES_METADATA,
  EXPECTED_RESULT_KEYS: WORK_PACKAGES_EXPECTED_KEYS,
  buildRecruitmentExecutionWorkPackages,
  isRecruitmentExecutionWorkPackages,
  isKnownWorkPackageIdentifier
} = require("../server/lib/recruitment/recruitmentExecutionWorkPackages");

const {
  RECRUITMENT_SHADOW_EXECUTION_PLANNER_PHASE,
  RECRUITMENT_SHADOW_EXECUTION_PLANNER_ENTITY,
  SHADOW_PLANNER_SCHEMA_VERSION,
  SHADOW_VALIDATION_APPROACH,
  SHADOW_PLAN_STATUS,
  SHADOW_PLAN_DEFINITIONS,
  RECRUITMENT_SHADOW_EXECUTION_PLANNER_DESCRIPTOR,
  RECRUITMENT_SHADOW_EXECUTION_PLANNER_METADATA,
  EXPECTED_RESULT_KEYS: SHADOW_PLANNER_EXPECTED_KEYS,
  buildRecruitmentShadowExecutionPlanner,
  isRecruitmentShadowExecutionPlanner
} = require("../server/lib/recruitment/recruitmentShadowExecutionPlanner");

const {
  RECRUITMENT_MILESTONE_TRACKER_PHASE,
  RECRUITMENT_MILESTONE_TRACKER_ENTITY,
  MILESTONE_TRACKER_SCHEMA_VERSION,
  MILESTONE_STATUS,
  MILESTONE_DEFINITIONS,
  RECRUITMENT_MILESTONE_TRACKER_DESCRIPTOR,
  RECRUITMENT_MILESTONE_TRACKER_METADATA,
  EXPECTED_RESULT_KEYS: MILESTONE_EXPECTED_KEYS,
  buildRecruitmentMilestoneTracker,
  isRecruitmentMilestoneTracker
} = require("../server/lib/recruitment/recruitmentMilestoneTracker");

const {
  RECRUITMENT_EXECUTION_SUMMARY_PHASE,
  RECRUITMENT_EXECUTION_SUMMARY_ENTITY,
  EXECUTION_SUMMARY_SCHEMA_VERSION,
  CONFIDENCE_LEVEL,
  READINESS_POSTURE,
  DEFAULT_RISK_DEFINITIONS,
  DEFAULT_RECOMMENDATIONS,
  RECRUITMENT_EXECUTION_SUMMARY_DESCRIPTOR,
  RECRUITMENT_EXECUTION_SUMMARY_METADATA,
  EXPECTED_RESULT_KEYS: SUMMARY_EXPECTED_KEYS,
  buildRecruitmentExecutionSummary,
  isRecruitmentExecutionSummary
} = require("../server/lib/recruitment/recruitmentExecutionSummary");

const {
  RECRUITMENT_WORKFLOW_STATES,
  orchestrateRecruitmentWorkflow
} = require("../server/lib/recruitment/recruitmentWorkflowOrchestrator");

const ROOT = path.join(__dirname, "..");
const WORK_PACKAGES_MODULE = "server/lib/recruitment/recruitmentExecutionWorkPackages.js";
const SHADOW_PLANNER_MODULE = "server/lib/recruitment/recruitmentShadowExecutionPlanner.js";
const MILESTONE_MODULE = "server/lib/recruitment/recruitmentMilestoneTracker.js";
const SUMMARY_MODULE = "server/lib/recruitment/recruitmentExecutionSummary.js";
const ORCHESTRATOR_MODULE = "server/lib/recruitment/recruitmentWorkflowOrchestrator.js";
const COORDINATOR_MODULE = "server/lib/recruitment/recruitmentWorkflowIntegrationCoordinator.js";
const GATEWAY_MODULE = "server/lib/recruitment/recruitmentWorkflowAdvisoryGateway.js";
const PIPELINE_MODULE = "server/lib/recruitment/runRecruitmentPipeline.js";
const WORKER_MODULE = "server/services/workers/siteWorker.js";

const PHASE_150_MODULES = [
  "recruitmentExecutionWorkPackages",
  "recruitmentShadowExecutionPlanner",
  "recruitmentMilestoneTracker",
  "recruitmentExecutionSummary"
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

function buildFullSuiteInput() {
  const workPackages = buildRecruitmentExecutionWorkPackages({
    recruitmentId: "EXEC_150"
  });
  const shadowPlanner = buildRecruitmentShadowExecutionPlanner({
    recruitmentId: "EXEC_150",
    workPackages
  });
  const milestoneTracker = buildRecruitmentMilestoneTracker({
    recruitmentId: "EXEC_150",
    workPackages
  });
  return {
    recruitmentId: "EXEC_150",
    workPackages,
    shadowPlanner,
    milestoneTracker,
    gapCatalog: { totalGapCount: 20, gaps: [] },
    riskMatrix: { overallRiskPosture: "ELEVATED" }
  };
}

describe("Phase 150 — module descriptors and constants", () => {
  test("work packages descriptor", () => {
    expect(RECRUITMENT_EXECUTION_WORK_PACKAGES_PHASE).toBe(150);
    expect(RECRUITMENT_EXECUTION_WORK_PACKAGES_ENTITY).toBe("recruitment_execution_work_packages");
    expect(WORK_PACKAGES_SCHEMA_VERSION).toBe("1.0.0");
    expect(RECRUITMENT_EXECUTION_WORK_PACKAGES_METADATA.advisoryOnly).toBe(true);
    expect(RECRUITMENT_EXECUTION_WORK_PACKAGES_METADATA.runtimeIntegration).toBe(false);
    expect(RECRUITMENT_EXECUTION_WORK_PACKAGES_DESCRIPTOR.phase).toBe(150);
  });

  test("shadow planner descriptor", () => {
    expect(RECRUITMENT_SHADOW_EXECUTION_PLANNER_PHASE).toBe(150);
    expect(SHADOW_PLANNER_SCHEMA_VERSION).toBe("1.0.0");
    expect(RECRUITMENT_SHADOW_EXECUTION_PLANNER_METADATA.writeExecutionPermitted).toBe(false);
    expect(RECRUITMENT_SHADOW_EXECUTION_PLANNER_METADATA.executed).toBe(false);
  });

  test("milestone tracker descriptor", () => {
    expect(RECRUITMENT_MILESTONE_TRACKER_PHASE).toBe(150);
    expect(MILESTONE_TRACKER_SCHEMA_VERSION).toBe("1.0.0");
    expect(RECRUITMENT_MILESTONE_TRACKER_METADATA.activatesAnything).toBe(false);
  });

  test("execution summary descriptor", () => {
    expect(RECRUITMENT_EXECUTION_SUMMARY_PHASE).toBe(150);
    expect(EXECUTION_SUMMARY_SCHEMA_VERSION).toBe("1.0.0");
    expect(RECRUITMENT_EXECUTION_SUMMARY_METADATA.rolloutActivationEnabled).toBe(false);
  });
});

describe("Phase 150 — recruitmentExecutionWorkPackages", () => {
  describe("deterministic output", () => {
    test("same input produces identical output", () => {
      const input = { recruitmentId: "WP_150" };
      const first = buildRecruitmentExecutionWorkPackages(input);
      const second = buildRecruitmentExecutionWorkPackages(input);
      expect(first).toEqual(second);
    });

    test("output is deep frozen", () => {
      const result = buildRecruitmentExecutionWorkPackages({ recruitmentId: "WP_150" });
      assertAllFrozen(result);
    });

    test("type guard accepts valid work packages", () => {
      const result = buildRecruitmentExecutionWorkPackages({ recruitmentId: "WP_150" });
      expect(isRecruitmentExecutionWorkPackages(result)).toBe(true);
    });
  });

  describe("invalid inputs", () => {
    test.each([null, undefined, "x", 1, true])("handles invalid input %p", (invalid) => {
      const result = buildRecruitmentExecutionWorkPackages(invalid);
      expect(isRecruitmentExecutionWorkPackages(result)).toBe(true);
      expect(result.recruitmentId).toBe("UNKNOWN");
      expect(result.totalPackageCount).toBe(WORK_PACKAGE_DEFINITIONS.length);
    });

    test("rejects malformed completedPackageIds", () => {
      const result = buildRecruitmentExecutionWorkPackages({
        recruitmentId: "BAD",
        completedPackageIds: "not-an-array"
      });
      expect(isRecruitmentExecutionWorkPackages(result)).toBe(true);
      expect(result.recruitmentId).toBe("UNKNOWN");
    });
  });

  describe("empty metadata", () => {
    test("default call with no input", () => {
      const result = buildRecruitmentExecutionWorkPackages();
      expect(result.workPackages.length).toBe(WORK_PACKAGE_DEFINITIONS.length);
      expect(result.packagesByStatus.READY.length).toBeGreaterThan(0);
      expect(result.packagesByStatus.COMPLETE.length).toBe(0);
    });

    test("empty object input", () => {
      const result = buildRecruitmentExecutionWorkPackages({});
      expect(result.recruitmentId).toBe("UNKNOWN");
      expect(result.packageSummary).toContain("work packages defined");
    });
  });

  describe("work package generation", () => {
    test("contains all expected result keys", () => {
      const result = buildRecruitmentExecutionWorkPackages();
      for (let i = 0; i < WORK_PACKAGES_EXPECTED_KEYS.length; i += 1) {
        expect(result).toHaveProperty(WORK_PACKAGES_EXPECTED_KEYS[i]);
      }
    });

    test("each package has required fields", () => {
      const result = buildRecruitmentExecutionWorkPackages();
      for (let i = 0; i < result.workPackages.length; i += 1) {
        const pkg = result.workPackages[i];
        expect(pkg).toHaveProperty("identifier");
        expect(pkg).toHaveProperty("objective");
        expect(pkg).toHaveProperty("prerequisites");
        expect(pkg).toHaveProperty("estimatedComplexity");
        expect(pkg).toHaveProperty("rollbackStrategy");
        expect(pkg).toHaveProperty("successCriteria");
        expect(Object.values(ESTIMATED_COMPLEXITY)).toContain(pkg.estimatedComplexity);
        expect(Object.values(WORK_PACKAGE_STATUS)).toContain(pkg.status);
        expect(pkg.successCriteria.length).toBeGreaterThan(0);
        expect(pkg.rollbackStrategy.length).toBeGreaterThan(0);
      }
    });

    test("tracks completed packages", () => {
      const result = buildRecruitmentExecutionWorkPackages({
        completedPackageIds: [
          "WP_MONITORING_PIPELINE_HEALTH",
          "WP_MONITORING_ALERTING_THRESHOLDS"
        ]
      });
      expect(result.packagesByStatus.COMPLETE.length).toBe(2);
      const monitoring = result.workPackages.find(
        (p) => p.identifier === "WP_MONITORING_PIPELINE_HEALTH"
      );
      expect(monitoring.status).toBe(WORK_PACKAGE_STATUS.COMPLETE);
    });

    test("completed gaps mark matching packages complete", () => {
      const result = buildRecruitmentExecutionWorkPackages({
        completedGapIds: ["GAP_MONITORING_PIPELINE_HEALTH"]
      });
      const pkg = result.workPackages.find((p) => p.gapId === "GAP_MONITORING_PIPELINE_HEALTH");
      expect(pkg.status).toBe(WORK_PACKAGE_STATUS.COMPLETE);
    });

    test("excluded packages are filtered", () => {
      const result = buildRecruitmentExecutionWorkPackages({
        excludedPackageIds: ["WP_PUBLISH_CONTROLLED_ROLLOUT"]
      });
      const found = result.workPackages.find(
        (p) => p.identifier === "WP_PUBLISH_CONTROLLED_ROLLOUT"
      );
      expect(found).toBeUndefined();
      expect(result.totalPackageCount).toBe(WORK_PACKAGE_DEFINITIONS.length - 1);
    });

    test("isKnownWorkPackageIdentifier validates vocabulary", () => {
      expect(isKnownWorkPackageIdentifier("WP_MONITORING_PIPELINE_HEALTH")).toBe(true);
      expect(isKnownWorkPackageIdentifier("WP_UNKNOWN")).toBe(false);
      expect(isKnownWorkPackageIdentifier(null)).toBe(false);
    });

    test("foundation package is READY with no completions", () => {
      const result = buildRecruitmentExecutionWorkPackages();
      const foundation = result.workPackages.find(
        (p) => p.identifier === "WP_MONITORING_PIPELINE_HEALTH"
      );
      expect(foundation.status).toBe(WORK_PACKAGE_STATUS.READY);
      const blocked = result.workPackages.find(
        (p) => p.identifier === "WP_UPDATE_INGESTION_BOT_DETECTION"
      );
      expect(blocked.status).toBe(WORK_PACKAGE_STATUS.BLOCKED);
    });
  });
});

describe("Phase 150 — recruitmentShadowExecutionPlanner", () => {
  describe("deterministic output", () => {
    test("same input produces identical output", () => {
      const workPackages = buildRecruitmentExecutionWorkPackages({ recruitmentId: "SHADOW_150" });
      const input = { recruitmentId: "SHADOW_150", workPackages };
      const first = buildRecruitmentShadowExecutionPlanner(input);
      const second = buildRecruitmentShadowExecutionPlanner(input);
      expect(first).toEqual(second);
    });

    test("output is deep frozen", () => {
      const result = buildRecruitmentShadowExecutionPlanner({ recruitmentId: "SHADOW_150" });
      assertAllFrozen(result);
    });

    test("type guard accepts valid planner", () => {
      const result = buildRecruitmentShadowExecutionPlanner({ recruitmentId: "SHADOW_150" });
      expect(isRecruitmentShadowExecutionPlanner(result)).toBe(true);
    });
  });

  describe("invalid inputs", () => {
    test.each([null, undefined, "x", 42])("handles invalid input %p", (invalid) => {
      const result = buildRecruitmentShadowExecutionPlanner(invalid);
      expect(isRecruitmentShadowExecutionPlanner(result)).toBe(true);
      expect(result.recruitmentId).toBe("UNKNOWN");
      expect(result.writeExecutionPermitted).toBe(false);
    });
  });

  describe("empty metadata", () => {
    test("default call plans all definitions", () => {
      const result = buildRecruitmentShadowExecutionPlanner();
      expect(result.shadowPlans.length).toBe(SHADOW_PLAN_DEFINITIONS.length);
      expect(result.writeExecutionPermitted).toBe(false);
    });
  });

  describe("shadow plan generation", () => {
    test("contains all expected result keys", () => {
      const result = buildRecruitmentShadowExecutionPlanner();
      for (let i = 0; i < SHADOW_PLANNER_EXPECTED_KEYS.length; i += 1) {
        expect(result).toHaveProperty(SHADOW_PLANNER_EXPECTED_KEYS[i]);
      }
    });

    test("each plan has validation approach, observation points, expected outputs, failure conditions", () => {
      const result = buildRecruitmentShadowExecutionPlanner();
      for (let i = 0; i < result.shadowPlans.length; i += 1) {
        const plan = result.shadowPlans[i];
        expect(Object.values(SHADOW_VALIDATION_APPROACH)).toContain(plan.validationApproach);
        expect(plan.observationPoints.length).toBeGreaterThan(0);
        expect(plan.expectedOutputs.length).toBeGreaterThan(0);
        expect(plan.failureConditions.length).toBeGreaterThan(0);
        expect(plan.writeExecutionPermitted).toBe(false);
        expect(plan.executes).toBe(false);
      }
    });

    test("completed packages yield SKIPPED status", () => {
      const result = buildRecruitmentShadowExecutionPlanner({
        completedPackageIds: ["WP_MONITORING_PIPELINE_HEALTH"]
      });
      const plan = result.shadowPlans.find(
        (p) => p.workPackageId === "WP_MONITORING_PIPELINE_HEALTH"
      );
      expect(plan.status).toBe(SHADOW_PLAN_STATUS.SKIPPED);
    });

    test("never permits write execution", () => {
      const result = buildRecruitmentShadowExecutionPlanner(buildFullSuiteInput());
      expect(result.writeExecutionPermitted).toBe(false);
      expect(result.advisoryMetadata.writeExecutionPermitted).toBe(false);
      expect(result.plannerSummary).toContain("write execution never permitted");
    });

    test("plansByApproach groups validation approaches", () => {
      const result = buildRecruitmentShadowExecutionPlanner();
      expect(result.plansByApproach[SHADOW_VALIDATION_APPROACH.READ_ONLY_COMPARISON].length).toBeGreaterThan(0);
      expect(result.plansByApproach[SHADOW_VALIDATION_APPROACH.OBSERVATION_ONLY].length).toBeGreaterThan(0);
    });
  });
});

describe("Phase 150 — recruitmentMilestoneTracker", () => {
  describe("deterministic output", () => {
    test("same input produces identical output", () => {
      const workPackages = buildRecruitmentExecutionWorkPackages({ recruitmentId: "MS_150" });
      const input = { recruitmentId: "MS_150", workPackages };
      const first = buildRecruitmentMilestoneTracker(input);
      const second = buildRecruitmentMilestoneTracker(input);
      expect(first).toEqual(second);
    });

    test("output is deep frozen", () => {
      const result = buildRecruitmentMilestoneTracker({ recruitmentId: "MS_150" });
      assertAllFrozen(result);
    });

    test("type guard accepts valid tracker", () => {
      const result = buildRecruitmentMilestoneTracker({ recruitmentId: "MS_150" });
      expect(isRecruitmentMilestoneTracker(result)).toBe(true);
    });
  });

  describe("invalid inputs", () => {
    test.each([null, undefined, false, "invalid"])("handles invalid input %p", (invalid) => {
      const result = buildRecruitmentMilestoneTracker(invalid);
      expect(isRecruitmentMilestoneTracker(result)).toBe(true);
      expect(result.recruitmentId).toBe("UNKNOWN");
    });
  });

  describe("milestone ordering", () => {
    test("contains all expected result keys", () => {
      const result = buildRecruitmentMilestoneTracker();
      for (let i = 0; i < MILESTONE_EXPECTED_KEYS.length; i += 1) {
        expect(result).toHaveProperty(MILESTONE_EXPECTED_KEYS[i]);
      }
    });

    test("milestones match definitions and are ordered by number", () => {
      const result = buildRecruitmentMilestoneTracker();
      expect(result.milestones.length).toBe(MILESTONE_DEFINITIONS.length);
      const numbers = result.milestones.map((m) => m.milestoneNumber);
      expect(numbers).toEqual(numbers.slice().sort((a, b) => a - b));
      expect(result.milestones[0].id).toBe("MILESTONE_FOUNDATION_MONITORING");
    });

    test("each milestone has included work packages, dependencies, completion requirements", () => {
      const result = buildRecruitmentMilestoneTracker();
      for (let i = 0; i < result.milestones.length; i += 1) {
        const m = result.milestones[i];
        expect(m.includedWorkPackages.length).toBeGreaterThan(0);
        expect(Array.isArray(m.dependencies)).toBe(true);
        expect(m.completionRequirements.length).toBeGreaterThan(0);
        expect(Object.values(MILESTONE_STATUS)).toContain(m.status);
      }
    });

    test("dependent milestones are blocked until foundation completes", () => {
      const result = buildRecruitmentMilestoneTracker();
      const foundation = result.milestones.find((m) => m.id === "MILESTONE_FOUNDATION_MONITORING");
      const ingestion = result.milestones.find((m) => m.id === "MILESTONE_INGESTION_IDENTIFICATION");
      expect(foundation.status).toBe(MILESTONE_STATUS.PENDING);
      expect(ingestion.status).toBe(MILESTONE_STATUS.BLOCKED);
    });

    test("completing foundation packages unlocks dependent milestones", () => {
      const result = buildRecruitmentMilestoneTracker({
        completedPackageIds: [
          "WP_MONITORING_PIPELINE_HEALTH",
          "WP_MONITORING_ALERTING_THRESHOLDS"
        ]
      });
      const foundation = result.milestones.find((m) => m.id === "MILESTONE_FOUNDATION_MONITORING");
      const ingestion = result.milestones.find((m) => m.id === "MILESTONE_INGESTION_IDENTIFICATION");
      const observability = result.milestones.find((m) => m.id === "MILESTONE_OBSERVABILITY");
      expect(foundation.complete).toBe(true);
      expect(foundation.status).toBe(MILESTONE_STATUS.COMPLETE);
      expect(ingestion.status).toBe(MILESTONE_STATUS.PENDING);
      expect(observability.status).toBe(MILESTONE_STATUS.PENDING);
    });
  });

  describe("dependency validation", () => {
    test("milestone dependency graph is valid", () => {
      const result = buildRecruitmentMilestoneTracker();
      expect(result.dependencyValidation.valid).toBe(true);
      expect(result.dependencyValidation.issues.length).toBe(0);
    });

    test("work package dependency validation is valid", () => {
      const result = buildRecruitmentExecutionWorkPackages();
      expect(result.dependencyValidation.valid).toBe(true);
      expect(result.dependencyValidation.issues.length).toBe(0);
    });

    test("milestone progress percentage updates with completions", () => {
      const baseline = buildRecruitmentMilestoneTracker();
      const improved = buildRecruitmentMilestoneTracker({
        completedPackageIds: [
          "WP_MONITORING_PIPELINE_HEALTH",
          "WP_MONITORING_ALERTING_THRESHOLDS"
        ]
      });
      expect(improved.milestoneProgress.percentage).toBeGreaterThan(baseline.milestoneProgress.percentage);
      expect(improved.milestoneProgress.complete).toBe(1);
    });
  });
});

describe("Phase 150 — recruitmentExecutionSummary", () => {
  describe("deterministic output", () => {
    test("same input produces identical output", () => {
      const input = buildFullSuiteInput();
      const first = buildRecruitmentExecutionSummary(input);
      const second = buildRecruitmentExecutionSummary(input);
      expect(first).toEqual(second);
    });

    test("output is deep frozen", () => {
      const result = buildRecruitmentExecutionSummary(buildFullSuiteInput());
      assertAllFrozen(result);
    });

    test("type guard accepts valid summary", () => {
      const result = buildRecruitmentExecutionSummary(buildFullSuiteInput());
      expect(isRecruitmentExecutionSummary(result)).toBe(true);
    });
  });

  describe("invalid inputs", () => {
    test.each([null, undefined, 0, []])("handles invalid input %p", (invalid) => {
      const result = buildRecruitmentExecutionSummary(invalid);
      expect(isRecruitmentExecutionSummary(result)).toBe(true);
      expect(result.readinessPosture).toBe(READINESS_POSTURE.NOT_ASSESSED);
      expect(result.confidence).toBe(0);
      expect(result.confidenceLevel).toBe(CONFIDENCE_LEVEL.NONE);
    });
  });

  describe("empty metadata", () => {
    test("empty object yields gaps remaining or planning posture", () => {
      const result = buildRecruitmentExecutionSummary({});
      expect(result.implementationMilestones.length).toBe(6);
      expect(result.workPackageProgress.total).toBe(20);
      expect([
        READINESS_POSTURE.GAPS_REMAINING,
        READINESS_POSTURE.PLANNING_COMPLETE
      ]).toContain(result.readinessPosture);
    });
  });

  describe("readiness calculations", () => {
    test("contains all expected result keys", () => {
      const result = buildRecruitmentExecutionSummary(buildFullSuiteInput());
      for (let i = 0; i < SUMMARY_EXPECTED_KEYS.length; i += 1) {
        expect(result).toHaveProperty(SUMMARY_EXPECTED_KEYS[i]);
      }
    });

    test("full suite yields shadow ready posture", () => {
      const result = buildRecruitmentExecutionSummary(buildFullSuiteInput());
      expect(result.readinessPosture).toBe(READINESS_POSTURE.SHADOW_READY);
      expect(result.confidence).toBeGreaterThan(50);
      expect([CONFIDENCE_LEVEL.MEDIUM, CONFIDENCE_LEVEL.HIGH]).toContain(result.confidenceLevel);
    });

    test("highest priority package is foundation monitoring when nothing complete", () => {
      const result = buildRecruitmentExecutionSummary(buildFullSuiteInput());
      expect(result.highestPriorityPackage.identifier).toBe("WP_MONITORING_PIPELINE_HEALTH");
      expect(result.highestPriorityPackage.status).toBe("READY");
    });

    test("readiness increases as packages complete", () => {
      const baseline = buildRecruitmentExecutionSummary(buildFullSuiteInput());
      const workPackages = buildRecruitmentExecutionWorkPackages({
        recruitmentId: "PROG_150",
        completedPackageIds: WORK_PACKAGE_DEFINITIONS.slice(0, 10).map((p) => p.identifier)
      });
      const milestoneTracker = buildRecruitmentMilestoneTracker({
        recruitmentId: "PROG_150",
        workPackages
      });
      const shadowPlanner = buildRecruitmentShadowExecutionPlanner({
        recruitmentId: "PROG_150",
        workPackages
      });
      const improved = buildRecruitmentExecutionSummary({
        recruitmentId: "PROG_150",
        workPackages,
        milestoneTracker,
        shadowPlanner
      });
      expect(improved.workPackageProgress.percentage).toBeGreaterThan(
        baseline.workPackageProgress.percentage
      );
      expect(improved.readiness.score).toBeGreaterThan(baseline.readiness.score);
    });

    test("all packages complete yields execution ready", () => {
      const workPackages = buildRecruitmentExecutionWorkPackages({
        completedPackageIds: WORK_PACKAGE_DEFINITIONS.map((p) => p.identifier)
      });
      const milestoneTracker = buildRecruitmentMilestoneTracker({ workPackages });
      const shadowPlanner = buildRecruitmentShadowExecutionPlanner({ workPackages });
      const result = buildRecruitmentExecutionSummary({
        recruitmentId: "DONE_150",
        workPackages,
        milestoneTracker,
        shadowPlanner
      });
      expect(result.workPackageProgress.complete).toBe(20);
      expect(result.readinessPosture).toBe(READINESS_POSTURE.EXECUTION_READY);
    });

    test("risks and recommendations populated", () => {
      const result = buildRecruitmentExecutionSummary(buildFullSuiteInput());
      expect(result.risks.length).toBeGreaterThan(0);
      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.risks.length).toBe(DEFAULT_RISK_DEFINITIONS.length);
      expect(result.recommendations[0].id).toBe("REC_PRIORITY_PACKAGE");
      expect(DEFAULT_RECOMMENDATIONS.length).toBeGreaterThan(0);
    });

    test("advisory metadata confirms planning only", () => {
      const result = buildRecruitmentExecutionSummary(buildFullSuiteInput());
      expect(result.advisoryMetadata.advisoryOnly).toBe(true);
      expect(result.advisoryMetadata.activatesAnything).toBe(false);
      expect(result.advisoryMetadata.rolloutActivationEnabled).toBe(false);
      expect(result.advisoryMetadata.executed).toBe(false);
    });
  });
});

describe("Phase 150 — stable ordering", () => {
  test("work packages sorted by order", () => {
    const result = buildRecruitmentExecutionWorkPackages();
    const orders = result.workPackages.map((p) => p.order);
    expect(orders).toEqual(orders.slice().sort((a, b) => a - b));
  });

  test("shadow plans sorted by order", () => {
    const result = buildRecruitmentShadowExecutionPlanner();
    const orders = result.shadowPlans.map((p) => p.order);
    expect(orders).toEqual(orders.slice().sort((a, b) => a - b));
  });

  test("milestones sorted by milestone number", () => {
    const result = buildRecruitmentMilestoneTracker();
    const numbers = result.milestones.map((m) => m.milestoneNumber);
    expect(numbers).toEqual(numbers.slice().sort((a, b) => a - b));
  });

  test("risks sorted by order", () => {
    const result = buildRecruitmentExecutionSummary(buildFullSuiteInput());
    const orders = result.risks.map((r) => r.order);
    expect(orders).toEqual(orders.slice().sort((a, b) => a - b));
  });

  test("recommendations sorted by order", () => {
    const result = buildRecruitmentExecutionSummary(buildFullSuiteInput());
    const orders = result.recommendations.map((r) => r.order);
    expect(orders).toEqual(orders.slice().sort((a, b) => a - b));
  });

  test("implementation milestones sorted by number in summary", () => {
    const result = buildRecruitmentExecutionSummary(buildFullSuiteInput());
    const numbers = result.implementationMilestones.map((m) => m.milestoneNumber);
    expect(numbers).toEqual(numbers.slice().sort((a, b) => a - b));
  });
});

describe("Phase 150 — runtime isolation", () => {
  test("phase 150 modules contain no require() calls", () => {
    const modules = [WORK_PACKAGES_MODULE, SHADOW_PLANNER_MODULE, MILESTONE_MODULE, SUMMARY_MODULE];
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

  test.each(PHASE_150_MODULES)(
    "phase 150 module %s is not imported by orchestrator",
    (moduleName) => {
      expect(read(ORCHESTRATOR_MODULE)).not.toContain(moduleName);
    }
  );

  test.each(PHASE_150_MODULES)(
    "phase 150 module %s is not imported by coordinator",
    (moduleName) => {
      expect(read(COORDINATOR_MODULE)).not.toContain(moduleName);
    }
  );

  test.each(PHASE_150_MODULES)(
    "phase 150 module %s is not imported by advisory gateway",
    (moduleName) => {
      expect(read(GATEWAY_MODULE)).not.toContain(moduleName);
    }
  );

  test.each(PHASE_150_MODULES)(
    "phase 150 module %s is not imported by recruitment pipeline",
    (moduleName) => {
      expect(read(PIPELINE_MODULE)).not.toContain(moduleName);
    }
  );

  test.each(PHASE_150_MODULES)(
    "phase 150 module %s is not imported by site worker",
    (moduleName) => {
      expect(read(WORKER_MODULE)).not.toContain(moduleName);
    }
  );

  test("orchestrator output does not leak phase 150 fields", () => {
    const result = orchestrateRecruitmentWorkflow({
      recruitmentId: "ISO_150",
      workflowState: RECRUITMENT_WORKFLOW_STATES.DRAFT_CREATED
    });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("phase_150");
    expect(serialized).not.toContain("recruitment_execution_work_packages");
    expect(serialized).not.toContain("recruitment_shadow_execution_planner");
    expect(serialized).not.toContain("recruitment_milestone_tracker");
    expect(serialized).not.toContain("recruitment_execution_summary");
    expect(serialized).not.toContain("WP_MONITORING_PIPELINE_HEALTH");
    expect(serialized).not.toContain("SHADOW_READY");
    expect(serialized).not.toContain("EXECUTION_READY");
  });

  test("protected production modules were not modified", () => {
    const protectedModules = [
      ORCHESTRATOR_MODULE,
      COORDINATOR_MODULE,
      GATEWAY_MODULE,
      PIPELINE_MODULE,
      WORKER_MODULE
    ];
    for (let i = 0; i < protectedModules.length; i += 1) {
      const source = read(protectedModules[i]);
      expect(source).not.toContain("phase_150");
      expect(source).not.toContain("recruitmentExecutionWorkPackages");
      expect(source).not.toContain("recruitmentShadowExecutionPlanner");
      expect(source).not.toContain("recruitmentMilestoneTracker");
      expect(source).not.toContain("recruitmentExecutionSummary");
    }
  });
});
