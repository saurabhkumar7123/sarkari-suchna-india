"use strict";

/**
 * Phase 132 — Recruitment Workflow Advisory Timeline Model tests.
 * Empty input, unknown input, completed/in-progress/blocked timelines,
 * stage ordering, current/next stage detection, summary/metadata,
 * determinism, immutability, and architecture boundaries.
 */

const fs = require("fs");
const path = require("path");

const {
  RECRUITMENT_WORKFLOW_TIMELINE_MODEL_PHASE,
  RECRUITMENT_WORKFLOW_TIMELINE_MODEL_ENTITY,
  WORKFLOW_STAGES,
  TIMELINE_STATUS,
  EVENT_STATUS,
  RECRUITMENT_WORKFLOW_TIMELINE_MODEL_METADATA,
  createRecruitmentWorkflowTimeline
} = require("../server/lib/recruitment/recruitmentWorkflowTimelineModel");

const {
  RECRUITMENT_WORKFLOW_STATES,
  orchestrateRecruitmentWorkflow
} = require("../server/lib/recruitment/recruitmentWorkflowOrchestrator");

const ROOT = path.join(__dirname, "..");
const MODULE_PATH = "server/lib/recruitment/recruitmentWorkflowTimelineModel.js";
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
  "recruitmentId",
  "timelineStatus",
  "timelineEvents",
  "completedStages",
  "currentStage",
  "nextExpectedStage",
  "timelineSummary",
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

function buildInProgressInput(overrides = {}) {
  return {
    recruitmentId: "rec-132",
    events: [
      { eventType: "NOTIFICATION", status: "COMPLETED", order: 1 },
      { eventType: "APPLICATION", status: "COMPLETED", order: 2 },
      { eventType: "ADMIT_CARD", status: "CURRENT", order: 4 }
    ],
    ...overrides
  };
}

describe("Phase 132 — recruitmentWorkflowTimelineModel", () => {
  describe("exports", () => {
    test("phase constants and metadata", () => {
      expect(RECRUITMENT_WORKFLOW_TIMELINE_MODEL_PHASE).toBe(132);
      expect(RECRUITMENT_WORKFLOW_TIMELINE_MODEL_ENTITY).toBe(
        "recruitment_workflow_timeline_model"
      );
      expect(WORKFLOW_STAGES).toEqual([
        "NOTIFICATION",
        "APPLICATION",
        "CORRECTION",
        "ADMIT_CARD",
        "EXAM",
        "ANSWER_KEY",
        "RESULT",
        "FINAL_RESULT"
      ]);
      expect(TIMELINE_STATUS.COMPLETED).toBe("COMPLETED");
      expect(TIMELINE_STATUS.IN_PROGRESS).toBe("IN_PROGRESS");
      expect(TIMELINE_STATUS.BLOCKED).toBe("BLOCKED");
      expect(TIMELINE_STATUS.EMPTY).toBe("EMPTY");
      expect(TIMELINE_STATUS.UNKNOWN).toBe("UNKNOWN");
      expect(EVENT_STATUS.CURRENT).toBe("CURRENT");
      expect(RECRUITMENT_WORKFLOW_TIMELINE_MODEL_METADATA.advisoryOnly).toBe(true);
      expect(RECRUITMENT_WORKFLOW_TIMELINE_MODEL_METADATA.persistent).toBe(false);
      expect(RECRUITMENT_WORKFLOW_TIMELINE_MODEL_METADATA.generatedBy).toBe("phase_132");
      expect(RECRUITMENT_WORKFLOW_TIMELINE_MODEL_METADATA.eventTracking).toBe(false);
      expect(RECRUITMENT_WORKFLOW_TIMELINE_MODEL_METADATA.historyTracking).toBe(false);
    });
  });

  describe("empty input", () => {
    test("returns empty timeline for null, undefined, and non-object input as unknown", () => {
      for (const input of [null, undefined, "bad", 42, true]) {
        const result = createRecruitmentWorkflowTimeline(input);

        expect(Object.keys(result).sort()).toEqual([...EXPECTED_RESULT_KEYS].sort());
        expect(result.timelineStatus).toBe(TIMELINE_STATUS.UNKNOWN);
        expect(result.timelineEvents).toEqual([]);
        expect(result.completedStages).toEqual([]);
        expect(result.currentStage).toBeNull();
        expect(result.nextExpectedStage).toBeNull();
        expect(result.timelineSummary).toBe(
          "Recruitment workflow timeline could not be determined from supplied signals"
        );
        expect(result.advisoryMetadata.generatedBy).toBe("phase_132");
      }
    });

    test("returns empty timeline for valid input with no events", () => {
      for (const input of [{}, { recruitmentId: 42 }, { recruitmentId: "rec-1", events: [] }]) {
        const result = createRecruitmentWorkflowTimeline(input);

        expect(result.timelineStatus).toBe(TIMELINE_STATUS.EMPTY);
        expect(result.timelineEvents).toEqual([]);
        expect(result.completedStages).toEqual([]);
        expect(result.currentStage).toBeNull();
        expect(result.nextExpectedStage).toBeNull();
        expect(result.timelineSummary).toBe("No recruitment workflow timeline events supplied");
      }
    });

    test("returns unknown for malformed input fields", () => {
      const malformedInputs = [
        { recruitmentId: {}, events: [] },
        { recruitmentId: 1, events: "bad" },
        { recruitmentId: 1, events: [{ eventType: "NOTIFICATION" }] },
        { recruitmentId: 1, events: [{ status: "COMPLETED", order: 1 }] },
        { recruitmentId: 1, events: [{ eventType: "NOTIFICATION", status: "COMPLETED" }] },
        { recruitmentId: 1, events: [{ eventType: "NOTIFICATION", status: "COMPLETED", order: "1" }] },
        { recruitmentId: 1, events: [{ eventType: "NOTIFICATION", status: "COMPLETED", order: 1, timestamp: {} }] }
      ];

      for (const input of malformedInputs) {
        const result = createRecruitmentWorkflowTimeline(input);

        expect(result.timelineStatus).toBe(TIMELINE_STATUS.UNKNOWN);
        expect(result.timelineEvents).toEqual([]);
      }
    });
  });

  describe("unknown input", () => {
    test("returns unknown when events contain only unrecognized stages", () => {
      const result = createRecruitmentWorkflowTimeline({
        recruitmentId: "rec-unknown",
        events: [
          { eventType: "CUSTOM_STAGE", status: "COMPLETED", order: 1 },
          { eventType: "OTHER_STAGE", status: "CURRENT", order: 2 }
        ]
      });

      expect(result.timelineStatus).toBe(TIMELINE_STATUS.UNKNOWN);
      expect(result.completedStages).toEqual([]);
      expect(result.currentStage).toBeNull();
      expect(result.nextExpectedStage).toBeNull();
      expect(result.timelineSummary).toBe(
        "Recruitment workflow timeline could not be determined from supplied signals"
      );
    });

    test("returns unknown when all event fields are blank after normalization", () => {
      const result = createRecruitmentWorkflowTimeline({
        recruitmentId: 7,
        events: [{ eventType: "   ", status: "COMPLETED", order: 1 }]
      });

      expect(result.timelineStatus).toBe(TIMELINE_STATUS.UNKNOWN);
      expect(result.timelineEvents).toEqual([]);
    });
  });

  describe("completed timeline", () => {
    test("marks timeline completed when FINAL_RESULT is completed", () => {
      const result = createRecruitmentWorkflowTimeline({
        recruitmentId: "rec-complete",
        events: [
          { eventType: "NOTIFICATION", status: "COMPLETED", order: 1 },
          { eventType: "APPLICATION", status: "COMPLETED", order: 2 },
          { eventType: "EXAM", status: "COMPLETED", order: 5 },
          { eventType: "FINAL_RESULT", status: "COMPLETED", order: 8 }
        ]
      });

      expect(result.timelineStatus).toBe(TIMELINE_STATUS.COMPLETED);
      expect(result.completedStages).toEqual([
        "NOTIFICATION",
        "APPLICATION",
        "EXAM",
        "FINAL_RESULT"
      ]);
      expect(result.currentStage).toBeNull();
      expect(result.nextExpectedStage).toBeNull();
      expect(result.timelineSummary).toBe(
        "Recruitment workflow timeline has reached completion at FINAL_RESULT"
      );
    });
  });

  describe("in-progress timeline", () => {
    test("matches advisory example for notification, application, and admit card progression", () => {
      const result = createRecruitmentWorkflowTimeline(buildInProgressInput());

      expect(result.timelineStatus).toBe(TIMELINE_STATUS.IN_PROGRESS);
      expect(result.completedStages).toEqual(["NOTIFICATION", "APPLICATION"]);
      expect(result.currentStage).toBe("ADMIT_CARD");
      expect(result.nextExpectedStage).toBe("EXAM");
      expect(result.timelineSummary).toBe(
        "Recruitment workflow timeline is in progress at ADMIT_CARD stage with EXAM expected next"
      );
    });

    test("infers next expected stage from completed stages when no current stage is supplied", () => {
      const result = createRecruitmentWorkflowTimeline({
        recruitmentId: "rec-infer",
        events: [
          { eventType: "NOTIFICATION", status: "COMPLETED", order: 1 },
          { eventType: "APPLICATION", status: "COMPLETED", order: 2 }
        ]
      });

      expect(result.timelineStatus).toBe(TIMELINE_STATUS.IN_PROGRESS);
      expect(result.completedStages).toEqual(["NOTIFICATION", "APPLICATION"]);
      expect(result.currentStage).toBe("APPLICATION");
      expect(result.nextExpectedStage).toBe("CORRECTION");
      expect(result.timelineSummary).toContain("CORRECTION expected next");
    });
  });

  describe("blocked timeline", () => {
    test("marks timeline blocked when a recognized stage is blocked", () => {
      const result = createRecruitmentWorkflowTimeline({
        recruitmentId: "rec-blocked",
        events: [
          { eventType: "NOTIFICATION", status: "COMPLETED", order: 1 },
          { eventType: "APPLICATION", status: "BLOCKED", order: 2 }
        ]
      });

      expect(result.timelineStatus).toBe(TIMELINE_STATUS.BLOCKED);
      expect(result.completedStages).toEqual(["NOTIFICATION"]);
      expect(result.currentStage).toBe("APPLICATION");
      expect(result.nextExpectedStage).toBe("CORRECTION");
      expect(result.timelineSummary).toBe(
        "Recruitment workflow timeline is blocked at APPLICATION stage"
      );
    });

    test("selects the most advanced blocked stage when multiple blocked events exist", () => {
      const result = createRecruitmentWorkflowTimeline({
        recruitmentId: "rec-multi-blocked",
        events: [
          { eventType: "APPLICATION", status: "BLOCKED", order: 2 },
          { eventType: "EXAM", status: "BLOCKED", order: 5 }
        ]
      });

      expect(result.timelineStatus).toBe(TIMELINE_STATUS.BLOCKED);
      expect(result.currentStage).toBe("EXAM");
      expect(result.nextExpectedStage).toBe("ANSWER_KEY");
    });
  });

  describe("stage ordering", () => {
    test("sorts timeline events by order and canonical stage index", () => {
      const result = createRecruitmentWorkflowTimeline({
        recruitmentId: "rec-order",
        events: [
          { eventType: "EXAM", status: "CURRENT", order: 5 },
          { eventType: "NOTIFICATION", status: "COMPLETED", order: 1 },
          { eventType: "APPLICATION", status: "COMPLETED", order: 2 }
        ]
      });

      expect(result.timelineEvents.map((event) => event.eventType)).toEqual([
        "NOTIFICATION",
        "APPLICATION",
        "EXAM"
      ]);
      expect(result.timelineEvents[0].order).toBe(1);
      expect(result.timelineEvents[2].order).toBe(5);
    });

    test("orders completed stages by canonical workflow sequence", () => {
      const result = createRecruitmentWorkflowTimeline({
        recruitmentId: "rec-canonical",
        events: [
          { eventType: "RESULT", status: "COMPLETED", order: 7 },
          { eventType: "NOTIFICATION", status: "COMPLETED", order: 1 },
          { eventType: "EXAM", status: "COMPLETED", order: 5 }
        ]
      });

      expect(result.completedStages).toEqual(["NOTIFICATION", "EXAM", "RESULT"]);
    });
  });

  describe("current stage detection", () => {
    test("detects explicit current stage from lifecycle signals", () => {
      const result = createRecruitmentWorkflowTimeline({
        recruitmentId: "rec-current",
        events: [
          { eventType: "ANSWER_KEY", status: "CURRENT", order: 6 },
          { eventType: "EXAM", status: "COMPLETED", order: 5 }
        ]
      });

      expect(result.currentStage).toBe("ANSWER_KEY");
    });

    test("prefers the most advanced current stage when multiple current events exist", () => {
      const result = createRecruitmentWorkflowTimeline({
        recruitmentId: "rec-multi-current",
        events: [
          { eventType: "APPLICATION", status: "CURRENT", order: 2 },
          { eventType: "EXAM", status: "CURRENT", order: 5 }
        ]
      });

      expect(result.currentStage).toBe("EXAM");
      expect(result.nextExpectedStage).toBe("ANSWER_KEY");
    });
  });

  describe("next stage detection", () => {
    test("resolves next expected stage from current stage in canonical order", () => {
      const result = createRecruitmentWorkflowTimeline({
        recruitmentId: "rec-next",
        events: [{ eventType: "CORRECTION", status: "CURRENT", order: 3 }]
      });

      expect(result.nextExpectedStage).toBe("ADMIT_CARD");
    });

    test("returns null next stage when current stage is FINAL_RESULT", () => {
      const result = createRecruitmentWorkflowTimeline({
        recruitmentId: "rec-final-current",
        events: [{ eventType: "FINAL_RESULT", status: "CURRENT", order: 8 }]
      });

      expect(result.currentStage).toBe("FINAL_RESULT");
      expect(result.nextExpectedStage).toBeNull();
    });
  });

  describe("summary generation", () => {
    test("generates in-progress summary with current and next stages", () => {
      const result = createRecruitmentWorkflowTimeline(buildInProgressInput());

      expect(result.timelineSummary).toContain("in progress");
      expect(result.timelineSummary).toContain("ADMIT_CARD");
      expect(result.timelineSummary).toContain("EXAM");
    });

    test("generates blocked, completed, empty, and unknown summaries", () => {
      const blocked = createRecruitmentWorkflowTimeline({
        recruitmentId: 1,
        events: [{ eventType: "RESULT", status: "BLOCKED", order: 7 }]
      });
      const completed = createRecruitmentWorkflowTimeline({
        recruitmentId: 1,
        events: [{ eventType: "FINAL_RESULT", status: "COMPLETED", order: 8 }]
      });
      const empty = createRecruitmentWorkflowTimeline({ recruitmentId: 1, events: [] });
      const unknown = createRecruitmentWorkflowTimeline(null);

      expect(blocked.timelineSummary).toContain("blocked");
      expect(completed.timelineSummary).toContain("completion");
      expect(empty.timelineSummary).toContain("No recruitment workflow timeline events");
      expect(unknown.timelineSummary).toContain("could not be determined");
    });
  });

  describe("metadata validation", () => {
    test("includes advisory timeline metadata on every result", () => {
      const result = createRecruitmentWorkflowTimeline(buildInProgressInput());

      expect(result.advisoryMetadata.advisoryOnly).toBe(true);
      expect(result.advisoryMetadata.persistent).toBe(false);
      expect(result.advisoryMetadata.generatedBy).toBe("phase_132");
      expect(result.advisoryMetadata.phase).toBe(132);
      expect(result.advisoryMetadata.architectureOnly).toBe(true);
      expect(result.advisoryMetadata.executed).toBe(false);
      expect(result.advisoryMetadata.persistenceEnabled).toBe(false);
      expect(result.advisoryMetadata.timelinePersistence).toBe(false);
      expect(result.advisoryMetadata.eventTracking).toBe(false);
      expect(result.advisoryMetadata.historyTracking).toBe(false);
      expect(result.advisoryMetadata.sideEffects).toBe(false);
      expect(result.advisoryMetadata.mutatesInput).toBe(false);
      expect(result.advisoryMetadata.advisoryTimelineOnly).toBe(true);
    });

    test("exported metadata matches result metadata contract", () => {
      expect(RECRUITMENT_WORKFLOW_TIMELINE_MODEL_METADATA.runtimeIntegration).toBe(false);
      expect(RECRUITMENT_WORKFLOW_TIMELINE_MODEL_METADATA.mutatesProduction).toBe(false);
      expect(RECRUITMENT_WORKFLOW_TIMELINE_MODEL_METADATA.sourcePhases).toContain(131);
    });
  });

  describe("deterministic output", () => {
    test("returns identical timeline for identical input", () => {
      const input = buildInProgressInput();

      const first = createRecruitmentWorkflowTimeline(input);
      const second = createRecruitmentWorkflowTimeline(input);

      expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    });
  });

  describe("deep immutability", () => {
    test("deep freezes timeline output", () => {
      const result = createRecruitmentWorkflowTimeline(buildInProgressInput());

      assertAllFrozen(result);
      expect(() => {
        result.timelineStatus = "CHANGED";
      }).toThrow();
      expect(() => {
        result.timelineEvents.push({});
      }).toThrow();
      expect(() => {
        result.completedStages.push("EXTRA");
      }).toThrow();
      expect(() => {
        result.timelineSummary = "CHANGED";
      }).toThrow();
      expect(() => {
        result.advisoryMetadata.persistent = true;
      }).toThrow();
    });
  });

  describe("input unchanged", () => {
    test("does not mutate timeline input or nested events", () => {
      const input = {
        recruitmentId: "rec-immutable",
        events: [
          { eventType: "NOTIFICATION", status: "COMPLETED", order: 1, timestamp: "2026-01-01" },
          { eventType: "APPLICATION", status: "CURRENT", order: 2 }
        ]
      };

      const before = JSON.stringify(input);
      const eventsBefore = JSON.stringify(input.events);

      createRecruitmentWorkflowTimeline(input);
      createRecruitmentWorkflowTimeline(input);

      expect(JSON.stringify(input)).toBe(before);
      expect(JSON.stringify(input.events)).toBe(eventsBefore);
    });

    test("timeline model does not mutate process environment", () => {
      const envBefore = { ...process.env };
      createRecruitmentWorkflowTimeline(buildInProgressInput());
      expect(process.env).toEqual(envBefore);
    });
  });

  describe("no history storage", () => {
    test("module source declares no persistence, event tracking, or history storage", () => {
      const source = read(MODULE_PATH);

      expect(source).toContain("No database access, no persistence");
      expect(source).toContain("No event tracking");
      expect(source).toContain("timelinePersistence: false");
      expect(source).toContain("eventTracking: false");
      expect(source).toContain("historyTracking: false");
      expect(source).not.toMatch(/INSERT INTO/i);
      expect(source).not.toMatch(/UPDATE\s+/i);
      expect(source).not.toMatch(/saveTimeline/i);
      expect(source).not.toMatch(/persistTimeline/i);
      expect(source).not.toMatch(/trackEvent/i);
      expect(source).not.toMatch(/historyStore/i);
    });
  });

  describe("no runtime wiring", () => {
    test("module source declares pure advisory timeline constraints for phase 132", () => {
      const source = read(MODULE_PATH);

      expect(source).toContain("Phase 132");
      expect(source).toContain("createRecruitmentWorkflowTimeline");
      expect(source).toContain("advisoryTimelineOnly");
      expect(source).toContain("Never mutates input");
      expect(source).not.toMatch(/require\(["']\.\//);
      expect(source).not.toMatch(/require\(["']fs["']\)/);
      expect(source).not.toMatch(/require\(["']express/);
      expect(source).not.toMatch(/require\(["']\.\.\/config\/db/);
      expect(source).not.toMatch(/mysql2/);
    });

    test("timeline model is not wired into recommendation model, intelligence summary, risk assessment, health indicator, evolution analyzer, comparison model, coordinator, gateway, pipeline, worker, orchestrator, trace model, registry, readiness assessment, report generator, snapshot model, or observation registry", () => {
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

      const modules = [
        recommendationSource,
        intelligenceSource,
        riskSource,
        healthSource,
        evolutionSource,
        comparisonSource,
        coordinatorSource,
        gatewaySource,
        pipelineSource,
        workerSource,
        orchestratorSource,
        traceModelSource,
        registrySource,
        readinessSource,
        reportSource,
        observationRegistrySource
      ];

      for (const moduleSource of modules) {
        expect(moduleSource).not.toMatch(/createRecruitmentWorkflowTimeline/);
        expect(moduleSource).not.toMatch(/recruitmentWorkflowTimelineModel/);
      }

      const phase125Block = snapshotSource.slice(snapshotSource.indexOf("Phase 125"));
      expect(phase125Block).not.toMatch(/createRecruitmentWorkflowTimeline/);
      expect(phase125Block).not.toMatch(/recruitmentWorkflowTimelineModel/);

      const phase126Block = comparisonSource.slice(comparisonSource.indexOf("Phase 126"));
      expect(phase126Block).not.toMatch(/createRecruitmentWorkflowTimeline/);
      expect(phase126Block).not.toMatch(/recruitmentWorkflowTimelineModel/);

      const phase127Block = evolutionSource.slice(evolutionSource.indexOf("Phase 127"));
      expect(phase127Block).not.toMatch(/createRecruitmentWorkflowTimeline/);
      expect(phase127Block).not.toMatch(/recruitmentWorkflowTimelineModel/);

      const phase128Block = healthSource.slice(healthSource.indexOf("Phase 128"));
      expect(phase128Block).not.toMatch(/createRecruitmentWorkflowTimeline/);
      expect(phase128Block).not.toMatch(/recruitmentWorkflowTimelineModel/);

      const phase129Block = riskSource.slice(riskSource.indexOf("Phase 129"));
      expect(phase129Block).not.toMatch(/createRecruitmentWorkflowTimeline/);
      expect(phase129Block).not.toMatch(/recruitmentWorkflowTimelineModel/);

      const phase130Block = intelligenceSource.slice(intelligenceSource.indexOf("Phase 130"));
      expect(phase130Block).not.toMatch(/createRecruitmentWorkflowTimeline/);
      expect(phase130Block).not.toMatch(/recruitmentWorkflowTimelineModel/);

      const phase131Block = recommendationSource.slice(recommendationSource.indexOf("Phase 131"));
      expect(phase131Block).not.toMatch(/createRecruitmentWorkflowTimeline/);
      expect(phase131Block).not.toMatch(/recruitmentWorkflowTimelineModel/);
    });

    test("orchestrator behavior remains unchanged and independent from timeline model", () => {
      const orchestration = orchestrateRecruitmentWorkflow({
        recruitmentId: 42,
        eventType: "notification"
      });

      expect(orchestration.workflowState).toBe(RECRUITMENT_WORKFLOW_STATES.DRAFT_CREATED);
      expect(orchestration.advisory).toBe(true);
      expect(orchestration.executed).toBe(false);
      expect(orchestration).not.toHaveProperty("timelineStatus");
      expect(orchestration).not.toHaveProperty("timelineEvents");
      expect(orchestration).not.toHaveProperty("currentStage");
    });
  });
});
