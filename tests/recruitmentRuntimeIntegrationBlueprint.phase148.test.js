"use strict";

/**
 * Phase 148 — Runtime Integration Blueprint Suite tests.
 * Verifies deterministic output, invalid inputs, blueprint generation,
 * lifecycle sequencing, readiness calculations, stable ordering,
 * and runtime isolation.
 */

const fs = require("fs");
const path = require("path");

const {
  RECRUITMENT_RUNTIME_INTEGRATION_BLUEPRINT_PHASE,
  RECRUITMENT_RUNTIME_INTEGRATION_BLUEPRINT_ENTITY,
  BLUEPRINT_SCHEMA_VERSION,
  BLUEPRINT_POSTURE,
  PRODUCTION_FLOW_STEP_IDS,
  FUTURE_INTEGRATION_POINT_IDS,
  ADVISORY_DECISION_POINT_IDS,
  EXISTING_PRODUCTION_FLOW_DEFINITIONS,
  FUTURE_INTEGRATION_POINT_DEFINITIONS,
  ADVISORY_DECISION_POINT_DEFINITIONS,
  EXECUTION_BOUNDARY_DEFINITIONS,
  SAFETY_REQUIREMENT_DEFINITIONS,
  ROLLBACK_BOUNDARY_DEFINITIONS,
  RECRUITMENT_RUNTIME_INTEGRATION_BLUEPRINT_DESCRIPTOR,
  RECRUITMENT_RUNTIME_INTEGRATION_BLUEPRINT_METADATA,
  EXPECTED_RESULT_KEYS: RUNTIME_EXPECTED_KEYS,
  buildRecruitmentRuntimeIntegrationBlueprint,
  isRecruitmentRuntimeIntegrationBlueprint
} = require("../server/lib/recruitment/recruitmentRuntimeIntegrationBlueprint");

const {
  RECRUITMENT_BOT_INTEGRATION_BLUEPRINT_PHASE,
  RECRUITMENT_BOT_INTEGRATION_BLUEPRINT_ENTITY,
  BOT_BLUEPRINT_SCHEMA_VERSION,
  BOT_INTEGRATION_POSTURE,
  BOT_INTERACTION_STAGE_IDS,
  BOT_INTERACTION_STAGE_DEFINITIONS,
  BOT_SAFETY_BOUNDARY_DEFINITIONS,
  RECRUITMENT_BOT_INTEGRATION_BLUEPRINT_DESCRIPTOR,
  RECRUITMENT_BOT_INTEGRATION_BLUEPRINT_METADATA,
  EXPECTED_RESULT_KEYS: BOT_EXPECTED_KEYS,
  buildRecruitmentBotIntegrationBlueprint,
  isRecruitmentBotIntegrationBlueprint
} = require("../server/lib/recruitment/recruitmentBotIntegrationBlueprint");

const {
  RECRUITMENT_LIFECYCLE_EXECUTION_BLUEPRINT_PHASE,
  RECRUITMENT_LIFECYCLE_EXECUTION_BLUEPRINT_ENTITY,
  LIFECYCLE_BLUEPRINT_SCHEMA_VERSION,
  LIFECYCLE_EXECUTION_POSTURE,
  LIFECYCLE_EVENT_IDS,
  CORE_LIFECYCLE_SEQUENCE,
  LIFECYCLE_STAGE_DEFINITIONS,
  FORWARD_TRANSITION_RULES,
  VERIFICATION_CHECKPOINT_DEFINITIONS,
  FAILURE_BOUNDARY_DEFINITIONS,
  RECRUITMENT_LIFECYCLE_EXECUTION_BLUEPRINT_DESCRIPTOR,
  RECRUITMENT_LIFECYCLE_EXECUTION_BLUEPRINT_METADATA,
  EXPECTED_RESULT_KEYS: LIFECYCLE_EXPECTED_KEYS,
  isKnownLifecycleEvent,
  buildRecruitmentLifecycleExecutionBlueprint,
  isRecruitmentLifecycleExecutionBlueprint
} = require("../server/lib/recruitment/recruitmentLifecycleExecutionBlueprint");

const {
  RECRUITMENT_INTEGRATION_READINESS_REPORT_PHASE,
  RECRUITMENT_INTEGRATION_READINESS_REPORT_ENTITY,
  READINESS_REPORT_SCHEMA_VERSION,
  READINESS_POSTURE,
  CONFIDENCE_LEVEL,
  COMPLETED_FOUNDATION_DEFINITIONS,
  REMAINING_TASK_DEFINITIONS,
  INTEGRATION_RISK_DEFINITIONS,
  RECOMMENDED_ROLLOUT_ORDER_DEFINITIONS,
  RECRUITMENT_INTEGRATION_READINESS_REPORT_DESCRIPTOR,
  RECRUITMENT_INTEGRATION_READINESS_REPORT_METADATA,
  EXPECTED_RESULT_KEYS: READINESS_EXPECTED_KEYS,
  buildRecruitmentIntegrationReadinessReport,
  isRecruitmentIntegrationReadinessReport
} = require("../server/lib/recruitment/recruitmentIntegrationReadinessReport");

const {
  RECRUITMENT_WORKFLOW_STATES,
  orchestrateRecruitmentWorkflow
} = require("../server/lib/recruitment/recruitmentWorkflowOrchestrator");

const ROOT = path.join(__dirname, "..");
const RUNTIME_MODULE = "server/lib/recruitment/recruitmentRuntimeIntegrationBlueprint.js";
const BOT_MODULE = "server/lib/recruitment/recruitmentBotIntegrationBlueprint.js";
const LIFECYCLE_MODULE = "server/lib/recruitment/recruitmentLifecycleExecutionBlueprint.js";
const READINESS_MODULE = "server/lib/recruitment/recruitmentIntegrationReadinessReport.js";
const ORCHESTRATOR_MODULE = "server/lib/recruitment/recruitmentWorkflowOrchestrator.js";
const COORDINATOR_MODULE = "server/lib/recruitment/recruitmentWorkflowIntegrationCoordinator.js";
const GATEWAY_MODULE = "server/lib/recruitment/recruitmentWorkflowAdvisoryGateway.js";
const PIPELINE_MODULE = "server/lib/recruitment/runRecruitmentPipeline.js";
const WORKER_MODULE = "server/services/workers/siteWorker.js";

const PHASE_148_MODULES = [
  "recruitmentRuntimeIntegrationBlueprint",
  "recruitmentBotIntegrationBlueprint",
  "recruitmentLifecycleExecutionBlueprint",
  "recruitmentIntegrationReadinessReport"
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

function buildRichRuntimeInput() {
  return {
    recruitmentId: "REC_148",
    implementationContract: { contractVersion: "1.0.0" },
    scenarioSummary: { summaryPosture: "READY_FOR_REVIEW" },
    simulationSummary: { posture: "SIMULATION_COMPLETE" },
    completionReport: { overallCompletion: { status: "COMPLETE" } },
    runtimeBoundaryContract: { posture: "BOUNDARIES_DOCUMENTED" }
  };
}

function buildRichBotInput() {
  return {
    recruitmentId: "BOT_148",
    lifecycleResolution: { lifecycleEvent: "NOTIFICATION", lifecycleConfidence: "high" },
    identityResolution: { recruitmentId: "BOT_148", confidence: "high" },
    draftProposal: { status: "proposed" },
    validationResult: { status: "valid" },
    reviewPackage: { status: "pending" },
    publishReadiness: { ready: true }
  };
}

function buildRichLifecycleInput() {
  return {
    recruitmentId: "LIFE_148",
    currentLifecycleEvent: LIFECYCLE_EVENT_IDS.APPLICATION,
    lifecycleResolution: { lifecycleConfidence: "high" },
    validationResult: { status: "valid" },
    transitionResolution: { available: true }
  };
}

function buildRichReadinessInput() {
  return {
    recruitmentId: "READY_148",
    scenarioSummary: { summaryPosture: "READY_FOR_REVIEW" },
    simulationSummary: { posture: "SIMULATION_COMPLETE" },
    runtimeIntegrationBlueprint: { blueprintPosture: BLUEPRINT_POSTURE.INTEGRATION_PLAN_DEFINED },
    completedTaskIds: REMAINING_TASK_DEFINITIONS.filter((t) => t.blocking).map((t) => t.id)
  };
}

describe("Phase 148 — module descriptors and constants", () => {
  test("runtime integration blueprint descriptor", () => {
    expect(RECRUITMENT_RUNTIME_INTEGRATION_BLUEPRINT_PHASE).toBe(148);
    expect(RECRUITMENT_RUNTIME_INTEGRATION_BLUEPRINT_ENTITY).toBe(
      "recruitment_runtime_integration_blueprint"
    );
    expect(BLUEPRINT_SCHEMA_VERSION).toBe("1.0.0");
    expect(RECRUITMENT_RUNTIME_INTEGRATION_BLUEPRINT_METADATA.advisoryOnly).toBe(true);
    expect(RECRUITMENT_RUNTIME_INTEGRATION_BLUEPRINT_METADATA.runtimeIntegration).toBe(false);
    expect(RECRUITMENT_RUNTIME_INTEGRATION_BLUEPRINT_DESCRIPTOR.phase).toBe(148);
  });

  test("bot integration blueprint descriptor", () => {
    expect(RECRUITMENT_BOT_INTEGRATION_BLUEPRINT_PHASE).toBe(148);
    expect(RECRUITMENT_BOT_INTEGRATION_BLUEPRINT_ENTITY).toBe(
      "recruitment_bot_integration_blueprint"
    );
    expect(BOT_BLUEPRINT_SCHEMA_VERSION).toBe("1.0.0");
    expect(RECRUITMENT_BOT_INTEGRATION_BLUEPRINT_METADATA.executed).toBe(false);
    expect(RECRUITMENT_BOT_INTEGRATION_BLUEPRINT_DESCRIPTOR.phase).toBe(148);
  });

  test("lifecycle execution blueprint descriptor", () => {
    expect(RECRUITMENT_LIFECYCLE_EXECUTION_BLUEPRINT_PHASE).toBe(148);
    expect(RECRUITMENT_LIFECYCLE_EXECUTION_BLUEPRINT_ENTITY).toBe(
      "recruitment_lifecycle_execution_blueprint"
    );
    expect(LIFECYCLE_BLUEPRINT_SCHEMA_VERSION).toBe("1.0.0");
    expect(RECRUITMENT_LIFECYCLE_EXECUTION_BLUEPRINT_METADATA.performsStateTransitions).toBe(false);
    expect(RECRUITMENT_LIFECYCLE_EXECUTION_BLUEPRINT_DESCRIPTOR.phase).toBe(148);
  });

  test("integration readiness report descriptor", () => {
    expect(RECRUITMENT_INTEGRATION_READINESS_REPORT_PHASE).toBe(148);
    expect(RECRUITMENT_INTEGRATION_READINESS_REPORT_ENTITY).toBe(
      "recruitment_integration_readiness_report"
    );
    expect(READINESS_REPORT_SCHEMA_VERSION).toBe("1.0.0");
    expect(RECRUITMENT_INTEGRATION_READINESS_REPORT_METADATA.activatesAnything).toBe(false);
    expect(RECRUITMENT_INTEGRATION_READINESS_REPORT_DESCRIPTOR.phase).toBe(148);
  });

  test("catalog definitions have stable ordering", () => {
    const flowOrders = EXISTING_PRODUCTION_FLOW_DEFINITIONS.map((d) => d.order);
    expect(flowOrders).toEqual(flowOrders.slice().sort((a, b) => a - b));
    const integrationOrders = FUTURE_INTEGRATION_POINT_DEFINITIONS.map((d) => d.order);
    expect(integrationOrders).toEqual(integrationOrders.slice().sort((a, b) => a - b));
    const botOrders = BOT_INTERACTION_STAGE_DEFINITIONS.map((d) => d.order);
    expect(botOrders).toEqual(botOrders.slice().sort((a, b) => a - b));
    const lifecycleOrders = LIFECYCLE_STAGE_DEFINITIONS.map((d) => d.order);
    expect(lifecycleOrders).toEqual(lifecycleOrders.slice().sort((a, b) => a - b));
    const foundationOrders = COMPLETED_FOUNDATION_DEFINITIONS.map((d) => d.order);
    expect(foundationOrders).toEqual(foundationOrders.slice().sort((a, b) => a - b));
  });
});

describe("Phase 148 — recruitmentRuntimeIntegrationBlueprint", () => {
  describe("deterministic output", () => {
    test("same input produces identical output", () => {
      const input = buildRichRuntimeInput();
      const first = buildRecruitmentRuntimeIntegrationBlueprint(input);
      const second = buildRecruitmentRuntimeIntegrationBlueprint(input);
      expect(first).toEqual(second);
    });

    test("default input is deterministic", () => {
      const first = buildRecruitmentRuntimeIntegrationBlueprint();
      const second = buildRecruitmentRuntimeIntegrationBlueprint();
      expect(first).toEqual(second);
    });

    test("output is deep frozen", () => {
      const result = buildRecruitmentRuntimeIntegrationBlueprint(buildRichRuntimeInput());
      assertAllFrozen(result);
    });

    test("type guard accepts valid blueprint", () => {
      const result = buildRecruitmentRuntimeIntegrationBlueprint(buildRichRuntimeInput());
      expect(isRecruitmentRuntimeIntegrationBlueprint(result)).toBe(true);
    });
  });

  describe("invalid inputs", () => {
    test.each([null, undefined, "string", 42, [], true])(
      "handles invalid input %p gracefully",
      (invalid) => {
        const result = buildRecruitmentRuntimeIntegrationBlueprint(invalid);
        expect(isRecruitmentRuntimeIntegrationBlueprint(result)).toBe(true);
        expect(result.recruitmentId).toBe("UNKNOWN");
        expect(result.blueprintPosture).toBe(BLUEPRINT_POSTURE.INTEGRATION_PLAN_UNKNOWN);
        expect(result.confidence).toBe(0);
      }
    );

    test("rejects malformed includedIntegrationPointIds type", () => {
      const result = buildRecruitmentRuntimeIntegrationBlueprint({
        recruitmentId: "BAD",
        includedIntegrationPointIds: "not-array"
      });
      expect(result.recruitmentId).toBe("UNKNOWN");
      expect(result.blueprintPosture).toBe(BLUEPRINT_POSTURE.INTEGRATION_PLAN_UNKNOWN);
    });

    test("type guard rejects invalid values", () => {
      expect(isRecruitmentRuntimeIntegrationBlueprint(null)).toBe(false);
      expect(isRecruitmentRuntimeIntegrationBlueprint({})).toBe(false);
    });
  });

  describe("blueprint generation", () => {
    test("contains all expected result keys", () => {
      const result = buildRecruitmentRuntimeIntegrationBlueprint(buildRichRuntimeInput());
      for (let i = 0; i < RUNTIME_EXPECTED_KEYS.length; i += 1) {
        expect(result).toHaveProperty(RUNTIME_EXPECTED_KEYS[i]);
      }
    });

    test("existing production flow covers all production steps", () => {
      const result = buildRecruitmentRuntimeIntegrationBlueprint();
      expect(result.existingProductionFlow.length).toBe(
        EXISTING_PRODUCTION_FLOW_DEFINITIONS.length
      );
      expect(result.existingProductionFlow[0].id).toBe(PRODUCTION_FLOW_STEP_IDS.SITE_MONITORING);
      expect(result.existingProductionFlow[result.existingProductionFlow.length - 1].id).toBe(
        PRODUCTION_FLOW_STEP_IDS.DIAGNOSTICS
      );
      for (let i = 0; i < result.existingProductionFlow.length; i += 1) {
        expect(result.existingProductionFlow[i].activatesRuntime).toBe(false);
        expect(result.existingProductionFlow[i].advisoryCoupling).toBe("none");
      }
    });

    test("future integration points are complete with rich input", () => {
      const result = buildRecruitmentRuntimeIntegrationBlueprint(buildRichRuntimeInput());
      expect(result.futureIntegrationPoints.length).toBe(
        FUTURE_INTEGRATION_POINT_DEFINITIONS.length
      );
      expect(result.blueprintPosture).toBe(BLUEPRINT_POSTURE.INTEGRATION_PLAN_DEFINED);
      expect(result.confidence).toBeGreaterThanOrEqual(80);
    });

    test("partial integration points yield partial posture", () => {
      const result = buildRecruitmentRuntimeIntegrationBlueprint({
        recruitmentId: "PARTIAL",
        includedIntegrationPointIds: [FUTURE_INTEGRATION_POINT_IDS.UPDATES_ADVISORY_VOCABULARY]
      });
      expect(result.futureIntegrationPoints.length).toBe(1);
      expect(result.blueprintPosture).toBe(BLUEPRINT_POSTURE.INTEGRATION_PLAN_PARTIAL);
    });

    test("advisory decision points are documented", () => {
      const result = buildRecruitmentRuntimeIntegrationBlueprint();
      expect(result.advisoryDecisionPoints.length).toBe(
        ADVISORY_DECISION_POINT_DEFINITIONS.length
      );
      const ids = result.advisoryDecisionPoints.map((d) => d.id);
      expect(ids).toContain(ADVISORY_DECISION_POINT_IDS.LIFECYCLE_CLASSIFICATION);
      expect(ids).toContain(ADVISORY_DECISION_POINT_IDS.IMPLEMENTATION_DECISION);
    });

    test("execution boundaries and safety requirements are present", () => {
      const result = buildRecruitmentRuntimeIntegrationBlueprint();
      expect(result.executionBoundaries.length).toBe(EXECUTION_BOUNDARY_DEFINITIONS.length);
      expect(result.safetyRequirements.length).toBe(SAFETY_REQUIREMENT_DEFINITIONS.length);
      expect(result.rollbackBoundaries.length).toBe(ROLLBACK_BOUNDARY_DEFINITIONS.length);
      for (let i = 0; i < result.safetyRequirements.length; i += 1) {
        expect(result.safetyRequirements[i].mandatory).toBe(true);
      }
    });

    test("advisory metadata confirms no execution", () => {
      const result = buildRecruitmentRuntimeIntegrationBlueprint();
      expect(result.advisoryMetadata.advisoryOnly).toBe(true);
      expect(result.advisoryMetadata.executed).toBe(false);
      expect(result.advisoryMetadata.activatesAnything).toBe(false);
      expect(result.advisoryMetadata.generatedBy).toBe("phase_148");
    });
  });
});

describe("Phase 148 — recruitmentBotIntegrationBlueprint", () => {
  describe("deterministic output", () => {
    test("same input produces identical output", () => {
      const input = buildRichBotInput();
      const first = buildRecruitmentBotIntegrationBlueprint(input);
      const second = buildRecruitmentBotIntegrationBlueprint(input);
      expect(first).toEqual(second);
    });

    test("output is deep frozen", () => {
      const result = buildRecruitmentBotIntegrationBlueprint(buildRichBotInput());
      assertAllFrozen(result);
    });

    test("type guard accepts valid blueprint", () => {
      const result = buildRecruitmentBotIntegrationBlueprint(buildRichBotInput());
      expect(isRecruitmentBotIntegrationBlueprint(result)).toBe(true);
    });
  });

  describe("invalid inputs", () => {
    test.each([null, undefined, 99, false])("handles invalid input %p", (invalid) => {
      const result = buildRecruitmentBotIntegrationBlueprint(invalid);
      expect(isRecruitmentBotIntegrationBlueprint(result)).toBe(true);
      expect(result.botIntegrationPosture).toBe(BOT_INTEGRATION_POSTURE.BOT_PLAN_UNKNOWN);
      expect(result.confidence).toBe(0);
    });

    test("malformed includedStageIds falls back to unknown posture", () => {
      const result = buildRecruitmentBotIntegrationBlueprint({
        includedStageIds: "invalid"
      });
      expect(result.botIntegrationPosture).toBe(BOT_INTEGRATION_POSTURE.BOT_PLAN_UNKNOWN);
    });
  });

  describe("bot interaction stages", () => {
    test("contains all seven interaction sections", () => {
      const result = buildRecruitmentBotIntegrationBlueprint(buildRichBotInput());
      for (let i = 0; i < BOT_EXPECTED_KEYS.length; i += 1) {
        expect(result).toHaveProperty(BOT_EXPECTED_KEYS[i]);
      }
      expect(result.updateDetection.stageId).toBe(BOT_INTERACTION_STAGE_IDS.UPDATE_DETECTION);
      expect(result.draftGeneration.stageId).toBe(BOT_INTERACTION_STAGE_IDS.DRAFT_GENERATION);
      expect(result.recruitmentIdentification.stageId).toBe(
        BOT_INTERACTION_STAGE_IDS.RECRUITMENT_IDENTIFICATION
      );
      expect(result.lifecycleClassification.stageId).toBe(
        BOT_INTERACTION_STAGE_IDS.LIFECYCLE_CLASSIFICATION
      );
      expect(result.validation.stageId).toBe(BOT_INTERACTION_STAGE_IDS.VALIDATION);
      expect(result.manualReview.stageId).toBe(BOT_INTERACTION_STAGE_IDS.MANUAL_REVIEW);
      expect(result.publishReadiness.stageId).toBe(BOT_INTERACTION_STAGE_IDS.PUBLISH_READINESS);
    });

    test("interaction sequence is ordered", () => {
      const result = buildRecruitmentBotIntegrationBlueprint();
      const orders = result.interactionSequence.map((s) => s.order);
      expect(orders).toEqual(orders.slice().sort((a, b) => a - b));
      expect(result.interactionSequence.length).toBe(BOT_INTERACTION_STAGE_DEFINITIONS.length);
    });

    test("rich input yields defined bot plan", () => {
      const result = buildRecruitmentBotIntegrationBlueprint(buildRichBotInput());
      expect(result.botIntegrationPosture).toBe(BOT_INTEGRATION_POSTURE.BOT_PLAN_DEFINED);
      expect(result.confidence).toBeGreaterThanOrEqual(75);
    });

    test("partial stages exclude missing sections", () => {
      const result = buildRecruitmentBotIntegrationBlueprint({
        recruitmentId: "PARTIAL_BOT",
        includedStageIds: [BOT_INTERACTION_STAGE_IDS.UPDATE_DETECTION]
      });
      expect(result.updateDetection.stageId).toBe(BOT_INTERACTION_STAGE_IDS.UPDATE_DETECTION);
      expect(result.draftGeneration.available).toBe(false);
      expect(result.interactionSequence.length).toBe(1);
    });

    test("safety boundaries are mandatory", () => {
      const result = buildRecruitmentBotIntegrationBlueprint();
      expect(result.safetyBoundaries.length).toBe(BOT_SAFETY_BOUNDARY_DEFINITIONS.length);
      for (let i = 0; i < result.safetyBoundaries.length; i += 1) {
        expect(result.safetyBoundaries[i].mandatory).toBe(true);
      }
    });

    test("no stage activates runtime", () => {
      const result = buildRecruitmentBotIntegrationBlueprint();
      for (let i = 0; i < result.interactionSequence.length; i += 1) {
        const stageId = result.interactionSequence[i].stageId;
        const section = result[stageId === BOT_INTERACTION_STAGE_IDS.UPDATE_DETECTION ? "updateDetection" :
          stageId === BOT_INTERACTION_STAGE_IDS.DRAFT_GENERATION ? "draftGeneration" :
          stageId === BOT_INTERACTION_STAGE_IDS.RECRUITMENT_IDENTIFICATION ? "recruitmentIdentification" :
          stageId === BOT_INTERACTION_STAGE_IDS.LIFECYCLE_CLASSIFICATION ? "lifecycleClassification" :
          stageId === BOT_INTERACTION_STAGE_IDS.VALIDATION ? "validation" :
          stageId === BOT_INTERACTION_STAGE_IDS.MANUAL_REVIEW ? "manualReview" : "publishReadiness"];
        if (section.stageId != null) {
          expect(section.activatesRuntime).toBe(false);
        }
      }
    });
  });
});

describe("Phase 148 — recruitmentLifecycleExecutionBlueprint", () => {
  describe("deterministic output", () => {
    test("same input produces identical output", () => {
      const input = buildRichLifecycleInput();
      const first = buildRecruitmentLifecycleExecutionBlueprint(input);
      const second = buildRecruitmentLifecycleExecutionBlueprint(input);
      expect(first).toEqual(second);
    });

    test("output is deep frozen", () => {
      const result = buildRecruitmentLifecycleExecutionBlueprint(buildRichLifecycleInput());
      assertAllFrozen(result);
    });

    test("type guard accepts valid blueprint", () => {
      const result = buildRecruitmentLifecycleExecutionBlueprint(buildRichLifecycleInput());
      expect(isRecruitmentLifecycleExecutionBlueprint(result)).toBe(true);
    });
  });

  describe("invalid inputs", () => {
    test.each([null, undefined, "bad", 0])("handles invalid input %p", (invalid) => {
      const result = buildRecruitmentLifecycleExecutionBlueprint(invalid);
      expect(isRecruitmentLifecycleExecutionBlueprint(result)).toBe(true);
      expect(result.executionPosture).toBe(LIFECYCLE_EXECUTION_POSTURE.SEQUENCE_UNKNOWN);
      expect(result.confidence).toBe(0);
    });

    test("unknown lifecycle event defaults to notification", () => {
      const result = buildRecruitmentLifecycleExecutionBlueprint({
        currentLifecycleEvent: "INVALID_EVENT"
      });
      expect(result.currentLifecycleEvent).toBe(LIFECYCLE_EVENT_IDS.NOTIFICATION);
    });
  });

  describe("lifecycle sequencing", () => {
    test("core lifecycle sequence matches specification", () => {
      const result = buildRecruitmentLifecycleExecutionBlueprint();
      const eventIds = result.lifecycleSequence.map((s) => s.eventId);
      expect(eventIds).toEqual(CORE_LIFECYCLE_SEQUENCE);
      expect(eventIds[0]).toBe(LIFECYCLE_EVENT_IDS.NOTIFICATION);
      expect(eventIds[eventIds.length - 1]).toBe(LIFECYCLE_EVENT_IDS.FINAL_RESULT);
    });

    test("lifecycle labels follow notification through final result", () => {
      const result = buildRecruitmentLifecycleExecutionBlueprint();
      const labels = result.lifecycleSequence.map((s) => s.label);
      expect(labels).toEqual([
        "Notification",
        "Apply",
        "Correction",
        "Exam City",
        "Admit Card",
        "Answer Key",
        "Result",
        "Final Result"
      ]);
    });

    test("transition rules align with forward transition table", () => {
      const result = buildRecruitmentLifecycleExecutionBlueprint();
      for (let i = 0; i < result.transitionRules.length; i += 1) {
        const rule = result.transitionRules[i];
        const expected = FORWARD_TRANSITION_RULES[rule.fromEvent];
        expect(rule.allowedNextEvents).toEqual(expected);
      }
    });

    test("next allowed events from application stage", () => {
      const result = buildRecruitmentLifecycleExecutionBlueprint({
        currentLifecycleEvent: LIFECYCLE_EVENT_IDS.APPLICATION
      });
      expect(result.nextAllowedEvents).toContain(LIFECYCLE_EVENT_IDS.APPLICATION_CORRECTION);
      expect(result.nextAllowedEvents).toContain(LIFECYCLE_EVENT_IDS.EXAM_CITY);
      expect(result.nextAllowedEvents).toContain(LIFECYCLE_EVENT_IDS.ADMIT_CARD);
    });

    test("final result has no next allowed events", () => {
      const result = buildRecruitmentLifecycleExecutionBlueprint({
        currentLifecycleEvent: LIFECYCLE_EVENT_IDS.FINAL_RESULT
      });
      expect(result.nextAllowedEvents).toEqual([]);
    });

    test("verification checkpoints and failure boundaries present", () => {
      const result = buildRecruitmentLifecycleExecutionBlueprint();
      expect(result.verificationCheckpoints.length).toBe(
        VERIFICATION_CHECKPOINT_DEFINITIONS.length
      );
      expect(result.failureBoundaries.length).toBe(FAILURE_BOUNDARY_DEFINITIONS.length);
      for (let i = 0; i < result.failureBoundaries.length; i += 1) {
        expect(result.failureBoundaries[i].automatedRecovery).toBe(false);
      }
    });

    test("partial lifecycle subset yields partial posture", () => {
      const result = buildRecruitmentLifecycleExecutionBlueprint({
        includedLifecycleEventIds: [
          LIFECYCLE_EVENT_IDS.NOTIFICATION,
          LIFECYCLE_EVENT_IDS.APPLICATION
        ]
      });
      expect(result.lifecycleSequence.length).toBe(2);
      expect(result.executionPosture).toBe(LIFECYCLE_EXECUTION_POSTURE.SEQUENCE_PARTIAL);
    });

    test("isKnownLifecycleEvent validates vocabulary", () => {
      expect(isKnownLifecycleEvent(LIFECYCLE_EVENT_IDS.ADMIT_CARD)).toBe(true);
      expect(isKnownLifecycleEvent("UNKNOWN_STAGE")).toBe(false);
    });

    test("rich input yields defined sequence", () => {
      const result = buildRecruitmentLifecycleExecutionBlueprint(buildRichLifecycleInput());
      expect(result.executionPosture).toBe(LIFECYCLE_EXECUTION_POSTURE.SEQUENCE_DEFINED);
      expect(result.confidence).toBeGreaterThan(0);
    });

    test("does not perform state transitions", () => {
      const result = buildRecruitmentLifecycleExecutionBlueprint(buildRichLifecycleInput());
      expect(result.advisoryMetadata.performsStateTransitions).toBe(false);
      expect(result.advisoryMetadata.executed).toBe(false);
    });
  });
});

describe("Phase 148 — recruitmentIntegrationReadinessReport", () => {
  describe("deterministic output", () => {
    test("same input produces identical output", () => {
      const input = buildRichReadinessInput();
      const first = buildRecruitmentIntegrationReadinessReport(input);
      const second = buildRecruitmentIntegrationReadinessReport(input);
      expect(first).toEqual(second);
    });

    test("output is deep frozen", () => {
      const result = buildRecruitmentIntegrationReadinessReport(buildRichReadinessInput());
      assertAllFrozen(result);
    });

    test("type guard accepts valid report", () => {
      const result = buildRecruitmentIntegrationReadinessReport(buildRichReadinessInput());
      expect(isRecruitmentIntegrationReadinessReport(result)).toBe(true);
    });
  });

  describe("invalid inputs", () => {
    test.each([null, undefined, "x", 1])("handles invalid input %p", (invalid) => {
      const result = buildRecruitmentIntegrationReadinessReport(invalid);
      expect(isRecruitmentIntegrationReadinessReport(result)).toBe(true);
      expect(result.readinessPosture).toBe(READINESS_POSTURE.UNKNOWN);
      expect(result.confidence).toBe(0);
      expect(result.confidenceLevel).toBe(CONFIDENCE_LEVEL.NONE);
    });
  });

  describe("readiness calculations", () => {
    test("contains all expected result keys", () => {
      const result = buildRecruitmentIntegrationReadinessReport();
      for (let i = 0; i < READINESS_EXPECTED_KEYS.length; i += 1) {
        expect(result).toHaveProperty(READINESS_EXPECTED_KEYS[i]);
      }
    });

    test("completed foundations include phases through 148", () => {
      const result = buildRecruitmentIntegrationReadinessReport();
      expect(result.completedFoundations.length).toBe(COMPLETED_FOUNDATION_DEFINITIONS.length);
      const phase148 = result.completedFoundations.find(
        (f) => f.id === "FOUNDATION_RUNTIME_INTEGRATION_BLUEPRINT"
      );
      expect(phase148).toBeDefined();
      expect(phase148.phase).toBe(148);
      expect(phase148.status).toBe("COMPLETE");
    });

    test("remaining tasks track completion status", () => {
      const result = buildRecruitmentIntegrationReadinessReport({
        completedTaskIds: ["TASK_RUNTIME_ADAPTER_SCAFFOLD", "TASK_FEATURE_FLAG_INFRASTRUCTURE"]
      });
      const completed = result.remainingImplementationTasks.filter((t) => t.complete === true);
      expect(completed.length).toBe(2);
      const pending = result.remainingImplementationTasks.filter(
        (t) => t.blocking === true && t.complete !== true
      );
      expect(pending.length).toBeGreaterThan(0);
    });

    test("all blocking tasks complete yields ready posture with rich input", () => {
      const result = buildRecruitmentIntegrationReadinessReport(buildRichReadinessInput());
      expect(result.readinessPosture).toBe(
        READINESS_POSTURE.READY_FOR_CONTROLLED_IMPLEMENTATION
      );
      expect(result.confidenceLevel).toBe(CONFIDENCE_LEVEL.HIGH);
      expect(result.confidence).toBeGreaterThanOrEqual(75);
    });

    test("default input is not ready", () => {
      const result = buildRecruitmentIntegrationReadinessReport({ recruitmentId: "DEFAULT" });
      expect(result.readinessPosture).toBe(READINESS_POSTURE.NOT_READY);
      expect(result.confidence).toBeGreaterThan(0);
    });

    test("integration risks and rollout order are documented", () => {
      const result = buildRecruitmentIntegrationReadinessReport();
      expect(result.integrationRisks.length).toBe(INTEGRATION_RISK_DEFINITIONS.length);
      expect(result.recommendedRolloutOrder.length).toBe(
        RECOMMENDED_ROLLOUT_ORDER_DEFINITIONS.length
      );
      for (let i = 0; i < result.recommendedRolloutOrder.length; i += 1) {
        expect(result.recommendedRolloutOrder[i].activatesRuntime).toBe(false);
      }
    });

    test("rollout order is stable", () => {
      const result = buildRecruitmentIntegrationReadinessReport();
      const orders = result.recommendedRolloutOrder.map((r) => r.order);
      expect(orders).toEqual(orders.slice().sort((a, b) => a - b));
      expect(result.recommendedRolloutOrder[0].id).toBe("ROLLOUT_BOUNDARY_CONFIRMATION");
      expect(result.recommendedRolloutOrder[result.recommendedRolloutOrder.length - 1].id).toBe(
        "ROLLOUT_POST_ADOPTION_REVIEW"
      );
    });

    test("advisory metadata confirms planning only", () => {
      const result = buildRecruitmentIntegrationReadinessReport();
      expect(result.advisoryMetadata.advisoryOnly).toBe(true);
      expect(result.advisoryMetadata.activatesAnything).toBe(false);
      expect(result.advisoryMetadata.rolloutActivationEnabled).toBe(false);
    });
  });
});

describe("Phase 148 — stable ordering", () => {
  test("runtime integration safety requirements sorted by order", () => {
    const result = buildRecruitmentRuntimeIntegrationBlueprint();
    const orders = result.safetyRequirements.map((r) => r.order);
    expect(orders).toEqual(orders.slice().sort((a, b) => a - b));
  });

  test("lifecycle verification checkpoints sorted by order", () => {
    const result = buildRecruitmentLifecycleExecutionBlueprint();
    const orders = result.verificationCheckpoints.map((c) => c.order);
    expect(orders).toEqual(orders.slice().sort((a, b) => a - b));
  });

  test("readiness integration risks sorted by order", () => {
    const result = buildRecruitmentIntegrationReadinessReport();
    const orders = result.integrationRisks.map((r) => r.order);
    expect(orders).toEqual(orders.slice().sort((a, b) => a - b));
  });
});

describe("Phase 148 — runtime isolation", () => {
  test("phase 148 modules contain no require() calls", () => {
    const modules = [RUNTIME_MODULE, BOT_MODULE, LIFECYCLE_MODULE, READINESS_MODULE];
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

  test.each(PHASE_148_MODULES)(
    "phase 148 module %s is not imported by orchestrator",
    (moduleName) => {
      expect(read(ORCHESTRATOR_MODULE)).not.toContain(moduleName);
    }
  );

  test.each(PHASE_148_MODULES)(
    "phase 148 module %s is not imported by coordinator",
    (moduleName) => {
      expect(read(COORDINATOR_MODULE)).not.toContain(moduleName);
    }
  );

  test.each(PHASE_148_MODULES)(
    "phase 148 module %s is not imported by advisory gateway",
    (moduleName) => {
      expect(read(GATEWAY_MODULE)).not.toContain(moduleName);
    }
  );

  test.each(PHASE_148_MODULES)(
    "phase 148 module %s is not imported by recruitment pipeline",
    (moduleName) => {
      expect(read(PIPELINE_MODULE)).not.toContain(moduleName);
    }
  );

  test.each(PHASE_148_MODULES)(
    "phase 148 module %s is not imported by site worker",
    (moduleName) => {
      expect(read(WORKER_MODULE)).not.toContain(moduleName);
    }
  );

  test("orchestrator output does not leak phase 148 fields", () => {
    const result = orchestrateRecruitmentWorkflow({
      recruitmentId: "ISO_148",
      workflowState: RECRUITMENT_WORKFLOW_STATES.DRAFT_CREATED
    });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("phase_148");
    expect(serialized).not.toContain("recruitment_runtime_integration_blueprint");
    expect(serialized).not.toContain("recruitment_bot_integration_blueprint");
    expect(serialized).not.toContain("recruitment_lifecycle_execution_blueprint");
    expect(serialized).not.toContain("recruitment_integration_readiness_report");
    expect(serialized).not.toContain("INTEGRATION_PLAN_DEFINED");
    expect(serialized).not.toContain("READY_FOR_CONTROLLED_IMPLEMENTATION");
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
      expect(source).not.toContain("phase_148");
      expect(source).not.toContain("recruitmentRuntimeIntegrationBlueprint");
      expect(source).not.toContain("recruitmentBotIntegrationBlueprint");
      expect(source).not.toContain("recruitmentLifecycleExecutionBlueprint");
      expect(source).not.toContain("recruitmentIntegrationReadinessReport");
    }
  });
});
