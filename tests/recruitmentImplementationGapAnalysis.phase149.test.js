"use strict";

/**
 * Phase 149 — Implementation Gap Analysis Suite tests.
 * Verifies deterministic output, invalid inputs, empty metadata,
 * gap catalog generation, roadmap ordering, dependency validation,
 * readiness calculations, risk matrix generation, stable ordering,
 * and runtime isolation.
 */

const fs = require("fs");
const path = require("path");

const {
  RECRUITMENT_IMPLEMENTATION_GAP_CATALOG_PHASE,
  RECRUITMENT_IMPLEMENTATION_GAP_CATALOG_ENTITY,
  GAP_CATALOG_SCHEMA_VERSION,
  GAP_AREA,
  GAP_AREA_ORDER,
  IMPLEMENTATION_COMPLEXITY,
  PRODUCTION_IMPACT,
  GAP_DEFINITIONS,
  RECRUITMENT_IMPLEMENTATION_GAP_CATALOG_DESCRIPTOR,
  RECRUITMENT_IMPLEMENTATION_GAP_CATALOG_METADATA,
  EXPECTED_RESULT_KEYS: GAP_CATALOG_EXPECTED_KEYS,
  buildRecruitmentImplementationGapCatalog,
  isRecruitmentImplementationGapCatalog,
  isKnownGapIdentifier
} = require("../server/lib/recruitment/recruitmentImplementationGapCatalog");

const {
  RECRUITMENT_IMPLEMENTATION_ROADMAP_PHASE,
  RECRUITMENT_IMPLEMENTATION_ROADMAP_ENTITY,
  ROADMAP_SCHEMA_VERSION,
  ROADMAP_PHASE_IDS,
  RECOMMENDED_PHASE_DEFINITIONS,
  PARALLELIZABLE_WORK_DEFINITIONS,
  BLOCKER_DEFINITIONS,
  DEPENDENCY_CHAIN_DEFINITIONS,
  ROLLOUT_ORDER_DEFINITIONS,
  RECRUITMENT_IMPLEMENTATION_ROADMAP_DESCRIPTOR,
  RECRUITMENT_IMPLEMENTATION_ROADMAP_METADATA,
  EXPECTED_RESULT_KEYS: ROADMAP_EXPECTED_KEYS,
  buildRecruitmentImplementationRoadmap,
  isRecruitmentImplementationRoadmap
} = require("../server/lib/recruitment/recruitmentImplementationRoadmap");

const {
  RECRUITMENT_IMPLEMENTATION_RISK_MATRIX_PHASE,
  RECRUITMENT_IMPLEMENTATION_RISK_MATRIX_ENTITY,
  RISK_MATRIX_SCHEMA_VERSION,
  RISK_SEVERITY,
  OVERALL_RISK_POSTURE,
  TECHNICAL_RISK_DEFINITIONS,
  OPERATIONAL_RISK_DEFINITIONS,
  DEPLOYMENT_RISK_DEFINITIONS,
  ROLLBACK_RISK_DEFINITIONS,
  MITIGATION_STRATEGY_DEFINITIONS,
  RECRUITMENT_IMPLEMENTATION_RISK_MATRIX_DESCRIPTOR,
  RECRUITMENT_IMPLEMENTATION_RISK_MATRIX_METADATA,
  EXPECTED_RESULT_KEYS: RISK_MATRIX_EXPECTED_KEYS,
  buildRecruitmentImplementationRiskMatrix,
  isRecruitmentImplementationRiskMatrix
} = require("../server/lib/recruitment/recruitmentImplementationRiskMatrix");

const {
  RECRUITMENT_IMPLEMENTATION_READINESS_DASHBOARD_PHASE,
  RECRUITMENT_IMPLEMENTATION_READINESS_DASHBOARD_ENTITY,
  DASHBOARD_SCHEMA_VERSION,
  CONFIDENCE_LEVEL,
  READINESS_POSTURE,
  COMPLETED_FOUNDATION_DEFINITIONS,
  RECRUITMENT_IMPLEMENTATION_READINESS_DASHBOARD_DESCRIPTOR,
  RECRUITMENT_IMPLEMENTATION_READINESS_DASHBOARD_METADATA,
  EXPECTED_RESULT_KEYS: DASHBOARD_EXPECTED_KEYS,
  buildRecruitmentImplementationReadinessDashboard,
  isRecruitmentImplementationReadinessDashboard
} = require("../server/lib/recruitment/recruitmentImplementationReadinessDashboard");

const {
  RECRUITMENT_WORKFLOW_STATES,
  orchestrateRecruitmentWorkflow
} = require("../server/lib/recruitment/recruitmentWorkflowOrchestrator");

const ROOT = path.join(__dirname, "..");
const GAP_CATALOG_MODULE = "server/lib/recruitment/recruitmentImplementationGapCatalog.js";
const ROADMAP_MODULE = "server/lib/recruitment/recruitmentImplementationRoadmap.js";
const RISK_MATRIX_MODULE = "server/lib/recruitment/recruitmentImplementationRiskMatrix.js";
const DASHBOARD_MODULE = "server/lib/recruitment/recruitmentImplementationReadinessDashboard.js";
const ORCHESTRATOR_MODULE = "server/lib/recruitment/recruitmentWorkflowOrchestrator.js";
const COORDINATOR_MODULE = "server/lib/recruitment/recruitmentWorkflowIntegrationCoordinator.js";
const GATEWAY_MODULE = "server/lib/recruitment/recruitmentWorkflowAdvisoryGateway.js";
const PIPELINE_MODULE = "server/lib/recruitment/runRecruitmentPipeline.js";
const WORKER_MODULE = "server/services/workers/siteWorker.js";

const PHASE_149_MODULES = [
  "recruitmentImplementationGapCatalog",
  "recruitmentImplementationRoadmap",
  "recruitmentImplementationRiskMatrix",
  "recruitmentImplementationReadinessDashboard"
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

function buildRichGapInput() {
  return {
    recruitmentId: "GAP_149",
    scenarioSummary: { summaryPosture: "READY_FOR_REVIEW" },
    simulationSummary: { posture: "SIMULATION_COMPLETE" }
  };
}

function buildFullSuiteInput() {
  const gapCatalog = buildRecruitmentImplementationGapCatalog(buildRichGapInput());
  const roadmap = buildRecruitmentImplementationRoadmap({ recruitmentId: "GAP_149", gapCatalog });
  const riskMatrix = buildRecruitmentImplementationRiskMatrix({ recruitmentId: "GAP_149", gapCatalog });
  return {
    recruitmentId: "GAP_149",
    gapCatalog,
    roadmap,
    riskMatrix,
    scenarioSummary: { summaryPosture: "READY_FOR_REVIEW" },
    simulationSummary: { posture: "SIMULATION_COMPLETE" },
    integrationReadinessReport: { readinessPosture: "NEARLY_READY" }
  };
}

describe("Phase 149 — module descriptors and constants", () => {
  test("gap catalog descriptor", () => {
    expect(RECRUITMENT_IMPLEMENTATION_GAP_CATALOG_PHASE).toBe(149);
    expect(RECRUITMENT_IMPLEMENTATION_GAP_CATALOG_ENTITY).toBe(
      "recruitment_implementation_gap_catalog"
    );
    expect(GAP_CATALOG_SCHEMA_VERSION).toBe("1.0.0");
    expect(RECRUITMENT_IMPLEMENTATION_GAP_CATALOG_METADATA.advisoryOnly).toBe(true);
    expect(RECRUITMENT_IMPLEMENTATION_GAP_CATALOG_METADATA.runtimeIntegration).toBe(false);
    expect(RECRUITMENT_IMPLEMENTATION_GAP_CATALOG_DESCRIPTOR.phase).toBe(149);
  });

  test("roadmap descriptor", () => {
    expect(RECRUITMENT_IMPLEMENTATION_ROADMAP_PHASE).toBe(149);
    expect(ROADMAP_SCHEMA_VERSION).toBe("1.0.0");
    expect(RECRUITMENT_IMPLEMENTATION_ROADMAP_METADATA.activatesAnything).toBe(false);
  });

  test("risk matrix descriptor", () => {
    expect(RECRUITMENT_IMPLEMENTATION_RISK_MATRIX_PHASE).toBe(149);
    expect(RISK_MATRIX_SCHEMA_VERSION).toBe("1.0.0");
    expect(RECRUITMENT_IMPLEMENTATION_RISK_MATRIX_METADATA.rolloutActivationEnabled).toBe(false);
  });

  test("readiness dashboard descriptor", () => {
    expect(RECRUITMENT_IMPLEMENTATION_READINESS_DASHBOARD_PHASE).toBe(149);
    expect(DASHBOARD_SCHEMA_VERSION).toBe("1.0.0");
    expect(RECRUITMENT_IMPLEMENTATION_READINESS_DASHBOARD_METADATA.executed).toBe(false);
  });
});

describe("Phase 149 — recruitmentImplementationGapCatalog", () => {
  describe("deterministic output", () => {
    test("same input produces identical output", () => {
      const input = buildRichGapInput();
      const first = buildRecruitmentImplementationGapCatalog(input);
      const second = buildRecruitmentImplementationGapCatalog(input);
      expect(first).toEqual(second);
    });

    test("output is deep frozen", () => {
      const result = buildRecruitmentImplementationGapCatalog(buildRichGapInput());
      assertAllFrozen(result);
    });

    test("type guard accepts valid catalog", () => {
      const result = buildRecruitmentImplementationGapCatalog(buildRichGapInput());
      expect(isRecruitmentImplementationGapCatalog(result)).toBe(true);
    });
  });

  describe("invalid inputs", () => {
    test.each([null, undefined, "x", 1, true])("handles invalid input %p", (invalid) => {
      const result = buildRecruitmentImplementationGapCatalog(invalid);
      expect(isRecruitmentImplementationGapCatalog(result)).toBe(true);
      expect(result.recruitmentId).toBe("UNKNOWN");
      expect(result.totalGapCount).toBe(GAP_DEFINITIONS.length);
    });

    test("rejects malformed completedGapIds", () => {
      const result = buildRecruitmentImplementationGapCatalog({
        recruitmentId: "BAD",
        completedGapIds: "not-an-array"
      });
      expect(isRecruitmentImplementationGapCatalog(result)).toBe(true);
      expect(result.recruitmentId).toBe("UNKNOWN");
    });
  });

  describe("empty metadata", () => {
    test("default call with no input", () => {
      const result = buildRecruitmentImplementationGapCatalog();
      expect(result.gaps.length).toBe(GAP_DEFINITIONS.length);
      expect(result.gapAreas).toEqual(GAP_AREA_ORDER);
      expect(result.gaps.every((g) => g.complete === false)).toBe(true);
    });

    test("empty object input", () => {
      const result = buildRecruitmentImplementationGapCatalog({});
      expect(result.recruitmentId).toBe("UNKNOWN");
      expect(result.catalogSummary).toContain("implementation gaps remain");
    });
  });

  describe("gap catalog generation", () => {
    test("contains all expected result keys", () => {
      const result = buildRecruitmentImplementationGapCatalog();
      for (let i = 0; i < GAP_CATALOG_EXPECTED_KEYS.length; i += 1) {
        expect(result).toHaveProperty(GAP_CATALOG_EXPECTED_KEYS[i]);
      }
    });

    test("covers all gap areas", () => {
      const result = buildRecruitmentImplementationGapCatalog();
      expect(result.gapAreas.length).toBe(10);
      for (let a = 0; a < GAP_AREA_ORDER.length; a += 1) {
        const area = GAP_AREA_ORDER[a];
        expect(result.gapsByArea[area].length).toBeGreaterThan(0);
      }
    });

    test("each gap has required fields", () => {
      const result = buildRecruitmentImplementationGapCatalog();
      for (let i = 0; i < result.gaps.length; i += 1) {
        const gap = result.gaps[i];
        expect(gap).toHaveProperty("identifier");
        expect(gap).toHaveProperty("description");
        expect(gap).toHaveProperty("implementationComplexity");
        expect(gap).toHaveProperty("productionImpact");
        expect(gap).toHaveProperty("prerequisiteDependencies");
        expect(Object.values(IMPLEMENTATION_COMPLEXITY)).toContain(gap.implementationComplexity);
        expect(Object.values(PRODUCTION_IMPACT)).toContain(gap.productionImpact);
      }
    });

    test("tracks completed gaps", () => {
      const result = buildRecruitmentImplementationGapCatalog({
        completedGapIds: ["GAP_MONITORING_PIPELINE_HEALTH", "GAP_MONITORING_ALERTING_THRESHOLDS"]
      });
      const completed = result.gaps.filter((g) => g.complete === true);
      expect(completed.length).toBe(2);
      expect(result.totalGapCount).toBe(GAP_DEFINITIONS.length);
    });

    test("excluded areas filter gaps", () => {
      const result = buildRecruitmentImplementationGapCatalog({
        excludedAreas: [GAP_AREA.PUBLISHING, GAP_AREA.OBSERVABILITY]
      });
      const publishingGaps = result.gaps.filter((g) => g.area === GAP_AREA.PUBLISHING);
      const observabilityGaps = result.gaps.filter((g) => g.area === GAP_AREA.OBSERVABILITY);
      expect(publishingGaps.length).toBe(0);
      expect(observabilityGaps.length).toBe(0);
    });

    test("isKnownGapIdentifier validates vocabulary", () => {
      expect(isKnownGapIdentifier("GAP_MONITORING_PIPELINE_HEALTH")).toBe(true);
      expect(isKnownGapIdentifier("GAP_UNKNOWN")).toBe(false);
      expect(isKnownGapIdentifier(null)).toBe(false);
    });
  });
});

describe("Phase 149 — recruitmentImplementationRoadmap", () => {
  describe("deterministic output", () => {
    test("same input produces identical output", () => {
      const gapCatalog = buildRecruitmentImplementationGapCatalog(buildRichGapInput());
      const input = { recruitmentId: "ROAD_149", gapCatalog };
      const first = buildRecruitmentImplementationRoadmap(input);
      const second = buildRecruitmentImplementationRoadmap(input);
      expect(first).toEqual(second);
    });

    test("output is deep frozen", () => {
      const result = buildRecruitmentImplementationRoadmap();
      assertAllFrozen(result);
    });

    test("type guard accepts valid roadmap", () => {
      const result = buildRecruitmentImplementationRoadmap({ recruitmentId: "ROAD_149" });
      expect(isRecruitmentImplementationRoadmap(result)).toBe(true);
    });
  });

  describe("invalid inputs", () => {
    test.each([null, undefined, "x", 42])("handles invalid input %p", (invalid) => {
      const result = buildRecruitmentImplementationRoadmap(invalid);
      expect(isRecruitmentImplementationRoadmap(result)).toBe(true);
      expect(result.recruitmentId).toBe("UNKNOWN");
    });
  });

  describe("roadmap ordering", () => {
    test("contains all expected result keys", () => {
      const result = buildRecruitmentImplementationRoadmap();
      for (let i = 0; i < ROADMAP_EXPECTED_KEYS.length; i += 1) {
        expect(result).toHaveProperty(ROADMAP_EXPECTED_KEYS[i]);
      }
    });

    test("recommended phases match definitions", () => {
      const result = buildRecruitmentImplementationRoadmap();
      expect(result.recommendedPhases.length).toBe(RECOMMENDED_PHASE_DEFINITIONS.length);
      const orders = result.recommendedPhases.map((p) => p.order);
      expect(orders).toEqual(orders.slice().sort((a, b) => a - b));
      expect(result.recommendedPhases[0].id).toBe(ROADMAP_PHASE_IDS.FOUNDATION_MONITORING);
    });

    test("rollout order never activates runtime", () => {
      const result = buildRecruitmentImplementationRoadmap();
      expect(result.rolloutOrder.length).toBe(ROLLOUT_ORDER_DEFINITIONS.length);
      for (let i = 0; i < result.rolloutOrder.length; i += 1) {
        expect(result.rolloutOrder[i].activatesRuntime).toBe(false);
      }
    });

    test("parallelizable work is documented", () => {
      const result = buildRecruitmentImplementationRoadmap();
      expect(result.parallelizableWork.length).toBe(PARALLELIZABLE_WORK_DEFINITIONS.length);
    });

    test("blockers reference known gaps", () => {
      const result = buildRecruitmentImplementationRoadmap();
      expect(result.blockers.length).toBe(BLOCKER_DEFINITIONS.length);
      for (let i = 0; i < result.blockers.length; i += 1) {
        expect(isKnownGapIdentifier(result.blockers[i].gapId)).toBe(true);
      }
    });
  });

  describe("dependency validation", () => {
    test("valid when gap catalog provided", () => {
      const gapCatalog = buildRecruitmentImplementationGapCatalog();
      const result = buildRecruitmentImplementationRoadmap({ gapCatalog });
      expect(result.dependencyValidation.valid).toBe(true);
      expect(result.dependencyValidation.issues.length).toBe(0);
    });

    test("dependency chain has stable ordering", () => {
      const result = buildRecruitmentImplementationRoadmap();
      const orders = result.dependencyChain.map((d) => d.order);
      expect(orders).toEqual(orders.slice().sort((a, b) => a - b));
      expect(result.dependencyChain.length).toBe(DEPENDENCY_CHAIN_DEFINITIONS.length);
    });

    test("phase completion tracked via gap catalog", () => {
      const gapCatalog = buildRecruitmentImplementationGapCatalog({
        completedGapIds: [
          "GAP_MONITORING_PIPELINE_HEALTH",
          "GAP_MONITORING_ALERTING_THRESHOLDS"
        ]
      });
      const result = buildRecruitmentImplementationRoadmap({ gapCatalog });
      const foundationPhase = result.recommendedPhases.find(
        (p) => p.id === ROADMAP_PHASE_IDS.FOUNDATION_MONITORING
      );
      expect(foundationPhase.complete).toBe(true);
      expect(foundationPhase.remainingGapCount).toBe(0);
    });
  });
});

describe("Phase 149 — recruitmentImplementationRiskMatrix", () => {
  describe("deterministic output", () => {
    test("same input produces identical output", () => {
      const input = { recruitmentId: "RISK_149", gapCatalog: buildRecruitmentImplementationGapCatalog() };
      const first = buildRecruitmentImplementationRiskMatrix(input);
      const second = buildRecruitmentImplementationRiskMatrix(input);
      expect(first).toEqual(second);
    });

    test("output is deep frozen", () => {
      const result = buildRecruitmentImplementationRiskMatrix({ recruitmentId: "RISK_149" });
      assertAllFrozen(result);
    });

    test("type guard accepts valid risk matrix", () => {
      const result = buildRecruitmentImplementationRiskMatrix({ recruitmentId: "RISK_149" });
      expect(isRecruitmentImplementationRiskMatrix(result)).toBe(true);
    });
  });

  describe("invalid inputs", () => {
    test.each([null, undefined, false, "invalid"])("handles invalid input %p", (invalid) => {
      const result = buildRecruitmentImplementationRiskMatrix(invalid);
      expect(isRecruitmentImplementationRiskMatrix(result)).toBe(true);
      expect(result.recruitmentId).toBe("UNKNOWN");
    });
  });

  describe("risk matrix generation", () => {
    test("contains all expected result keys", () => {
      const result = buildRecruitmentImplementationRiskMatrix({ recruitmentId: "RISK_149" });
      for (let i = 0; i < RISK_MATRIX_EXPECTED_KEYS.length; i += 1) {
        expect(result).toHaveProperty(RISK_MATRIX_EXPECTED_KEYS[i]);
      }
    });

    test("all risk categories populated", () => {
      const result = buildRecruitmentImplementationRiskMatrix({ recruitmentId: "RISK_149" });
      expect(result.technicalRisk.length).toBe(TECHNICAL_RISK_DEFINITIONS.length);
      expect(result.operationalRisk.length).toBe(OPERATIONAL_RISK_DEFINITIONS.length);
      expect(result.deploymentRisk.length).toBe(DEPLOYMENT_RISK_DEFINITIONS.length);
      expect(result.rollbackRisk.length).toBe(ROLLBACK_RISK_DEFINITIONS.length);
      expect(result.mitigationStrategies.length).toBe(MITIGATION_STRATEGY_DEFINITIONS.length);
    });

    test("overall risk posture is elevated or higher for full gap set", () => {
      const result = buildRecruitmentImplementationRiskMatrix({ recruitmentId: "RISK_149" });
      expect([OVERALL_RISK_POSTURE.ELEVATED, OVERALL_RISK_POSTURE.HIGH, OVERALL_RISK_POSTURE.CRITICAL]).toContain(
        result.overallRiskPosture
      );
      expect(result.overallRiskScore).toBeGreaterThan(0);
      expect(result.riskSummary).toContain("risk posture");
    });

    test("each risk has severity from vocabulary", () => {
      const result = buildRecruitmentImplementationRiskMatrix({ recruitmentId: "RISK_149" });
      const allRisks = result.technicalRisk
        .concat(result.operationalRisk)
        .concat(result.deploymentRisk)
        .concat(result.rollbackRisk);
      for (let i = 0; i < allRisks.length; i += 1) {
        expect(Object.values(RISK_SEVERITY)).toContain(allRisks[i].severity);
      }
    });

    test("mitigation strategies address documented risks", () => {
      const result = buildRecruitmentImplementationRiskMatrix({ recruitmentId: "RISK_149" });
      for (let i = 0; i < result.mitigationStrategies.length; i += 1) {
        expect(result.mitigationStrategies[i].addressesRiskIds.length).toBeGreaterThan(0);
        expect(result.mitigationStrategies[i].strategy.length).toBeGreaterThan(0);
      }
    });
  });
});

describe("Phase 149 — recruitmentImplementationReadinessDashboard", () => {
  describe("deterministic output", () => {
    test("same input produces identical output", () => {
      const input = buildFullSuiteInput();
      const first = buildRecruitmentImplementationReadinessDashboard(input);
      const second = buildRecruitmentImplementationReadinessDashboard(input);
      expect(first).toEqual(second);
    });

    test("output is deep frozen", () => {
      const result = buildRecruitmentImplementationReadinessDashboard(buildFullSuiteInput());
      assertAllFrozen(result);
    });

    test("type guard accepts valid dashboard", () => {
      const result = buildRecruitmentImplementationReadinessDashboard(buildFullSuiteInput());
      expect(isRecruitmentImplementationReadinessDashboard(result)).toBe(true);
    });
  });

  describe("invalid inputs", () => {
    test.each([null, undefined, 0, []])("handles invalid input %p", (invalid) => {
      const result = buildRecruitmentImplementationReadinessDashboard(invalid);
      expect(isRecruitmentImplementationReadinessDashboard(result)).toBe(true);
      expect(result.readinessPosture).toBe(READINESS_POSTURE.NOT_ASSESSED);
      expect(result.confidence).toBe(0);
      expect(result.confidenceLevel).toBe(CONFIDENCE_LEVEL.NONE);
    });
  });

  describe("empty metadata", () => {
    test("empty object yields gaps remaining posture", () => {
      const result = buildRecruitmentImplementationReadinessDashboard({});
      expect(result.remainingGaps.length).toBe(20);
      expect(result.readinessPosture).toBe(READINESS_POSTURE.GAPS_REMAINING);
      expect(result.readinessPercentage).toBeGreaterThan(0);
    });
  });

  describe("readiness calculations", () => {
    test("contains all expected result keys", () => {
      const result = buildRecruitmentImplementationReadinessDashboard(buildFullSuiteInput());
      for (let i = 0; i < DASHBOARD_EXPECTED_KEYS.length; i += 1) {
        expect(result).toHaveProperty(DASHBOARD_EXPECTED_KEYS[i]);
      }
    });

    test("completed foundations include phases through 149", () => {
      const result = buildRecruitmentImplementationReadinessDashboard(buildFullSuiteInput());
      expect(result.completedFoundations.length).toBe(COMPLETED_FOUNDATION_DEFINITIONS.length);
      const phase149 = result.completedFoundations.find(
        (f) => f.id === "FOUNDATION_IMPLEMENTATION_GAP_ANALYSIS"
      );
      expect(phase149).toBeDefined();
      expect(phase149.phase).toBe(149);
      expect(phase149.status).toBe("COMPLETE");
    });

    test("readiness percentage increases as gaps complete", () => {
      const baseline = buildRecruitmentImplementationReadinessDashboard(buildFullSuiteInput());
      const gapCatalog = buildRecruitmentImplementationGapCatalog({
        completedGapIds: GAP_DEFINITIONS.slice(0, 10).map((g) => g.identifier)
      });
      const improved = buildRecruitmentImplementationReadinessDashboard({
        ...buildFullSuiteInput(),
        gapCatalog
      });
      expect(improved.readinessPercentage).toBeGreaterThan(baseline.readinessPercentage);
      expect(improved.remainingGaps.length).toBeLessThan(baseline.remainingGaps.length);
    });

    test("all gaps complete yields implementation ready", () => {
      const gapCatalog = buildRecruitmentImplementationGapCatalog({
        completedGapIds: GAP_DEFINITIONS.map((g) => g.identifier)
      });
      const result = buildRecruitmentImplementationReadinessDashboard({
        ...buildFullSuiteInput(),
        gapCatalog
      });
      expect(result.remainingGaps.length).toBe(0);
      expect(result.readinessPosture).toBe(READINESS_POSTURE.IMPLEMENTATION_READY);
    });

    test("highest priority items sorted by impact", () => {
      const gapCatalog = buildRecruitmentImplementationGapCatalog();
      const result = buildRecruitmentImplementationReadinessDashboard({
        recruitmentId: "PRIORITY_149",
        gapCatalog
      });
      expect(result.highestPriorityItems.length).toBeGreaterThan(0);
      expect(result.highestPriorityItems.length).toBeLessThanOrEqual(5);
      for (let i = 1; i < result.highestPriorityItems.length; i += 1) {
        expect(result.highestPriorityItems[i - 1].priorityScore).toBeGreaterThanOrEqual(
          result.highestPriorityItems[i].priorityScore
        );
      }
    });

    test("next recommended milestones from roadmap", () => {
      const gapCatalog = buildRecruitmentImplementationGapCatalog();
      const roadmap = buildRecruitmentImplementationRoadmap({ gapCatalog });
      const result = buildRecruitmentImplementationReadinessDashboard({
        recruitmentId: "MILESTONE_149",
        gapCatalog,
        roadmap
      });
      expect(result.nextRecommendedMilestones.length).toBeGreaterThan(0);
      expect(result.nextRecommendedMilestones[0].id).toBe(ROADMAP_PHASE_IDS.FOUNDATION_MONITORING);
    });

    test("rich input yields higher confidence", () => {
      const result = buildRecruitmentImplementationReadinessDashboard(buildFullSuiteInput());
      expect(result.confidence).toBeGreaterThan(50);
      expect([CONFIDENCE_LEVEL.MEDIUM, CONFIDENCE_LEVEL.HIGH]).toContain(result.confidenceLevel);
    });

    test("advisory metadata confirms planning only", () => {
      const result = buildRecruitmentImplementationReadinessDashboard(buildFullSuiteInput());
      expect(result.advisoryMetadata.advisoryOnly).toBe(true);
      expect(result.advisoryMetadata.activatesAnything).toBe(false);
      expect(result.advisoryMetadata.rolloutActivationEnabled).toBe(false);
    });
  });
});

describe("Phase 149 — stable ordering", () => {
  test("gap catalog gaps sorted by order", () => {
    const result = buildRecruitmentImplementationGapCatalog();
    const orders = result.gaps.map((g) => g.order);
    expect(orders).toEqual(orders.slice().sort((a, b) => a - b));
  });

  test("roadmap dependency chain sorted by order", () => {
    const result = buildRecruitmentImplementationRoadmap();
    const orders = result.dependencyChain.map((d) => d.order);
    expect(orders).toEqual(orders.slice().sort((a, b) => a - b));
  });

  test("technical risks sorted by order", () => {
    const result = buildRecruitmentImplementationRiskMatrix({ recruitmentId: "ORDER_149" });
    const orders = result.technicalRisk.map((r) => r.order);
    expect(orders).toEqual(orders.slice().sort((a, b) => a - b));
  });

  test("mitigation strategies sorted by order", () => {
    const result = buildRecruitmentImplementationRiskMatrix({ recruitmentId: "ORDER_149" });
    const orders = result.mitigationStrategies.map((m) => m.order);
    expect(orders).toEqual(orders.slice().sort((a, b) => a - b));
  });

  test("completed foundations sorted by order", () => {
    const result = buildRecruitmentImplementationReadinessDashboard(buildFullSuiteInput());
    const orders = result.completedFoundations.map((f) => f.order);
    expect(orders).toEqual(orders.slice().sort((a, b) => a - b));
  });
});

describe("Phase 149 — runtime isolation", () => {
  test("phase 149 modules contain no require() calls", () => {
    const modules = [GAP_CATALOG_MODULE, ROADMAP_MODULE, RISK_MATRIX_MODULE, DASHBOARD_MODULE];
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

  test.each(PHASE_149_MODULES)(
    "phase 149 module %s is not imported by orchestrator",
    (moduleName) => {
      expect(read(ORCHESTRATOR_MODULE)).not.toContain(moduleName);
    }
  );

  test.each(PHASE_149_MODULES)(
    "phase 149 module %s is not imported by coordinator",
    (moduleName) => {
      expect(read(COORDINATOR_MODULE)).not.toContain(moduleName);
    }
  );

  test.each(PHASE_149_MODULES)(
    "phase 149 module %s is not imported by advisory gateway",
    (moduleName) => {
      expect(read(GATEWAY_MODULE)).not.toContain(moduleName);
    }
  );

  test.each(PHASE_149_MODULES)(
    "phase 149 module %s is not imported by recruitment pipeline",
    (moduleName) => {
      expect(read(PIPELINE_MODULE)).not.toContain(moduleName);
    }
  );

  test.each(PHASE_149_MODULES)(
    "phase 149 module %s is not imported by site worker",
    (moduleName) => {
      expect(read(WORKER_MODULE)).not.toContain(moduleName);
    }
  );

  test("orchestrator output does not leak phase 149 fields", () => {
    const result = orchestrateRecruitmentWorkflow({
      recruitmentId: "ISO_149",
      workflowState: RECRUITMENT_WORKFLOW_STATES.DRAFT_CREATED
    });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("phase_149");
    expect(serialized).not.toContain("recruitment_implementation_gap_catalog");
    expect(serialized).not.toContain("recruitment_implementation_roadmap");
    expect(serialized).not.toContain("recruitment_implementation_risk_matrix");
    expect(serialized).not.toContain("recruitment_implementation_readiness_dashboard");
    expect(serialized).not.toContain("IMPLEMENTATION_READY");
    expect(serialized).not.toContain("GAP_MONITORING_PIPELINE_HEALTH");
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
      expect(source).not.toContain("phase_149");
      expect(source).not.toContain("recruitmentImplementationGapCatalog");
      expect(source).not.toContain("recruitmentImplementationRoadmap");
      expect(source).not.toContain("recruitmentImplementationRiskMatrix");
      expect(source).not.toContain("recruitmentImplementationReadinessDashboard");
    }
  });
});
