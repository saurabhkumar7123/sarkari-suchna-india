"use strict";

/**
 * Phase 133 — Recruitment Workflow Advisory Consistency Validator tests.
 * Empty input, unknown input, consistent/inconsistent advisory sets,
 * validation summary, metadata, determinism, immutability,
 * and architecture boundaries.
 */

const fs = require("fs");
const path = require("path");

const {
  RECRUITMENT_WORKFLOW_CONSISTENCY_VALIDATOR_PHASE,
  RECRUITMENT_WORKFLOW_CONSISTENCY_VALIDATOR_ENTITY,
  CONSISTENCY_STATUS,
  TIMELINE_STATUS,
  WORKFLOW_STAGES,
  HEALTH_STATUS,
  RISK_LEVEL,
  RECOMMENDATION_STATUS,
  CONSISTENCY_RULE,
  VALIDATED_AREA,
  RECRUITMENT_WORKFLOW_CONSISTENCY_VALIDATOR_METADATA,
  validateRecruitmentWorkflowConsistency
} = require("../server/lib/recruitment/recruitmentWorkflowConsistencyValidator");

const {
  RECRUITMENT_WORKFLOW_STATES,
  orchestrateRecruitmentWorkflow
} = require("../server/lib/recruitment/recruitmentWorkflowOrchestrator");

const ROOT = path.join(__dirname, "..");
const MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowConsistencyValidator.js";
const TIMELINE_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowTimelineModel.js";
const RECOMMENDATION_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowRecommendationModel.js";
const INTELLIGENCE_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowIntelligenceSummary.js";
const RISK_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowRiskAssessment.js";
const HEALTH_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowHealthIndicator.js";
const EVOLUTION_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowEvolutionAnalyzer.js";
const COMPARISON_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowSnapshotComparison.js";
const SNAPSHOT_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowAdvisorySnapshot.js";
const ORCHESTRATOR_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowOrchestrator.js";
const TRACE_MODEL_MODULE_PATH = "server/lib/recruitment/workflowDecisionTraceModel.js";
const REGISTRY_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowCapabilityRegistry.js";
const READINESS_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowReadinessAssessment.js";
const REPORT_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowAdvisoryReportGenerator.js";
const COORDINATOR_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowIntegrationCoordinator.js";
const GATEWAY_MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowAdvisoryGateway.js";
const PIPELINE_MODULE_PATH = "server/lib/recruitment/runRecruitmentPipeline.js";
const WORKER_MODULE_PATH = "server/services/workers/siteWorker.js";
const OBSERVATION_REGISTRY_MODULE_PATH =
  "server/lib/recruitment/recruitmentWorkflowObservationRegistry.js";

const EXPECTED_RESULT_KEYS = Object.freeze([
  "consistencyStatus",
  "inconsistencies",
  "validatedAreas",
  "validationSummary",
  "advisoryMetadata"
]);

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

function buildConsistentInput(overrides = {}) {
  return {
    timeline: {
      currentStage: WORKFLOW_STAGES.FINAL_RESULT,
      timelineStatus: TIMELINE_STATUS.COMPLETED
    },
    intelligenceSummary: {
      currentState: {
        health: HEALTH_STATUS.HEALTHY,
        risk: RISK_LEVEL.LOW
      }
    },
    health: { healthStatus: HEALTH_STATUS.HEALTHY },
    risk: { riskLevel: RISK_LEVEL.LOW },
    recommendation: { recommendationStatus: RECOMMENDATION_STATUS.PROCEED },
    ...overrides
  };
}

describe("Phase 133 — recruitmentWorkflowConsistencyValidator", () => {
  describe("exports", () => {
    test("phase constants and metadata", () => {
      expect(RECRUITMENT_WORKFLOW_CONSISTENCY_VALIDATOR_PHASE).toBe(133);
      expect(RECRUITMENT_WORKFLOW_CONSISTENCY_VALIDATOR_ENTITY).toBe(
        "recruitment_workflow_consistency_validator"
      );
      expect(CONSISTENCY_STATUS.CONSISTENT).toBe("CONSISTENT");
      expect(CONSISTENCY_STATUS.INCONSISTENT).toBe("INCONSISTENT");
      expect(CONSISTENCY_STATUS.UNKNOWN).toBe("UNKNOWN");
      expect(CONSISTENCY_RULE.FINAL_RESULT_SHOULD_NOT_RECOMMEND_REVIEW).toBe(
        "FINAL_RESULT_SHOULD_NOT_RECOMMEND_REVIEW"
      );
      expect(RECRUITMENT_WORKFLOW_CONSISTENCY_VALIDATOR_METADATA.advisoryOnly).toBe(true);
      expect(RECRUITMENT_WORKFLOW_CONSISTENCY_VALIDATOR_METADATA.persistent).toBe(false);
      expect(RECRUITMENT_WORKFLOW_CONSISTENCY_VALIDATOR_METADATA.generatedBy).toBe("phase_133");
      expect(RECRUITMENT_WORKFLOW_CONSISTENCY_VALIDATOR_METADATA.autoCorrectionEnabled).toBe(false);
      expect(RECRUITMENT_WORKFLOW_CONSISTENCY_VALIDATOR_METADATA.automationEnabled).toBe(false);
    });
  });

  describe("empty input", () => {
    test("returns unknown consistency for null, undefined, empty object, and non-object input", () => {
      for (const input of [null, undefined, {}, "bad", 42, true]) {
        const result = validateRecruitmentWorkflowConsistency(input);

        expect(Object.keys(result).sort()).toEqual([...EXPECTED_RESULT_KEYS].sort());
        expect(result.consistencyStatus).toBe(CONSISTENCY_STATUS.UNKNOWN);
        expect(result.inconsistencies).toEqual([]);
        expect(result.validatedAreas).toEqual([]);
        expect(result.validationSummary).toBe(
          "Recruitment workflow advisory consistency could not be determined from supplied signals"
        );
        expect(result.advisoryMetadata.generatedBy).toBe("phase_133");
      }
    });

    test("returns unknown consistency for malformed input fields", () => {
      const malformedInputs = [
        { timeline: [] },
        { intelligenceSummary: 42 },
        { health: true },
        { risk: {} },
        { recommendation: null }
      ];

      for (const input of malformedInputs) {
        const result = validateRecruitmentWorkflowConsistency(input);

        expect(result.consistencyStatus).toBe(CONSISTENCY_STATUS.UNKNOWN);
        expect(result.inconsistencies).toEqual([]);
      }
    });
  });

  describe("unknown input", () => {
    test("returns unknown status when signals are present but inconclusive", () => {
      const result = validateRecruitmentWorkflowConsistency({
        timeline: { currentStage: "CUSTOM_STAGE" },
        health: { healthStatus: "CUSTOM_HEALTH" }
      });

      expect(result.consistencyStatus).toBe(CONSISTENCY_STATUS.UNKNOWN);
      expect(result.inconsistencies).toEqual([]);
      expect(result.validatedAreas).toEqual([]);
    });
  });

  describe("consistent advisory set", () => {
    test("reports consistent status for aligned timeline, health, risk, and recommendation signals", () => {
      const result = validateRecruitmentWorkflowConsistency(buildConsistentInput());

      expect(result.consistencyStatus).toBe(CONSISTENCY_STATUS.CONSISTENT);
      expect(result.inconsistencies).toEqual([]);
      expect(result.validatedAreas).toEqual(
        expect.arrayContaining([
          VALIDATED_AREA.TIMELINE,
          VALIDATED_AREA.HEALTH,
          VALIDATED_AREA.RISK,
          VALIDATED_AREA.RECOMMENDATION,
          VALIDATED_AREA.INTELLIGENCE_SUMMARY
        ])
      );
    });

    test("accepts string shorthand for advisory signals", () => {
      const result = validateRecruitmentWorkflowConsistency({
        timeline: WORKFLOW_STAGES.FINAL_RESULT,
        health: HEALTH_STATUS.HEALTHY,
        risk: RISK_LEVEL.LOW,
        recommendation: RECOMMENDATION_STATUS.PROCEED
      });

      expect(result.consistencyStatus).toBe(CONSISTENCY_STATUS.CONSISTENT);
      expect(result.inconsistencies).toEqual([]);
    });
  });

  describe("inconsistent recommendation", () => {
    test("flags FINAL_RESULT timeline with REVIEW_REQUIRED recommendation as inconsistent", () => {
      const result = validateRecruitmentWorkflowConsistency({
        timeline: WORKFLOW_STAGES.FINAL_RESULT,
        recommendation: RECOMMENDATION_STATUS.REVIEW_REQUIRED
      });

      expect(result.consistencyStatus).toBe(CONSISTENCY_STATUS.INCONSISTENT);
      expect(result.inconsistencies).toHaveLength(1);
      expect(result.inconsistencies[0].rule).toBe(
        CONSISTENCY_RULE.FINAL_RESULT_SHOULD_NOT_RECOMMEND_REVIEW
      );
      expect(result.inconsistencies[0].detail).toBe(
        "FINAL_RESULT timeline stage should not recommend approval review"
      );
      expect(result.inconsistencies[0].observed).toEqual({
        timeline: WORKFLOW_STAGES.FINAL_RESULT,
        recommendation: RECOMMENDATION_STATUS.REVIEW_REQUIRED
      });
    });
  });

  describe("inconsistent health", () => {
    test("flags BLOCKED health with LOW risk as inconsistent", () => {
      const result = validateRecruitmentWorkflowConsistency({
        health: HEALTH_STATUS.BLOCKED,
        risk: RISK_LEVEL.LOW
      });

      expect(result.consistencyStatus).toBe(CONSISTENCY_STATUS.INCONSISTENT);
      expect(result.inconsistencies).toHaveLength(1);
      expect(result.inconsistencies[0].rule).toBe(
        CONSISTENCY_RULE.BLOCKED_HEALTH_SHOULD_NOT_PRODUCE_LOW_RISK
      );
      expect(result.inconsistencies[0].detail).toBe(
        "BLOCKED health status should not coexist with LOW risk level"
      );
      expect(result.inconsistencies[0].observed).toEqual({
        health: HEALTH_STATUS.BLOCKED,
        risk: RISK_LEVEL.LOW
      });
    });

    test("flags HEALTHY health with BLOCKED timeline status as inconsistent", () => {
      const result = validateRecruitmentWorkflowConsistency({
        timeline: { timelineStatus: TIMELINE_STATUS.BLOCKED },
        health: HEALTH_STATUS.HEALTHY
      });

      expect(result.consistencyStatus).toBe(CONSISTENCY_STATUS.INCONSISTENT);
      expect(result.inconsistencies).toHaveLength(1);
      expect(result.inconsistencies[0].rule).toBe(
        CONSISTENCY_RULE.HEALTHY_SHOULD_NOT_COEXIST_WITH_BLOCKED_TIMELINE
      );
      expect(result.inconsistencies[0].detail).toBe(
        "HEALTHY health status should not coexist with BLOCKED timeline status"
      );
      expect(result.inconsistencies[0].observed).toEqual({
        health: HEALTH_STATUS.HEALTHY,
        timeline: TIMELINE_STATUS.BLOCKED
      });
    });
  });

  describe("inconsistent risk", () => {
    test("flags PROCEED recommendation with CRITICAL risk as inconsistent", () => {
      const result = validateRecruitmentWorkflowConsistency({
        recommendation: RECOMMENDATION_STATUS.PROCEED,
        risk: RISK_LEVEL.CRITICAL
      });

      expect(result.consistencyStatus).toBe(CONSISTENCY_STATUS.INCONSISTENT);
      expect(result.inconsistencies).toHaveLength(1);
      expect(result.inconsistencies[0].rule).toBe(
        CONSISTENCY_RULE.PROCEED_SHOULD_NOT_COEXIST_WITH_CRITICAL_RISK
      );
      expect(result.inconsistencies[0].detail).toBe(
        "PROCEED recommendation should not coexist with CRITICAL risk level"
      );
      expect(result.inconsistencies[0].observed).toEqual({
        recommendation: RECOMMENDATION_STATUS.PROCEED,
        risk: RISK_LEVEL.CRITICAL
      });
    });
  });

  describe("validation summary", () => {
    test("describes consistent advisory validation", () => {
      const result = validateRecruitmentWorkflowConsistency(buildConsistentInput());

      expect(result.validationSummary).toBe(
        "Recruitment workflow advisory outputs are logically consistent across validated areas"
      );
    });

    test("describes inconsistent advisory validation", () => {
      const result = validateRecruitmentWorkflowConsistency({
        timeline: WORKFLOW_STAGES.FINAL_RESULT,
        recommendation: RECOMMENDATION_STATUS.REVIEW_REQUIRED
      });

      expect(result.validationSummary).toBe(
        "Recruitment workflow advisory outputs are inconsistent: FINAL_RESULT timeline stage should not recommend approval review"
      );
    });

    test("describes unknown advisory validation", () => {
      const result = validateRecruitmentWorkflowConsistency({});

      expect(result.validationSummary).toBe(
        "Recruitment workflow advisory consistency could not be determined from supplied signals"
      );
    });
  });

  describe("metadata", () => {
    test("includes advisory consistency metadata on every result", () => {
      const result = validateRecruitmentWorkflowConsistency(buildConsistentInput());

      expect(result.advisoryMetadata.advisoryOnly).toBe(true);
      expect(result.advisoryMetadata.persistent).toBe(false);
      expect(result.advisoryMetadata.generatedBy).toBe("phase_133");
      expect(result.advisoryMetadata.phase).toBe(133);
      expect(result.advisoryMetadata.architectureOnly).toBe(true);
      expect(result.advisoryMetadata.executed).toBe(false);
      expect(result.advisoryMetadata.persistenceEnabled).toBe(false);
      expect(result.advisoryMetadata.validationPersistence).toBe(false);
      expect(result.advisoryMetadata.autoCorrectionEnabled).toBe(false);
      expect(result.advisoryMetadata.automationEnabled).toBe(false);
      expect(result.advisoryMetadata.alertingEnabled).toBe(false);
      expect(result.advisoryMetadata.historyTracking).toBe(false);
      expect(result.advisoryMetadata.sideEffects).toBe(false);
      expect(result.advisoryMetadata.mutatesInput).toBe(false);
      expect(result.advisoryMetadata.advisoryConsistencyOnly).toBe(true);
    });

    test("exported metadata matches result metadata contract", () => {
      expect(RECRUITMENT_WORKFLOW_CONSISTENCY_VALIDATOR_METADATA.runtimeIntegration).toBe(false);
      expect(RECRUITMENT_WORKFLOW_CONSISTENCY_VALIDATOR_METADATA.mutatesProduction).toBe(false);
      expect(RECRUITMENT_WORKFLOW_CONSISTENCY_VALIDATOR_METADATA.sourcePhases).toEqual([
        128, 129, 130, 131, 132
      ]);
    });
  });

  describe("deterministic output", () => {
    test("returns identical validation for identical input", () => {
      const input = buildConsistentInput();

      const first = validateRecruitmentWorkflowConsistency(input);
      const second = validateRecruitmentWorkflowConsistency(input);

      expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    });
  });

  describe("immutability", () => {
    test("deep freezes consistency validation output", () => {
      const result = validateRecruitmentWorkflowConsistency({
        timeline: WORKFLOW_STAGES.FINAL_RESULT,
        recommendation: RECOMMENDATION_STATUS.REVIEW_REQUIRED
      });

      assertAllFrozen(result);
      expect(() => {
        result.consistencyStatus = "CHANGED";
      }).toThrow();
      expect(() => {
        result.inconsistencies.push({});
      }).toThrow();
      expect(() => {
        result.validatedAreas.push("extra");
      }).toThrow();
      expect(() => {
        result.validationSummary = "CHANGED";
      }).toThrow();
      expect(() => {
        result.advisoryMetadata.persistent = true;
      }).toThrow();
      expect(() => {
        result.inconsistencies[0].detail = "CHANGED";
      }).toThrow();
    });
  });

  describe("input unchanged", () => {
    test("does not mutate consistency input or nested advisory objects", () => {
      const input = {
        timeline: {
          currentStage: WORKFLOW_STAGES.FINAL_RESULT,
          timelineStatus: TIMELINE_STATUS.COMPLETED
        },
        intelligenceSummary: {
          currentState: {
            health: HEALTH_STATUS.HEALTHY,
            risk: RISK_LEVEL.LOW
          }
        },
        health: { healthStatus: HEALTH_STATUS.HEALTHY },
        risk: { riskLevel: RISK_LEVEL.LOW },
        recommendation: { recommendationStatus: RECOMMENDATION_STATUS.PROCEED }
      };

      const before = JSON.stringify(input);
      const timelineBefore = JSON.stringify(input.timeline);
      const intelligenceBefore = JSON.stringify(input.intelligenceSummary);

      validateRecruitmentWorkflowConsistency(input);
      validateRecruitmentWorkflowConsistency(input);

      expect(JSON.stringify(input)).toBe(before);
      expect(JSON.stringify(input.timeline)).toBe(timelineBefore);
      expect(JSON.stringify(input.intelligenceSummary)).toBe(intelligenceBefore);
    });

    test("consistency validator does not mutate process environment", () => {
      const envBefore = { ...process.env };
      validateRecruitmentWorkflowConsistency(buildConsistentInput());
      expect(process.env).toEqual(envBefore);
    });
  });

  describe("no persistence", () => {
    test("module source declares no persistence or validation storage", () => {
      const source = read(MODULE_PATH);

      expect(source).toContain("No database access, no persistence");
      expect(source).toContain("validationPersistence: false");
      expect(source).toContain("historyTracking: false");
      expect(source).not.toMatch(/INSERT INTO/i);
      expect(source).not.toMatch(/UPDATE\s+/i);
      expect(source).not.toMatch(/saveValidation/i);
      expect(source).not.toMatch(/persistValidation/i);
    });
  });

  describe("no runtime wiring", () => {
    test("module source declares pure advisory consistency constraints for phase 133", () => {
      const source = read(MODULE_PATH);

      expect(source).toContain("Phase 133");
      expect(source).toContain("validateRecruitmentWorkflowConsistency");
      expect(source).toContain("advisoryConsistencyOnly");
      expect(source).toContain("Never mutates input");
      expect(source).toContain("No auto-correction");
      expect(source).not.toMatch(/require\(["']\.\//);
      expect(source).not.toMatch(/require\(["']fs["']\)/);
      expect(source).not.toMatch(/require\(["']express/);
      expect(source).not.toMatch(/require\(["']\.\.\/config\/db/);
      expect(source).not.toMatch(/mysql2/);
    });

    test("consistency validator is not wired into timeline model, recommendation model, intelligence summary, risk assessment, health indicator, evolution analyzer, comparison model, coordinator, gateway, pipeline, worker, orchestrator, trace model, registry, readiness assessment, report generator, snapshot model, or observation registry", () => {
      const timelineSource = read(TIMELINE_MODULE_PATH);
      const recommendationSource = read(RECOMMENDATION_MODULE_PATH);
      const intelligenceSource = read(INTELLIGENCE_MODULE_PATH);
      const riskSource = read(RISK_MODULE_PATH);
      const healthSource = read(HEALTH_MODULE_PATH);
      const evolutionSource = read(EVOLUTION_MODULE_PATH);
      const comparisonSource = read(COMPARISON_MODULE_PATH);
      const coordinatorSource = read(COORDINATOR_MODULE_PATH);
      const gatewaySource = read(GATEWAY_MODULE_PATH);
      const pipelineSource = read(PIPELINE_MODULE_PATH);
      const workerSource = read(WORKER_MODULE_PATH);
      const orchestratorSource = read(ORCHESTRATOR_MODULE_PATH);
      const traceModelSource = read(TRACE_MODEL_MODULE_PATH);
      const registrySource = read(REGISTRY_MODULE_PATH);
      const readinessSource = read(READINESS_MODULE_PATH);
      const reportSource = read(REPORT_MODULE_PATH);
      const snapshotSource = read(SNAPSHOT_MODULE_PATH);
      const observationRegistrySource = read(OBSERVATION_REGISTRY_MODULE_PATH);

      expect(timelineSource).not.toMatch(/validateRecruitmentWorkflowConsistency/);
      expect(timelineSource).not.toMatch(/recruitmentWorkflowConsistencyValidator/);
      expect(recommendationSource).not.toMatch(/validateRecruitmentWorkflowConsistency/);
      expect(intelligenceSource).not.toMatch(/validateRecruitmentWorkflowConsistency/);
      expect(riskSource).not.toMatch(/validateRecruitmentWorkflowConsistency/);
      expect(healthSource).not.toMatch(/validateRecruitmentWorkflowConsistency/);
      expect(evolutionSource).not.toMatch(/validateRecruitmentWorkflowConsistency/);
      expect(comparisonSource).not.toMatch(/validateRecruitmentWorkflowConsistency/);
      expect(coordinatorSource).not.toMatch(/validateRecruitmentWorkflowConsistency/);
      expect(gatewaySource).not.toMatch(/validateRecruitmentWorkflowConsistency/);
      expect(pipelineSource).not.toMatch(/validateRecruitmentWorkflowConsistency/);
      expect(workerSource).not.toMatch(/validateRecruitmentWorkflowConsistency/);
      expect(orchestratorSource).not.toMatch(/validateRecruitmentWorkflowConsistency/);
      expect(traceModelSource).not.toMatch(/validateRecruitmentWorkflowConsistency/);
      expect(registrySource).not.toMatch(/validateRecruitmentWorkflowConsistency/);
      expect(readinessSource).not.toMatch(/validateRecruitmentWorkflowConsistency/);
      expect(reportSource).not.toMatch(/validateRecruitmentWorkflowConsistency/);
      expect(observationRegistrySource).not.toMatch(/validateRecruitmentWorkflowConsistency/);

      const phase128Block = healthSource.slice(healthSource.indexOf("Phase 128"));
      expect(phase128Block).not.toMatch(/validateRecruitmentWorkflowConsistency/);
      expect(phase128Block).not.toMatch(/recruitmentWorkflowConsistencyValidator/);

      const phase129Block = riskSource.slice(riskSource.indexOf("Phase 129"));
      expect(phase129Block).not.toMatch(/validateRecruitmentWorkflowConsistency/);
      expect(phase129Block).not.toMatch(/recruitmentWorkflowConsistencyValidator/);

      const phase130Block = intelligenceSource.slice(intelligenceSource.indexOf("Phase 130"));
      expect(phase130Block).not.toMatch(/validateRecruitmentWorkflowConsistency/);
      expect(phase130Block).not.toMatch(/recruitmentWorkflowConsistencyValidator/);

      const phase131Block = recommendationSource.slice(recommendationSource.indexOf("Phase 131"));
      expect(phase131Block).not.toMatch(/validateRecruitmentWorkflowConsistency/);
      expect(phase131Block).not.toMatch(/recruitmentWorkflowConsistencyValidator/);

      const phase132Block = timelineSource.slice(timelineSource.indexOf("Phase 132"));
      expect(phase132Block).not.toMatch(/validateRecruitmentWorkflowConsistency/);
      expect(phase132Block).not.toMatch(/recruitmentWorkflowConsistencyValidator/);
    });

    test("orchestrator behavior remains unchanged and independent from consistency validator", () => {
      const orchestration = orchestrateRecruitmentWorkflow({
        recruitmentId: 42,
        eventType: "notification"
      });

      expect(orchestration.workflowState).toBe(RECRUITMENT_WORKFLOW_STATES.DRAFT_CREATED);
      expect(orchestration.advisory).toBe(true);
      expect(orchestration.executed).toBe(false);
      expect(orchestration).not.toHaveProperty("consistencyStatus");
      expect(orchestration).not.toHaveProperty("inconsistencies");
      expect(orchestration).not.toHaveProperty("validatedAreas");
    });
  });
});
